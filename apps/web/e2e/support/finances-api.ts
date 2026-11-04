import { APIRequestContext, TestInfo, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** The first month handed out by `ownMonth`, far from any real data. */
const FIRST_OWN_MONTH = new Date(2031, 0, 15, 10, 0);

/**
 * Mid-morning on the 15th of a month no other test or browser project uses. Totals are per month, so
 * a test that owns its month sees only its own transactions; each run starts from a fresh database,
 * so the same month every run is safe and makes a failure repeatable.
 * @example await page.clock.setFixedTime(ownMonth(test.info(), 2)) // a day in its own month
 */
export function ownMonth(testInfo: TestInfo, slot: number): Date {
  const projects = testInfo.config.projects.map((project) => project.name);
  const project = projects.indexOf(testInfo.project.name);
  if (project < 0) {
    throw new Error(
      `Expected a project among [${projects.join(', ')}], received "${testInfo.project.name}"`,
    );
  }
  const months = slot * projects.length + project;
  return new Date(
    FIRST_OWN_MONTH.getFullYear(),
    FIRST_OWN_MONTH.getMonth() + months,
    FIRST_OWN_MONTH.getDate(),
    FIRST_OWN_MONTH.getHours(),
  );
}

/** A day of the moment's month as the API spells it. */
export function isoDayOf(moment: Date, day: number): string {
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  return `${moment.getFullYear()}-${month}-${String(day).padStart(2, '0')}`;
}

export interface SeededTransaction {
  readonly date: string;
  readonly description: string;
  readonly categoryId: string;
  readonly accountId: string;
  readonly amountCents: number;
}

/**
 * Records a transaction straight through the API, against the starter categories and accounts.
 * @example await createTransaction(request, { date: '2031-01-10', description: 'Salary', categoryId: 'salary', accountId: 'checking-account', amountCents: 950000 })
 */
export async function createTransaction(
  request: APIRequestContext,
  transaction: SeededTransaction,
): Promise<void> {
  const response = await request.put(`/api/transactions/${randomUUID()}`, { data: transaction });
  expect(response.ok()).toBe(true);
}
