import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { APIRequestContext, APIResponse, Browser, BrowserContext, Page, chromium, request } from 'playwright';
import { config } from '../../config/env';

/** Per-scenario state: browser objects for UI scenarios, request context for API scenarios. */
export class CustomWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page!: Page;
  api?: APIRequestContext;
  consoleErrors: string[] = [];
  lastResponse?: APIResponse;
  lastResponseMs = 0;
  lastBody: unknown;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async openBrowser(): Promise<void> {
    this.browser = await chromium.launch({ headless: config.headless });
    this.context = await this.browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1280, height: 900 } });
    this.page = await this.context.newPage();
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => this.consoleErrors.push(err.message));
  }

  async openApi(): Promise<void> {
    this.api = await request.newContext({ baseURL: config.apiBaseUrl });
  }

  async close(): Promise<void> {
    await this.api?.dispose();
    await this.context?.close();
    await this.browser?.close();
  }
}

setWorldConstructor(CustomWorld);
