import { buildDemoRoutines, chanceOf } from './demo-routines-data';

/** Wednesday, November 4, 2026. */
const TODAY = '2026-11-04';
const NINE_O_CLOCK = 9 * 60;

describe('buildDemoRoutines', () => {
  it('gives the same chance for the same key and a value in [0, 1)', () => {
    expect(chanceOf('2026-11-04|work')).toBe(chanceOf('2026-11-04|work'));
    expect(chanceOf('2026-11-04|work')).toBeGreaterThanOrEqual(0);
    expect(chanceOf('2026-11-04|work')).toBeLessThan(1);
  });

  it('fills every Routines & Goals screen: categories, routines, tasks and goals', () => {
    const data = buildDemoRoutines(TODAY, 'en-US', NINE_O_CLOCK);

    expect(data.categories.length).toBeGreaterThanOrEqual(5);
    expect(data.routines.map((routine) => routine.name)).toEqual(['Weekdays', 'Weekend']);
    expect(data.tasks.length).toBeGreaterThanOrEqual(8);
    expect(data.goals.some((goal) => goal.type === 'objective')).toBe(true);
    expect(data.goals.some((goal) => goal.type === 'frequency')).toBe(true);
  });

  it('gives every goal and block a category that exists', () => {
    const data = buildDemoRoutines(TODAY, 'en-US', NINE_O_CLOCK);
    const known = new Set(data.categories.map((category) => category.id));
    const blocks = data.routines.flatMap((routine) => routine.blocks);

    expect(data.goals.every((goal) => known.has(goal.categoryId))).toBe(true);
    expect(
      blocks.every((block) => block.categoryId === undefined || known.has(block.categoryId)),
    ).toBe(true);
  });

  it('comes with weeks of history, but nothing yet for the blocks that have not ended today', () => {
    const data = buildDemoRoutines(TODAY, 'en-US', NINE_O_CLOCK);

    expect(data.outcomes.get('2026-10-21')?.length).toBeGreaterThan(0);
    const todayBlocks = (data.outcomes.get(TODAY) ?? []).map((outcome) => outcome.blockId);
    expect(todayBlocks.every((blockId) => blockId === 'workout')).toBe(true);
  });

  it('marks tasks as done on past days and keeps the one-off task of the future pending', () => {
    const data = buildDemoRoutines(TODAY, 'en-US', NINE_O_CLOCK);
    const done = [...data.completedTasks.values()].flat();

    expect(done.length).toBeGreaterThan(0);
    expect(done).not.toContain('passport');
  });

  it('names things in Portuguese when asked to', () => {
    const data = buildDemoRoutines(TODAY, 'pt-BR', NINE_O_CLOCK);

    expect(data.routines.map((routine) => routine.name)).toEqual(['Dias úteis', 'Fim de semana']);
  });
});
