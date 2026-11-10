import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Product } from '../infrastructure/database/entities/product.entity';
import { Sale, SaleItem, SalePayment, SaleStatus } from '../infrastructure/database/entities/sale.entity';
import { Shift, ShiftStatus } from '../infrastructure/database/entities/shift.entity';
import { Refund, RefundDisposition, RefundItem, RefundPayment } from '../infrastructure/database/entities/refund.entity';
import { round2, round3 } from '../sales/sale-calculations';
import { allocateRefundPayments, calcRefundLines, formatRefundNumber, sumRefund } from './refund-calculations';
import { CreateRefundDto } from './dto/refund.dto';

@Injectable()
export class RefundsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Refund) private readonly refundRepository: Repository<Refund>,
  ) {}

  /**
   * Refunds part or all of a sale. Everything happens in one transaction with the sale row
   * locked, so two tills can never refund the same item twice.
   */
  async create(storeId: string, user: { id?: string; name?: string }, dto: CreateRefundDto): Promise<Refund> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const shift = await manager.findOne(Shift, { where: { storeId, userId: user.id, status: ShiftStatus.OPEN } });
          if (!shift) throw new ConflictException('Open the till before processing a refund');

          const sale = await manager.findOne(Sale, { where: { id: dto.saleId, storeId }, lock: { mode: 'pessimistic_write' } });
          if (!sale) throw new NotFoundException('Sale not found');
          if (sale.status === SaleStatus.VOIDED) throw new BadRequestException('A voided sale cannot be refunded');

          const items = await manager.find(SaleItem, { where: { saleId: sale.id }, lock: { mode: 'pessimistic_write' } });
          const lines = calcRefundLines(items, dto.items);
          const totals = sumRefund(lines);

          // How much each method can still give back on this sale.
          const paid = await manager.find(SalePayment, { where: { saleId: sale.id } });
          const alreadyRefunded = await manager
            .createQueryBuilder(RefundPayment, 'rp')
            .innerJoin(Refund, 'r', 'r.id = rp.refundId')
            .select('rp.method', 'method')
            .addSelect('COALESCE(SUM(rp.amount), 0)', 'amount')
            .where('r.saleId = :saleId', { saleId: sale.id })
            .groupBy('rp.method')
            .getRawMany();
          const sumBy = (m: string, rows: { method: string; amount: number | string }[]) =>
            round2(rows.filter((r) => r.method === m).reduce((a, r) => a + Number(r.amount), 0));
          const capacity = {
            cash: round2(sumBy('cash', paid) - sumBy('cash', alreadyRefunded)),
            card: round2(sumBy('card', paid) - sumBy('card', alreadyRefunded)),
          };
          const payments = allocateRefundPayments(totals.total, dto.payments, capacity);

          // Update the sale lines + put goods back on the shelf where the cashier said so.
          const dispositionById = new Map(dto.items.map((i) => [i.saleItemId, i.disposition]));
          const restockQty = new Map<string, number>();
          for (const line of lines) {
            const item = items.find((i) => i.id === line.saleItemId)!;
            item.refundedQuantity = round3(item.refundedQuantity + line.quantity);
            item.refundedAmount = round2(item.refundedAmount + line.lineTotal);
            item.refundedVat = round2(item.refundedVat + line.vatAmount);
            if (dispositionById.get(item.id) === RefundDisposition.RESTOCK && item.productId) {
              restockQty.set(item.productId, round3((restockQty.get(item.productId) ?? 0) + line.quantity));
            }
          }
          await manager.save(SaleItem, items);

          if (restockQty.size) {
            const products = await manager.find(Product, { where: { id: In([...restockQty.keys()]), storeId }, lock: { mode: 'pessimistic_write' } });
            products.forEach((p) => (p.stockQuantity = round3(p.stockQuantity + (restockQty.get(p.id) ?? 0))));
            await manager.save(Product, products);
          }

          sale.refundedTotal = round2(sale.refundedTotal + totals.total);
          sale.status = items.every((i) => i.refundedQuantity >= i.quantity) ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED;
          await manager.save(Sale, sale);

          const last = await manager
            .createQueryBuilder(Refund, 'r')
            .select('COALESCE(MAX(r.refundSeq), 0)', 'max')
            .where('r.storeId = :storeId', { storeId })
            .getRawOne();
          const refundSeq = Number(last?.max ?? 0) + 1;

          const refund = manager.create(Refund, {
            storeId,
            refundSeq,
            refundNumber: formatRefundNumber(refundSeq),
            saleId: sale.id,
            originalReceiptNumber: sale.receiptNumber,
            shiftId: shift.id,
            processedById: user.id ?? null,
            processedByName: user.name ?? null,
            reason: dto.reason,
            note: dto.note?.trim() || null,
            total: totals.total,
            vatTotal: totals.vatTotal,
            items: lines.map((l) => {
              const item = items.find((i) => i.id === l.saleItemId)!;
              return manager.create(RefundItem, {
                saleItemId: item.id,
                productId: item.productId,
                name: item.name,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
                vatAmount: l.vatAmount,
                disposition: dispositionById.get(item.id)!,
              });
            }),
            payments: payments.map((p) => manager.create(RefundPayment, { method: p.method as any, amount: p.amount, reference: p.reference ?? null })),
          });
          return manager.save(Refund, refund);
        });
      } catch (error: any) {
        const isNumberClash = error?.code === '23505' && String(error?.detail ?? '').includes('refundSeq');
        if (isNumberClash && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  async findAll(storeId: string, page = 1, limit = 25) {
    const [data, total] = await this.refundRepository.findAndCount({
      where: { storeId },
      relations: ['payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, storeId: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({ where: { id, storeId }, relations: ['items', 'payments'] });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }
}
