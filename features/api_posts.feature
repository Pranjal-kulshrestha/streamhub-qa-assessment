@api
Feature: POST /posts boundary and invalid data (JSONPlaceholder)
  Objective: the API must handle boundary and invalid input without server-side failures.

  NOTE: JSONPlaceholder is a mock API that accepts almost any body. Scenarios in the default run
  therefore assert what matters for robustness (no 5xx, fast response, valid JSON) and record
  the actual status. Scenarios tagged @known-issue assert the stricter expectation from the brief
  (4xx for invalid data) and are expected to fail against this service. Run them with
  `npm run test:known-issues`. See README "API test findings".

  Scenario: Baseline - a valid post is created
    When I send a POST to "/posts" with the "valid" payload
    Then the response status is 201
    And the response is JSON containing an id
    And the response time is within the limit

  Scenario Outline: Invalid or extreme payloads do not cause a server failure
    When I send a POST to "/posts" with the "<payload>" payload
    Then the response status is not a server error
    And the response time is within the limit
    And the actual status is recorded in the test log

    Examples:
      | payload            |
      | long_title         |
      | special_characters |
      | missing_userid     |
      | missing_title      |
      | empty_object       |
      | wrong_types        |
      | negative_userid    |

  @known-issue
  Scenario Outline: The API should reject invalid input with a 4xx error
    When I send a POST to "/posts" with the "<payload>" payload
    Then the response status is a client error

    Examples:
      | payload         |
      | missing_userid  |
      | missing_title   |
      | empty_object    |
      | wrong_types     |
      | negative_userid |

  @known-issue
  Scenario: Malformed JSON should not cause a server error
    When I send a POST to "/posts" with the "malformed_json" payload
    Then the response status is not a server error
