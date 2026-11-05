import { Locator, Page } from '@playwright/test';

/** Page object for the Finances Investments page: stats, holdings, movements and their forms. */
export class InvestmentsPage {
  readonly title: Locator;
  readonly addButton: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.addButton = page.getByRole('button', { name: 'Add investment' });
  }

  /** Opens the Investments page and waits for the portfolio to finish loading. */
  async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/investments',
    );
    await this.page.goto('/finances/investments');
    await loaded;
    await this.addButton.waitFor();
  }

  /** The holding of the investment with this name. */
  holding(name: string): Locator {
    return this.page.locator('tr.holding').filter({
      has: this.page.locator('.name', { hasText: name }),
    });
  }

  /** The rows of the movements list that mention this investment. */
  movements(name: string): Locator {
    return this.page
      .getByRole('region', { name: 'Movements' })
      .getByRole('listitem')
      .filter({ hasText: name });
  }

  /** Adds an investment with a typed price (like `12,00`) and waits for the API to store it. */
  async addInvestment(name: string, price: string): Promise<void> {
    await this.addButton.click();
    const form = this.page.getByRole('form', { name: 'New investment' });
    await form.getByLabel('Name').fill(name);
    await form.getByLabel('Current price').fill(price);
    await this.storing(() => form.getByRole('button', { name: 'Add investment' }).click());
  }

  /** Records a purchase or sale for the investment; the form closes only when the API accepted it. */
  async trade(name: string, kind: 'Buy' | 'Sell', quantity: string, price: string): Promise<void> {
    await this.page.getByRole('button', { name: `Trade ${name}`, exact: true }).click();
    const form = this.page.getByRole('form', { name: `Trade ${name}` });
    await form.getByRole('button', { name: kind, exact: true }).click();
    await form.getByLabel('Quantity').fill(quantity);
    await form.getByLabel('Price per unit').fill(price);
    await form.getByRole('button', { name: /^Record (purchase|sale)$/ }).click();
  }

  /** Records a provento for the investment and waits for the API to store it. */
  async addIncome(name: string, amount: string): Promise<void> {
    await this.page.getByRole('button', { name: `Add income to ${name}` }).click();
    const form = this.page.getByRole('form', { name: `Income from ${name}` });
    await form.getByLabel('Amount').fill(amount);
    await this.storing(() => form.getByRole('button', { name: 'Record income' }).click());
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  private async storing(act: () => Promise<void>): Promise<void> {
    const stored = this.page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.ok(),
    );
    await act();
    await stored;
  }
}
