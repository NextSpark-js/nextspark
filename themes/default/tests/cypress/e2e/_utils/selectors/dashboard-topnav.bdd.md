---
feature: Dashboard Topnav UI Selectors Validation
priority: high
tags: [selectors, topnav, dashboard, ui-validation]
grepTags: [ui-selectors, topnav, SEL_TNAV_001, SEL_TNAV_002, SEL_TNAV_003, SEL_TNAV_004, SEL_TNAV_006]
coverage: 5
---

# Dashboard Topnav UI Selectors Validation

> Validates that dashboard topnav component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Uses `loginAsDefaultDeveloper()` which has access to superadmin and devtools links.

**NOTE:** Public navbar tests (logo, signin, signup) are in `public.cy.ts`.

## @test SEL_TNAV_001: Topnav Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, structure, desktop
- **Grep:** `@ui-selectors` `@SEL_TNAV_001`
- **Status:** Active - 3 tests

```gherkin:en
Scenario: Dashboard topnav has complete structure

Given I am logged in as a developer user
And I navigate to the dashboard
Then I should find the topnav header
And I should find the topnav actions container
And I should find the topnav search section
```

```gherkin:es
Scenario: Topnav del dashboard tiene estructura completa

Given estoy logueado como usuario developer
And navego al dashboard
Then deberia encontrar el header del topnav
And deberia encontrar el contenedor de acciones del topnav
And deberia encontrar la seccion de busqueda del topnav
```

### Expected Results
- `topnav-header` selector exists
- `topnav-actions` selector exists
- `topnav-search-section` selector exists

---

## @test SEL_TNAV_002: Topnav Actions

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, actions, buttons
- **Grep:** `@ui-selectors` `@SEL_TNAV_002`
- **Status:** Active - 4 passing

```gherkin:en
Scenario: Dashboard topnav has all action buttons

Given I am logged in as a valid user
And I navigate to the dashboard
Then I should find the sidebar toggle button
And I should find the notifications button
And I should find the help button
And I should find the theme toggle button
```

```gherkin:es
Scenario: Topnav del dashboard tiene todos los botones de accion

Given estoy logueado como usuario valido
And navego al dashboard
Then deberia encontrar el boton de toggle del sidebar
And deberia encontrar el boton de notificaciones
And deberia encontrar el boton de ayuda
And deberia encontrar el boton de cambio de tema
```

### Expected Results
- `topnav-sidebar-toggle` selector exists
- `topnav-notifications` selector exists
- `topnav-help` selector exists
- `topnav-theme-toggle` selector exists

---

## @test SEL_TNAV_003: Topnav Admin Links

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** topnav, admin, superadmin, devtools
- **Grep:** `@ui-selectors` `@SEL_TNAV_003`
- **Status:** Active - 2 tests

```gherkin:en
Scenario: Topnav shows admin links for developer users

Given I am logged in as a developer user
And superadminAccess.showToDevelopers is enabled (default: true)
And devtoolsAccess is enabled (default: true)
And I navigate to the dashboard
Then I should find the superadmin link
And I should find the devtools link
```

```gherkin:es
Scenario: Topnav muestra links de admin para usuarios developer

Given estoy logueado como usuario developer
And superadminAccess.showToDevelopers esta habilitado (default: true)
And devtoolsAccess esta habilitado (default: true)
And navego al dashboard
Then deberia encontrar el link de superadmin
And deberia encontrar el link de devtools
```

### Expected Results
- `topnav-superadmin` selector exists (developer sees with showToDevelopers: true)
- `topnav-devtools` selector exists (developer has access)

---

## @test SEL_TNAV_004: User Menu

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, user-menu, dropdown
- **Grep:** `@ui-selectors` `@SEL_TNAV_004`
- **Status:** Active - 5 passing

```gherkin:en
Scenario: User menu opens and shows all items

Given I am logged in as a valid user
And I navigate to the dashboard
Then I should find the user menu trigger
When I click on the user menu trigger
Then I should see the user menu dropdown
And I should find the profile menu item
And I should find the settings menu item
And I should find the signOut action
```

```gherkin:es
Scenario: Menu de usuario se abre y muestra todos los items

Given estoy logueado como usuario valido
And navego al dashboard
Then deberia encontrar el trigger del menu de usuario
When hago click en el trigger del menu de usuario
Then deberia ver el dropdown del menu de usuario
And deberia encontrar el item de menu de perfil
And deberia encontrar el item de menu de configuracion
And deberia encontrar la accion de cerrar sesion
```

### Expected Results
- `topnav-user-menu-trigger` selector exists
- `topnav-user-menu` visible when opened
- `topnav-menu-item-user` selector exists
- `topnav-menu-item-settings` selector exists
- `topnav-menu-action-signOut` selector exists

---

## @test SEL_TNAV_006: Loading State

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** topnav, loading, skeleton
- **Grep:** `@ui-selectors` `@SEL_TNAV_006`
- **Status:** 1 Skipped - transient state cannot be reliably tested

```gherkin:en
Scenario: Topnav shows loading state during auth

Given the authentication state is loading
And I navigate to the dashboard
Then I should find the user loading state indicator
```

```gherkin:es
Scenario: Topnav muestra estado de carga durante autenticacion

Given el estado de autenticacion esta cargando
And navego al dashboard
Then deberia encontrar el indicador de estado de carga del usuario
```

### Expected Results
- `topnav-user-loading` - only visible during auth loading

### Notes
This transient state is difficult to test in normal flow.
