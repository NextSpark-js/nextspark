---
feature: Member Team Role Restrictions
priority: critical
tags: [auth, team-role, member, permissions, security, restrictions]
grepTags: [uat, feat-auth, team-role, member]
coverage: 7
---

# Member Team Role Restrictions

> Tests for Member team role restrictions. Member is the most restricted team role with read-only access to entities, no create/update/delete permissions, and no access to settings, billing, or app-role areas.

## @test MEMBER-PERM-001: Member Dashboard Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** member, dashboard
- **Grep:** `@smoke`

```gherkin:en
Scenario: Member can access dashboard

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I visit /dashboard
Then the dashboard container should be visible
```

```gherkin:es
Scenario: Member puede acceder al dashboard

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When visito /dashboard
Then el contenedor del dashboard deberia estar visible
```

### Expected Results
- Dashboard loads
- Limited navigation visible

---

## @test MEMBER-PERM-002: Member Read-Only Entity Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** member, customers, read-only
- **Grep:** `@smoke`

```gherkin:en
Scenario: Member has read-only access to customers

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I visit /customers
Then the entity list should be visible
And the create button should NOT exist
```

```gherkin:es
Scenario: Member tiene acceso solo lectura a customers

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When visito /customers
Then la lista de entidades deberia estar visible
And el boton de crear NO deberia existir
```

### Expected Results
- Can view entity list
- Cannot create new entities
- No action buttons visible

---

## @test MEMBER-PERM-003: Member Cannot Create Entities

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** member, create, blocked

```gherkin:en
Scenario: Member cannot see create button on entity pages

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I visit /customers
Then the create button should not exist
When I visit /tasks
Then the create button should not exist
```

```gherkin:es
Scenario: Member no puede ver boton crear en paginas de entidades

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When visito /customers
Then el boton crear no deberia existir
When visito /tasks
Then el boton crear no deberia existir
```

### Expected Results
- No create buttons on any entity page
- Read-only experience

---

## @test MEMBER-PERM-004: Member Settings Restricted

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** member, settings, restricted

```gherkin:en
Scenario: Member has limited or no settings access

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I visit /settings
Then I should see only profile tab or be redirected
And the team settings tab should not exist
```

```gherkin:es
Scenario: Member tiene acceso limitado o sin acceso a settings

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When visito /settings
Then deberia ver solo pestana de perfil o ser redirigido
And la pestana de team settings no deberia existir
```

### Expected Results
- Profile tab only (if accessible)
- No team settings access
- No danger zone access

---

## @test MEMBER-PERM-005: Member Billing Blocked

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** member, billing, blocked

```gherkin:en
Scenario: Member cannot access billing

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I visit /billing
Then I should be redirected away from /billing
```

```gherkin:es
Scenario: Member no puede acceder a billing

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When visito /billing
Then deberia ser redirigido fuera de /billing
```

### Expected Results
- No billing access
- Redirect to dashboard

---

## @test MEMBER-PERM-006: Member Cannot Access Sector7

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** member, sector7, blocked

```gherkin:en
Scenario: Member is blocked from Sector7

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I attempt to visit /sector7
Then I should be redirected away from /sector7
```

```gherkin:es
Scenario: Member no puede acceder a Sector7

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When intento visitar /sector7
Then deberia ser redirigido fuera de /sector7
```

### Expected Results
- Access denied
- Redirect to dashboard

---

## @test MEMBER-PERM-007: Member Cannot Access Dev Zone

### Metadata
- **Priority:** High
- **Type:** Security
- **Tags:** member, dev-zone, blocked

```gherkin:en
Scenario: Member is blocked from Dev Zone

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I attempt to visit /dev
Then I should be redirected away from /dev
```

```gherkin:es
Scenario: Member no puede acceder a Dev Zone

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When intento visitar /dev
Then deberia ser redirigido fuera de /dev
```

### Expected Results
- Access denied
- Redirect to dashboard

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Dashboard Container | `[data-cy="dashboard-container"]` | Main dashboard container |
| Create Button | `[data-cy="entity-create-button"]` | Entity create button (should not exist) |
| Entity List | `[data-cy="entity-list-container"]` | Entity list container |
| Settings Container | `[data-cy="settings-container"]` | Settings page container |
| Profile Tab | `[data-cy="settings-tab-profile"]` | Profile settings tab |
| Team Tab | `[data-cy="settings-tab-team"]` | Team settings tab (should not exist) |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| MEMBER-PERM-001 | Access | Dashboard access | `@smoke` |
| MEMBER-PERM-002 | Read-Only | Read-only entity access | `@smoke` |
| MEMBER-PERM-003 | Blocked | Cannot create entities | |
| MEMBER-PERM-004 | Restricted | Settings limited/blocked | |
| MEMBER-PERM-005 | Blocked | Billing blocked | |
| MEMBER-PERM-006 | Blocked | Sector7 blocked | |
| MEMBER-PERM-007 | Blocked | Dev Zone blocked | |
