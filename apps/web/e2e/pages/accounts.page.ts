import { Locator, Page } from '@playwright/test';

/** Page object for the Finances Banks & Cards page: tiles, detail, account and payment forms. */
export class AccountsPage {
  readonly title: Locator;
  readonly addAccountButton: Locator;
  readonly tiles: Locator;
  readonly detail: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.addAccountButton = page.getByRole('button', { name: 'Add account or card' });
    this.tiles = page.getByRole('list', { name: 'Accounts and cards' });
    this.detail = page.getByRole('region').filter({ has: page.getByRole('heading', { level: 2 }) });
  }

  /** Opens the Banks & Cards page. */
  async goto(): Promise<void> {
    await this.page.goto('/finances/accounts');
  }

  /** The form open for a new account or an edit. */
  form(name: 'New account' | 'Edit account'): Locator {
    return this.page.getByRole('form', { name });
  }

  /** The payment form of the card with this name. */
  paymentForm(cardName: string): Locator {
    return this.page.getByRole('form', { name: `Pay ${cardName}` });
  }

  /** The tile of the account with this name. */
  tile(name: string): Locator {
    return this.tiles.getByRole('button', { name: new RegExp(`${name}$`) });
  }

  /** The value of one stat of the selected account (e.g. "Balance"). */
  stat(label: string): Locator {
    return this.detail.locator('.stat').filter({ hasText: label }).locator('.stat-value');
  }

  /** Fills and submits the new account form as a bank account. */
  async addBankAccount(name: string, openingBalance: string): Promise<void> {
    await this.addAccountButton.click();
    const form = this.form('New account');
    await form.getByLabel('Name').fill(name);
    await form.getByLabel('Opening balance (R$)').fill(openingBalance);
    await form.getByRole('button', { name: 'Add account' }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
