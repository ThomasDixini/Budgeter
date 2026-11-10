import { Locator, Page } from '@playwright/test';

/** Page object for the landing page: hides selectors so specs read as user intent. */
export class LandingPage {
  readonly headline: Locator;
  readonly activeModuleName: Locator;
  readonly openModuleLink: Locator;
  readonly spinLeftButton: Locator;
  readonly spinRightButton: Locator;
  readonly signInLinks: Locator;

  constructor(private readonly page: Page) {
    this.headline = page.getByRole('heading', { level: 1 });
    this.activeModuleName = page.locator('.module-card .module-name');
    this.openModuleLink = page.getByRole('link', { name: 'Open module' });
    this.spinLeftButton = page.getByRole('button', { name: /Spin left/ });
    this.spinRightButton = page.getByRole('button', { name: /Spin right/ });
    this.signInLinks = page.getByRole('link', { name: 'Sign in' });
  }

  /** Opens the landing page. */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Spins the wheel one module back. */
  async spinLeft(): Promise<void> {
    await this.spinLeftButton.click();
  }

  /** Spins the wheel one module forward. */
  async spinRight(): Promise<void> {
    await this.spinRightButton.click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
