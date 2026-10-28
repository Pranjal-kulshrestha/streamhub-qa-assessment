// Cucumber profiles. The default run excludes the intentionally broken locator scenarios
// and the known-issue API scenarios (they have their own profiles and reports).
const base = {
  requireModule: ['ts-node/register'],
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  paths: ['features/**/*.feature'],
  formatOptions: { snippetInterface: 'async-await' },
};

module.exports = {
  default: {
    ...base,
    tags: 'not @known-issue and not @broken-locator',
    format: [
      'progress-bar',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
      'summary:reports/summary.txt',
    ],
  },
  known: {
    ...base,
    tags: '@known-issue',
    format: ['progress', 'html:reports/known-issues-report.html', 'summary:reports/known-issues-summary.txt'],
  },
  broken: {
    ...base,
    tags: '@broken-locator',
    format: ['progress', 'html:reports/broken-locators-report.html', 'summary:reports/broken-locators-summary.txt'],
  },
};
