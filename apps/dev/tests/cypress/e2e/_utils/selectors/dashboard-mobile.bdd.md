---
feature: Dashboard Mobile UI Selectors Validation
priority: medium
tags: [selectors, mobile, dashboard, ui-validation]
grepTags: [ui-selectors, mobile, SEL_DMOB_DOC, SEL_DMOB_001, SEL_DMOB_002, SEL_DMOB_003, SEL_DMOB_004]
coverage: 5
---

# Dashboard Mobile UI Selectors Validation

> Validates that dashboard mobile component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. All tests are skipped because they require mobile viewport (< 1024px).

**IMPORTANT:** Mobile selectors are ONLY visible on small viewports. Desktop tests will not find these elements. To test: add `cy.viewport('iphone-x')` or run with `--config viewportWidth=375,viewportHeight=812`.

## @test SEL_DMOB_DOC: Mobile Testing Documentation

### Metadata
- **Priority:** Low
- **Type:** Documentation
- **Tags:** mobile, documentation
- **Grep:** `@ui-selectors` `@SEL_DMOB_DOC`
- **Status:** Active

```gherkin:en
Scenario: Document all dashboard mobile selectors

Given the mobile selector tests are running
Then the test should log all mobile selectors
And document viewport requirements for each section
```

```gherkin:es
Scenario: Documentar todos los selectores mobile del dashboard

Given los tests de selectores mobile estan corriendo
Then el test deberia loguear todos los selectores mobile
And documentar los requisitos de viewport para cada seccion
```

### Expected Results
- Test logs all mobile selectors for reference
- Documents viewport requirements (<1024px)

---

## @test SEL_DMOB_001: Mobile Topbar Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** mobile, topbar, navigation
- **Grep:** `@ui-selectors` `@SEL_DMOB_001`
- **Status:** Skipped - requires mobile viewport

```gherkin:en
Scenario: Mobile topbar has all required selectors

Given I am viewing the dashboard on a mobile viewport
And I am logged in as a valid user
Then I should find the mobile topbar header
And I should find the user profile button
And I should find the notifications button
And I should find the theme toggle button
```

```gherkin:es
Scenario: Topbar mobile tiene todos los selectores requeridos

Given estoy viendo el dashboard en viewport mobile
And estoy logueado como usuario valido
Then deberia encontrar el header del topbar mobile
And deberia encontrar el boton de perfil de usuario
And deberia encontrar el boton de notificaciones
And deberia encontrar el boton de cambio de tema
```

### Expected Results
- `mobile-topbar-header` selector exists
- `mobile-topbar-user-profile` selector exists
- `mobile-topbar-notifications` selector exists
- `mobile-topbar-theme-toggle` selector exists

### Notes
All selectors have `lg:hidden` CSS class - only visible on screens < 1024px.

---

## @test SEL_DMOB_002: Mobile Bottom Nav Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** mobile, bottom-nav, navigation
- **Grep:** `@ui-selectors` `@SEL_DMOB_002`
- **Status:** Skipped - requires mobile viewport

```gherkin:en
Scenario: Mobile bottom navigation has all required selectors

Given I am viewing the dashboard on a mobile viewport
And I am logged in as a valid user
Then I should find the bottom navigation bar
And I should find bottom nav items for key sections
```

```gherkin:es
Scenario: Navegacion inferior mobile tiene todos los selectores requeridos

Given estoy viendo el dashboard en viewport mobile
And estoy logueado como usuario valido
Then deberia encontrar la barra de navegacion inferior
And deberia encontrar items de navegacion para secciones clave
```

### Expected Results
- `mobile-bottom-nav` selector exists
- `mobile-bottom-nav-item-{slug}` selectors exist (dashboard, entities, create, more)

### Notes
Bottom nav replaces sidebar on mobile. Shows 4 main navigation items.

---

## @test SEL_DMOB_003: Mobile More Sheet Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** mobile, sheet, navigation
- **Grep:** `@ui-selectors` `@SEL_DMOB_003`
- **Status:** Skipped - requires mobile viewport

```gherkin:en
Scenario: Mobile more sheet has all required selectors

Given I am viewing the dashboard on a mobile viewport
And I am logged in as a valid user
And I tap on the "More" button in bottom nav
Then I should find the more sheet content
And I should find more sheet items for each section
And I should find the superadmin link (if permitted)
And I should find the team switcher
And I should find the signout button
```

```gherkin:es
Scenario: Sheet de mas opciones mobile tiene todos los selectores requeridos

Given estoy viendo el dashboard en viewport mobile
And estoy logueado como usuario valido
And toco el boton "Mas" en la navegacion inferior
Then deberia encontrar el contenido del sheet de mas opciones
And deberia encontrar items del sheet para cada seccion
And deberia encontrar el link de superadmin (si esta permitido)
And deberia encontrar el selector de equipo
And deberia encontrar el boton de cerrar sesion
```

### Expected Results
- `mobile-more-sheet-content` selector exists
- `mobile-more-sheet-item-{slug}` selectors exist
- `mobile-more-sheet-superadmin` selector exists
- `mobile-more-sheet-team-switcher` selector exists
- `mobile-more-sheet-signout` selector exists

### Notes
More sheet opens from bottom of screen as a sheet/drawer component.

---

## @test SEL_DMOB_004: Mobile Quick Create Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** mobile, sheet, quick-create
- **Grep:** `@ui-selectors` `@SEL_DMOB_004`
- **Status:** Skipped - requires mobile viewport

```gherkin:en
Scenario: Mobile quick create sheet has all required selectors

Given I am viewing the dashboard on a mobile viewport
And I am logged in as a valid user
And I tap on the "Create" button in bottom nav
Then I should find the quick create sheet content
And I should find quick create items for each entity type
```

```gherkin:es
Scenario: Sheet de creacion rapida mobile tiene todos los selectores requeridos

Given estoy viendo el dashboard en viewport mobile
And estoy logueado como usuario valido
And toco el boton "Crear" en la navegacion inferior
Then deberia encontrar el contenido del sheet de creacion rapida
And deberia encontrar items de creacion rapida para cada tipo de entidad
```

### Expected Results
- `mobile-quick-create-content` selector exists
- `mobile-quick-create-item-{slug}` selectors exist (tasks, customers, posts, pages, etc.)

### Notes
Quick create sheet shows available entity types for fast creation on mobile.
