import { Locator, Page } from '@playwright/test';

/** Page object for the Finances Income split page: base income, bar, parts, comparison, categories. */
export class IncomeSplitPage {
  readonly title: Locator;
  readonly saveButton: Locator;
  readonly baseIncome: Locator;
  readonly status: Locator;
  readonly parts: Locator;
  readonly comparison: Locator;
  readonly categories: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.saveButton = page.getByRole('button', { name: /^(Save split|Saving…)$/ });
    this.baseIncome = page.getByLabel('Base income (R$)');
    this.status = page.getByRole('status').filter({ hasText: /assigned|left|over/ });
    this.parts = page.getByRole('region', { name: 'Your parts' });
    this.comparison = page.getByRole('region', { name: /^Planned vs actual/ });
    this.categories = page.getByRole('region', { name: 'Categories' });
  }

  /** Opens the Income split page and waits for it to finish loading. */
  async goto(): Promise<void> {
    await this.page.goto('/finances/income-split');
    await this.baseIncome.waitFor();
  }

  /** Starts the split from the template with this label (e.g. "50 · 30 · 20"). */
  async applyTemplate(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click();
  }

  /** The row of the part with this name. */
  part(name: string): Locator {
    return this.parts.getByRole('group', { name, exact: true });
  }

  /** Opens the category picker of a part and toggles the category with this name. */
  async assignCategory(partName: string, categoryName: string): Promise<void> {
    await this.part(partName).getByRole('button', { name: '+ categories' }).click();
    await this.parts
      .getByRole('group', { name: `Categories of ${partName}` })
      .getByRole('button', { name: new RegExp(`^${categoryName}`) })
      .click();
  }

  /** The list item of the category with this name in the categories manager. */
  categoryItem(name: string): Locator {
    return this.categories.getByRole('listitem').filter({ hasText: name });
  }

  /** Types a new category name in the manager and adds it. */
  async addCategory(name: string): Promise<void> {
    await this.categories.getByRole('textbox', { name: 'New category' }).fill(name);
    await this.categories.getByRole('button', { name: 'Add category' }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
