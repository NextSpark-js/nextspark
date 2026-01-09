---
feature: Dashboard Sidebar UI Selectors Validation
priority: medium
tags: [selectors, sidebar, dashboard, ui-validation]
grepTags: [ui-selectors, sidebar, SEL_DBAR_001, SEL_DBAR_DOC]
coverage: 2
---

# Dashboard Sidebar UI Selectors Validation

> Validates that dashboard sidebar component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Some tests are skipped due to misalignment between CORE_SELECTORS definitions and component implementations.

**IMPORTANT:** Sidebar is only visible on desktop viewports (>= 1024px) when authenticated. The component uses `createCyId()` which sometimes produces different selectors than defined in CORE_SELECTORS.

## @test SEL_DBAR_001: Sidebar Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** sidebar, structure, desktop
- **Grep:** `@ui-selectors` `@SEL_DBAR_001`
- **Status:** Partial - 1 passing, 3 skipped

```gherkin:en
Scenario: Dashboard sidebar has required structure selectors

Given I am logged in as a valid user
And I am viewing the dashboard on desktop viewport
Then I should find the sidebar main container
And the sidebar header should exist (skipped - selector mismatch)
And the sidebar content should exist (skipped - not implemented)
And the sidebar footer should exist (skipped - not implemented)
```

```gherkin:es
Scenario: Sidebar del dashboard tiene selectores de estructura requeridos

Given estoy logueado como usuario valido
And estoy viendo el dashboard en viewport desktop
Then deberia encontrar el contenedor principal del sidebar
And deberia existir el header del sidebar (skipped - selectores desalineados)
And deberia existir el contenido del sidebar (skipped - no implementado)
And deberia existir el footer del sidebar (skipped - no implementado)
```

### Expected Results
- `sidebar-main` selector exists (WORKING)
- `sidebar-header` skipped - component uses `sidebar-header-section` instead
- `sidebar-content` skipped - not implemented in Sidebar.tsx
- `sidebar-footer` skipped - not implemented in Sidebar.tsx

### Notes
The Sidebar.tsx component uses these data-cy attributes:
- `sidebar-main` - Main sidebar container (aligned with CORE_SELECTORS)
- `sidebar-header-section` - NOT `sidebar-header`
- `sidebar-logo` - Logo container
- `sidebar-nav` - Navigation container
- `sidebar-nav-items` - Navigation items wrapper

---

## @test SEL_DBAR_DOC: Selector Documentation

### Metadata
- **Priority:** Low
- **Type:** Documentation
- **Tags:** sidebar, documentation
- **Grep:** `@ui-selectors` `@SEL_DBAR_DOC`
- **Status:** Active

```gherkin:en
Scenario: Document all sidebar component selectors

Given the sidebar selector tests are running
Then the test should log all sidebar selectors
And document which selectors are implemented vs defined in CORE_SELECTORS
And document any selector/component mismatches
```

```gherkin:es
Scenario: Documentar todos los selectores de componente sidebar

Given los tests de selectores de sidebar estan corriendo
Then el test deberia loguear todos los selectores de sidebar
And documentar que selectores estan implementados vs definidos en CORE_SELECTORS
And documentar cualquier desalineacion entre selectores y componentes
```

### Expected Results
- Test logs all sidebar selectors for reference
- Documents implemented vs not-implemented selectors
- Notes selector naming mismatches

---

## Known Issues

### Selector/Component Misalignment

| CORE_SELECTORS Path | Expected data-cy | Component Uses | Status |
|---------------------|-----------------|----------------|--------|
| `dashboard.sidebar.main` | `sidebar-main` | `sidebar-main` | ✅ Aligned |
| `dashboard.sidebar.header` | `sidebar-header` | `sidebar-header-section` | ⚠️ Mismatch |
| `dashboard.sidebar.content` | `sidebar-content` | N/A | ❌ Not implemented |
| `dashboard.sidebar.footer` | `sidebar-footer` | N/A | ❌ Not implemented |

### Recommendation
Future fix should either:
1. Update CORE_SELECTORS to match component (`sidebar-header-section`)
2. Update component to match CORE_SELECTORS (`sidebar-header`)
3. Add missing selectors to component (`sidebar-content`, `sidebar-footer`)
