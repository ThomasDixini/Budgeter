import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Clock } from '../../calendar/clock';
import { FixedClock } from '../../calendar/fixed-clock';
import { DemoSinkingFundsGateway, summarize } from './demo-sinking-funds';

function setup(now: Date): DemoSinkingFundsGateway {
  TestBed.configureTestingModule({
    providers: [{ provide: Clock, useValue: new FixedClock(now) }, DemoSinkingFundsGateway],
  });
  return TestBed.inject(DemoSinkingFundsGateway);
}

describe('demo sinking funds gateway', () => {
  it('lists the two seeded funds by due date with their totals', async () => {
    const gateway = setup(new Date(2026, 10, 4, 10, 0));

    const overview = await firstValueFrom(gateway.list('2026-11-04'));

    expect(
      overview.funds.map((fund) => [
        fund.description,
        fund.schedule.nextDueDate,
        fund.savedCents,
        fund.monthlyCents,
      ]),
    ).toEqual([
      ['Dog grooming', '2026-11-25', 5000, 5000],
      ['Vehicle tax (IPVA)', '2027-04-04', 70000, 10000],
    ]);
    expect(overview.totalMonthlyCents).toBe(15000);
  });

  it('follows the demo clock instead of fixed years', async () => {
    const gateway = setup(new Date(2031, 0, 31, 9, 0));

    const overview = await firstValueFrom(gateway.list('2031-01-31'));

    expect(overview.funds.map((fund) => fund.schedule.nextDueDate)).toEqual([
      '2031-02-21',
      '2031-06-30',
    ]);
  });

  it('saves a fixed-date fund on its next occurrence from today', async () => {
    const gateway = setup(new Date(2026, 10, 4));
    const draft = {
      description: 'Insurance',
      categoryId: 'other',
      amountCents: 60_000,
      schedule: { kind: 'fixedDate' as const, month: 2, day: 29 },
    };

    const saved = await firstValueFrom(gateway.save('mine', '2027-03-01', draft));

    expect([saved.schedule.nextDueDate, saved.schedule.intervalMonths, saved.monthlyCents]).toEqual(
      ['2028-02-29', 12, 5000],
    );
  });

  it('replaces a fund saved again and removes a deleted one', async () => {
    const gateway = setup(new Date(2026, 10, 4));
    const draft = {
      description: 'Gift',
      categoryId: 'other',
      amountCents: 30_000,
      schedule: { kind: 'everyMonths' as const, intervalMonths: 3, nextDueDate: '2027-01-15' },
    };

    await firstValueFrom(gateway.save('gift', '2026-11-04', draft));
    await firstValueFrom(gateway.save('gift', '2026-11-04', { ...draft, amountCents: 60_000 }));
    const withGift = await firstValueFrom(gateway.list('2026-11-04'));
    await firstValueFrom(gateway.delete('gift'));
    const without = await firstValueFrom(gateway.list('2026-11-04'));

    expect([withGift.funds.length, withGift.totalMonthlyCents, without.funds.length]).toEqual([
      3, 35000, 2,
    ]);
  });

  it('rolls no bills', async () => {
    const gateway = setup(new Date(2026, 10, 4));

    expect(await firstValueFrom(gateway.roll())).toEqual([]);
  });
});

describe('summarize', () => {
  const fund = {
    id: 'a',
    description: 'A',
    categoryId: 'other',
    amountCents: 120_000,
    schedule: {
      kind: 'fixedDate' as const,
      intervalMonths: 12,
      month: 2,
      day: 28,
      nextDueDate: '2027-02-28',
    },
  };

  it('counts whole elapsed months of the cycle', () => {
    expect(summarize(fund, '2026-08-27').savedCents).toBe(50_000);
    expect(summarize(fund, '2026-08-28').savedCents).toBe(60_000);
  });

  it('clamps the saved amount to the cycle', () => {
    expect([
      summarize(fund, '2025-01-01').savedCents,
      summarize(fund, '2030-01-01').savedCents,
    ]).toEqual([0, 120_000]);
  });

  it('keeps the due day when a short month clamps the cycle start', () => {
    const monthEndFund = {
      ...fund,
      amountCents: 100,
      schedule: {
        kind: 'everyMonths' as const,
        intervalMonths: 1,
        day: 31,
        nextDueDate: '2027-03-31',
      },
    };

    expect(summarize(monthEndFund, '2027-03-01').cycleStart).toBe('2027-02-28');
  });
});
