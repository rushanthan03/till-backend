import { ConflictException, NotFoundException } from '@nestjs/common';
import { AttendanceService, MAX_SHIFT_HOURS, minutesBetween } from './attendance.service';

const HOUR = 3600000;
const make = (open: any, openShift = false) => {
  const saved: any[] = [];
  const entries: any = {
    findOne: jest.fn().mockResolvedValue(open),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => { saved.push(v); return v; }),
  };
  const shifts: any = { findOne: jest.fn().mockResolvedValue(openShift ? { id: 's' } : null) };
  return { svc: new AttendanceService(entries, shifts), saved };
};
const user = { id: 'u1', name: 'Sam' };

describe('attendance', () => {
  it('counts minutes and never goes negative', () => {
    expect(minutesBetween(new Date(0), new Date(90 * 60000))).toBe(90);
    expect(minutesBetween(new Date(5000), new Date(0))).toBe(0);
  });

  it('clocking in starts an entry', async () => {
    const { svc, saved } = make(null);
    const e = await svc.clockIn('s1', user);
    expect(e.clockedOutAt).toBeNull();
    expect(saved).toHaveLength(1);
  });

  it('clocking in twice returns the same entry and creates nothing', async () => {
    const open = { id: 'e1', clockedInAt: new Date(Date.now() - 2 * HOUR), clockedOutAt: null };
    const { svc, saved } = make(open);
    expect(await svc.clockIn('s1', user)).toBe(open);
    expect(saved).toHaveLength(0);
  });

  it('closes a forgotten entry at the limit and starts a new one', async () => {
    const start = new Date(Date.now() - (MAX_SHIFT_HOURS + 3) * HOUR);
    const open: any = { id: 'e1', clockedInAt: start, clockedOutAt: null, note: null };
    const { svc, saved } = make(open);
    await svc.clockIn('s1', user);
    expect(saved).toHaveLength(2);
    expect(open.clockedOutAt.getTime()).toBe(start.getTime() + MAX_SHIFT_HOURS * HOUR);
    expect(open.note).toMatch(/Auto-closed/);
  });

  it('cannot clock out when not clocked in', async () => {
    await expect(make(null).svc.clockOut('s1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cannot clock out while the till is still open', async () => {
    const open = { id: 'e1', clockedInAt: new Date(), clockedOutAt: null };
    await expect(make(open, true).svc.clockOut('s1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('clocks out when the till is closed', async () => {
    const open: any = { id: 'e1', clockedInAt: new Date(Date.now() - HOUR), clockedOutAt: null };
    const { svc } = make(open);
    expect((await svc.clockOut('s1', 'u1')).clockedOutAt).toBeInstanceOf(Date);
  });
});
