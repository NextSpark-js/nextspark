# Billing Plans - BDD Test Documentation

## Overview

These tests validate the billing system's plan-based features, limits, and quota enforcement.
Tests are organized by plan to ensure comprehensive coverage of each subscription tier.

---

## Test Files Structure

```
e2e/api/billing/plans/
├── README.md                    # This file - BDD documentation
├── free-plan.cy.ts             # Free plan tests
├── starter-plan.cy.ts          # Starter plan tests
├── pro-plan.cy.ts              # Pro plan tests
├── business-plan.cy.ts         # Business plan tests
├── downgrade-scenarios.cy.ts   # Downgrade policy tests
└── fixtures/
    └── billing-plans.json      # Plan configurations for tests
```

---

## BDD Specifications

### Feature: Free Plan Restrictions

```gherkin
Feature: Free Plan Restrictions
  As a user with a Free plan
  I want to understand my plan limitations
  So that I can decide if I need to upgrade

  Background:
    Given I am authenticated as a user with Free plan
    And my team has the Free subscription active

  # Scenario 1.1: Auto-subscription on team creation
  Scenario: New team gets Free plan automatically
    When I create a new team
    Then the team should have an active Free subscription
    And the plan slug should be "free"

  # Scenario 1.2: Basic analytics access
  Scenario: User can access basic analytics
    When I check my subscription details
    Then the plan features should include "basic_analytics"

  # Scenario 1.3: Advanced analytics blocked
  Scenario: User cannot access advanced analytics
    When I check action "analytics.view_advanced"
    Then the action should be denied
    And the reason should be "feature_not_in_plan"

  # Scenario 1.4: Team members limit
  Scenario: Team members limit of 3 is enforced
    Given my team has 3 members
    When I check action "team.members.invite"
    Then the action should be denied
    And the reason should be "quota_exceeded"
    And the quota current should be 3
    And the quota max should be 3

  # Scenario 1.5: Tasks limit
  Scenario: Tasks limit of 50 is enforced
    Given my team has 50 tasks
    When I check action "tasks.create"
    Then the action should be denied
    And the reason should be "quota_exceeded"

  # Scenario 1.6: Customers limit
  Scenario: Customers limit of 25 is enforced
    Given my team has 25 customers
    When I check action "customers.create"
    Then the action should be denied
    And the reason should be "quota_exceeded"

  # Scenario 1.7: API calls monthly tracking
  Scenario: API calls are tracked monthly
    When I check usage for "api_calls"
    Then the period key should be in format "YYYY-MM"
    And the max should be 1000

  # Scenario 1.8: Domain features blocked
  Scenario: Domain-specific features are not available
    When I check action "tasks.automate"
    Then the action should be denied
    And the reason should be "feature_not_in_plan"

    When I check action "customers.bulk_import"
    Then the action should be denied

    When I check action "tasks.create_recurring"
    Then the action should be denied
```

### Feature: Starter Plan Features

```gherkin
Feature: Starter Plan Features
  As a user with a Starter plan
  I want to access starter-level features
  So that I can grow my small team

  Background:
    Given I am authenticated as a user with Starter plan
    And my team has the Starter subscription active

  Scenario: Starter plan includes advanced analytics
    When I check action "analytics.view_advanced"
    Then the action should be allowed

  Scenario: Starter plan includes API access
    When I check action "api.generate_key"
    Then the action should be allowed

  Scenario: Starter plan includes guest access
    When I check action "team.invite_guest"
    Then the action should be allowed

  Scenario: Starter plan limits - 5 team members
    Given my team has 5 members
    When I check action "team.members.invite"
    Then the action should be denied
    And the quota max should be 5

  Scenario: Starter plan limits - 200 tasks
    When I check usage for "tasks"
    Then the max should be 200

  Scenario: Starter plan limits - 100 customers
    When I check usage for "customers"
    Then the max should be 100

  Scenario: Starter plan does NOT include realtime analytics
    When I check action "analytics.view_realtime"
    Then the action should be denied
    And the reason should be "feature_not_in_plan"

  Scenario: Starter plan does NOT include task automation
    When I check action "tasks.automate"
    Then the action should be denied
```

### Feature: Pro Plan Features

```gherkin
Feature: Pro Plan Features
  As a user with a Pro plan
  I want to access professional features
  So that I can scale my growing business

  Background:
    Given I am authenticated as a user with Pro plan
    And my team has the Pro subscription active

  Scenario: Pro plan includes realtime analytics
    When I check action "analytics.view_realtime"
    Then the action should be allowed

  Scenario: Pro plan includes webhooks
    When I check action "webhooks.create"
    Then the action should be allowed

  Scenario: Pro plan includes custom branding
    When I check action "branding.customize"
    Then the action should be allowed

  Scenario: Pro plan includes task automation
    When I check action "tasks.automate"
    Then the action should be allowed

  Scenario: Pro plan includes priority support
    When I check action "support.priority_access"
    Then the action should be allowed

  Scenario: Pro plan limits - 15 team members
    When I check usage for "team_members"
    Then the max should be 15

  Scenario: Pro plan limits - 1000 tasks
    When I check usage for "tasks"
    Then the max should be 1000

  Scenario: Pro plan limits - 500 customers
    When I check usage for "customers"
    Then the max should be 500

  Scenario: Pro plan limits - 10 webhooks
    When I check usage for "webhooks_count"
    Then the max should be 10

  Scenario: Pro plan does NOT include SSO
    When I check action "auth.configure_sso"
    Then the action should be denied
    And the reason should be "feature_not_in_plan"

  Scenario: Pro plan does NOT include customer import
    When I check action "customers.bulk_import"
    Then the action should be denied
```

### Feature: Business Plan Features

```gherkin
Feature: Business Plan Features
  As a user with a Business plan
  I want to access enterprise-grade features
  So that I can run my large organization

  Background:
    Given I am authenticated as a user with Business plan
    And my team has the Business subscription active

  Scenario: Business plan includes SSO
    When I check action "auth.configure_sso"
    Then the action should be allowed

  Scenario: Business plan includes audit logs
    When I check action "security.view_audit_logs"
    Then the action should be allowed

  Scenario: Business plan includes customer import
    When I check action "customers.bulk_import"
    Then the action should be allowed

  Scenario: Business plan includes recurring tasks
    When I check action "tasks.create_recurring"
    Then the action should be allowed

  Scenario: Business plan limits - 50 team members
    When I check usage for "team_members"
    Then the max should be 50

  Scenario: Business plan limits - 5000 tasks
    When I check usage for "tasks"
    Then the max should be 5000

  Scenario: Business plan limits - 2000 customers
    When I check usage for "customers"
    Then the max should be 2000

  Scenario: Business plan limits - 50 webhooks
    When I check usage for "webhooks_count"
    Then the max should be 50
```

### Feature: Downgrade Policy (Soft Limits)

```gherkin
Feature: Downgrade Policy - Soft Limits
  As a user downgrading from a higher plan
  I want my existing resources to remain accessible
  So that I don't lose my data

  Background:
    Given I am authenticated as a team owner

  Scenario: Downgrade is always allowed
    Given my team has Pro plan with 200 tasks
    When I request downgrade preview to Free plan
    Then the downgrade should be allowed
    And I should see warning about resources exceeding limits

  Scenario: Existing resources remain accessible after downgrade
    Given my team has Pro plan with 200 tasks
    When I downgrade to Free plan (limit: 50 tasks)
    Then all 200 tasks should still be accessible
    And I should be able to read any task

  Scenario: New resource creation blocked when over limit
    Given my team was downgraded from Pro to Free
    And my team has 200 tasks (exceeds Free limit of 50)
    When I check action "tasks.create"
    Then the action should be denied
    And the reason should be "quota_exceeded"
    And the quota current should be 200
    And the quota max should be 50

  Scenario: Creation allowed after reducing resources
    Given my team was downgraded from Pro to Free
    And my team originally had 200 tasks
    When I delete tasks until I have 40 remaining
    And I check action "tasks.create"
    Then the action should be allowed
    And the quota remaining should be 10

  Scenario: Features are lost immediately on downgrade
    Given my team has Pro plan with task_automation enabled
    When I downgrade to Free plan
    And I check action "tasks.automate"
    Then the action should be denied
    And the reason should be "feature_not_in_plan"

  Scenario: Team members remain but cannot add more
    Given my team has Pro plan with 8 members
    When I downgrade to Free plan (limit: 3 members)
    Then all 8 members should still be in the team
    But I should not be able to invite new members
```

---

## Test Data Requirements

### Sample Teams for Testing

| Team ID | Plan | Tasks | Customers | Members | Purpose |
|---------|------|-------|-----------|---------|---------|
| team-billing-free-001 | free | 49 | 24 | 2 | Test near-limit scenarios |
| team-billing-free-at-limit | free | 50 | 25 | 3 | Test at-limit blocking |
| team-billing-starter-001 | starter | 50 | 50 | 3 | Starter plan tests |
| team-billing-pro-001 | pro | 100 | 100 | 5 | Pro plan tests |
| team-billing-business-001 | business | 500 | 500 | 10 | Business plan tests |
| team-billing-downgrade-001 | free | 200 | 80 | 8 | Downgrade scenario (over-limit) |

---

## Selectors Reference

| Selector | Description |
|----------|-------------|
| `billing-usage-bar` | Usage progress bar |
| `billing-usage-current` | Current usage value |
| `billing-usage-max` | Maximum limit value |
| `billing-plan-badge` | Current plan badge |
| `billing-upgrade-button` | Upgrade CTA button |
| `billing-downgrade-warning` | Downgrade warning modal |
| `billing-quota-exceeded-toast` | Quota exceeded notification |

---

## Coverage Summary

| Plan | Features | Limits | Quota Tests |
|------|----------|--------|-------------|
| Free | 4 tests | 6 tests | 3 tests |
| Starter | 6 tests | 4 tests | 2 tests |
| Pro | 8 tests | 5 tests | 2 tests |
| Business | 6 tests | 4 tests | 2 tests |
| Downgrade | N/A | N/A | 6 tests |

**Total: 52 tests across 5 files**
