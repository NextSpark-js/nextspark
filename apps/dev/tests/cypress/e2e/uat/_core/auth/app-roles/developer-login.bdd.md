---
feature: Developer App Role Authentication
priority: critical
tags: [auth, app-role, developer, dev-zone, security]
grepTags: [uat, feat-auth, app-role, developer]
coverage: 6
---

# Developer App Role Authentication

> Tests for Developer app role login and specific access privileges. Developer is a global app role (not team-based) that grants access to the Dev Zone and inherits Sector7 access.

## @test DEV-LOGIN-001: Developer Login and Dev Zone Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** developer, login, dev-zone
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can login and access Dev Zone

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /dev
Then the URL should include /dev
And the Dev Zone home page should be visible
```

```gherkin:es
Scenario: Developer puede loguearse y acceder a Dev Zone

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /dev
Then la URL deberia incluir /dev
And la pagina principal de Dev Zone deberia estar visible
```

### Expected Results
- Developer successfully logs in
- Access to /dev is granted
- Dev Zone home page renders correctly

---

## @test DEV-LOGIN-002: Developer Access to Style Gallery

### Metadata
- **Priority:** Normal
- **Type:** Smoke
- **Tags:** developer, style-gallery
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Style Gallery

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /dev/style
Then the URL should include /dev/style
And the Style Gallery page should be visible
```

```gherkin:es
Scenario: Developer puede acceder a Style Gallery

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /dev/style
Then la URL deberia incluir /dev/style
And la pagina de Style Gallery deberia estar visible
```

### Expected Results
- Style Gallery page loads successfully
- All component sections available

---

## @test DEV-LOGIN-003: Developer Access to Test Cases

### Metadata
- **Priority:** Normal
- **Type:** Smoke
- **Tags:** developer, test-cases
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Test Cases viewer

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /dev/tests
Then the URL should include /dev/tests
And the Test Cases viewer should be visible
```

```gherkin:es
Scenario: Developer puede acceder al visor de Test Cases

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /dev/tests
Then la URL deberia incluir /dev/tests
And el visor de Test Cases deberia estar visible
```

### Expected Results
- Test Cases viewer loads successfully
- File tree or empty state visible

---

## @test DEV-LOGIN-004: Developer Access to Config Viewer

### Metadata
- **Priority:** Normal
- **Type:** Smoke
- **Tags:** developer, config-viewer
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Config Viewer

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /dev/config
Then the URL should include /dev/config
And the Config Viewer page should be visible
```

```gherkin:es
Scenario: Developer puede acceder a Config Viewer

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /dev/config
Then la URL deberia incluir /dev/config
And la pagina de Config Viewer deberia estar visible
```

### Expected Results
- Config Viewer loads successfully
- Theme and Entities tabs available

---

## @test DEV-LOGIN-005: Developer Inherited Sector7 Access

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** developer, sector7, inherited

```gherkin:en
Scenario: Developer can access Sector7 (inherited privilege)

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /sector7
Then the URL should include /sector7
And the Sector7 container should be visible
```

```gherkin:es
Scenario: Developer puede acceder a Sector7 (privilegio heredado)

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /sector7
Then la URL deberia incluir /sector7
And el contenedor de Sector7 deberia estar visible
```

### Expected Results
- Developer inherits superadmin privileges for Sector7
- Sector7 control panel accessible
- No access denied redirect

---

## @test DEV-LOGIN-006: Developer Logout Flow

### Metadata
- **Priority:** Normal
- **Type:** Regression
- **Tags:** developer, logout

```gherkin:en
Scenario: Developer can logout successfully

Given I am logged in as Developer (developer@nextspark.dev)
And I am on the dashboard
When I click on user menu
And I click on Sign Out
Then I should be redirected to /login
```

```gherkin:es
Scenario: Developer puede cerrar sesion correctamente

Given estoy logueado como Developer (developer@nextspark.dev)
And estoy en el dashboard
When hago click en el menu de usuario
And hago click en Sign Out
Then deberia ser redirigido a /login
```

### Expected Results
- User menu opens correctly
- Sign out action works
- Redirect to login page

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Dev Home Page | `[data-cy="dev-home-page"]` | Dev Zone home page container |
| Dev Style Page | `[data-cy="dev-style-page"]` | Style Gallery page container |
| Dev Tests Page | `[data-cy="dev-tests-page"]` | Test Cases viewer container |
| Dev Config Page | `[data-cy="dev-config-page"]` | Config Viewer page container |
| Sector7 Container | `[data-cy="sector7-container"]` | Sector7 main container |
| User Menu Trigger | `[data-cy="topnav-user-menu-trigger"]` | User menu dropdown trigger |
| Sign Out Button | `[data-cy="topnav-menu-signOut"]` | Sign out menu item |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| DEV-LOGIN-001 | Login | Developer login + Dev Zone access | `@smoke` |
| DEV-LOGIN-002 | Access | Style Gallery access | `@smoke` |
| DEV-LOGIN-003 | Access | Test Cases viewer access | `@smoke` |
| DEV-LOGIN-004 | Access | Config Viewer access | `@smoke` |
| DEV-LOGIN-005 | Inherited | Sector7 access (inherited) | |
| DEV-LOGIN-006 | Logout | Developer logout flow | |
