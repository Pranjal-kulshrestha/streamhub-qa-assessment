@ui @broken-locator
Feature: Intentionally broken locators (AI self-healing exercise)
  These scenarios FAIL ON PURPOSE. They use brittle or outdated locators from
  src/pages/BrokenLocators.ts and are excluded from the default run.
  See SELF_HEALING.md for how AI would detect, repair and validate each locator.

  Scenario Outline: Broken locator <id> cannot find its element
    Given I open the application
    When I use the broken locator "<id>"

    Examples:
      | id                |
      | calculateButton   |
      | amountInput       |
      | totalInterestText |
      | reportTab         |
      | pieChart          |
