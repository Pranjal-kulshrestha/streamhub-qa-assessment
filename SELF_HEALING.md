# AI self-healing locators

This document describes how broken locators are detected, repaired with AI, and validated before any fix is applied.
It also covers the working proof of concept in [`healing/healer.ts`](healing/healer.ts).

## 1. The five intentionally broken locators

They live in [`src/pages/BrokenLocators.ts`](src/pages/BrokenLocators.ts), are used by
[`features/broken_locators.feature`](features/broken_locators.feature) (tag `@broken-locator`), and are **left broken on purpose**.
The default run excludes them. Run them with `npm run test:broken` (report: `reports/broken-locators-report.html`).

| # | Broken locator | Why it is brittle | Intent (what the test wants) |
|---|----------------|-------------------|------------------------------|
| 1 | `page.locator('#calc-btn-old')` | Id was renamed. Ids are not a stable contract. | Click Calculate on the EMI Report view |
| 2 | `page.locator('//div[2]/div/form/div[1]/input')` | Positional XPath. Any wrapper div added or removed breaks it. | Type into the Loan amount field |
| 3 | `page.locator('.summary-total-interest')` | Stale or styling-only class name that no longer exists. | Read Total interest on the Dashboard |
| 4 | `page.getByRole('tab', { name: 'EMI Reports', exact: true })` | Exact match on an old label ("EMI Reports", now "EMI Report"). | Open the EMI Report view |
| 5 | `page.getByTestId('emi-chart-pie')` | Wrong test id (real one is `emi-pie-chart`). | Check the pie chart is visible after a calculation |

## 2. Detection

A locator is treated as broken when the step fails with a **locator timeout** (`TimeoutError: waiting for locator(...)`) or a
**strict mode violation** (the locator matches more than one element).

How the suite detects it:

1. A hook around each step (or a custom `step` wrapper) catches the error and checks that it is a locator error, not an assertion error.
   Assertion failures such as "EMI is 33,000 but expected 33,037" are **never healed**, because they may be real product bugs.
2. It records evidence for the healer: the step text, the failing locator, the error message, the page URL, a screenshot,
   and an **accessibility snapshot** of the page (`page.locator('body').ariaSnapshot()`). The snapshot is small, structured and
   already shows roles and accessible names, which is exactly what stable locators are built from.
3. It checks the page really loaded (HTTP ok, no blocking dialog). If the page is wrong, healing is skipped.

The POC does this in `healer.ts` step 1: it runs each locator with a short wait and flags the ones that never attach.

## 3. Prompt approach

The model is given only what it needs, and a strict output format, so the answer can be checked by code.

Inputs:
- the **intent** in plain words (taken from the step or page object),
- the **failing locator** (so it can see what went wrong),
- the **accessibility snapshot** (not the whole HTML: less noise, fewer tokens, less sensitive data),
- the **locator rules** of this project.

Prompt used by the POC (`buildPrompt` in `healer.ts`):

```text
You repair broken Playwright locators for a web test suite.
The test intent is: <intent>
The failing locator is: <broken locator>
Here is the current accessibility snapshot of the page:
<aria snapshot>

Rules: prefer role + accessible name, then label, then data-testid, then text. Never use positional CSS or XPath.
The locator must match exactly one element and must express the intent, not just any element.
Reply with ONLY a JSON array of up to 3 candidates, best first. Each item:
{"strategy": "role" | "label" | "testid" | "text", "value": string, "name": string (role only), "reason": string, "confidence": number between 0 and 1}
```

Why this shape:
- **Intent first.** Without intent the model can return "a button" instead of "the Calculate button".
- **Constrained strategies.** The model may only return role, label, test id or text locators. It cannot return an XPath, so the fix cannot be as brittle as the original.
- **Several ranked candidates with a reason and confidence.** Validation picks the first one that passes; the reasons go into the review.
- **JSON only.** The output is parsed by code. Anything that does not parse is rejected.

## 4. Validation before applying a fix

An AI answer is a **proposal**, never trusted. Every candidate must pass all of these checks on the live page
(implemented in `validate()` in `healer.ts`):

| Check | Why |
|-------|-----|
| Matches **exactly one** element (`count() === 1`) | Prevents healing to a wrong, duplicated or too general element. |
| Element is **visible** | Rules out hidden duplicates. |
| Suits the action: **editable** for `fill`, **enabled** for `click` | Rules out an element that looks right but cannot do the action. |
| The **real action succeeds** (click, fill, read text, wait visible) | Proves the candidate works, not just that it exists. |
| Each candidate is tried on a **fresh page** | One candidate's side effects cannot make the next one pass. |

Further checks for a production version (not in the POC):
- Compare the matched element with the one from the last green run (tag, role, text, position in the accessibility tree). A big difference lowers confidence.
- Re-run the **whole scenario** with the candidate and require it to pass, including its value assertions.
- Reject candidates whose confidence is below a threshold (for example 0.7).
- Never heal locators used in negative checks (`not visible`, `count 0`), because a "found" element can hide a real defect.

## 5. Applying the fix

- The POC changes **no source file**. It writes `healing/healing-report.json` with the validated proposal for each locator.
- In a team setup, a pipeline job opens a **pull request** with the one-line diff, the evidence (before/after screenshot,
  validation results, model reason) and the confidence. A human approves it. Auto-merge is only acceptable for high-confidence,
  low-risk changes after the process has proven itself.
- Every heal is logged (what, when, why, confidence) so that healing rate and wrong-heal rate can be tracked.

## 6. Guardrails

- Heal **locator** failures only. Never heal assertions.
- Limit the number of heal attempts and the AI spend per run.
- Send the accessibility snapshot only. Do not send cookies, tokens or personal data. Mask sensitive field values first.
- Keep the API key in `.env` (git-ignored), never in the repo.
- After a healed locator is merged, tighten the page object so the fix becomes the new stable locator. The goal is fewer heals over time, not a suite that silently drifts.
- Better than healing: prevent the breakage. Ask developers for `data-testid` on key elements and keep locators semantic.

## 7. The working proof of concept

```bash
npm run heal
```

It runs the five broken locators, detects the failures, gets candidates, validates them, and writes `healing/healing-report.json`.
Output from the committed run (also in `reports/logs/healing-run.log`):

| Broken locator | Validated proposal |
|----------------|--------------------|
| `#calc-btn-old` | `getByRole('button', { name: 'Calculate' })` |
| `//div[2]/div/form/div[1]/input` | `getByLabel('Loan amount')` |
| `.summary-total-interest` | `getByTestId('total-interest')` |
| `getByRole('tab', { name: 'EMI Reports', exact: true })` | `getByRole('tab', { name: 'EMI Report' })` |
| `getByTestId('emi-chart-pie')` | `getByTestId('emi-pie-chart')` |

### Two modes, and what is honestly proven

- **Rule-based mode (default, offline).** Candidates come from hints stored next to each broken locator. This proves the
  **detection and validation pipeline** end to end, and runs without any key. It does not show AI reasoning, because the hints
  are supplied by the author.
- **AI mode (`ANTHROPIC_API_KEY` set in `.env`).** The same pipeline, but candidates come from Claude using the prompt in section 3.
  The code for this path is written (`aiCandidates` in `healer.ts`), but **it was not executed for the committed results because no
  API key was available while the repo was built.** To try it, add a key to `.env` and run `npm run heal`; the report header shows `"mode": "ai"`.
  If the AI call fails, the POC falls back to the rule-based candidates and prints a warning.
