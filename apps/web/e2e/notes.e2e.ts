import { randomUUID } from 'node:crypto';
import { APIRequestContext } from '@playwright/test';
import { expect, test } from './support/test';
import { NotesPage } from './pages/notes.page';
import { RoutinesPage } from './pages/routines.page';
import { uniqueName } from './support/finances-api';

/*
 * Notes live in one table shared by every test, so each test tells its own apart by a unique title and
 * never asserts on the whole list.
 */
let notes: NotesPage;

test.beforeEach(async ({ page }) => {
  notes = new NotesPage(page);
});

/** Creates an open note straight through the API. */
async function seedNote(
  request: APIRequestContext,
  kind: 'goal' | 'note' | 'idea',
  title: string,
  body = '',
): Promise<void> {
  const response = await request.put(`/api/notes/${randomUUID()}`, { data: { kind, title, body } });
  expect(response.ok()).toBe(true);
}

test('the Notes tab opens the page from Routines & Goals', async ({ page }) => {
  const routines = new RoutinesPage(page);
  await routines.goto();

  await routines.openTab('Notes');

  await expect(page).toHaveURL(/\/routines\/notes$/);
  await expect(notes.heading).toBeVisible();
});

test('a quick idea shows in the list, clears the field and survives a reload', async ({ page }) => {
  const title = uniqueName(test.info(), 'Podcast');
  await notes.goto();

  await notes.jotDown(title);

  await expect(notes.card(title)).toContainText('Idea');
  await expect(notes.quickIdea).toHaveValue('');
  await page.reload();
  await expect(notes.card(title)).toBeVisible();
});

test('a goal made in the form shows its label and an edited title updates the card', async () => {
  const title = uniqueName(test.info(), 'Speak English');
  const renamed = uniqueName(test.info(), 'Speak fluently');
  await notes.goto();

  await notes.addNote({ kind: 'Goal', title, body: 'Practice daily\nBook a trial class' });

  await expect(notes.card(title)).toContainText('Goal');
  await expect(notes.card(title)).toContainText('Book a trial class');
  await notes.rename(title, renamed);
  await expect(notes.card(renamed)).toBeVisible();
  await expect(notes.card(title)).toHaveCount(0);
});

test('an idea moves to Done and back, and a note moves to Archived and back', async ({
  request,
}) => {
  const idea = uniqueName(test.info(), 'Newsletter');
  const note = uniqueName(test.info(), 'Reading list');
  await seedNote(request, 'idea', idea);
  await seedNote(request, 'note', note);
  await notes.goto();

  await notes.act('Mark as done', idea);
  await expect(notes.card(idea)).toHaveCount(0);
  await notes.showStatus('Done notes');
  await expect(notes.card(idea)).toContainText('Marked as done');
  await notes.act('Reopen', idea);
  await expect(notes.card(idea)).toHaveCount(0);
  await notes.showStatus('Open notes');
  await expect(notes.card(idea)).toBeVisible();

  await notes.act('Archive', note);
  await expect(notes.card(note)).toHaveCount(0);
  await notes.showStatus('Archived notes');
  await expect(notes.card(note)).toBeVisible();
  await notes.act('Restore', note);
  await expect(notes.card(note)).toHaveCount(0);
  await notes.showStatus('Open notes');
  await expect(notes.card(note)).toBeVisible();
});

test('search finds a note by its text without caring about accents', async ({ request }) => {
  const token = uniqueName(test.info(), 'cafe').replace(' ', '-');
  const title = uniqueName(test.info(), 'Recipe');
  const other = uniqueName(test.info(), 'Unrelated');
  await seedNote(request, 'note', title, `Pão de queijo e café ${token}`);
  await seedNote(request, 'note', other);
  await notes.goto();

  await notes.search.fill(`pao de queijo e cafe ${token}`);

  await expect(notes.card(title)).toBeVisible();
  await expect(notes.card(other)).toHaveCount(0);
});

test('deleting a note removes the card, also after a reload', async ({ page, request }) => {
  const title = uniqueName(test.info(), 'Old idea');
  await seedNote(request, 'idea', title);
  await notes.goto();
  await expect(notes.card(title)).toBeVisible();

  await notes.act('Delete', title);

  await expect(notes.card(title)).toHaveCount(0);
  await page.reload();
  await expect(notes.quickIdea).toBeVisible();
  await expect(notes.card(title)).toHaveCount(0);
});

test('the page fits a phone screen without sideways scrolling', async ({ request }) => {
  const title = uniqueName(test.info(), 'A very long note title that keeps going');
  await seedNote(request, 'goal', title, 'A long text '.repeat(40));
  await notes.goto();
  await expect(notes.card(title)).toBeVisible();

  expect(await notes.horizontalOverflow()).toBe(0);
});
