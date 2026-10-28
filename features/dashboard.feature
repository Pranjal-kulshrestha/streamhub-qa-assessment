@ui @dashboard
Feature: Dashboard
  As a loan analyst I want a summary of my loan portfolio
  so that I can see total exposure at a glance.

  Scenario: Dashboard loads with the portfolio summary
    Given I open the application
    Then the page title "Loan EMI Dashboard" is visible
    And the dashboard shows 3 loans in the portfolio table
    And the portfolio summary cards are populated
    And there are no console errors

  Scenario: Dashboard totals match independently calculated values
    Given I open the application
    Then the dashboard totals match the independently calculated values for the sample loans

  Scenario: User navigates to the EMI report view
    Given I open the application
    When I open the "EMI Report" view
    Then the EMI form is displayed with its three inputs
    And the "Dashboard" content is hidden
