@ui @report
Feature: EMI report
  The report view calculates EMI from the user's input. Expected values are calculated
  independently in test code, not copied from the page.

  Background:
    Given I open the application
    And I open the "EMI Report" view

  Scenario Outline: Submitted input produces the independently calculated output
    When I calculate a loan of <amount> at <rate> percent for <years> years
    Then the displayed EMI matches the independently calculated EMI for <amount>, <rate> and <years>
    And the displayed total interest and total payment match for <amount>, <rate> and <years>
    And the yearly schedule has <years> rows

    Examples:
      | amount  | rate | years |
      | 2500000 | 10   | 10    |
      | 5000000 | 7.5  | 15    |
      | 1000000 | 12   | 5     |

  Scenario Outline: Invalid input is rejected with a clear message
    When I calculate a loan of <amount> at <rate> percent for <years> years
    Then I see the error message "<message>"
    And no results are shown

    Examples:
      | amount | rate | years | message                                        |
      | 0      | 10   | 10    | Enter a loan amount greater than 0.            |
      | -500   | 10   | 10    | Enter a loan amount greater than 0.            |
      | 100000 | 75   | 10    | Enter an interest rate between 0 and 50.       |
      | 100000 | 10   | 0     | Enter a whole number of years between 1 and 40. |
