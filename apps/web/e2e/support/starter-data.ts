import { APIRequestContext } from '@playwright/test';

/*
 * The app starts every account empty, but the specs read and write against a known set: the routines and
 * tasks the "Today" specs look at by name, the categories they link to, and the finance categories and
 * accounts the money specs record against. This gives the suite's account that set, through the API, once.
 */

const CATEGORIES = [
  { id: 'study', name: 'Study', color: '#7DD3FC' },
  { id: 'networking', name: 'Networking', color: '#F0ABFC' },
  { id: 'reading', name: 'Reading', color: '#FBBF24' },
  { id: 'exercise', name: 'Exercise', color: '#FCA5A5' },
];

const ROUTINES = [
  {
    id: 'weekdays',
    name: 'Weekdays',
    days: [0, 1, 2, 3, 4],
    start: '08:00',
    end: '17:00',
    blocks: [
      { id: 'work', name: 'Work', start: '08:00', end: '12:00' },
      { id: 'lunch', name: 'Lunch', start: '12:00', end: '13:30' },
      { id: 'csharp', name: 'C# study', start: '13:30', end: '15:00', categoryId: 'study' },
      { id: 'network', name: 'Networking', start: '15:00', end: '17:00', categoryId: 'networking' },
    ],
  },
  {
    id: 'weekend',
    name: 'Weekend',
    days: [5, 6],
    start: '09:00',
    end: '14:00',
    blocks: [
      { id: 'workout', name: 'Workout', start: '09:00', end: '10:00', categoryId: 'exercise' },
      { id: 'read', name: 'Reading', start: '10:00', end: '12:00', categoryId: 'reading' },
      { id: 'weekend-lunch', name: 'Lunch', start: '12:00', end: '13:30' },
    ],
  },
];

const TASKS = [
  { id: 't1', title: 'Reply to pending emails', repeat: 'daily' },
  {
    id: 't2',
    title: 'Review class notes',
    repeat: 'weekly',
    categoryId: 'study',
    days: [0, 1, 2, 3, 4],
  },
  { id: 't3', title: 'Do the LINQ exercises', repeat: 'weekly', categoryId: 'study', days: [1, 3] },
  {
    id: 't4',
    title: 'Message 2 contacts',
    repeat: 'weekly',
    categoryId: 'networking',
    days: [0, 2, 4],
  },
  { id: 't5', title: 'Read 20 pages', repeat: 'daily', categoryId: 'reading' },
];

const FINANCE_CATEGORIES = [
  ['housing', 'Housing'],
  ['food', 'Food'],
  ['transport', 'Transport'],
  ['health', 'Health'],
  ['leisure', 'Leisure'],
  ['subscriptions', 'Subscriptions'],
  ['education', 'Education'],
  ['salary', 'Salary'],
  ['extra-income', 'Extra income'],
  ['investments', 'Investments'],
  ['other', 'Other'],
];

async function save(request: APIRequestContext, method: 'put' | 'post', url: string, data: object) {
  const response = await request[method](url, { data });
  if (!response.ok()) {
    throw new Error(
      `Expected ${method.toUpperCase()} ${url} to succeed, received ${response.status()}`,
    );
  }
}

/**
 * Stores the suite's starting data for the account the request is signed in as; storing it again leaves
 * the same state.
 * @example await seedStarterData(authorizedRequest)
 */
export async function seedStarterData(request: APIRequestContext): Promise<void> {
  for (const category of CATEGORIES) await save(request, 'post', '/api/categories', category);
  for (const { id, ...routine } of ROUTINES)
    await save(request, 'put', `/api/routines/${id}`, routine);
  for (const { id, ...task } of TASKS) await save(request, 'put', `/api/tasks/${id}`, task);
  for (const [id, name] of FINANCE_CATEGORIES) {
    await save(request, 'put', `/api/finance-categories/${id}`, { name });
  }
  await save(request, 'put', '/api/accounts/checking-account', {
    name: 'Checking account',
    kind: 'bankAccount',
  });
  await save(request, 'put', '/api/accounts/credit-card', {
    name: 'Credit card',
    kind: 'creditCard',
    card: { limitCents: 500_000, closingDay: 3, dueDay: 10 },
  });
}
