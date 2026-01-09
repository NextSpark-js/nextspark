---
feature: Settings API Keys UI Selectors Validation
priority: high
tags: [selectors, settings, api-keys, ui-validation]
grepTags: [ui-selectors, settings, SEL_API_001, SEL_API_002, SEL_API_003, SEL_API_004, SEL_API_005, SEL_API_006]
coverage: 6
---

# Settings API Keys UI Selectors Validation

> Validates that settings API keys selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_API_001: API Keys Page Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, api-keys, container
- **Grep:** `@ui-selectors` `@SEL_API_001`
- **Status:** Active

```gherkin:en
Scenario: API Keys page has required structure selectors

Given I am logged in as developer
And I navigate to the API keys settings page
Then I should find the API keys main container
And I should find the create key button
```

```gherkin:es
Scenario: La pagina de API Keys tiene los selectores de estructura requeridos

Given estoy logueado como developer
And navego a la pagina de settings de API keys
Then deberia encontrar el contenedor principal de API keys
And deberia encontrar el boton de crear key
```

### Expected Results
- `settings.apiKeys.main` selector exists (settings-api-keys-main)
- `settings.apiKeys.createButton` selector exists (api-keys-create-button)

---

## @test SEL_API_002: Empty State / Skeleton Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** settings, api-keys, empty-state
- **Grep:** `@ui-selectors` `@SEL_API_002`
- **Status:** Active

```gherkin:en
Scenario: API Keys page has empty state or loading selectors

Given I am logged in as developer
And I navigate to the API keys settings page
When there are no API keys
Then I should find the empty state container
Or when loading
Then I should find the skeleton loader
```

```gherkin:es
Scenario: La pagina de API Keys tiene selectores de estado vacio o cargando

Given estoy logueado como developer
And navego a la pagina de settings de API keys
When no hay API keys
Then deberia encontrar el contenedor de estado vacio
Or cuando esta cargando
Then deberia encontrar el skeleton loader
```

### Expected Results
- `settings.apiKeys.emptyState` selector exists when no keys (api-keys-empty)
- `settings.apiKeys.skeleton` selector exists during loading (api-keys-skeleton)

---

## @test SEL_API_003: Create Dialog Selectors

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** settings, api-keys, dialog
- **Grep:** `@ui-selectors` `@SEL_API_003`
- **Status:** Active (partial - selector mismatch documented)

```gherkin:en
Scenario: Create API Key dialog has required selectors

Given I am logged in as developer
And I navigate to the API keys settings page
When I click the create key button
Then I should find the create dialog
And I should find the key name input
And I should find the cancel button
And I should find the submit button
```

```gherkin:es
Scenario: El dialogo de crear API Key tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de API keys
When hago click en el boton de crear key
Then deberia encontrar el dialogo de crear
And deberia encontrar el input de nombre de key
And deberia encontrar el boton de cancelar
And deberia encontrar el boton de enviar
```

### Expected Results
- `settings.apiKeys.createDialog` selector exists (api-keys-dialog) - **NOTE: Mismatch with CORE**
- `settings.apiKeys.nameInput` selector exists (api-keys-dialog-name) - **NOTE: Mismatch with CORE**
- `settings.apiKeys.cancelCreate` selector exists (api-keys-cancel)
- `settings.apiKeys.submitCreate` selector exists (api-keys-submit)

### Notes
**Selector Mismatches Documented:**

| Expected (CORE_SELECTORS) | Actual (Component) |
|---------------------------|-------------------|
| `api-keys-create-dialog` | `api-keys-dialog` |
| `api-key-name` | `api-keys-dialog-name` |

Tests use direct selectors matching component implementation.

---

## @test SEL_API_004: API Key Row Dynamic Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** settings, api-keys, dynamic
- **Grep:** `@ui-selectors` `@SEL_API_004`
- **Status:** Skipped - requires existing API keys

```gherkin:en
Scenario: API Key rows have dynamic selectors

Given I am logged in as developer
And I navigate to the API keys settings page
And at least one API key exists
Then I should find the key row with dynamic ID
And I should find the view button with dynamic ID
And I should find the revoke button with dynamic ID
```

```gherkin:es
Scenario: Las filas de API Key tienen selectores dinamicos

Given estoy logueado como developer
And navego a la pagina de settings de API keys
And existe al menos una API key
Then deberia encontrar la fila de key con ID dinamico
And deberia encontrar el boton de ver con ID dinamico
And deberia encontrar el boton de revocar con ID dinamico
```

### Expected Results
- `settings.apiKeys.row(id)` pattern returns (api-key-row-{id})
- `settings.apiKeys.viewButton(id)` pattern returns (api-key-view-{id})
- `settings.apiKeys.revokeButton(id)` pattern returns (api-key-revoke-{id})

### Notes
Skipped because requires at least one existing API key. Create key flow is tested elsewhere.

---

## @test SEL_API_005: Details Dialog Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** settings, api-keys, details
- **Grep:** `@ui-selectors` `@SEL_API_005`
- **Status:** Skipped - requires existing API key and opening details

```gherkin:en
Scenario: API Key details dialog has required selectors

Given I am logged in as developer
And I navigate to the API keys settings page
And at least one API key exists
When I click the view button on a key row
Then I should find the details dialog
And I should find the key value display
And I should find the copy button
And I should find the close button
```

```gherkin:es
Scenario: El dialogo de detalles de API Key tiene los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de API keys
And existe al menos una API key
When hago click en el boton de ver en una fila de key
Then deberia encontrar el dialogo de detalles
And deberia encontrar el display del valor de key
And deberia encontrar el boton de copiar
And deberia encontrar el boton de cerrar
```

### Expected Results
- `settings.apiKeys.detailsDialog` selector exists (api-key-details-dialog)
- `settings.apiKeys.keyValue` selector exists (api-key-value)
- `settings.apiKeys.copyButton` selector exists (api-key-copy)
- `settings.apiKeys.closeDetails` selector exists (api-key-close)

---

## @test SEL_API_006: Revoke / New Key Selectors

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** settings, api-keys, revoke
- **Grep:** `@ui-selectors` `@SEL_API_006`
- **Status:** Skipped - requires existing API key

```gherkin:en
Scenario: Revoke and new key display have required selectors

Given I am logged in as developer
And I navigate to the API keys settings page
And at least one API key exists
Then I should find the revoke confirm dialog when revoking
And I should find the new key display after creation
```

```gherkin:es
Scenario: El dialogo de revocar y el display de nueva key tienen los selectores requeridos

Given estoy logueado como developer
And navego a la pagina de settings de API keys
And existe al menos una API key
Then deberia encontrar el dialogo de confirmar revocar al revocar
And deberia encontrar el display de nueva key despues de crear
```

### Expected Results
- `settings.apiKeys.revokeConfirm` selector exists (api-key-revoke-confirm)
- `settings.apiKeys.newKeyDisplay` selector exists (api-key-new-display)

---

## Related Components

| Component | File | Selectors |
|-----------|------|-----------|
| ApiKeysSettings | `packages/core/src/components/settings/ApiKeysSettings.tsx` | settings-api-keys-main, api-keys-create-button, api-keys-empty, api-keys-skeleton |
| CreateApiKeyDialog | `packages/core/src/components/api-keys/CreateApiKeyDialog.tsx` | api-keys-dialog, api-keys-dialog-name, api-keys-cancel, api-keys-submit |
| ApiKeyRow | `packages/core/src/components/api-keys/ApiKeyRow.tsx` | api-key-row-{id}, api-key-view-{id}, api-key-revoke-{id} |
| ApiKeyDetailsDialog | `packages/core/src/components/api-keys/ApiKeyDetailsDialog.tsx` | api-key-details-dialog, api-key-value, api-key-copy, api-key-close |

## Related POMs

| POM | File | Usage |
|-----|------|-------|
| SettingsPOM | `themes/default/tests/cypress/src/features/SettingsPOM.ts` | API keys page selectors |
