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
