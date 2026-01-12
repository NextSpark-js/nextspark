---
feature: Dashboard Topnav UI Selectors Validation
priority: high
tags: [selectors, topnav, dashboard, ui-validation]
grepTags: [ui-selectors, dashboard, topnav, SEL_TNAV_001, SEL_TNAV_002, SEL_TNAV_003, SEL_TNAV_004, SEL_TNAV_005, SEL_TNAV_006]
coverage: 6
---

# Dashboard Topnav UI Selectors Validation

> Validates that dashboard topnav component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Uses `loginAsDefaultDeveloper()` which has access to superadmin and devtools links.

**NOTE:** Public navbar tests (logo, signin, signup) are in `public.cy.ts`.

**Login:** Uses Developer via `loginAsDefaultDeveloper()`.

## @test SEL_TNAV_001: Topnav Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, structure, desktop
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_001`
- **Status:** Active (3 passing, 0 skipped)

```gherkin:en
Scenario: Dashboard topnav has complete structure

Given I am logged in as a developer user
And I navigate to the dashboard
Then I should find the topnav container
And I should find the topnav actions container
And I should find the topnav search container
```

```gherkin:es
Scenario: Topnav del dashboard tiene estructura completa

Given estoy logueado como usuario developer
And navego al dashboard
Then deberia encontrar el contenedor del topnav
And deberia encontrar el contenedor de acciones del topnav
And deberia encontrar el contenedor de busqueda del topnav
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.container | dashboard.selectors.topnavContainer | topnav-header | Implemented |
| dashboard.topnav.actions | dashboard.selectors.topnavActions | topnav-actions | Implemented |
| dashboard.topnav.searchContainer | dashboard.selectors.topnavSearchContainer | topnav-search-section | Implemented |

---

## @test SEL_TNAV_002: Topnav Actions

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, actions, buttons
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_002`
- **Status:** Active (4 passing, 0 skipped)

```gherkin:en
Scenario: Dashboard topnav has all action buttons

Given I am logged in as a valid user
And I navigate to the dashboard
Then I should find the sidebar toggle button
And I should find the notifications trigger
And I should find the help button
And I should find the theme toggle button
```

```gherkin:es
Scenario: Topnav del dashboard tiene todos los botones de accion

Given estoy logueado como usuario valido
And navego al dashboard
Then deberia encontrar el boton de toggle del sidebar
And deberia encontrar el trigger de notificaciones
And deberia encontrar el boton de ayuda
And deberia encontrar el boton de cambio de tema
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.sidebarToggle | dashboard.selectors.topnavSidebarToggle | topnav-sidebar-toggle | Implemented |
| dashboard.topnav.notificationsTrigger | dashboard.selectors.topnavNotificationsTrigger | topnav-notifications | Implemented |
| dashboard.topnav.help | dashboard.selectors.topnavHelp | topnav-help | Implemented |
| dashboard.topnav.themeToggle | dashboard.selectors.topnavThemeToggle | topnav-theme-toggle | Implemented |

---

## @test SEL_TNAV_003: Topnav Admin Links

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** topnav, admin, superadmin, devtools
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_003`
- **Status:** Active (2 passing, 0 skipped)

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
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.superadmin | dashboard.selectors.topnavSuperadmin | topnav-superadmin | Implemented |
| dashboard.topnav.devtools | dashboard.selectors.topnavDevtools | topnav-devtools | Implemented |

### Notes
- Superadmin link: `superadminAccess.enabled && (isSuperAdmin || (isDeveloper && showToDevelopers))`
- Devtools link: `devtoolsAccess.enabled && isDeveloper`

---

## @test SEL_TNAV_004: User Menu

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** topnav, user-menu, dropdown
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_004`
- **Status:** Active (5 passing, 0 skipped)

```gherkin:en
Scenario: User menu opens and shows all items

Given I am logged in as a valid user
And I navigate to the dashboard
Then I should find the user menu trigger
When I click on the user menu trigger
Then I should see the user menu content
And I should find the profile menu item (user)
And I should find the settings menu item
And I should find the signOut action
```

```gherkin:es
Scenario: Menu de usuario se abre y muestra todos los items

Given estoy logueado como usuario valido
And navego al dashboard
Then deberia encontrar el trigger del menu de usuario
When hago click en el trigger del menu de usuario
Then deberia ver el contenido del menu de usuario
And deberia encontrar el item de menu de perfil (user)
And deberia encontrar el item de menu de configuracion
And deberia encontrar la accion de cerrar sesion
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.userMenuTrigger | dashboard.selectors.topnavUserMenuTrigger | topnav-user-menu-trigger | Implemented |
| dashboard.topnav.userMenuContent | dashboard.selectors.topnavUserMenuContent | topnav-user-menu | Implemented |
| dashboard.topnav.userMenuItem(item) | dashboard.selectors.topnavUserMenuItem('user') | topnav-menu-item-user | Implemented |
| dashboard.topnav.userMenuItem(item) | dashboard.selectors.topnavUserMenuItem('settings') | topnav-menu-item-settings | Implemented |
| dashboard.topnav.userMenuAction(action) | dashboard.selectors.topnavUserMenuAction('signOut') | topnav-menu-action-signOut | Implemented |

---

## @test SEL_TNAV_005: Quick Create

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** topnav, quick-create, dropdown
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_005`
- **Status:** Skipped (3 tests) - requires entity with create permission

```gherkin:en
Scenario: Quick create dropdown shows entity options

Given I am logged in as a user with create permissions
And I navigate to the dashboard
Then I should find the quick create trigger
When I click on the quick create trigger
Then I should see the quick create content
And I should find quick create links for entities (e.g., customers)
```

```gherkin:es
Scenario: Dropdown de creacion rapida muestra opciones de entidad

Given estoy logueado como usuario con permisos de crear
And navego al dashboard
Then deberia encontrar el trigger de creacion rapida
When hago click en el trigger de creacion rapida
Then deberia ver el contenido de creacion rapida
And deberia encontrar links de creacion rapida para entidades (ej. customers)
```

### Expected Results
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.quickCreateTrigger | dashboard.selectors.topnavQuickCreateTrigger | topnav-quick-create-trigger | **Skipped** |
| dashboard.topnav.quickCreateContent | dashboard.selectors.topnavQuickCreateContent | topnav-quick-create-content | **Skipped** |
| dashboard.topnav.quickCreateLink(entity) | dashboard.selectors.topnavQuickCreateLink('customers') | topnav-quick-create-customers | **Skipped** |

### Notes
- Component renders null if user has no create permissions on any entity
- Developer role may not have quickCreate entities configured
- Tests skipped because they require entity with create permission

---

## @test SEL_TNAV_006: Loading State

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** topnav, loading, skeleton
- **Grep:** `@ui-selectors` `@dashboard` `@topnav` `@SEL_TNAV_006`
- **Status:** Skipped (1 test) - transient state cannot be reliably tested

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
| Selector Path | POM Accessor | data-cy Value | Status |
|---------------|--------------|---------------|--------|
| dashboard.topnav.userLoading | dashboard.selectors.topnavUserLoading | topnav-user-loading | **Skipped** |

### Notes
- This transient state is only visible during auth loading
- Difficult to test reliably in normal flow

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| Topnav | `packages/core/src/components/dashboard/Topnav.tsx` | topnav-header, topnav-actions, topnav-search-section |
| TopnavActions | `packages/core/src/components/dashboard/TopnavActions.tsx` | topnav-sidebar-toggle, topnav-notifications, topnav-help, topnav-theme-toggle |
| TopnavUserMenu | `packages/core/src/components/dashboard/TopnavUserMenu.tsx` | topnav-user-menu-trigger, topnav-user-menu, topnav-menu-item-*, topnav-menu-action-* |
| TopnavQuickCreate | `packages/core/src/components/dashboard/TopnavQuickCreate.tsx` | topnav-quick-create-trigger, topnav-quick-create-content, topnav-quick-create-* |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| DashboardPOM | `themes/default/tests/cypress/src/features/DashboardPOM.ts` | Topnav selectors and methods |
