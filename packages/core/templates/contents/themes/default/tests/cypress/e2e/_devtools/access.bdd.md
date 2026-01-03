---
feature: DevTools Access Control
priority: critical
tags: [dev-area, access-control, security, roles]
grepTags: [uat, feat-dev-area, smoke, regression]
coverage: 7
---

# DevTools Access Control

> Role-based access control tests for the /devtools area. Validates that Developer users can access all /devtools routes and /admin, while Superadmin and Member users are blocked.

## @test ACCESS-001: Developer can access /devtools

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** developer, access, home
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access /devtools home page

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools
Then I should be on /devtools home page
And the home page container should be visible
```

```gherkin:es
Scenario: Developer puede acceder a /devtools home page

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools
Then deberia estar en /devtools home page
And el contenedor de home page deberia estar visible
```

### Expected Results
- Developer successfully accesses /devtools
- Home page renders correctly
- No access denied errors

---

## @test ACCESS-002: Developer can access /devtools/style

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** developer, access, style-gallery
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Style Gallery

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/style
Then the URL should include /devtools/style
And the style page should be visible
```

```gherkin:es
Scenario: Developer puede acceder a Style Gallery

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/style
Then la URL deberia incluir /devtools/style
And la pagina de estilos deberia estar visible
```

### Expected Results
- Style Gallery page loads successfully
- All component sections available

---

## @test ACCESS-003: Developer can access /devtools/tests

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** developer, access, test-cases
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Test Cases viewer

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/tests
Then the URL should include /devtools/tests
And the tests page should be visible
```

```gherkin:es
Scenario: Developer puede acceder al visor de Test Cases

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/tests
Then la URL deberia incluir /devtools/tests
And la pagina de tests deberia estar visible
```

### Expected Results
- Test Cases viewer loads successfully
- File tree or empty state visible

---

## @test ACCESS-004: Developer can access /devtools/config

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** developer, access, config
- **Grep:** `@smoke`

```gherkin:en
Scenario: Developer can access Config Viewer

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools/config
Then the URL should include /devtools/config
And the config page should be visible
```

```gherkin:es
Scenario: Developer puede acceder al Config Viewer

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools/config
Then la URL deberia incluir /devtools/config
And la pagina de config deberia estar visible
```

### Expected Results
- Config Viewer loads successfully
- Theme and Entities tabs available

---

## @test ACCESS-005: Developer can access /admin (inherited)

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** developer, admin, inherited

```gherkin:en
Scenario: Developer can access Admin area

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /admin
Then the URL should include /admin
And the Admin container should be visible
```

```gherkin:es
Scenario: Developer puede acceder al area Admin

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /admin
Then la URL deberia incluir /admin
And el contenedor de Admin deberia estar visible
```

### Expected Results
- Developer inherits superadmin privileges for Admin
- Admin control panel accessible
- No access denied redirect

---

## @test ACCESS-006: Superadmin is BLOCKED from /devtools

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** superadmin, blocked, security
- **Grep:** `@smoke`

```gherkin:en
Scenario: Superadmin is redirected when attempting to access /devtools

Given I am logged in as Superadmin (superadmin@nextspark.dev)
When I attempt to visit /devtools
Then I should be redirected to /dashboard
And the URL should include error=access_denied
```

```gherkin:es
Scenario: Superadmin es redirigido al intentar acceder a /devtools

Given estoy logueado como Superadmin (superadmin@nextspark.dev)
When intento visitar /devtools
Then deberia ser redirigido a /dashboard
And la URL deberia incluir error=access_denied
```

### Expected Results
- Superadmin cannot access /devtools area
- Redirect to dashboard with error parameter
- Access control working correctly

---

## @test ACCESS-007: Member is BLOCKED from /devtools

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** member, blocked, security
- **Grep:** `@smoke`

```gherkin:en
Scenario: Member is redirected when attempting to access /devtools

Given I am logged in as Member (emily.johnson@nextspark.dev)
When I attempt to visit /devtools
Then I should be redirected to /dashboard
And the URL should include error=access_denied
```

```gherkin:es
Scenario: Member es redirigido al intentar acceder a /devtools

Given estoy logueado como Member (emily.johnson@nextspark.dev)
When intento visitar /devtools
Then deberia ser redirigido a /dashboard
And la URL deberia incluir error=access_denied
```

### Expected Results
- Member cannot access /devtools area
- Redirect to dashboard with error parameter
- Access control working correctly

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Home Page | `[data-cy="dev-home-page"]` | Dev area home page container |
| Style Page | `[data-cy="dev-style-page"]` | Style Gallery page container |
| Tests Page | `[data-cy="dev-tests-page"]` | Test Cases viewer container |
| Config Page | `[data-cy="dev-config-page"]` | Config Viewer page container |
| Admin Container | `[data-cy="admin-container"]` | Admin main container |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| ACCESS-001 | Developer Access | Developer can access /devtools home | `@smoke` |
| ACCESS-002 | Developer Access | Developer can access /devtools/style | `@smoke` |
| ACCESS-003 | Developer Access | Developer can access /devtools/tests | `@smoke` |
| ACCESS-004 | Developer Access | Developer can access /devtools/config | `@smoke` |
| ACCESS-005 | Inherited Access | Developer can access /admin | |
| ACCESS-006 | Blocked Access | Superadmin BLOCKED from /devtools | `@smoke` |
| ACCESS-007 | Blocked Access | Member BLOCKED from /devtools | `@smoke` |
