import { Locator, Page } from 'playwright';

/**
 * INTENTIONALLY BROKEN LOCATORS (AI self-healing exercise).
 * They are deliberately left broken. Do not "fix" them: they are the input for healing/healer.ts
 * and for SELF_HEALING.md. Run them with `npm run test:broken`; the default test run excludes them.
 *
 * Why each one is brittle:
 *  1. calculateButton   - id that was renamed (#calc-btn-old); ids are not stable contracts.
 *  2. amountInput       - positional XPath; breaks when any wrapper element is added or removed.
 *  3. totalInterestText - class name that does not exist (stale or auto-generated styling class).
 *  4. reportTab         - exact text match on an old label ("EMI Reports"); the label is now "EMI Report".
 *  5. pieChart          - wrong data-testid (emi-chart-pie); the real one is emi-pie-chart.
 */
export type BrokenAction = 'click' | 'fill' | 'text' | 'visible';

export interface LocatorHints {
  role?: string;
  name?: string;
  label?: string;
  testId?: string;
  text?: string;
}

export interface BrokenLocatorEntry {
  id: string;
  /** What the test is trying to do, in plain words. This is what the AI healer is told. */
  intent: string;
  /** Human readable copy of the broken selector, for reports. */
  selectorText: string;
  action: BrokenAction;
  build: (page: Page) => Locator;
  /** Puts the app into the state where the element exists (open a tab, run a calculation). */
  prepare: (page: Page) => Promise<void>;
  /** Only used by the rule-based healer fallback (no AI key). The AI mode ignores these. */
  hints: LocatorHints;
}

const openReport = async (page: Page) => {
  await page.getByRole('tab', { name: 'EMI Report' }).click();
};
const openReportAndCalculate = async (page: Page) => {
  await openReport(page);
  await page.getByRole('button', { name: 'Calculate' }).click();
};

export const brokenLocatorCatalog: BrokenLocatorEntry[] = [
  {
    id: 'calculateButton',
    intent: 'Click the Calculate button on the EMI Report view',
    selectorText: "page.locator('#calc-btn-old')",
    action: 'click',
    build: (page) => page.locator('#calc-btn-old'), // BROKEN
    prepare: openReport,
    hints: { role: 'button', name: 'Calculate' },
  },
  {
    id: 'amountInput',
    intent: 'Type a value into the Loan amount field on the EMI Report view',
    selectorText: "page.locator('//div[2]/div/form/div[1]/input')",
    action: 'fill',
    build: (page) => page.locator('//div[2]/div/form/div[1]/input'), // BROKEN
    prepare: openReport,
    hints: { label: 'Loan amount' },
  },
  {
    id: 'totalInterestText',
    intent: 'Read the Total interest value shown in the portfolio summary on the Dashboard',
    selectorText: "page.locator('.summary-total-interest')",
    action: 'text',
    build: (page) => page.locator('.summary-total-interest'), // BROKEN
    prepare: async () => undefined,
    hints: { testId: 'total-interest' },
  },
  {
    id: 'reportTab',
    intent: 'Click the tab that opens the EMI Report view',
    selectorText: "page.getByRole('tab', { name: 'EMI Reports', exact: true })",
    action: 'click',
    build: (page) => page.getByRole('tab', { name: 'EMI Reports', exact: true }), // BROKEN
    prepare: async () => undefined,
    hints: { role: 'tab', name: 'EMI Report' },
  },
  {
    id: 'pieChart',
    intent: 'Check that the principal versus interest pie chart is visible after a calculation',
    selectorText: "page.getByTestId('emi-chart-pie')",
    action: 'visible',
    build: (page) => page.getByTestId('emi-chart-pie'), // BROKEN
    prepare: openReportAndCalculate,
    hints: { testId: 'emi-pie-chart' },
  },
];

export class BrokenLocators {
  constructor(private readonly page: Page) {}

  entry(id: string): BrokenLocatorEntry {
    const found = brokenLocatorCatalog.find((e) => e.id === id);
    if (!found) {
      throw new Error(`Unknown broken locator "${id}"`);
    }
    return found;
  }

  /** Runs the action with the (broken) locator and a short timeout so the failure is quick. */
  async use(id: string): Promise<void> {
    const entry = this.entry(id);
    await entry.prepare(this.page);
    const locator = entry.build(this.page);
    const options = { timeout: 3000 };
    switch (entry.action) {
      case 'click':
        await locator.click(options);
        break;
      case 'fill':
        await locator.fill('123456', options);
        break;
      case 'text':
        await locator.innerText(options);
        break;
      case 'visible':
        await locator.waitFor({ state: 'visible', timeout: 3000 });
        break;
    }
  }
}
