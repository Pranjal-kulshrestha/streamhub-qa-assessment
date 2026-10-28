import { After, AfterAll, Before, BeforeAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { config } from '../../config/env';
import { CustomWorld } from './world';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startServer } = require('../../app/server');

setDefaultTimeout(30_000);

let server: http.Server | undefined;
let shotCounter = 0;
const screenshotDir = path.resolve('reports', 'screenshots');

BeforeAll(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  if (config.startServer) {
    const port = Number(new URL(config.baseUrl).port || 80);
    server = await startServer(port);
  }
});

AfterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
});

Before({ tags: '@ui' }, async function (this: CustomWorld) {
  await this.openBrowser();
});

Before({ tags: '@api' }, async function (this: CustomWorld) {
  await this.openApi();
});

After(async function (this: CustomWorld, scenario) {
  const failed = scenario.result?.status === Status.FAILED;
  if (this.page && !this.page.isClosed()) {
    // Evidence: always keep a screenshot, failures are attached to the HTML report as well.
    const safeName = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
    const file = path.join(screenshotDir, `${String(++shotCounter).padStart(2, '0')}_${failed ? 'FAILED_' : ''}${safeName}.png`);
    const png = await this.page.screenshot({ path: file, fullPage: true });
    if (failed) {
      await this.attach(png, 'image/png');
    }
  }
  await this.close();
});
