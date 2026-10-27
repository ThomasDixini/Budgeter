import { Task, occursOn, repeatLabel } from './task';

const MONDAY = new Date(2026, 9, 26);
const TUESDAY = new Date(2026, 9, 27);

function task(changes: Partial<Task>): Task {
  return { id: 't1', title: 'Read', repeat: 'daily', days: [], ...changes };
}

describe('occursOn', () => {
  it('shows a daily task every day', () => {
    expect(occursOn(task({}), TUESDAY, '2026-10-27')).toBe(true);
  });

  it('shows a one-off task only on its date', () => {
    const callBank = task({ repeat: 'once', date: '2026-10-26' });

    expect(occursOn(callBank, MONDAY, '2026-10-26')).toBe(true);
    expect(occursOn(callBank, TUESDAY, '2026-10-27')).toBe(false);
  });

  it('shows a weekly task on its weekdays only', () => {
    const gym = task({ repeat: 'weekly', days: [0, 2, 4] });

    expect(occursOn(gym, MONDAY, '2026-10-26')).toBe(true);
    expect(occursOn(gym, TUESDAY, '2026-10-27')).toBe(false);
  });
});

describe('repeatLabel', () => {
  it('names each kind of repeat', () => {
    expect(repeatLabel(task({}))).toBe('Every day');
    expect(repeatLabel(task({ repeat: 'once' }))).toBe('Only today');
    expect(repeatLabel(task({ repeat: 'weekly', days: [0, 2, 4] }))).toBe('Mon, Wed, Fri');
  });

  it('calls a weekly task on all seven days "Every day"', () => {
    expect(repeatLabel(task({ repeat: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }))).toBe('Every day');
  });
});
