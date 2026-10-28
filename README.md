# Streamhub QA Automation Assessment (Section A)

Playwright + Cucumber (TypeScript) framework that tests a small web application I built, plus API tests against
JSONPlaceholder, SQL scenarios, and an AI self-healing locator exercise.

I chose **Section A: Web Application + UI Automation** (A1 app, A2 UI tests, A3 API tests, A4 SQL tests).

## Results at a glance

| Suite | Command | Result |
|-------|---------|--------|
| UI + API (default run) | `npm test` | **21 scenarios, 96 steps, all passed** |
| API known issues (expected to fail) | `npm run test:known-issues` | 6 scenarios fail as expected (see "API test findings") |
| Broken locators (expected to fail) | `npm run test:broken` | 5 scenarios fail on purpose (see `SELF_HEALING.md`) |
| Self-healing POC | `npm run heal` | 5 of 5 broken locators get a validated fix proposal |
| SQL | `npm run sql` | Both scenarios match an independent JavaScript calculation |

**View the HTML reports online:** https://pranjal-kulshrestha.github.io/streamhub-qa-assessment/ (GitHub shows `.html` files as source code, so use this link or open the file locally after cloning).

Evidence is committed in [`reports/`](reports) and [`sql/screenshots/`](sql/screenshots):
- `reports/cucumber-report.html` main HTML report (open in a browser), `reports/cucumber-report.json`, `reports/summary.txt`
- `reports/known-issues-report.html`, `reports/broken-locators-report.html`
- `reports/screenshots/` one screenshot per UI scenario (failures prefixed `FAILED_`)
- `reports/logs/` console output of every run
- `sql/screenshots/` schema, sample data and query output screenshots, `sql/results.md` raw results

## Requirements

- Node.js 20 or newer (built and run on Node 25)
- npm

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

## How to run

```bash
npm test                    # default run: all UI and API scenarios, writes reports/
npm run test:ui             # UI scenarios only
npm run test:api            # API scenarios only
npm run test:known-issues   # API scenarios that assert strict validation (expected to fail)
npm run test:broken         # intentionally broken locators (expected to fail)
npm run heal                # self-healing proof of concept
npm run sql                 # runs the SQL scenarios and regenerates the screenshots
npm run lint                # TypeScript type check
npm start                   # serve the web app only, at BASE_URL
```

`npm test` starts the web app by itself (`START_SERVER=true`), runs Chromium headless, and writes the HTML report to
`reports/cucumber-report.html`. To watch the browser, set `HEADLESS=false` in `.env`.

Run a single feature or tag: `npx cucumber-js features/report.feature` or `npx cucumber-js --tags "@chart"`.

## Environment configuration (no hardcoded URLs)

All URLs and settings come from environment files, loaded by [`config/env.ts`](config/env.ts):

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | Web app under test |
| `API_BASE_URL` | API under test (JSONPlaceholder) |
| `START_SERVER` | `true` = framework starts `app/server.js`, `false` = test an already running or remote app |
| `HEADLESS` | `false` to watch the browser |
| `API_MAX_RESPONSE_MS` | Response time limit for API checks |
| `ANTHROPIC_API_KEY` | Optional, enables AI mode of the healing POC |

`ENV=staging npm test` loads `.env.staging` first and falls back to `.env`. `grep -r "http" src features config` shows no URL in test code.

## A1. The web application

`app/` is a small **Loan EMI Dashboard** (plain HTML, CSS and JavaScript, Chart.js served from `node_modules`):

- **Dashboard** with summary cards (loan count, total principal, total interest, average EMI), a bar chart of monthly EMI by loan, and a loan table.
- **EMI Report** driven by user input: loan amount, rate, tenure. It shows monthly EMI, total interest, total payment, a **pie chart** (principal vs interest) and a yearly repayment schedule table. Invalid input shows an error message.

It was built to be testable: semantic HTML (roles, labels, `aria-label`s) plus `data-testid` on key values. Canvas charts cannot be read from the DOM,
so the app also exposes the plotted data on the canvas as `data-labels` and `data-values`, which the tests read.

## A2. UI tests

| Feature file | What it covers |
|--------------|----------------|
| `features/dashboard.feature` | Dashboard loads, title, summary cards populated, no console errors, totals equal independently calculated values, navigation to the report view |
| `features/report.feature` | Submit input and compare EMI, total interest and total payment with independently calculated values (3 examples); yearly schedule row count; 4 invalid-input cases |
| `features/chart.feature` | Bar chart visible with 3 bars all greater than zero; pie chart visible, both sections greater than zero, and equal to the independently calculated principal and interest |

**Independent oracle.** Expected values come from [`src/utils/emi.ts`](src/utils/emi.ts), a separate implementation of
`E = P·r·(1+r)^n / ((1+r)^n − 1)`, `r = rate / 12 / 100`, `n = years × 12`. The tests never copy a number from the page. Displayed values have 2 decimals, so comparison uses a 0.011 tolerance.

## A3. API tests (JSONPlaceholder)

`features/api_posts.feature` sends `POST /posts` with a very long title (20,000 characters), special characters (script tag, quotes, SQL text, emoji, control characters),
missing `userId`, missing `title`, empty body, wrong types, negative `userId`, and malformed JSON, using Playwright's request context.

### API test findings

JSONPlaceholder is a **mock API that does not validate input**. Measured against the live service (`npm` script `scripts/api-status-probe.ts`):

| Payload | Actual status |
|---------|---------------|
| valid | 201 |
| 20,000-character title | 201 |
| special characters | 201 |
| missing `userId` | 201 |
| missing `title` | 201 |
| empty object | 201 |
| wrong types | 201 |
| negative `userId` | 201 |
| malformed JSON | **500** |

The brief expects "appropriate HTTP error codes or error messages for invalid inputs without server-side failures". The service does not meet that, so I split the tests honestly:

- **Default run (`@api`, passing):** asserts what the service does guarantee: a valid post returns 201 with a numeric `id` and JSON content type; none of the invalid or extreme
  payloads causes a 5xx; every response arrives within the limit; the actual status is written to the test log.
- **Known issues (`@known-issue`, failing on purpose):** assert the stricter expectation from the brief (4xx for missing or invalid fields, no 5xx for malformed JSON).
  They fail because of the service, not the test. Run `npm run test:known-issues`; the report is `reports/known-issues-report.html`.
  Against a real API with validation, these are the scenarios that would pass.

## A4. SQL tests

Files in [`sql/`](sql): `schema.sql`, `data.sql` (synthetic data, names and scores invented), `scenario1_round_trips.sql`,
`scenario2_scoring_streaks.sql`, `dialects.md` (PostgreSQL, MySQL, SQL Server changes), `results.md`, and `screenshots/`.

- **Scenario 1: round-trip transfers.** A self-join on `transactions`: B to A after A to B, within 24 hours (inclusive, computed in epoch seconds so the exact 24 h case is not lost to floating point),
  and the returned amount within 10% of the original. If one send has two returns, each pair is a row. Sample data includes boundary cases (exactly 24 h, exactly 10%, 899 vs 1000, 24 h + 1 second).
- **Scenario 2: IPL 2024 streaks.** Window functions, "gaps and islands": `ROW_NUMBER() over all matches` minus `ROW_NUMBER() over 30+ matches` gives a constant per unbroken streak.
  Returns player name, streak start date and streak length for streaks of 3 or more. "Consecutive" means consecutive matches the player played, in date order; a player with two streaks appears twice.
  Only the 2024 season is counted (a 2023 row is in the data to prove the filter).

`npm run sql` runs both queries on in-memory SQLite and **checks each result against an independent JavaScript calculation** before taking the screenshots.

## Self-healing locators

See [`SELF_HEALING.md`](SELF_HEALING.md): the 5 intentionally broken locators (left broken), how AI would detect, repair and validate them, and the working proof of concept.

## Architecture

```text
features/              Gherkin scenarios (behaviour, no code)
src/steps/             Step definitions: thin, call page objects and assertions only
src/pages/             Page Object Model: BasePage, DashboardPage, ReportPage, BrokenLocators
src/support/           Cucumber World (browser or API context per scenario) and hooks (server, screenshots)
src/utils/             EMI oracle, test data
config/env.ts          Typed environment configuration
app/                   The web application under test and its tiny static server
healing/               Self-healing POC and its report
scripts/               SQL runner, API status probe
sql/                   Schema, data, queries, screenshots
reports/               Test evidence
```

How it fits together: a `.feature` file calls steps; steps use page objects (all locators live there, no locators in steps); the World gives each scenario a fresh browser
context (UI) or request context (API); hooks start the app server once, take a screenshot after every UI scenario and attach failures to the HTML report.
Locators use `getByRole`, `getByLabel` and `getByTestId`; assertions are Playwright web-first assertions with auto-wait, no fixed sleeps.

## Claude Code reflection

<!-- Replace or extend this section with your own experience before submitting. It describes how Claude Code was used to build this repo. -->

**How it was used.** Claude Code was used as a pair programmer for the whole repo: it scaffolded the folder structure, config, World and hooks, the app, page objects,
step definitions, SQL, the healing POC and the documents, and ran the suites and read the failures to iterate.

**What worked well**
- Scaffolding the Cucumber + Playwright + TypeScript structure and typed environment config quickly.
- Building the app with `data-testid`s and labels from the start, and exposing chart data for tests.
- Running every suite, reading the output, and probing the real API instead of assuming how it behaves.
- Cross-checking SQL output against an independent JavaScript calculation inside `scripts/run-sql.ts`.

**What went wrong, and how it was caught**
- **API assumption.** The brief expects error codes for invalid input. Probing JSONPlaceholder showed it returns 201 for almost everything and 500 for malformed JSON.
  The first draft of the tests would have asserted 4xx and failed for the wrong reason. The suite was split into passing robustness tests and `@known-issue` tests, and the finding is documented.
- **Wrong SQL sample data.** One row pair was commented as "a return before the send must not match". The first run returned 5 rows instead of the 4 expected, which exposed that the
  relationship is symmetric: the earlier transaction is simply the "original". The test case was redesigned (a return 24 h and 1 second later).
- **Floating-point date maths.** The first version of the 24-hour condition used `julianday() * 24 <= 24`, which can drop the exact-24-hours boundary. It was replaced with integer epoch seconds.
- **Duplicate step definition.** Cucumber matches steps regardless of Given/When/Then, so the same text defined twice would have been ambiguous. It was found on review and merged into one definition.
- Smaller items: a deprecated Cucumber option (`publishQuiet`) was removed, and the `progress-bar` formatter falls back to `progress` when output is not a terminal.

**What it cannot do for you.** It does not decide what is correct. The EMI formula, the definition of "similar amount" and "consecutive matches", and the honest reporting of the API behaviour
all needed human judgement. The AI mode of the healing POC has not been run against the real model (no API key was available), and the README says so.
