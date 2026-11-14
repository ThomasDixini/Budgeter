import { Locator, Page } from '@playwright/test';

/** What the note form fills in. */
export interface NoteFormInput {
  readonly kind: 'Goal' | 'Note' | 'Idea';
  readonly title: string;
  readonly body: string;
}

/** The buttons on a note card; each is labelled with the note's title. */
export type NoteAction = 'Mark as done' | 'Reopen' | 'Archive' | 'Restore' | 'Delete';

/** Page object for the Notes page of the Routines & Goals module. */
export class NotesPage {
  readonly heading: Locator;
  readonly quickIdea: Locator;
  readonly search: Locator;
  readonly newButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Notes' });
    this.quickIdea = page.getByLabel('Jot down an idea');
    this.search = page.getByLabel('Search notes');
    this.newButton = page.getByRole('button', { name: 'New note' });
  }

  /** Opens the Notes page and waits for the notes to finish loading. */
  async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/notes',
    );
    await this.page.goto('/routines/notes');
    await loaded;
    await this.quickIdea.waitFor();
  }

  /** Types an idea in the quick field and presses Enter. */
  async jotDown(title: string): Promise<void> {
    await this.quickIdea.fill(title);
    await this.quickIdea.press('Enter');
  }

  /** Shows one status list by pressing its filter chip. */
  async showStatus(status: 'Open notes' | 'Done notes' | 'Archived notes'): Promise<void> {
    await this.page.getByRole('button', { name: status }).click();
  }

  /** The card of the note with this title. */
  card(title: string): Locator {
    return this.page
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('heading', { name: title }) });
  }

  /** Fills and saves the form for a new note, then waits for the form to close. */
  async addNote(note: NoteFormInput): Promise<void> {
    await this.newButton.click();
    const form = this.form('New note');
    await form.getByLabel('Note kind').selectOption({ label: note.kind });
    await form.getByLabel('Note title').fill(note.title);
    await form.getByLabel('Note text').fill(note.body);
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'detached' });
  }

  /** Renames a listed note through the edit form and waits for the form to close. */
  async rename(title: string, newTitle: string): Promise<void> {
    await this.page.getByRole('button', { name: `Edit note ${title}` }).click();
    const form = this.form('Edit note');
    await form.getByLabel('Note title').fill(newTitle);
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'detached' });
  }

  /** Presses one of a note's action buttons. */
  async act(action: NoteAction, title: string): Promise<void> {
    const name =
      action === 'Mark as done' ? `Mark note ${title} as done` : `${action} note ${title}`;
    await this.page.getByRole('button', { name }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  private form(name: 'New note' | 'Edit note'): Locator {
    return this.page.getByRole('form', { name });
  }
}
