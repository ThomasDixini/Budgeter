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
 * Creates a routine with one uncategorized block, so a test edits a routine no other test touches.
 * @example const routine = await createRoutine(request);
 */
export async function createRoutine(request: APIRequestContext): Promise<SeededRoutine> {
  const routine = { id: randomUUID(), name: uniqueTitle('Plan'), blockName: 'Deep work' };
  const response = await request.put(`/api/routines/${routine.id}`, {
    data: {
      name: routine.name,
      days: [],
      start: '08:00',
      end: '12:00',
      blocks: [{ id: 'deep-work', name: routine.blockName, start: '08:00', end: '10:00' }],
    },
  });
  expect(response.status()).toBe(200);
  return routine;
}

/**
 * Creates a weekly frequency goal straight through the API, for tests that start from an existing goal.
 * @example const goal = await createWeeklyGoal(request, 'exercise', 3);
 */
export async function createWeeklyGoal(
  request: APIRequestContext,
  categoryId: string,
  target: number,
): Promise<SeededGoal> {
  const goal: SeededGoal = { id: randomUUID(), categoryId, title: uniqueTitle('Work out'), target };
  const response = await request.post('/api/goals', {
    data: { ...goal, type: 'frequency', period: 'weekly' },
  });
  expect(response.status()).toBe(201);
  return goal;
}
