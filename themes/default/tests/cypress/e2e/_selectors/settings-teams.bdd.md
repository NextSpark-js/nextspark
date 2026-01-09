---
feature: Settings Teams UI Selectors Validation
priority: high
tags: [selectors, settings, teams, ui-validation]
grepTags: [ui-selectors, settings, SEL_STMS_001, SEL_STMS_002]
coverage: 2
---

# Settings Teams UI Selectors Validation

> Validates that settings teams selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_STMS_001: Teams Page Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, teams, management
- **Grep:** `@ui-selectors` `@SEL_STMS_001`
- **Status:** Active (4 passing, 3 skipped)

```gherkin:en
Scenario: Teams settings page has required selectors

Given I am logged in as developer
And I navigate to the teams settings page
Then I should find the teams main container
And I should find the teams header
And I should find the teams list
And I should find the create team button
```

```gherkin:es
Scenario: La pagina de settings de teams tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de teams
Then deberia encontrar el contenedor principal de teams
And deberia encontrar el header de teams
And deberia encontrar la lista de teams
And deberia encontrar el boton de crear equipo
```

### Expected Results
- `teams-settings-main` selector exists ✅
- `teams-settings-header` selector exists ✅
- `teams-settings-loading` selector - **SKIPPED: Only visible during loading**
- `teams-settings-single-user` selector - **SKIPPED: Only visible for users without teams**
- `teams-settings-teams-list` selector exists ✅
- `teams-settings-team-details` selector - **SKIPPED: Only visible when team is selected**
- `create-team-button` selector exists ✅

### Notes
**Skipped Tests (3):**
1. `teams-settings-loading` - Loading skeleton only visible during initial load
2. `teams-settings-single-user` - Only appears for users not in any team
3. `teams-settings-team-details` - Only appears when a team is selected

---

## @test SEL_STMS_002: Create Team Dialog Documentation

### Metadata
- **Priority:** Medium
- **Type:** Documentation
- **Tags:** settings, teams, dialog
- **Grep:** `@ui-selectors` `@SEL_STMS_002`
- **Status:** Active (1 passing, 0 skipped)

```gherkin:en
Scenario: Create Team Dialog selectors are documented

Given the Create Team Dialog can be opened from teams settings
Then the following selectors are documented:
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

Given el dialogo de crear equipo puede abrirse desde settings de teams
Then los siguientes selectores estan documentados:
| Selector | Valor |
| create-team-dialog | Contenedor del dialogo |
| team-name-input | Campo de nombre |
| team-slug-input | Campo de slug |
| team-description-input | Campo de descripcion |
| cancel-create-team | Boton cancelar |
| submit-create-team | Boton enviar |
```

### Expected Results
- Create Team Dialog selectors are documented for reference ✅
- Actual dialog testing done in teams.cy.ts (SEL_TEAM_003)

### Notes
The Create Team Dialog selectors are shared between:
- Teams settings page (`/dashboard/settings/teams`)
- Team switcher create button

This test documents the selectors for cross-reference with teams.cy.ts.

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| TeamsSettings | `packages/core/src/components/settings/TeamsSettings.tsx` | teams-settings-main, teams-settings-header, teams-settings-loading, teams-settings-single-user, teams-settings-teams-list, teams-settings-team-details |
| CreateTeamDialog | `packages/core/src/components/teams/CreateTeamDialog.tsx` | create-team-dialog, cancel-create-team, submit-create-team |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | Teams settings page selectors |
| TeamSwitcherPOM | `themes/default/tests/cypress/src/components/TeamSwitcherPOM.ts` | Create team dialog selectors |
