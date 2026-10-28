import { Page } from 'playwright';

/** Shared behaviour. The base URL comes from the browser context (config/env.ts), never from here. */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async open(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  title() {
    return this.page.getByTestId('app-title');
  }

  tab(name: 'Dashboard' | 'EMI Report') {
    return this.page.getByRole('tab', { name });
  }

  async openTab(name: 'Dashboard' | 'EMI Report'): Promise<void> {
    await this.tab(name).click();
  }

  /** Reads the values that the app exposes on a canvas chart (canvas pixels are not inspectable). */
  async chartValues(testId: string): Promise<number[]> {
    const raw = await this.page.getByTestId(testId).getAttribute('data-values');
    if (!raw) {
      throw new Error(`Chart "${testId}" has no data-values attribute`);
    }
    return JSON.parse(raw) as number[];
  }

  async chartLabels(testId: string): Promise<string[]> {
    const raw = await this.page.getByTestId(testId).getAttribute('data-labels');
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
}
