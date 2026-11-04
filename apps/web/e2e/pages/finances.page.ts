import { Locator, Page } from '@playwright/test';

/** Page object for the Finances Transactions page: header actions, form, filters and history. */
export class FinancesPage {
  readonly title: Locator;
  readonly newTransactionButton: Locator;
  readonly summary: Locator;
  readonly history: Locator;
  readonly typeFilter: Locator;
  readonly accountFilter: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.newTransactionButton = page.getByRole('button', { name: 'New transaction' });
    this.summary = page.getByRole('region', { name: 'Month summary' });
    this.history = page.getByRole('region', { name: 'History' });
    this.typeFilter = page.getByRole('group', { name: 'Type' });
    this.accountFilter = page.getByRole('group', { name: 'Account' });
  }

  /** Opens the Transactions page. */
  async goto(): Promise<void> {
    await this.page.goto('/finances/transactions');
  }

  /** The form open for a new transaction or an edit. */
  form(name: 'New transaction' | 'Edit transaction'): Locator {
    return this.page.getByRole('form', { name });
  }

  /** The history row of the transaction with this description. */
  row(description: string): Locator {
    return this.history.getByRole('button', { name: new RegExp(`^Edit ${description},`) });
  }

  /** Fills and submits the new transaction form as an expense of the given category. */
  async recordExpense(amount: string, description: string, category: string): Promise<void> {
    await this.newTransactionButton.click();
    const form = this.form('New transaction');
    await form.getByLabel('Amount (R$)').fill(amount);
    await form.getByLabel('Description').fill(description);
    await form.getByLabel('Category').selectOption({ label: category });
    await form.getByRole('button', { name: 'Add transaction' }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
