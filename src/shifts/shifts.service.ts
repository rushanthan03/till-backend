import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Shift, ShiftStatus } from '../infrastructure/database/entities/shift.entity';
import { Sale, SalePayment, SaleStatus } from '../infrastructure/database/entities/sale.entity';
import { Refund, RefundPayment } from '../infrastructure/database/entities/refund.entity';
import { round2 } from '../sales/sale-calculations';
import { cashVariance, expectedCash, varianceNeedsNote, VARIANCE_NOTE_THRESHOLD } from './shift-calculations';
import { CloseShiftDto, ListShiftsQueryDto, OpenShiftDto } from './dto/shift.dto';

export interface ShiftTotals {
  transactions: number;
  refundCount: number;
  grossSales: number;
  vatSales: number;
  cashSales: number;
  cardSales: number;
  refundsTotal: number;
  refundsVat: number;
  cashRefunds: number;
  cardRefunds: number;
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Shift) private readonly shiftRepository: Repository<Shift>,
  ) {}

  findOpen(restaurantId: string, userId: string): Promise<Shift | null> {
    return this.shiftRepository.findOne({ where: { restaurantId, userId, status: ShiftStatus.OPEN } });
  }

  async open(restaurantId: string, user: { id: string; name: string }, dto: OpenShiftDto): Promise<Shift> {
    if (await this.findOpen(restaurantId, user.id)) {
      throw new ConflictException('You already have an open till session');
    }
    try {
      return await this.shiftRepository.save(
        this.shiftRepository.create({
          restaurantId,
          userId: user.id,
          cashierName: user.name,
          openingFloat: dto.openingFloat,
          openingNote: dto.note ?? null,
          status: ShiftStatus.OPEN,
        }),
      );
    } catch (error: any) {
      // Two tabs opening at the same instant: the unique index lets only one win.
      if (error?.code === '23505') throw new ConflictException('You already have an open till session');
      throw error;
    }
  }

  async requireOpen(restaurantId: string, userId: string): Promise<Shift> {
    const shift = await this.findOpen(restaurantId, userId);
    if (!shift) throw new NotFoundException('No open till session. Open the till first.');
    return shift;
  }

  /** Live figures for a shift, calculated from its sales and refunds. */
  async totals(shiftId: string): Promise<ShiftTotals> {
    const notVoided = { shiftId, voided: SaleStatus.VOIDED };
    const sales = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.total), 0)', 'gross')
      .addSelect('COALESCE(SUM(s.vatTotal), 0)', 'vat')
      .from(Sale, 's')
      .where('s.shiftId = :shiftId AND s.status != :voided', notVoided)
      .getRawOne();
    const salePay = await this.dataSource
      .createQueryBuilder()
      .select('p.method', 'method')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
      .from(SalePayment, 'p')
      .innerJoin(Sale, 's', 's.id = p.saleId')
      .where('s.shiftId = :shiftId AND s.status != :voided', notVoided)
      .groupBy('p.method')
      .getRawMany();
    const refunds = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.total), 0)', 'total')
      .addSelect('COALESCE(SUM(r.vatTotal), 0)', 'vat')
      .from(Refund, 'r')
      .where('r.shiftId = :shiftId', { shiftId })
      .getRawOne();
    const refundPay = await this.dataSource
      .createQueryBuilder()
      .select('rp.method', 'method')
      .addSelect('COALESCE(SUM(rp.amount), 0)', 'amount')
      .from(RefundPayment, 'rp')
      .innerJoin(Refund, 'r', 'r.id = rp.refundId')
      .where('r.shiftId = :shiftId', { shiftId })
      .groupBy('rp.method')
      .getRawMany();
    const by = (rows: any[], m: string) => round2(Number(rows.find((r) => r.method === m)?.amount ?? 0));
    return {
      transactions: Number(sales.count),
      refundCount: Number(refunds.count),
      grossSales: round2(Number(sales.gross)),
      vatSales: round2(Number(sales.vat)),
      cashSales: by(salePay, 'cash'),
      cardSales: by(salePay, 'card'),
      refundsTotal: round2(Number(refunds.total)),
      refundsVat: round2(Number(refunds.vat)),
      cashRefunds: by(refundPay, 'cash'),
      cardRefunds: by(refundPay, 'card'),
    };
  }

  /** X report: a read-only look at the running totals. Does not close anything. */
  async xReport(shift: Shift) {
    const t = await this.totals(shift.id);
    return {
      shift,
      ...t,
      netSales: round2(t.grossSales - t.refundsTotal),
      vat: round2(t.vatSales - t.refundsVat),
      expectedCash: expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds),
      varianceNoteThreshold: VARIANCE_NOTE_THRESHOLD,
    };
  }

  /**
   * Step 2 of cash-up. The cashier counts first (blind), and only then sees what was expected
   * and the difference. Nothing is saved here.
   */
  async previewClose(shift: Shift, countedCash: number) {
    const t = await this.totals(shift.id);
    const expected = expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds);
    const variance = cashVariance(countedCash, expected);
    return { countedCash, expectedCash: expected, variance, requiresNote: varianceNeedsNote(variance) };
  }

  async close(restaurantId: string, userId: string, dto: CloseShiftDto): Promise<Shift> {
    return this.dataSource.transaction(async (manager) => {
      const shift = await manager.findOne(Shift, {
        where: { restaurantId, userId, status: ShiftStatus.OPEN },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('No open till session to close');

      const t = await this.totals(shift.id);
      const expected = expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds);
      const variance = cashVariance(dto.countedCash, expected);
      if (varianceNeedsNote(variance) && !dto.note?.trim()) {
        throw new BadRequestException('The cash difference is over the allowed limit: a reason is required to close the till');
      }

      Object.assign(shift, {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        countedCash: dto.countedCash,
        expectedCash: expected,
        variance,
        closeNote: dto.note?.trim() || null,
        transactionCount: t.transactions,
        refundCount: t.refundCount,
        grossSales: t.grossSales,
        vatTotal: round2(t.vatSales - t.refundsVat),
        cashSales: t.cashSales,
        cardSales: t.cardSales,
        refundsTotal: t.refundsTotal,
        cashRefunds: t.cashRefunds,
        cardRefunds: t.cardRefunds,
      });
      return manager.save(Shift, shift);
    });
  }

  /** Shared by the list and the summary so the tiles always match the table. */
  private filtered(qb: SelectQueryBuilder<Shift>, restaurantId: string, q: ListShiftsQueryDto) {
    qb.where('s.restaurantId = :restaurantId', { restaurantId });
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.cashier?.trim()) qb.andWhere('s.cashierName ILIKE :cashier', { cashier: `%${q.cashier.trim()}%` });
    if (q.from) qb.andWhere('s.openedAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('s.openedAt <= :to', { to: new Date(q.to) });
    if (q.differenceOnly) qb.andWhere("s.status = 'closed' AND s.variance <> 0");
    return qb;
  }

  async list(restaurantId: string, q: ListShiftsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [data, total] = await this.filtered(this.shiftRepository.createQueryBuilder('s'), restaurantId, q)
      .orderBy('s.openedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Headline numbers for the filtered sessions. Money figures use closed sessions only (open ones are still moving). */
  async summary(restaurantId: string, q: ListShiftsQueryDto) {
    const row = await this.filtered(this.shiftRepository.createQueryBuilder('s'), restaurantId, q)
      .select('COUNT(*)', 'sessions')
      .addSelect("COUNT(*) FILTER (WHERE s.status = 'open')", 'open')
      .addSelect("COUNT(*) FILTER (WHERE s.status = 'closed')", 'closed')
      .addSelect("COALESCE(SUM(s.grossSales - s.refundsTotal) FILTER (WHERE s.status = 'closed'), 0)", 'net')
      .addSelect("COALESCE(SUM(s.variance) FILTER (WHERE s.status = 'closed'), 0)", 'variance')
      .addSelect("COUNT(*) FILTER (WHERE s.status = 'closed' AND s.variance < 0)", 'short')
      .addSelect("COUNT(*) FILTER (WHERE s.status = 'closed' AND s.variance > 0)", 'over')
      .addSelect("COUNT(*) FILTER (WHERE s.status = 'closed' AND s.variance = 0)", 'balanced')
      .addSelect("COALESCE(SUM(s.variance) FILTER (WHERE s.status = 'closed' AND s.variance < 0), 0)", 'shortTotal')
      .addSelect("COALESCE(SUM(s.variance) FILTER (WHERE s.status = 'closed' AND s.variance > 0), 0)", 'overTotal')
      .getRawOne();
    return {
      sessions: Number(row.sessions),
      openSessions: Number(row.open),
      closedSessions: Number(row.closed),
      netSales: round2(Number(row.net)),
      netDifference: round2(Number(row.variance)),
      shortCount: Number(row.short),
      overCount: Number(row.over),
      balancedCount: Number(row.balanced),
      shortTotal: round2(Number(row.shortTotal)),
      overTotal: round2(Number(row.overTotal)),
    };
  }

  /**
   * One session with its figures: live for an open session, the saved Z report for a closed one
   * (closed figures never change, even if sales are later edited).
   */
  async detail(id: string, restaurantId: string) {
    const shift = await this.findOne(id, restaurantId);
    if (shift.status === ShiftStatus.OPEN) return this.xReport(shift);
    const gross = shift.grossSales ?? 0;
    const refunds = shift.refundsTotal ?? 0;
    return {
      shift,
      transactions: shift.transactionCount ?? 0,
      refundCount: shift.refundCount ?? 0,
      grossSales: gross,
      refundsTotal: refunds,
      netSales: round2(gross - refunds),
      vat: shift.vatTotal ?? 0,
      cashSales: shift.cashSales ?? 0,
      cardSales: shift.cardSales ?? 0,
      cashRefunds: shift.cashRefunds ?? 0,
      cardRefunds: shift.cardRefunds ?? 0,
      expectedCash: shift.expectedCash ?? 0,
      varianceNoteThreshold: VARIANCE_NOTE_THRESHOLD,
    };
  }

  async findOne(id: string, restaurantId: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({ where: { id, restaurantId } });
    if (!shift) throw new NotFoundException('Till session not found');
    return shift;
  }
}
