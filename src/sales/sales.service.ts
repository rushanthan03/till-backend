import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Refund, RefundPayment } from '../infrastructure/database/entities/refund.entity';
import { Product } from '../infrastructure/database/entities/product.entity';
import { Shift, ShiftStatus } from '../infrastructure/database/entities/shift.entity';
import { Sale, SaleItem, SalePayment, SalePaymentMethod, SaleStatus } from '../infrastructure/database/entities/sale.entity';
import { CreateSaleDto, ListSalesQueryDto } from './dto/sale.dto';
import { ApprovalsService, APPROVER_ROLES } from '../approvals/approvals.service';
import { UserRole } from '../infrastructure/database/entities';
import { applyPayments, calcLine, formatReceiptNumber, round2, round3, sumLines } from './sale-calculations';

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    private readonly approvals: ApprovalsService,
  ) {}

  /**
   * Completes a sale. Prices, VAT and totals are always recalculated here from
   * the product records, never trusted from the client. Everything runs in one
   * transaction: the sale, its lines and payments, and the stock deduction.
   */
  async create(storeId: string, user: { id?: string; name?: string; role?: UserRole }, dto: CreateSaleDto): Promise<Sale> {
    // Plain lines for the same product are merged so each is checked and deducted once.
    // Lines with a discount or override stay separate: each keeps its own price.
    const plain = new Map<string, number>();
    const lines: { productId: string; quantity: number; discountPercent?: number; priceOverride?: number; reason?: string }[] = [];
    for (const item of dto.items) {
      const adjusted = item.discountPercent !== undefined || item.priceOverride !== undefined;
      if (item.discountPercent !== undefined && item.priceOverride !== undefined) {
        throw new BadRequestException('Use either a discount or a price override on a line, not both');
      }
      if (adjusted && !item.reason?.trim()) throw new BadRequestException('A reason is required for a discount or price override');
      if (adjusted) lines.push({ ...item });
      else plain.set(item.productId, round3((plain.get(item.productId) ?? 0) + item.quantity));
    }
    for (const [productId, quantity] of plain) lines.push({ productId, quantity });
    const productIds = [...new Set(lines.map((l) => l.productId))];

    // Cashiers need a manager's approval for any price change; managers and admins may do it themselves.
    const hasAdjustment = lines.some((l) => l.discountPercent !== undefined || l.priceOverride !== undefined);
    let approver: { approverId: string; approverName: string } | null = null;
    if (hasAdjustment) {
      if (user.role && APPROVER_ROLES.includes(user.role)) {
        approver = { approverId: user.id!, approverName: user.name ?? '' };
      } else {
        if (!dto.approvalToken) throw new ForbiddenException('Manager approval is required for discounts and price overrides');
        approver = await this.approvals.verifyToken(dto.approvalToken, storeId);
      }
    }

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // Sales belong to a till session: the cashier must have opened the till first.
          const shift = await manager.findOne(Shift, { where: { storeId, userId: user.id, status: ShiftStatus.OPEN } });
          if (!shift) throw new ConflictException('Open the till before selling');

          const products = await manager.find(Product, {
            where: { id: In(productIds), storeId },
            lock: { mode: 'pessimistic_write' },
          });
          const byId = new Map(products.map((p) => [p.id, p]));

          const saleItems: SaleItem[] = [];
          const amounts = [];
          let needsAgeCheck = false;

          let discountTotal = 0;
          for (const { productId, quantity, discountPercent, priceOverride, reason } of lines) {
            const product = byId.get(productId);
            if (!product) throw new BadRequestException(`Product ${productId} does not exist in this store`);
            if (!product.isActive) throw new BadRequestException(`${product.name} is archived and cannot be sold`);
            if (product.unitType === 'each' && !Number.isInteger(quantity)) {
              throw new BadRequestException(`${product.name} must be sold in whole units`);
            }
            if (product.ageRestriction > 0) needsAgeCheck = true;

            let unitPrice = product.price;
            if (discountPercent !== undefined) unitPrice = round2(product.price * (1 - discountPercent / 100));
            if (priceOverride !== undefined) unitPrice = round2(priceOverride);
            if (unitPrice > product.price) throw new BadRequestException(`${product.name}: a price override cannot be higher than the shelf price`);

            const a = calcLine(unitPrice, quantity, product.vatRate);
            const adjusted = unitPrice !== product.price;
            if (adjusted) discountTotal = round2(discountTotal + calcLine(product.price, quantity, product.vatRate).lineTotal - a.lineTotal);
            amounts.push(a);
            saleItems.push(
              manager.create(SaleItem, {
                productId: product.id,
                name: product.name,
                barcode: product.barcode,
                quantity,
                unitPrice,
                originalUnitPrice: adjusted ? product.price : null,
                adjustmentReason: adjusted ? reason!.trim() : null,
                vatRate: product.vatRate,
                lineTotal: a.lineTotal,
                vatAmount: a.vatAmount,
                ageRestriction: product.ageRestriction,
              }),
            );
            // Stock may go negative (flagged later as an exception) so a busy till is never blocked.
            product.stockQuantity = round3(product.stockQuantity - quantity);
          }

          if (needsAgeCheck && !dto.ageVerified) {
            throw new BadRequestException('Age verification is required for age-restricted items in this sale');
          }

          const totals = sumLines(amounts);
          const { applied, changeDue } = applyPayments(totals.total, dto.payments);

          await manager.save(Product, products);

          const last = await manager
            .createQueryBuilder(Sale, 's')
            .select('COALESCE(MAX(s.receiptSeq), 0)', 'max')
            .where('s.storeId = :storeId', { storeId })
            .getRawOne();
          const receiptSeq = Number(last?.max ?? 0) + 1;

          const sale = manager.create(Sale, {
            storeId,
            receiptSeq,
            receiptNumber: formatReceiptNumber(receiptSeq),
            cashierId: user.id ?? null,
            cashierName: user.name ?? null,
            shiftId: shift.id,
            status: SaleStatus.COMPLETED,
            total: totals.total,
            netTotal: totals.netTotal,
            vatTotal: totals.vatTotal,
            changeDue,
            discountTotal,
            approvedById: discountTotal > 0 ? approver?.approverId ?? null : null,
            approvedByName: discountTotal > 0 ? approver?.approverName ?? null : null,
            itemCount: saleItems.reduce((n, i) => n + (Number.isInteger(i.quantity) ? i.quantity : 1), 0),
            ageVerified: !!dto.ageVerified,
            items: saleItems,
            payments: applied.map((p) =>
              manager.create(SalePayment, {
                method: p.method as SalePaymentMethod,
                amount: p.amount,
                tendered: p.tendered,
                reference: p.reference,
              }),
            ),
          });
          return manager.save(Sale, sale);
        });
      } catch (error: any) {
        // Two tills finishing at the same moment can pick the same receipt number; retry picks the next one.
        const isReceiptClash = error?.code === '23505' && String(error?.detail ?? '').includes('receiptSeq');
        if (isReceiptClash && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  async findAll(storeId: string, query: ListSalesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const qb = this.saleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.payments', 'payments')
      .where('s.storeId = :storeId', { storeId });
    if (query.receiptNumber?.trim()) qb.andWhere('s.receiptNumber ILIKE :rn', { rn: `%${query.receiptNumber.trim()}%` });
    if (query.shiftId) qb.andWhere('s.shiftId = :shiftId', { shiftId: query.shiftId });
    if (query.cashier?.trim()) qb.andWhere('s.cashierName ILIKE :cashier', { cashier: `%${query.cashier.trim()}%` });
    if (query.status) qb.andWhere('s.status = :status', { status: query.status });
    if (query.method) {
      // sales that include at least one payment of this method (split payments match both)
      qb.andWhere('EXISTS (SELECT 1 FROM sale_payments sp WHERE sp."saleId" = s.id AND sp.method = :method)', { method: query.method });
    }
    if (query.from) qb.andWhere('s.createdAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('s.createdAt <= :to', { to: new Date(query.to) });
    const [data, total] = await qb
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** A sale with its lines, payments and every refund made against it. */
  async findOne(id: string, storeId: string): Promise<Sale & { refunds: Refund[] }> {
    const sale = await this.saleRepository.findOne({ where: { id, storeId }, relations: ['items', 'payments'] });
    if (!sale) throw new NotFoundException('Sale not found');
    const refunds = await this.dataSource.getRepository(Refund).find({
      where: { saleId: sale.id, storeId },
      relations: ['items', 'payments'],
      order: { createdAt: 'ASC' },
    });
    return Object.assign(sale, { refunds });
  }

  /**
   * Totals for a period (defaults to today). Same definitions as the X report:
   * gross = everything sold, net = gross minus refunds. Voided sales are left out;
   * sales that were later refunded still count in gross (the refund is shown separately).
   */
  async summary(storeId: string, from?: string, to?: string, shiftId?: string) {
    const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = to ? new Date(to) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('from/to must be valid dates');
    const params = { storeId, voided: SaleStatus.VOIDED, start, end, shiftId };
    // With a shift id the figures describe exactly that till session (the period is then ignored).
    const salesWhere = shiftId
      ? 's.storeId = :storeId AND s.status != :voided AND s.shiftId = :shiftId'
      : 's.storeId = :storeId AND s.status != :voided AND s.createdAt BETWEEN :start AND :end';
    const refundWhere = shiftId
      ? 'r.storeId = :storeId AND r.shiftId = :shiftId'
      : 'r.storeId = :storeId AND r.createdAt BETWEEN :start AND :end';

    const sales = await this.dataSource.createQueryBuilder().select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.total), 0)', 'gross').addSelect('COALESCE(SUM(s.vatTotal), 0)', 'vat')
      .from(Sale, 's').where(salesWhere, params).getRawOne();
    const salePay = await this.dataSource.createQueryBuilder().select('p.method', 'method')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount').from(SalePayment, 'p')
      .innerJoin(Sale, 's', 's.id = p.saleId').where(salesWhere, params).groupBy('p.method').getRawMany();
    const refunds = await this.dataSource.createQueryBuilder().select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.total), 0)', 'total').addSelect('COALESCE(SUM(r.vatTotal), 0)', 'vat')
      .from(Refund, 'r').where(refundWhere, params).getRawOne();
    const refundPay = await this.dataSource.createQueryBuilder().select('rp.method', 'method')
      .addSelect('COALESCE(SUM(rp.amount), 0)', 'amount').from(RefundPayment, 'rp')
      .innerJoin(Refund, 'r', 'r.id = rp.refundId').where(refundWhere, params).groupBy('rp.method').getRawMany();

    const by = (rows: any[], m: string) => round2(Number(rows.find((r) => r.method === m)?.amount ?? 0));
    const gross = round2(Number(sales.gross));
    const refundsTotal = round2(Number(refunds.total));
    return {
      from: start,
      to: end,
      transactions: Number(sales.count),
      refundCount: Number(refunds.count),
      grossSales: gross,
      refundsTotal,
      netSales: round2(gross - refundsTotal),
      vat: round2(Number(sales.vat) - Number(refunds.vat)),
      cashSales: by(salePay, 'cash'),
      cardSales: by(salePay, 'card'),
      cashRefunds: by(refundPay, 'cash'),
      cardRefunds: by(refundPay, 'card'),
    };
  }
}
