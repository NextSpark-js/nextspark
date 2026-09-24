---
feature: DevTools Navigation
priority: high
tags: [dev-area, navigation, sidebar]
grepTags: [uat, feat-dev-area, regression]
coverage: 7
---

# DevTools Navigation

> Navigation functionality tests within the /devtools area. Validates sidebar navigation items, clickable links, and exit navigation to Dashboard and Admin.

## @test NAV-001: Sidebar navigation works

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** sidebar, navigation, display
- **Grep:** `@smoke`

```gherkin:en
Scenario: All sidebar navigation items are displayed

Given I am logged in as Developer (developer@nextspark.dev)
When I visit /devtools home
Then all navigation items should be visible in sidebar
And exit links (Dashboard, Admin) should be visible
```

```gherkin:es
Scenario: Todos los items de navegacion del sidebar estan visibles

Given estoy logueado como Developer (developer@nextspark.dev)
When visito /devtools home
Then todos los items de navegacion deberian estar visibles en el sidebar
And los enlaces de salida (Dashboard, Admin) deberian estar visibles
```

### Expected Results
- Home, Style Gallery, Test Cases, Config links visible
- Exit to Dashboard link visible
- Go to Admin link visible

---

## @test NAV-002a: Navigate to Style Gallery via sidebar

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** navigate, style-gallery

```gherkin:en
Scenario: Navigate to Style Gallery via sidebar

Given I am on /devtools home
When I click Style Gallery nav item
Then the URL should include /devtools/style
And the style page should be visible
```

```gherkin:es
Scenario: Navegar a Style Gallery via sidebar

Given estoy en /devtools home
When hago clic en el item de navegacion Style Gallery
Then la URL deberia incluir /devtools/style
And la pagina de estilos deberia estar visible
```

### Expected Results
- Navigation completes successfully
- Style Gallery page loads

---

## @test NAV-002b: Navigate to Test Cases via sidebar

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** navigate, test-cases

```gherkin:en
Scenario: Navigate to Test Cases via sidebar

Given I am on /devtools home
When I click Test Cases nav item
Then the URL should include /devtools/tests
And the tests page should be visible
```

```gherkin:es
Scenario: Navegar a Test Cases via sidebar

Given estoy en /devtools home
When hago clic en el item de navegacion Test Cases
Then la URL deberia incluir /devtools/tests
And la pagina de tests deberia estar visible
```

### Expected Results
- Navigation completes successfully
- Test Cases viewer page loads

---

## @test NAV-002c: Navigate to Config Viewer via sidebar

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** navigate, config

```gherkin:en
Scenario: Navigate to Config Viewer via sidebar

Given I am on /devtools home
When I click Config nav item
Then the URL should include /devtools/config
And the config page should be visible
```

```gherkin:es
Scenario: Navegar a Config Viewer via sidebar

Given estoy en /devtools home
When hago clic en el item de navegacion Config
Then la URL deberia incluir /devtools/config
And la pagina de config deberia estar visible
```

### Expected Results
- Navigation completes successfully
- Config Viewer page loads

---

## @test NAV-002d: Navigate back to Home via sidebar

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** navigate, home

```gherkin:en
Scenario: Navigate back to Home via sidebar

Given I am on /devtools/style
When I click Home nav item
Then the URL should be /devtools
And the home page should be visible
```

```gherkin:es
Scenario: Navegar de vuelta a Home via sidebar

Given estoy en /devtools/style
When hago clic en el item de navegacion Home
Then la URL deberia ser /devtools
And la pagina home deberia estar visible
```

### Expected Results
- Navigation completes successfully
- Home page loads

---

## @test NAV-003: Back to Dashboard link works

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** exit, dashboard

```gherkin:en
Scenario: Navigate to Dashboard when clicking exit link

Given I am on /devtools home
When I click "Exit to Dashboard" link
Then the URL should include /dashboard
And the URL should not include /devtools
And the dashboard container should be visible
```

```gherkin:es
Scenario: Navegar a Dashboard al hacer clic en enlace de salida

Given estoy en /devtools home
When hago clic en el enlace "Exit to Dashboard"
Then la URL deberia incluir /dashboard
And la URL no deberia incluir /devtools
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Exit navigation works correctly
- User lands on main dashboard
- No /devtools in URL

---

## @test NAV-004: Go to Admin link works

### Metadata
- **Priority:** High
- **Type:** Smoke
- **Tags:** exit, admin

```gherkin:en
Scenario: Navigate to Admin when clicking exit link

Given I am on /devtools home
When I click "Go to Admin" link
Then the URL should include /admin
And the Admin container should be visible
```

```gherkin:es
Scenario: Navegar a Admin al hacer clic en enlace de salida

Given estoy en /devtools home
When hago clic en el enlace "Go to Admin"
Then la URL deberia incluir /admin
And el contenedor de Admin deberia estar visible
```

### Expected Results
- Exit to Admin works correctly
- Developer can access Admin (inherited privileges)
- Admin control panel visible

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Nav Home | `[data-cy="dev-nav-home"]` | Home navigation item |
| Nav Style Gallery | `[data-cy="dev-nav-stylegallery"]` | Style Gallery navigation item |
| Nav Test Cases | `[data-cy="dev-nav-testcases"]` | Test Cases navigation item |
| Nav Config | `[data-cy="dev-nav-config"]` | Config navigation item |
| Exit to Dashboard | `[data-cy="dev-sidebar-exit-to-dashboard"]` | Exit to dashboard link |
| Go to Admin | `[data-cy="dev-sidebar-go-to-admin"]` | Go to Admin link |
| Dashboard Container | `[data-cy="dashboard-container"]` | Main dashboard container |
| Admin Container | `[data-cy="admin-container"]` | Admin main container |

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| NAV-001 | Sidebar Display | All navigation items visible | `@smoke` |
| NAV-002a | Navigate | Style Gallery via sidebar | |
| NAV-002b | Navigate | Test Cases via sidebar | |
| NAV-002c | Navigate | Config Viewer via sidebar | |
| NAV-002d | Navigate | Back to Home via sidebar | |
| NAV-003 | Exit Links | Back to Dashboard works | |
| NAV-004 | Exit Links | Go to Admin works | |
