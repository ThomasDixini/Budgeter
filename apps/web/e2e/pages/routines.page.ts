import { Locator, Page } from '@playwright/test';

/** Page object for the Routines & Goals module: header tabs, module dock and the routed page. */
export class RoutinesPage {
  readonly title: Locator;
  readonly sectionTabs: Locator;
  readonly currentTab: Locator;
  readonly moduleDock: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.sectionTabs = page.getByRole('navigation', { name: 'Module sections' });
    this.currentTab = this.sectionTabs.locator('[aria-current="page"]');
    this.moduleDock = page.getByRole('navigation', { name: 'Switch module' });
  }

  /** Opens a module page directly by its path. */
  async goto(path = '/routines'): Promise<void> {
    await this.page.goto(path);
  }

  /** Follows the header tab with the given label. */
  async openTab(label: string): Promise<void> {
    await this.sectionTabs.getByRole('link', { name: label, exact: true }).click();
  }

  /** Page width beyond the viewport; zero means no horizontal scroll. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
