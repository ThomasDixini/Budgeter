import { Locator, Page } from '@playwright/test';

/** What the bill form fills in. */
export interface BillInput {
  readonly description: string;
  /** Typed as the user would, like `119,90`. */
  readonly amount: string;
  readonly category: string;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly repeat?: { readonly option: string; readonly count?: string };
}

/** Page object for the Finances To pay & receive page: the grouped agenda and its forms. */
export class BillsPage {
  readonly title: Locator;
  readonly addButton: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.addButton = page.getByRole('button', { name: 'Add bill' });
  }

  /** Opens the To pay & receive page and waits for the agenda to finish loading. */
  async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/bills',
    );
    await this.page.goto('/finances/bills');
    await loaded;
    await this.addButton.waitFor();
  }

  /** The block of the agenda with this title (e.g. "Next 7 days"). */
  group(title: string | RegExp): Locator {
    return this.page.getByRole('region', { name: title });
  }

  /** The rows with this description in any block. */
  rows(description: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: description });
  }

  /** Fills and submits the form for a new bill. */
  async addBill(bill: BillInput): Promise<void> {
    await this.addButton.click();
    const form = this.page.getByRole('form', { name: 'New bill' });
    await form.getByLabel('Description').fill(bill.description);
    await form.getByLabel('Amount (R$)').fill(bill.amount);
    await form.getByLabel('Category').selectOption({ label: bill.category });
    await form.getByLabel('Due date').fill(bill.dueDate);
    if (bill.repeat !== undefined) await this.chooseRepeat(bill.repeat);
    await form.getByRole('button', { name: 'Add bill' }).click();
  }

  private async chooseRepeat(repeat: NonNullable<BillInput['repeat']>): Promise<void> {
    const form = this.page.getByRole('form', { name: 'New bill' });
    await form.getByLabel('Repeat').selectOption({ label: repeat.option });
    if (repeat.count !== undefined) await form.locator('input[name="count"]').fill(repeat.count);
  }

  /** Marks the bill paid or received through the default account, today, once the API stored it. */
  async settle(action: 'Mark paid' | 'Mark received', description: string): Promise<void> {
    await this.page.getByRole('button', { name: `${action}: ${description}` }).click();
    const verb = action === 'Mark paid' ? 'paid' : 'received';
    const stored = this.waitForSettlement('PUT');
    await this.page
      .getByRole('form', { name: `Mark ${description} ${verb}` })
      .getByRole('button', { name: `Mark as ${verb}` })
      .click();
    await stored;
  }

  /** Undoes the settlement of a bill, once the API stored that. */
  async undo(description: string): Promise<void> {
    const stored = this.waitForSettlement('DELETE');
    await this.page.getByRole('button', { name: `Undo: ${description}` }).click();
    await stored;
  }

  private waitForSettlement(method: 'PUT' | 'DELETE'): Promise<unknown> {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method && response.url().endsWith('/settlement'),
    );
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
