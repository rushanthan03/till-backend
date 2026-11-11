import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Shift, ShiftStatus } from '../infrastructure/database/entities/shift.entity';
import { Sale, SalePayment, SaleStatus } from '../infrastructure/database/entities/sale.entity';
import { CashMovement, CashMovementType } from '../infrastructure/database/entities/cash-movement.entity';
import { UserRole } from '../infrastructure/database/entities';
import { ApprovalsService, APPROVER_ROLES } from '../approvals/approvals.service';
import { Refund, RefundPayment } from '../infrastructure/database/entities/refund.entity';
import { round2 } from '../sales/sale-calculations';
import { cashVariance, expectedCash, varianceNeedsNote, VARIANCE_NOTE_THRESHOLD } from './shift-calculations';
import { CashMovementDto, CloseShiftDto, ListShiftsQueryDto, OpenShiftDto } from './dto/shift.dto';

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
  paidIn: number;
  paidOut: number;
  safeDrops: number;
  noSales: number;
  /** Loyalty points spent: a discount, so already out of grossSales. */
  pointsDiscount: number;
  pointsRedeemed: number;
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Shift) private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(CashMovement) private readonly movementRepository: Repository<CashMovement>,
    private readonly approvals: ApprovalsService,
  ) {}

  findOpen(storeId: string, userId: string): Promise<Shift | null> {
    return this.shiftRepository.findOne({ where: { storeId, userId, status: ShiftStatus.OPEN } });
  }

  async open(storeId: string, user: { id: string; name: string }, dto: OpenShiftDto): Promise<Shift> {
    if (await this.findOpen(storeId, user.id)) {
      throw new ConflictException('You already have an open till session');
    }
    try {
      return await this.shiftRepository.save(
        this.shiftRepository.create({
          storeId,
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

  async requireOpen(storeId: string, userId: string): Promise<Shift> {
    const shift = await this.findOpen(storeId, userId);
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
      .addSelect('COALESCE(SUM(s.pointsDiscount), 0)', 'pointsDiscount')
      .addSelect('COALESCE(SUM(s.pointsRedeemed), 0)', 'pointsRedeemed')
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
    const moves = await this.dataSource
      .createQueryBuilder()
      .select('m.type', 'type')
      .addSelect('COALESCE(SUM(m.amount), 0)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .from(CashMovement, 'm')
      .where('m.shiftId = :shiftId', { shiftId })
      .groupBy('m.type')
      .getRawMany();
    const move = (t: CashMovementType) => round2(Number(moves.find((r) => r.type === t)?.amount ?? 0));
    const by = (rows: any[], m: string) => round2(Number(rows.find((r) => r.method === m)?.amount ?? 0));
    return {
      paidIn: move(CashMovementType.PAID_IN),
      paidOut: move(CashMovementType.PAID_OUT),
      safeDrops: move(CashMovementType.SAFE_DROP),
      noSales: Number(moves.find((r) => r.type === CashMovementType.NO_SALE)?.count ?? 0),
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
      pointsDiscount: round2(Number(sales.pointsDiscount)),
      pointsRedeemed: Number(sales.pointsRedeemed),
    };
  }

  /**
   * Records cash going in or out of the drawer, or a no-sale drawer opening. Paid-outs need a manager's
   * approval from a cashier; money leaving the drawer can never exceed the cash that should be in it.
   */
  async addMovement(storeId: string, user: { id: string; name: string; role?: UserRole }, dto: CashMovementDto): Promise<CashMovement> {
    const shift = await this.requireOpen(storeId, user.id);
    const isNoSale = dto.type === CashMovementType.NO_SALE;
    const amount = isNoSale ? 0 : dto.amount;
    if (!isNoSale && !amount) throw new BadRequestException('An amount is required');
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('A reason is required');

    let approver: { approverId: string; approverName: string } | null = null;
    if (dto.type === CashMovementType.PAID_OUT) {
      if (user.role && APPROVER_ROLES.includes(user.role)) approver = { approverId: user.id, approverName: user.name };
      else {
        if (!dto.approvalToken) throw new ForbiddenException('Manager approval is required for a paid out');
        approver = await this.approvals.verifyToken(dto.approvalToken, storeId);
      }
    }

    if (dto.type === CashMovementType.PAID_OUT || dto.type === CashMovementType.SAFE_DROP) {
      const t = await this.totals(shift.id);
      const inDrawer = expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds, t);
      if (amount! > inDrawer) throw new BadRequestException(`Only ${inDrawer.toFixed(2)} should be in the drawer`);
    }

    return this.movementRepository.save(
      this.movementRepository.create({
        storeId,
        shiftId: shift.id,
        userId: user.id,
        userName: user.name,
        type: dto.type,
        amount: amount ?? 0,
        reason,
        approvedById: approver?.approverId ?? null,
        approvedByName: approver?.approverName ?? null,
      }),
    );
  }

  movements(shiftId: string, storeId: string): Promise<CashMovement[]> {
    return this.movementRepository.find({ where: { shiftId, storeId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Day end report: every till session opened on the trading day, with combined totals,
   * cash movements and discounts. Open sessions are included live and flagged.
   */
  async dayReport(storeId: string, date?: string) {
    const day = date ? new Date(`${date}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
    if (Number.isNaN(day.getTime())) throw new BadRequestException('date must be YYYY-MM-DD');
    const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const shifts = await this.shiftRepository
      .createQueryBuilder('s')
      .where('s.storeId = :storeId AND s.openedAt >= :day AND s.openedAt < :next', { storeId, day, next })
      .orderBy('s.openedAt', 'ASC')
      .getMany();

    const rows = [];
    const sum = {
      transactions: 0, refundCount: 0, grossSales: 0, refundsTotal: 0, netSales: 0, vat: 0, cashSales: 0, cardSales: 0,
      cashRefunds: 0, cardRefunds: 0, paidIn: 0, paidOut: 0, safeDrops: 0, noSales: 0, expectedCash: 0, countedCash: 0, variance: 0, pointsDiscount: 0, pointsRedeemed: 0,
    };
    for (const sh of shifts) {
      const d: any = await this.detail(sh.id, storeId);
      rows.push({
        id: sh.id, cashierName: sh.cashierName, status: sh.status, openedAt: sh.openedAt, closedAt: sh.closedAt,
        netSales: d.netSales, expectedCash: d.expectedCash, countedCash: sh.countedCash, variance: sh.variance,
      });
      for (const k of ['transactions', 'refundCount', 'grossSales', 'refundsTotal', 'netSales', 'vat', 'cashSales', 'cardSales', 'cashRefunds', 'cardRefunds', 'paidIn', 'paidOut', 'safeDrops', 'noSales', 'expectedCash', 'pointsDiscount', 'pointsRedeemed'] as const) {
        sum[k] = round2(sum[k] + Number(d[k] ?? 0));
      }
      sum.countedCash = round2(sum.countedCash + (sh.countedCash ?? 0));
      sum.variance = round2(sum.variance + (sh.variance ?? 0));
    }
    const disc = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(s.discountTotal), 0)', 'discounts')
      .from(Sale, 's')
      // discounts of the sessions in this report, so the figures always agree with the session rows
      .where('s.storeId = :storeId AND s.status != :voided AND s.shiftId IN (:...ids)', { storeId, voided: SaleStatus.VOIDED, ids: shifts.length ? shifts.map((x) => x.id) : [null] })
      .getRawOne();
    return {
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      sessions: rows.length,
      openSessions: rows.filter((r) => r.status === ShiftStatus.OPEN).length,
      discountTotal: round2(Number(disc.discounts)),
      totals: sum,
      shifts: rows,
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
      expectedCash: expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds, t),
      varianceNoteThreshold: VARIANCE_NOTE_THRESHOLD,
    };
  }

  /**
   * Step 2 of cash-up. The cashier counts first (blind), and only then sees what was expected
   * and the difference. Nothing is saved here.
   */
  async previewClose(shift: Shift, countedCash: number) {
    const t = await this.totals(shift.id);
    const expected = expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds, t);
    const variance = cashVariance(countedCash, expected);
    return { countedCash, expectedCash: expected, variance, requiresNote: varianceNeedsNote(variance) };
  }

  async close(storeId: string, userId: string, dto: CloseShiftDto): Promise<Shift> {
    return this.dataSource.transaction(async (manager) => {
      const shift = await manager.findOne(Shift, {
        where: { storeId, userId, status: ShiftStatus.OPEN },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('No open till session to close');

      const t = await this.totals(shift.id);
      const expected = expectedCash(shift.openingFloat, t.cashSales, t.cashRefunds, t);
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
        paidIn: t.paidIn,
        paidOut: t.paidOut,
        safeDrops: t.safeDrops,
        noSaleCount: t.noSales,
      });
      return manager.save(Shift, shift);
    });
  }

  /** Shared by the list and the summary so the tiles always match the table. */
  private filtered(qb: SelectQueryBuilder<Shift>, storeId: string, q: ListShiftsQueryDto) {
    qb.where('s.storeId = :storeId', { storeId });
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.cashier?.trim()) qb.andWhere('s.cashierName ILIKE :cashier', { cashier: `%${q.cashier.trim()}%` });
    if (q.from) qb.andWhere('s.openedAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('s.openedAt <= :to', { to: new Date(q.to) });
    if (q.differenceOnly) qb.andWhere("s.status = 'closed' AND s.variance <> 0");
    return qb;
  }

  async list(storeId: string, q: ListShiftsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [data, total] = await this.filtered(this.shiftRepository.createQueryBuilder('s'), storeId, q)
      .orderBy('s.openedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Headline numbers for the filtered sessions. Money figures use closed sessions only (open ones are still moving). */
  async summary(storeId: string, q: ListShiftsQueryDto) {
    const row = await this.filtered(this.shiftRepository.createQueryBuilder('s'), storeId, q)
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
  async detail(id: string, storeId: string) {
    const shift = await this.findOne(id, storeId);
    if (shift.status === ShiftStatus.OPEN) return this.xReport(shift);
    const gross = shift.grossSales ?? 0;
    const refunds = shift.refundsTotal ?? 0;
    const pts = await this.dataSource.createQueryBuilder()
      .select('COALESCE(SUM(s.pointsDiscount), 0)', 'value').addSelect('COALESCE(SUM(s.pointsRedeemed), 0)', 'points')
      .from(Sale, 's').where('s.shiftId = :id AND s.status != :voided', { id: shift.id, voided: SaleStatus.VOIDED }).getRawOne();
    return {
      shift,
      pointsDiscount: round2(Number(pts?.value ?? 0)),
      pointsRedeemed: Number(pts?.points ?? 0),
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
      paidIn: shift.paidIn ?? 0,
      paidOut: shift.paidOut ?? 0,
      safeDrops: shift.safeDrops ?? 0,
      noSales: shift.noSaleCount ?? 0,
      expectedCash: shift.expectedCash ?? 0,
      varianceNoteThreshold: VARIANCE_NOTE_THRESHOLD,
    };
  }

  async findOne(id: string, storeId: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({ where: { id, storeId } });
    if (!shift) throw new NotFoundException('Till session not found');
    return shift;
  }
}
