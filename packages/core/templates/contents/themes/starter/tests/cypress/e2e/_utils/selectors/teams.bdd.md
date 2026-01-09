---
feature: Teams UI Selectors Validation
priority: high
tags: [selectors, teams, ui-validation, multi-tenant]
grepTags: [ui-selectors, teams, SEL_TEAM_001, SEL_TEAM_003, SEL_TEAM_004, SEL_TEAM_006, SEL_TEAM_007, SEL_TEAM_008, multi-team, mobile]
coverage: 6
---

# Teams UI Selectors Validation

> Validates that teams selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_TEAM_001: Team Switcher Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** teams, switcher, sidebar
- **Grep:** `@ui-selectors` `@SEL_TEAM_001`
- **Status:** Active (5 passing)

```gherkin:en
Scenario: Team switcher has complete structure

Given I am logged in as developer
And I navigate to the dashboard
And the sidebar is expanded
Then I should find the team switcher compact trigger
When I click the team switcher trigger
Then I should find the team switcher dropdown
And I should find at least one team option
And I should find the manage teams link
```

```gherkin:es
Scenario: El switcher de equipos tiene estructura completa

Given estoy logueado como developer
And navego al dashboard
And el sidebar esta expandido
Then deberia encontrar el trigger del team switcher compacto
When hago click en el trigger del team switcher
Then deberia encontrar el dropdown del team switcher
And deberia encontrar al menos una opcion de equipo
And deberia encontrar el link de administrar equipos
```

### Expected Results
- `teams.switcher.compact` selector exists (team-switcher-compact) ✅
- `teams.switcher.dropdown` selector exists when opened (team-switcher-dropdown) ✅
- `teams.switcher.option` selector exists for team options (team-option-{slug}) ✅
- `teams.switcher.manageLink` selector exists (manage-teams-link) ✅
- Create button documentation ✅

---

## @test SEL_TEAM_003: Create Team Dialog Documentation

### Metadata
- **Priority:** Low
- **Type:** Documentation
- **Tags:** teams, create, dialog
- **Grep:** `@ui-selectors` `@SEL_TEAM_003`
- **Status:** Active (documentation only)

```gherkin:en
Scenario: Create Team Dialog selectors are documented

Given the Create Team Dialog is on the settings/teams page
Then the following selectors are tested in settings-teams.cy.ts:
| Selector | Value |
| create-team-dialog | Dialog container |
| team-name-input | Name input field |
| team-slug-input | Slug input field |
| team-description-input | Description input |
| cancel-create-team | Cancel button |
| submit-create-team | Submit button |
```

```gherkin:es
Scenario: Los selectores del dialogo de crear equipo estan documentados

Given el dialogo de crear equipo esta en la pagina settings/teams
Then los siguientes selectores se prueban en settings-teams.cy.ts:
| Selector | Valor |
| create-team-dialog | Contenedor del dialogo |
| team-name-input | Campo de nombre |
| team-slug-input | Campo de slug |
| team-description-input | Campo de descripcion |
| cancel-create-team | Boton cancelar |
| submit-create-team | Boton enviar |
```

### Notes
This test documents that Create Team Dialog selectors are tested in `settings-teams.cy.ts`, not here.

---

## @test SEL_TEAM_004: Dashboard Sidebar Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** sidebar, dashboard
- **Grep:** `@ui-selectors` `@SEL_TEAM_004`
- **Status:** Active (2 passing)

```gherkin:en
Scenario: Dashboard sidebar has required selectors

Given I am logged in as developer
And I navigate to the dashboard
Then I should find the sidebar main container
And I should find the sidebar toggle button
```

```gherkin:es
Scenario: El sidebar del dashboard tiene los selectores requeridos

Given estoy logueado como developer
And navego al dashboard
Then deberia encontrar el contenedor principal del sidebar
And deberia encontrar el boton toggle del sidebar
```

### Expected Results
- `dashboard.sidebar.main` selector exists ✅
- `dashboard.topnav.sidebarToggle` selector exists ✅

---

## @test SEL_TEAM_006: Team Members Documentation

### Metadata
- **Priority:** Low
- **Type:** Documentation
- **Tags:** teams, members, settings
- **Grep:** `@ui-selectors` `@SEL_TEAM_006`
- **Status:** Active (documentation only)

```gherkin:en
Scenario: Team members selectors are documented

Given team members management is on the settings/teams page
Then the team members selectors are tested in settings-teams.cy.ts
And the path is /dashboard/settings/teams
```

```gherkin:es
Scenario: Los selectores de miembros del equipo estan documentados

Given la gestion de miembros del equipo esta en la pagina settings/teams
Then los selectores de miembros del equipo se prueban en settings-teams.cy.ts
And la ruta es /dashboard/settings/teams
```

### Notes
This test documents that Team Members selectors are tested in `settings-teams.cy.ts`, not here.

---

## @test SEL_TEAM_007: Multi-Team Switch Modal

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** teams, modal, switch, multi-team
- **Grep:** `@ui-selectors` `@SEL_TEAM_007` `@multi-team`
- **Status:** Active (2 passing)
- **User:** Carlos Mendoza (loginAsDefaultOwner) - has multiple teams

```gherkin:en
Scenario: Team switch modal appears during team change

Given I am logged in as Carlos Mendoza (owner with multiple teams)
And I navigate to the dashboard
And the sidebar is expanded
When I open the team switcher dropdown
Then I should find at least 2 team options
When I click on a different team
Then I should find the team switch modal
```

```gherkin:es
Scenario: El modal de cambio de equipo aparece durante el cambio

Given estoy logueado como Carlos Mendoza (owner con multiples equipos)
And navego al dashboard
And el sidebar esta expandido
When abro el dropdown del team switcher
Then deberia encontrar al menos 2 opciones de equipo
When hago click en un equipo diferente
Then deberia encontrar el modal de cambio de equipo
```

### Expected Results
- Multiple team options exist (at least 2) ✅
- `teams.switchModal.container` selector exists during switch (team-switch-modal) ✅

### Notes
This test uses `loginAsDefaultOwner()` which logs in as Carlos Mendoza, a user with multiple teams:
- Carlos Personal (personal team)
- Everpoint Labs (owner)
- Other teams where he has membership

---

## @test SEL_TEAM_008: Mobile Team Switcher

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** teams, mobile, responsive
- **Grep:** `@ui-selectors` `@SEL_TEAM_008` `@mobile`
- **Status:** Active (3 passing)
- **Viewport:** iphone-x (375x812)

```gherkin:en
Scenario: Mobile team switcher has required selectors

Given I set the viewport to iphone-x
And I am logged in as developer
And I navigate to the dashboard
Then I should find the mobile more button
When I tap the more button
Then I should find the mobile more sheet
And I should find the mobile team switcher inside the sheet
```

```gherkin:es
Scenario: El team switcher movil tiene los selectores requeridos

Given configuro el viewport a iphone-x
And estoy logueado como developer
And navego al dashboard
Then deberia encontrar el boton more movil
When toco el boton more
Then deberia encontrar el sheet more movil
And deberia encontrar el team switcher movil dentro del sheet
```

### Expected Results
- `dashboard.mobile.bottomNav.item` with id `more` exists ✅
- `dashboard.mobile.moreSheet.content` exists when opened ✅
- `dashboard.mobile.moreSheet.teamSwitcher` exists in sheet ✅

### Notes
This test uses `cy.viewport('iphone-x')` before login to ensure the mobile layout is rendered.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| TeamSwitcherCompact | `packages/core/src/components/teams/TeamSwitcherCompact.tsx` | team-switcher-compact, team-switcher-dropdown, team-option-{slug}, manage-teams-link |
| TeamSwitchModal | `packages/core/src/components/teams/TeamSwitchModal.tsx` | team-switch-modal |
| Sidebar | `packages/core/src/components/dashboard/layouts/Sidebar.tsx` | sidebar-main |
| TopNavbar | `packages/core/src/components/dashboard/layouts/TopNavbar.tsx` | topnav-sidebar-toggle |
| MobileMoreSheet | `packages/core/src/components/dashboard/mobile/MobileMoreSheet.tsx` | mobile-more-sheet, mobile-more-sheet-team-switcher |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| TeamSwitcherPOM | `themes/default/tests/cypress/src/components/TeamSwitcherPOM.ts` | Team switcher interactions and selectors |

## Test Summary

| Test ID | Description | Status | Tests |
|---------|-------------|--------|-------|
| SEL_TEAM_001 | Team Switcher Selectors | Active | 5 |
| SEL_TEAM_003 | Create Team Dialog Documentation | Active | 1 |
| SEL_TEAM_004 | Dashboard Sidebar Selectors | Active | 2 |
| SEL_TEAM_006 | Team Members Documentation | Active | 1 |
| SEL_TEAM_007 | Multi-Team Switch Modal | Active | 2 |
| SEL_TEAM_008 | Mobile Team Switcher | Active | 3 |
| **Total** | | **All Active** | **14** |
