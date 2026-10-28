import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { DashboardPage } from '../pages/DashboardPage';
import { ReportPage } from '../pages/ReportPage';
import { calculateEmi, parseMoney } from '../utils/emi';
import { sampleLoans } from '../utils/testData';

// Displayed amounts have 2 decimals, so the oracle may differ from the page by at most half a paisa plus float noise.
const MONEY_TOLERANCE = 0.011;

const dashboard = (w: CustomWorld) => new DashboardPage(w.page);
const report = (w: CustomWorld) => new ReportPage(w.page);

function expectClose(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: page shows ${actual}, expected ${expected.toFixed(2)}`).toBeLessThanOrEqual(MONEY_TOLERANCE);
}

Given('I open the application', async function (this: CustomWorld) {
  await dashboard(this).open('/');
});

// Cucumber step matching ignores the Given/When/Then keyword, so one definition serves all three.
Given('I open the {string} view', async function (this: CustomWorld, name: 'Dashboard' | 'EMI Report') {
  await dashboard(this).openTab(name);
});

// ---- Dashboard ----------------------------------------------------------------------------

Then('the page title {string} is visible', async function (this: CustomWorld, title: string) {
  await expect(dashboard(this).title()).toHaveText(title);
  await expect(this.page).toHaveTitle(title);
});

Then('the dashboard shows {int} loans in the portfolio table', async function (this: CustomWorld, count: number) {
  await expect(dashboard(this).loanRows()).toHaveCount(count);
});

Then('the portfolio summary cards are populated', async function (this: CustomWorld) {
  const d = dashboard(this);
  for (const card of [d.loanCount(), d.totalPrincipal(), d.totalInterest(), d.averageEmi()]) {
    await expect(card).not.toHaveText('-');
    await expect(card).not.toBeEmpty();
  }
});

Then('there are no console errors', async function (this: CustomWorld) {
  expect(this.consoleErrors, `Console errors: ${this.consoleErrors.join(' | ')}`).toEqual([]);
});

Then('the dashboard totals match the independently calculated values for the sample loans', async function (this: CustomWorld) {
  const results = sampleLoans.map((l) => calculateEmi(l.amount, l.rate, l.years));
  const totalPrincipal = sampleLoans.reduce((s, l) => s + l.amount, 0);
  const totalInterest = results.reduce((s, r) => s + r.totalInterest, 0);
  const averageEmi = results.reduce((s, r) => s + r.emi, 0) / results.length;

  const d = dashboard(this);
  await expect(d.loanCount()).toHaveText(String(sampleLoans.length));
  expectClose(parseMoney(await d.totalPrincipal().innerText()), totalPrincipal, 'Total principal');
  expectClose(parseMoney(await d.totalInterest().innerText()), totalInterest, 'Total interest');
  expectClose(parseMoney(await d.averageEmi().innerText()), averageEmi, 'Average EMI');
});

Then('the EMI form is displayed with its three inputs', async function (this: CustomWorld) {
  const r = report(this);
  await expect(r.amountInput()).toBeVisible();
  await expect(r.rateInput()).toBeVisible();
  await expect(r.tenureInput()).toBeVisible();
  await expect(r.calculateButton()).toBeEnabled();
});

Then('the {string} content is hidden', async function (this: CustomWorld, view: string) {
  await expect(this.page.getByRole('tabpanel', { name: view, includeHidden: true })).toBeHidden();
});

// ---- EMI report ---------------------------------------------------------------------------

When('I calculate a loan of {float} at {float} percent for {int} years', async function (this: CustomWorld, amount: number, rate: number, years: number) {
  await report(this).calculate(amount, rate, years);
});

Then('the displayed EMI matches the independently calculated EMI for {float}, {float} and {int}', async function (this: CustomWorld, amount: number, rate: number, years: number) {
  const r = report(this);
  await expect(r.emiResult()).toBeVisible();
  const expected = calculateEmi(amount, rate, years);
  expectClose(parseMoney(await r.emiResult().innerText()), expected.emi, 'Monthly EMI');
});

Then('the displayed total interest and total payment match for {float}, {float} and {int}', async function (this: CustomWorld, amount: number, rate: number, years: number) {
  const r = report(this);
  const expected = calculateEmi(amount, rate, years);
  expectClose(parseMoney(await r.totalInterestResult().innerText()), expected.totalInterest, 'Total interest');
  expectClose(parseMoney(await r.totalPaymentResult().innerText()), expected.totalPayment, 'Total payment');
});

Then('the yearly schedule has {int} rows', async function (this: CustomWorld, years: number) {
  await expect(report(this).scheduleRows()).toHaveCount(years);
});

Then('I see the error message {string}', async function (this: CustomWorld, message: string) {
  await expect(report(this).formError()).toHaveText(message);
});

Then('no results are shown', async function (this: CustomWorld) {
  await expect(report(this).emiResult()).toBeHidden();
});

// ---- Charts -------------------------------------------------------------------------------

Then('the dashboard bar chart is visible', async function (this: CustomWorld) {
  await expect(dashboard(this).barChart()).toBeVisible();
  const box = await dashboard(this).barChart().boundingBox();
  expect(box?.width ?? 0, 'chart has a rendered width').toBeGreaterThan(0);
  expect(box?.height ?? 0, 'chart has a rendered height').toBeGreaterThan(0);
});

Then('the bar chart has {int} bars, all with values greater than zero', async function (this: CustomWorld, count: number) {
  const values = await dashboard(this).chartValues('loans-bar-chart');
  expect(values).toHaveLength(count);
  for (const v of values) {
    expect(Number.isFinite(v) && v > 0, `bar value ${v} must be a number greater than 0`).toBe(true);
  }
});

Then('the pie chart is visible', async function (this: CustomWorld) {
  await expect(report(this).pieChart()).toBeVisible();
});

Then('both pie chart sections have values greater than zero', async function (this: CustomWorld) {
  const values = await report(this).chartValues('emi-pie-chart');
  const labels = await report(this).chartLabels('emi-pie-chart');
  expect(values, 'a pie chart with principal and interest has exactly 2 sections').toHaveLength(2);
  values.forEach((v, i) => expect(v, `${labels[i]} section must be greater than 0`).toBeGreaterThan(0));
});

Then('the pie chart sections equal the independently calculated principal and interest for {float}, {float} and {int}', async function (this: CustomWorld, amount: number, rate: number, years: number) {
  const [principal, interest] = await report(this).chartValues('emi-pie-chart');
  const expected = calculateEmi(amount, rate, years);
  expectClose(principal, amount, 'Principal slice');
  expectClose(interest, expected.totalInterest, 'Interest slice');
});
