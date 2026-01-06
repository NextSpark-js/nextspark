# Team Switcher - E2E Tests

## Overview

Comprehensive test suite for the TeamSwitcherCompact component in multi-tenant mode.
Tests team switching functionality, data reload after switch, and permission changes.

**Test File:** `team-switcher.cy.ts`

## Component Characteristics

| Property | Value |
|----------|-------|
| **Component** | `TeamSwitcherCompact` |
| **Location** | Sidebar footer, MobileMoreSheet |
| **Mode** | Multi-tenant |
| **Modal** | `TeamSwitchModal` (~1.4s animation) |

## Test Users

| User | Email | Teams | Roles |
|------|-------|-------|-------|
| Carlos | carlos.mendoza@nextspark.dev | Everpoint Labs, Carlos Mendoza Team, Riverstone Ventures | owner, owner, member |
| Ana | ana.garcia@nextspark.dev | Multiple teams | owner |
| Sarah | sarah.davis@nextspark.dev | Ironvale Global | viewer |

**Password for all:** `Test1234`

## Test Coverage

### 1. Single/Few Team User (2 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_001 | User sees their teams in switcher | Passing |
| TEAM_SW_002 | Manage Teams link visible and navigates | Passing |

### 2. Multi-Team User (5 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_010 | Multi-team user sees all teams | Passing |
| TEAM_SW_011 | Current team shows checkmark | Passing |
| TEAM_SW_012 | Roles displayed correctly (Spanish) | Passing |
| TEAM_SW_013 | Can switch teams successfully | Passing |
| TEAM_SW_014 | Modal appears during switch | Passing |

### 3. Data Reload After Switch (3 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_020 | Customers reload after switch | Passing |
| TEAM_SW_021 | Tasks reload after switch | Passing |
| TEAM_SW_022 | Sidebar shows new team name | Passing |

### 4. Permission Changes (6 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_030 | Owner can create customer | Passing |
| TEAM_SW_031 | Owner can edit/delete customer | Pending (missing data-cy) |
| TEAM_SW_032 | Member cannot create customer | Passing |
| TEAM_SW_033 | Member cannot delete customer | Pending (missing data-cy) |
| TEAM_SW_034 | Member blocked from /edit URL | Pending (missing data-cy) |
| TEAM_SW_035 | Member blocked from /create URL | Pending (missing data-cy) |

### 5. UI Behavior (3 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_040 | Dropdown closes on escape key | Passing |
| TEAM_SW_041 | Team avatar/initials display | Pending (selector needs work) |
| TEAM_SW_042 | Switcher hidden when sidebar collapsed | Pending (missing data-cy) |

### 6. Viewer Role (3 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_043 | Viewer can only read customers | Pending (Ironvale no entities) |
| TEAM_SW_044 | Viewer can only read tasks | Pending (Ironvale no entities) |
| TEAM_SW_045 | Viewer blocked from action URLs | Pending (missing data-cy) |

### 7. Mobile (3 tests)

| ID | Test Case | Status |
|----|-----------|--------|
| TEAM_SW_050 | Switcher visible in MobileMoreSheet | Pending (missing data-cy) |
| TEAM_SW_051 | Can switch teams from mobile | Pending (missing data-cy) |
| TEAM_SW_052 | Mobile shows all teams | Pending (missing data-cy) |

## Summary

| Category | Total | Passing | Pending |
|----------|-------|---------|---------|
| Single/Few Team User | 2 | 2 | 0 |
| Multi-Team User | 5 | 5 | 0 |
| Data Reload | 3 | 3 | 0 |
| Permission Changes | 6 | 2 | 4 |
| UI Behavior | 3 | 1 | 2 |
| Viewer Role | 3 | 0 | 3 |
| Mobile | 3 | 0 | 3 |
| **Total** | **25** | **13** | **12** |

## Data-cy Selectors Used

### TeamSwitcherCompact
```
[data-cy="team-switcher-compact"]     - Trigger button
[data-cy="team-switcher-dropdown"]    - Dropdown container
[data-cy="team-option-{slug}"]        - Team options (dynamic)
[data-cy="manage-teams-link"]         - Manage Teams navigation
```

### TeamSwitchModal
```
[data-cy="team-switch-modal"]         - Modal container
```

### Entity Lists
```
[data-cy="customers-list"]            - Customers list container
[data-cy="customers-row-{id}"]        - Customer row (dynamic)
[data-cy="customers-add"]             - Add customer button
[data-cy="tasks-list"]                - Tasks list container
[data-cy="tasks-row-{id}"]            - Task row (dynamic)
[data-cy="tasks-add"]                 - Add task button
```

## Missing Data-cy Attributes (TODOs)

To enable pending tests, add these attributes:

| Component | Attribute | Description |
|-----------|-----------|-------------|
| EntityList row | `data-cy="entity-row-actions"` | Actions menu trigger |
| Action menu | `data-cy="action-edit"` | Edit action |
| Action menu | `data-cy="action-delete"` | Delete action |
| NoPermission | `data-cy="permission-denied"` | Permission denied message |
| MobileMoreSheet | `data-cy="mobile-more-button"` | Mobile more button |
| Sidebar | `data-cy="sidebar-collapse"` | Collapse button |
| Sidebar | `data-cy="sidebar-expand"` | Expand button |

## POM Class

**Path:** `test/cypress/src/classes/components/teams/TeamSwitcher.js`

### Key Methods

| Method | Description |
|--------|-------------|
| `validateSwitcherVisible()` | Assert switcher is visible |
| `open()` | Open dropdown (idempotent) |
| `validateTeamCount(n)` | Assert team count |
| `validateTeamInList(slug)` | Assert team exists |
| `validateTeamHasCheckmark(slug)` | Assert team is selected |
| `validateRoleDisplayed(slug, role)` | Assert role text |
| `switchToTeam(slug)` | Switch and wait for completion |
| `validateSwitchModalVisible()` | Assert modal during switch |
| `goToManageTeams()` | Navigate to team settings |

## Role Translations (Spanish)

| English | Spanish |
|---------|---------|
| Owner | Propietario |
| Admin | Administrador |
| Member | Miembro |
| Viewer | Visualizador |

## Key Behaviors

### Team Switching Flow
1. User clicks team in dropdown
2. `TeamSwitchModal` appears (~1.4s animation)
3. Progress bar fills
4. Page reloads with new team context
5. Data (customers/tasks) reloads for new team

### Permission Enforcement
- **Owner**: Full CRUD access
- **Admin**: Create/Read/Update (no delete)
- **Member**: Read only (no create/edit/delete buttons)
- **Viewer**: Read only

### Session Management
Tests use `cy.session()` for performance:
- `ana-few-teams` - Single/few team user session
- `carlos-multi-team` - Multi-team user session
- `carlos-data-reload` - Data reload tests session
- `carlos-permissions` - Permission tests session
- `carlos-ui-behavior` - UI behavior tests session
- `sarah-viewer` - Viewer role session

## Related Files

- `core/components/teams/TeamSwitcherCompact.tsx` - Main component
- `core/components/teams/TeamSwitchModal.tsx` - Transition modal
- `test/cypress/src/classes/components/teams/TeamSwitcher.js` - POM class
