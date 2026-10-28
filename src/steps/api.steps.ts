import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { config } from '../../config/env';
import { CustomWorld } from '../support/world';
import { postPayloads } from '../utils/testData';

When('I send a POST to {string} with the {string} payload', async function (this: CustomWorld, path: string, payloadName: string) {
  const payload = postPayloads[payloadName];
  if (!payload) {
    throw new Error(`Unknown payload "${payloadName}". Add it to src/utils/testData.ts`);
  }
  const started = Date.now();
  this.lastResponse =
    payload.raw !== undefined
      ? await this.api!.post(path, { data: payload.raw, headers: { 'Content-Type': 'application/json' } })
      : await this.api!.post(path, { data: payload.body });
  this.lastResponseMs = Date.now() - started;

  const text = await this.lastResponse.text();
  try {
    this.lastBody = JSON.parse(text);
  } catch {
    this.lastBody = text;
  }
  this.log(`POST ${path} [${payloadName}] -> ${this.lastResponse.status()} in ${this.lastResponseMs} ms`);
});

Then('the response status is {int}', async function (this: CustomWorld, status: number) {
  expect(this.lastResponse!.status()).toBe(status);
});

Then('the response status is not a server error', async function (this: CustomWorld) {
  expect(this.lastResponse!.status(), 'a 5xx status means the server failed on this input').toBeLessThan(500);
});

Then('the response status is a client error', async function (this: CustomWorld) {
  const status = this.lastResponse!.status();
  expect(status, `invalid input should be rejected with a 4xx status, got ${status}`).toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
});

Then('the response is JSON containing an id', async function (this: CustomWorld) {
  expect(this.lastResponse!.headers()['content-type']).toContain('application/json');
  expect(this.lastBody).toMatchObject({ id: expect.any(Number) });
});

Then('the response time is within the limit', async function (this: CustomWorld) {
  expect(this.lastResponseMs, `response must arrive within ${config.apiMaxResponseMs} ms`).toBeLessThan(config.apiMaxResponseMs);
});

Then('the actual status is recorded in the test log', async function (this: CustomWorld) {
  // The status is already logged in the When step; this step documents the intent in the feature file.
  expect(this.lastResponse!.status()).toBeGreaterThan(0);
});
