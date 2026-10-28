/**
 * Self-healing locator proof of concept. Run: npm run heal
 *
 * Pipeline (see SELF_HEALING.md):
 *   1. DETECT    run each intentionally broken locator; a timeout means the locator is broken.
 *   2. PROPOSE   ask for candidate locators. AI mode (ANTHROPIC_API_KEY set) sends the intent plus an
 *                accessibility snapshot to Claude. Without a key, a rule-based generator is used
 *                (hints stored with each broken locator), so the POC always runs offline.
 *   3. VALIDATE  every candidate must match exactly one element, be visible, suit the action
 *                (editable for fill, enabled for click) and the real action must succeed.
 *   4. REPORT    nothing is changed in the source. Fixes are written as proposals to
 *                healing/healing-report.json for human review.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Locator, Page, chromium } from 'playwright';
import { config } from '../config/env';
import { BrokenLocatorEntry, brokenLocatorCatalog } from '../src/pages/BrokenLocators';

type Strategy = 'role' | 'label' | 'testid' | 'text';
export interface Candidate {
  strategy: Strategy;
  value: string; // role name for "role", otherwise the label / test id / text
  name?: string; // accessible name for "role"
  reason?: string;
  confidence?: number;
}

const toLocator = (page: Page, c: Candidate): Locator => {
  switch (c.strategy) {
    case 'role':
      return page.getByRole(c.value as Parameters<Page['getByRole']>[0], { name: c.name });
    case 'label':
      return page.getByLabel(c.value);
    case 'testid':
      return page.getByTestId(c.value);
    case 'text':
      return page.getByText(c.value);
  }
};

const describe = (c: Candidate): string =>
  c.strategy === 'role' ? `getByRole('${c.value}', { name: '${c.name}' })` : `${{ label: 'getByLabel', testid: 'getByTestId', text: 'getByText' }[c.strategy]}('${c.value}')`;

// ---- 2a. rule-based proposals (offline fallback) ------------------------------------------
function ruleBasedCandidates(entry: BrokenLocatorEntry): Candidate[] {
  const h = entry.hints;
  const out: Candidate[] = [];
  if (h.testId) out.push({ strategy: 'testid', value: h.testId, reason: 'data-testid from hints', confidence: 0.9 });
  if (h.role && h.name) out.push({ strategy: 'role', value: h.role, name: h.name, reason: 'role and accessible name from hints', confidence: 0.85 });
  if (h.label) out.push({ strategy: 'label', value: h.label, reason: 'form label from hints', confidence: 0.85 });
  if (h.text) out.push({ strategy: 'text', value: h.text, reason: 'visible text from hints', confidence: 0.5 });
  return out;
}

// ---- 2b. AI proposals ---------------------------------------------------------------------
function buildPrompt(entry: BrokenLocatorEntry, snapshot: string): string {
  return [
    'You repair broken Playwright locators for a web test suite.',
    `The test intent is: ${entry.intent}`,
    `The failing locator is: ${entry.selectorText}`,
    'Here is the current accessibility snapshot of the page:',
    snapshot,
    '',
    'Rules: prefer role + accessible name, then label, then data-testid, then text. Never use positional CSS or XPath.',
    'The locator must match exactly one element and must express the intent, not just any element.',
    'Reply with ONLY a JSON array of up to 3 candidates, best first. Each item:',
    '{"strategy": "role" | "label" | "testid" | "text", "value": string, "name": string (role only), "reason": string, "confidence": number between 0 and 1}',
    'For strategy "role", value is the ARIA role (for example "button") and name is the accessible name.',
  ].join('\n');
}

async function aiCandidates(entry: BrokenLocatorEntry, snapshot: string): Promise<Candidate[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 800, messages: [{ role: 'user', content: buildPrompt(entry, snapshot) }] }),
  });
  if (!response.ok) throw new Error(`AI request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((b) => b.type === 'text')?.text ?? '[]';
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  return JSON.parse(json) as Candidate[];
}

// ---- 3. validation ------------------------------------------------------------------------
interface Validation {
  candidate: string;
  passed: boolean;
  checks: Record<string, boolean | string>;
}

async function validate(page: Page, entry: BrokenLocatorEntry, c: Candidate): Promise<Validation> {
  const locator = toLocator(page, c);
  const checks: Record<string, boolean | string> = {};
  checks.matchesExactlyOne = (await locator.count()) === 1;
  checks.visible = checks.matchesExactlyOne && (await locator.isVisible());
  if (entry.action === 'fill') checks.editable = checks.visible && (await locator.isEditable());
  if (entry.action === 'click') checks.enabled = checks.visible && (await locator.isEnabled());
  let actionWorks = false;
  if (checks.visible) {
    try {
      // The real action, with a short timeout. It runs on the page that the broken locator failed on.
      if (entry.action === 'click') await locator.click({ timeout: 3000 });
      else if (entry.action === 'fill') await locator.fill('123456', { timeout: 3000 });
      else if (entry.action === 'text') await locator.innerText({ timeout: 3000 });
      else await locator.waitFor({ state: 'visible', timeout: 3000 });
      actionWorks = true;
    } catch (e) {
      checks.actionError = (e as Error).message.split('\n')[0];
    }
  }
  checks.actionSucceeds = actionWorks;
  const passed = Object.entries(checks).filter(([k]) => k !== 'actionError').every(([, v]) => v === true);
  return { candidate: describe(c), passed, checks };
}

async function freshPage(browser: Awaited<ReturnType<typeof chromium.launch>>, entry: BrokenLocatorEntry): Promise<Page> {
  const context = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await entry.prepare(page);
  return page;
}

interface ReportItem {
  id: string;
  intent: string;
  brokenLocator: string;
  detected: boolean;
  mode: 'ai' | 'rule-based';
  candidates: { locator: string; reason?: string; confidence?: number; validation: Validation }[];
  proposedFix: string | null;
  status: 'healed-proposal' | 'not-healed' | 'locator-ok';
}

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { startServer } = require('../app/server');
  const server = config.startServer ? await startServer(Number(new URL(config.baseUrl).port || 80)) : undefined;
  const browser = await chromium.launch({ headless: config.headless });
  const mode: 'ai' | 'rule-based' = config.anthropicApiKey ? 'ai' : 'rule-based';
  const report: ReportItem[] = [];

  for (const entry of brokenLocatorCatalog) {
    // 1. DETECT
    let page = await freshPage(browser, entry);
    let detected = false;
    try {
      await entry.build(page).waitFor({ state: 'attached', timeout: 2500 });
    } catch {
      detected = true;
    }
    const item: ReportItem = { id: entry.id, intent: entry.intent, brokenLocator: entry.selectorText, detected, mode, candidates: [], proposedFix: null, status: detected ? 'not-healed' : 'locator-ok' };
    if (!detected) { report.push(item); await page.context().close(); continue; }

    // 2. PROPOSE
    const snapshot = await page.locator('body').ariaSnapshot();
    let candidates: Candidate[];
    try {
      candidates = mode === 'ai' ? await aiCandidates(entry, snapshot) : ruleBasedCandidates(entry);
    } catch (e) {
      console.warn(`AI mode failed (${(e as Error).message}); using rule-based candidates.`);
      candidates = ruleBasedCandidates(entry);
    }

    // 3. VALIDATE (a fresh page per candidate so one candidate cannot affect the next)
    for (const c of candidates) {
      await page.context().close();
      page = await freshPage(browser, entry);
      const validation = await validate(page, entry, c);
      item.candidates.push({ locator: describe(c), reason: c.reason, confidence: c.confidence, validation });
      if (validation.passed && !item.proposedFix) {
        item.proposedFix = describe(c);
        item.status = 'healed-proposal';
      }
    }
    await page.context().close();
    report.push(item);
    console.log(`${item.status === 'healed-proposal' ? 'HEAL ' : 'FAIL '} ${entry.id}: ${entry.selectorText}  ->  ${item.proposedFix ?? 'no valid candidate'}`);
  }

  await browser.close();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  const out = path.resolve('healing', 'healing-report.json');
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), mode, results: report }, null, 2));
  const healed = report.filter((r) => r.status === 'healed-proposal').length;
  console.log(`\n${healed}/${report.length} broken locators have a validated fix proposal. Report: ${out}`);
  console.log('No source files were modified. A human reviews and applies the proposals.');
}

main().catch((e) => { console.error(e); process.exit(1); });
