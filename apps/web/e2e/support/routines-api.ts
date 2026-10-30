import { APIRequestContext, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export interface SeededGoal {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly target: number;
}

/**
 * A title no other test or project shares, since every test writes to the same database.
 * @example uniqueTitle('Read before bed') // 'Read before bed 3f2b7c1e'
 */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

export interface SeededRoutine {
  readonly id: string;
  readonly name: string;
  readonly blockName: string;
}

/**
 * Creates a category straight through the API and returns its id and name.
 * @example const category = await createCategory(request, 'Languages');
 */
export async function createCategory(
  request: APIRequestContext,
  prefix: string,
): Promise<{ readonly id: string; readonly name: string }> {
  const category = { id: randomUUID(), name: uniqueTitle(prefix) };
  const response = await request.post('/api/categories', {
    data: { ...category, color: '#86EFAC' },
  });
  expect(response.status()).toBe(201);
  return category;
}

/**
 * Creates a routine with one block (of a category when given) and no weekdays, so a test works on a
 * routine no other test touches and that never takes a day from another routine.
 * @example const routine = await createRoutine(request);
 */
export async function createRoutine(
  request: APIRequestContext,
  categoryId?: string,
): Promise<SeededRoutine> {
  const routine = { id: randomUUID(), name: uniqueTitle('Plan'), blockName: 'Deep work' };
  const response = await request.put(`/api/routines/${routine.id}`, {
    data: {
      name: routine.name,
      days: [],
      start: '08:00',
      end: '12:00',
      blocks: [
        { id: 'deep-work', name: routine.blockName, start: '08:00', end: '10:00', categoryId },
      ],
    },
  });
  expect(response.status()).toBe(200);
  return routine;
}

/**
 * Completes the single block of a seeded routine on a day, as the Today timeline would.
 * @example await completeBlock(request, routine, localDay(-1));
 */
export async function completeBlock(
  request: APIRequestContext,
  routine: SeededRoutine,
  isoDay: string,
): Promise<void> {
  const response = await request.put(
    `/api/routines/${routine.id}/days/${isoDay}/blocks/deep-work`,
    { data: { outcome: 'done', at: '09:30' } },
  );
  expect(response.ok()).toBe(true);
}

/**
 * Creates a task that shows up every day, so a test can work on it whatever today is.
 * @example const task = await createDailyTask(request);
 */
export async function createDailyTask(
  request: APIRequestContext,
): Promise<{ readonly id: string; readonly title: string }> {
  const task = { id: randomUUID(), title: uniqueTitle('Stretch') };
  const response = await request.put(`/api/tasks/${task.id}`, {
    data: { title: task.title, repeat: 'daily' },
  });
  expect(response.status()).toBe(200);
  return task;
}

/**
 * The local calendar day as the web app reads it (`YYYY-MM-DD`); goals are read for the period around it.
 * @example localToday() // '2026-10-28'
 */
export function localToday(): string {
  return localDay(0);
}

/**
 * A local calendar day counted from today (`YYYY-MM-DD`), e.g. -1 for yesterday.
 * @example localDay(-1) // '2026-10-27'
 */
export function localDay(daysFromToday: number): string {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/**
 * Creates a weekly frequency goal straight through the API, for tests that start from an existing goal.
 * It counts the completed blocks of its category.
 * @example const goal = await createWeeklyGoal(request, 'exercise', 3);
 */
export async function createWeeklyGoal(
  request: APIRequestContext,
  categoryId: string,
  target: number,
): Promise<SeededGoal> {
  const goal: SeededGoal = { id: randomUUID(), categoryId, title: uniqueTitle('Work out'), target };
  const response = await request.post(`/api/goals?date=${localToday()}`, {
    data: { ...goal, type: 'frequency', period: 'weekly' },
  });
  expect(response.status()).toBe(201);
  return goal;
}

/**
 * Creates an objective straight through the API: a milestone marked achieved by hand.
 * @example const goal = await createObjective(request, 'exercise');
 */
export async function createObjective(
  request: APIRequestContext,
  categoryId: string,
): Promise<SeededGoal> {
  const goal: SeededGoal = {
    id: randomUUID(),
    categoryId,
    title: uniqueTitle('Run 10k'),
    target: 1,
  };
  const response = await request.post(`/api/goals?date=${localToday()}`, {
    data: { ...goal, type: 'objective', period: 'yearly' },
  });
  expect(response.status()).toBe(201);
  return goal;
}

/**
 * Creates a daily task of a category straight through the API.
 * @example const task = await createCategorizedTask(request, 'exercise');
 */
export async function createCategorizedTask(
  request: APIRequestContext,
  categoryId: string,
): Promise<{ readonly id: string; readonly title: string }> {
  const task = { id: randomUUID(), title: uniqueTitle('Stretch') };
  const response = await request.put(`/api/tasks/${task.id}`, {
    data: { title: task.title, repeat: 'daily', categoryId },
  });
  expect(response.status()).toBe(200);
  return task;
}
