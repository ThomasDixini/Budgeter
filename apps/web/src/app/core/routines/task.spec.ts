import { Task, occursOn, repeatLabel, tasksNotToday } from './task';

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
    expect(repeatLabel(task({ repeat: 'weekly', days: [0, 2, 4] }))).toBe('Mon, Wed, Fri');
  });

  it('names the day of a one-time task, or "Today"', () => {
    const callBank = task({ repeat: 'once', date: '2026-10-30' });

    expect(repeatLabel(callBank, '2026-10-28')).toBe('Oct 30');
    expect(repeatLabel(callBank, '2026-10-30')).toBe('Today');
  });

  it('calls a weekly task on all seven days "Every day"', () => {
    expect(repeatLabel(task({ repeat: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }))).toBe('Every day');
  });
});

describe('tasksNotToday', () => {
  const gymTueThu = task({ id: 'gym', title: 'Gym', repeat: 'weekly', days: [1, 3] });
  const mondayLinkedIn = task({ id: 'li', title: 'LinkedIn', repeat: 'weekly', days: [0] });
  const dentist = task({ id: 'dentist', title: 'Dentist', repeat: 'once', date: '2026-11-05' });
  const passport = task({ id: 'passport', title: 'Passport', repeat: 'once', date: '2026-10-30' });
  const taxes = task({ id: 'taxes', title: 'Taxes', repeat: 'once', date: '2026-10-01' });
  const invoice = task({ id: 'invoice', title: 'Invoice', repeat: 'once', date: '2026-10-20' });
  const everything = [gymTueThu, mondayLinkedIn, dentist, passport, taxes, invoice, task({})];

  // 2026-10-26 is a Monday.
  function ids(tasks: readonly Task[], day: Date, isoDay: string): string[] {
    return tasksNotToday(tasks, day, isoDay).map((item) => item.task.id);
  }

  it('leaves out what is due today, and a daily task is always due', () => {
    expect(ids(everything, MONDAY, '2026-10-26')).not.toContain('li');
    expect(ids(everything, MONDAY, '2026-10-26')).not.toContain('t1');
  });

  it('lists scheduled tasks soonest first, then repeating ones, then past ones latest first', () => {
    expect(ids(everything, MONDAY, '2026-10-26')).toEqual([
      'passport',
      'dentist',
      'gym',
      'invoice',
      'taxes',
    ]);
  });

  it('tags each task with where it sits', () => {
    const groups = tasksNotToday(everything, MONDAY, '2026-10-26').map((item) => item.group);

    expect(groups).toEqual(['scheduled', 'scheduled', 'repeating', 'past', 'past']);
  });

  it('moves a task between groups as the day changes', () => {
    expect(tasksNotToday([passport], MONDAY, '2026-10-26')[0].group).toBe('scheduled');
    expect(tasksNotToday([passport], new Date(2026, 9, 31), '2026-10-31')[0].group).toBe('past');
  });
});
