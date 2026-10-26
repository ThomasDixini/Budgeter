import { Locator, Page } from '@playwright/test';

/** Page object for the home screen: hides selectors so specs read as user intent. */
export class HomePage {
  readonly title: Locator;
  readonly counter: Locator;
  readonly openModuleLink: Locator;
  readonly spinLeftButton: Locator;
  readonly spinRightButton: Locator;
  readonly allModulesButton: Locator;
  readonly picker: Locator;
  readonly pickerCloseButton: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.counter = page.getByText(/^Module \d+ of \d+$/);
    this.openModuleLink = page.getByRole('link', { name: 'Open module' });
    this.spinLeftButton = page.getByRole('button', { name: /Spin left/ });
    this.spinRightButton = page.getByRole('button', { name: /Spin right/ });
    this.allModulesButton = page.getByRole('button', { name: 'All modules' });
    this.picker = page.getByRole('dialog', { name: 'Choose a module' });
    this.pickerCloseButton = this.picker.getByRole('button', { name: 'Close' });
  }

  /** Opens the home screen. */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Clicks a dome half `steps` times; negative steps spin left. */
  async spin(steps: number): Promise<void> {
    const button = steps < 0 ? this.spinLeftButton : this.spinRightButton;
    for (let step = 0; step < Math.abs(steps); step++) {
      await button.click();
    }
  }

  /** Opens the picker and chooses the module with the given name. */
  async pickModule(name: string): Promise<void> {
    await this.allModulesButton.click();
    await this.picker.getByRole('button', { name }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
