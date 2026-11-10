import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeEntry } from '../infrastructure/database/entities/time-entry.entity';
import { Shift, ShiftStatus } from '../infrastructure/database/entities/shift.entity';
import { AttendanceQueryDto } from './dto/attendance.dto';

/** Someone still "on the clock" after this long has almost certainly forgotten to clock out. */
export const MAX_SHIFT_HOURS = 16;
const HOUR = 60 * 60 * 1000;

export const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(TimeEntry) private readonly entries: Repository<TimeEntry>,
    @InjectRepository(Shift) private readonly shifts: Repository<Shift>,
  ) {}

  status(storeId: string, userId: string) {
    return this.entries.findOne({ where: { storeId, userId, clockedOutAt: null as any }, order: { clockedInAt: 'DESC' } });
  }

  /** Clock in. Safe to call twice: someone already on the clock just gets their current entry back. */
  async clockIn(storeId: string, user: { id: string; name: string }): Promise<TimeEntry> {
    const open = await this.status(storeId, user.id);
    if (open) {
      if (Date.now() - open.clockedInAt.getTime() <= MAX_SHIFT_HOURS * HOUR) return open;
      // forgot to clock out yesterday: close that entry at the limit and start a new one
      open.clockedOutAt = new Date(open.clockedInAt.getTime() + MAX_SHIFT_HOURS * HOUR);
      open.note = `Auto-closed after ${MAX_SHIFT_HOURS} hours`;
      await this.entries.save(open);
    }
    return this.entries.save(this.entries.create({ storeId, userId: user.id, userName: user.name, clockedInAt: new Date(), clockedOutAt: null }));
  }

  async clockOut(storeId: string, userId: string): Promise<TimeEntry> {
    const open = await this.status(storeId, userId);
    if (!open) throw new NotFoundException('You are not clocked in');
    if (await this.shifts.findOne({ where: { storeId, userId, status: ShiftStatus.OPEN } })) {
      throw new ConflictException('Close your till before clocking out');
    }
    open.clockedOutAt = new Date();
    return this.entries.save(open);
  }

  /** Hours worked per person and every entry, for managers. Entries still open count up to now. */
  async report(storeId: string, q: AttendanceQueryDto) {
    const from = q.from ? new Date(q.from) : new Date(new Date().setHours(0, 0, 0, 0) - 6 * 24 * HOUR);
    const to = q.to ? new Date(q.to) : new Date();
    const qb = this.entries.createQueryBuilder('e').where('e.storeId = :storeId AND e.clockedInAt BETWEEN :from AND :to', { storeId, from, to });
    if (q.userId) qb.andWhere('e.userId = :uid', { uid: q.userId });
    const rows = await qb.orderBy('e.clockedInAt', 'DESC').getMany();
    const now = new Date();
    const entries = rows.map((e) => ({
      id: e.id, userId: e.userId, userName: e.userName, clockedInAt: e.clockedInAt, clockedOutAt: e.clockedOutAt, note: e.note,
      minutes: minutesBetween(e.clockedInAt, e.clockedOutAt ?? now), open: !e.clockedOutAt,
      forgotten: !e.clockedOutAt && now.getTime() - e.clockedInAt.getTime() > MAX_SHIFT_HOURS * HOUR,
    }));
    const byUser = new Map<string, { userId: string; userName: string; minutes: number; shifts: number }>();
    for (const e of entries) {
      const row = byUser.get(e.userId) ?? { userId: e.userId, userName: e.userName, minutes: 0, shifts: 0 };
      row.minutes += e.minutes; row.shifts += 1;
      byUser.set(e.userId, row);
    }
    return { from, to, people: [...byUser.values()].sort((a, b) => b.minutes - a.minutes), entries };
  }
}
