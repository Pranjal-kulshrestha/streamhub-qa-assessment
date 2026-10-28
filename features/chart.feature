@ui @chart
Feature: Charts render valid data
  Charts are canvas elements, so the app exposes the plotted values on the canvas
  (data-values) and the tests check them for validity.

  Scenario: Dashboard bar chart is visible with valid non-zero data
    Given I open the application
    Then the dashboard bar chart is visible
    And the bar chart has 3 bars, all with values greater than zero

  Scenario Outline: Pie chart shows principal and interest for a calculated loan
    Given I open the application
    And I open the "EMI Report" view
    When I calculate a loan of <amount> at <rate> percent for <years> years
    Then the pie chart is visible
    And both pie chart sections have values greater than zero
    And the pie chart sections equal the independently calculated principal and interest for <amount>, <rate> and <years>

    Examples:
      | amount  | rate | years |
      | 2500000 | 10   | 10    |
      | 5000000 | 7.5  | 15    |
