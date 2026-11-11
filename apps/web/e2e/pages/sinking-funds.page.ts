import { Locator, Page } from '@playwright/test';

/** What the sinking fund form fills in; the schedule is either every few months or a fixed date. */
export interface SinkingFundInput {
  readonly description: string;
  readonly category: string;
  /** Typed as the user would, like `100,00`. */
  readonly cost: string;
  readonly schedule:
    | {
        readonly kind: 'everyMonths';
        readonly intervalMonths: string;
        readonly nextDueDate: string;
      }
    | { readonly kind: 'fixedDate'; readonly month: string; readonly day: string };
}

/** Page object for the sinking funds section of the Finances To pay & receive page. */
export class SinkingFundsPage {
  readonly section: Locator;
  readonly newButton: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.section = page.getByRole('region', { name: 'Sinking funds' });
    this.newButton = this.section.getByRole('button', { name: 'New sinking fund' });
    this.total = this.section.getByText('Total to set aside per month:');
  }

  /** Opens the To pay & receive page and waits for the sinking funds to finish loading. */
  async goto(): Promise<void> {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/sinking-funds',
    );
    await this.page.goto('/finances/bills');
    await loaded;
    await this.newButton.waitFor();
  }

  /** The row of the fund with this description. */
  row(description: string): Locator {
    return this.section.getByRole('listitem').filter({ hasText: description });
  }

  /** Fills and saves the form for a new fund, then waits for the form to close. */
  async addFund(fund: SinkingFundInput): Promise<void> {
    await this.newButton.click();
    const form = this.form('New sinking fund');
    await form.getByLabel('Description').fill(fund.description);
    await form.getByLabel('Category').selectOption({ label: fund.category });
    await form.getByLabel('Cost per cycle (R$)').fill(fund.cost);
    await this.fillSchedule(fund.schedule);
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'detached' });
  }

  /** Changes the cost of a listed fund and waits for the form to close. */
  async changeCost(description: string, cost: string): Promise<void> {
    await this.page.getByRole('button', { name: `Edit ${description}` }).click();
    const form = this.form('Edit sinking fund');
    await form.getByLabel('Cost per cycle (R$)').fill(cost);
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'detached' });
  }

  /** Deletes a listed fund. */
  async remove(description: string): Promise<void> {
    await this.page.getByRole('button', { name: `Delete sinking fund ${description}` }).click();
  }

  private form(name: 'New sinking fund' | 'Edit sinking fund'): Locator {
    return this.page.getByRole('form', { name });
  }

  private async fillSchedule(schedule: SinkingFundInput['schedule']): Promise<void> {
    const form = this.form('New sinking fund');
    if (schedule.kind === 'everyMonths') {
      await form.getByLabel('Every (months)').fill(schedule.intervalMonths);
      await form.getByLabel('Next due date').fill(schedule.nextDueDate);
      return;
    }
    await form.getByLabel('Repeats').selectOption({ label: 'Every year on a fixed date' });
    await form.getByLabel('Month of the year (1-12)').fill(schedule.month);
    await form.getByLabel('Day of the month').fill(schedule.day);
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
