# {{THEME_DISPLAY_NAME}}

> **Note:** This file contains fictional test data for development and QA purposes only. Users, teams, and credentials listed here are sample data used for testing the application.

## Objective

<!-- Describe the main purpose of your theme -->
Describe the main objective and use case for this theme.

## Product

**{{THEME_DISPLAY_NAME}}** - Brief description of the application.

## Teams Mode

```
multi-tenant
```

- Users can belong to multiple teams
- Team Switcher enabled
- Create teams enabled
- Invitations enabled

## Entities

| Entity | Description |
|--------|-------------|
| tasks | Example entity with title, description, status |

## Permissions

### tasks

| Action | owner | admin | member | viewer |
|--------|:-----:|:-----:|:------:|:------:|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |

## Test Users

| Email | Name | Teams |
|-------|------|-------|
| owner@example.com | Test Owner | Demo Team (owner) |
| admin@example.com | Test Admin | Demo Team (admin) |
| member@example.com | Test Member | Demo Team (member) |
| viewer@example.com | Test Viewer | Demo Team (viewer) |

**Password:** `Test1234`

## Teams

| Team | Industry | Members |
|------|----------|---------|
| Demo Team | Technology | 4 |

## Use Cases

1. Teams from different industries sharing the same platform
2. Users with different roles in different organizations
3. Complete data isolation between teams
