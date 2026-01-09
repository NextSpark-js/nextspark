---
feature: Password Reset Flow
priority: critical
tags: [auth, password-reset, security, user-flow]
grepTags: [uat, feat-auth, password-reset]
coverage: 8
---

# Password Reset Flow

> Tests for the password reset flow including page access, form validation, submission, and error handling. Actual email delivery is not tested as it requires external service integration.

## @test PWD-RESET-001: Access Password Reset Page

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** password-reset, navigation
- **Grep:** `@smoke`

```gherkin:en
Scenario: Access password reset page from login

Given I am on the login page
When I click on the forgot password link
Then I should be on /forgot-password
And the password reset form should be visible
And the email input should be visible
And the submit button should be visible
```

```gherkin:es
Scenario: Acceder a pagina de reset de password desde login

Given estoy en la pagina de login
When hago click en el enlace de olvide mi password
Then deberia estar en /forgot-password
And el formulario de reset deberia estar visible
And el input de email deberia estar visible
And el boton de enviar deberia estar visible
```

### Expected Results
- Forgot password link works
- Password reset page loads
- All form elements visible

---

## @test PWD-RESET-002: Direct URL Access

### Metadata
- **Priority:** Normal
- **Type:** Smoke
- **Tags:** password-reset, direct-access
- **Grep:** `@smoke`

```gherkin:en
Scenario: Access password reset page directly via URL

Given I visit /forgot-password directly
Then the password reset container should be visible
And the email input should be visible
```

```gherkin:es
Scenario: Acceder a pagina de reset directamente via URL

Given visito /forgot-password directamente
Then el contenedor de reset deberia estar visible
And el input de email deberia estar visible
```

### Expected Results
- Direct URL access works
- No authentication required

---

## @test PWD-RESET-003: Submit Valid Email

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** password-reset, submit
- **Grep:** `@smoke`

```gherkin:en
Scenario: Submit password reset with valid email format

Given I am on the password reset page
When I enter a valid email format (user@example.com)
And I click the submit button
Then I should see a success message
```

```gherkin:es
Scenario: Enviar reset de password con email valido

Given estoy en la pagina de reset de password
When ingreso un email con formato valido (user@example.com)
And hago click en el boton de enviar
Then deberia ver un mensaje de exito
```

### Expected Results
- Form submits successfully
- Success message displayed
- No email enumeration (same message for existing/non-existing)

---

## @test PWD-RESET-004: Validate Empty Email

### Metadata
- **Priority:** High
- **Type:** Validation
- **Tags:** password-reset, validation, empty

```gherkin:en
Scenario: Show error for empty email field

Given I am on the password reset page
When I click submit without entering an email
Then I should see a required field error
```

```gherkin:es
Scenario: Mostrar error para campo email vacio

Given estoy en la pagina de reset de password
When hago click en enviar sin ingresar email
Then deberia ver un error de campo requerido
```

### Expected Results
- Validation error displayed
- Form not submitted

---

## @test PWD-RESET-005: Validate Invalid Email Format

### Metadata
- **Priority:** High
- **Type:** Validation
- **Tags:** password-reset, validation, format

```gherkin:en
Scenario: Show error for invalid email format

Given I am on the password reset page
When I enter an invalid email format (not-an-email)
And I click the submit button
Then I should see an invalid email error
```

```gherkin:es
Scenario: Mostrar error para formato de email invalido

Given estoy en la pagina de reset de password
When ingreso un formato de email invalido (not-an-email)
And hago click en el boton de enviar
Then deberia ver un error de email invalido
```

### Expected Results
- Format validation works
- Clear error message

---

## @test PWD-RESET-006: Back to Login Link

### Metadata
- **Priority:** Normal
- **Type:** Navigation
- **Tags:** password-reset, navigation

```gherkin:en
Scenario: Navigate back to login page

Given I am on the password reset page
When I click the back to login link
Then I should be on the login page
```

```gherkin:es
Scenario: Navegar de vuelta a pagina de login

Given estoy en la pagina de reset de password
When hago click en el enlace de volver a login
Then deberia estar en la pagina de login
```

### Expected Results
- Back link works
- Returns to login page

---

## @test PWD-RESET-007: Submit with Known Test Email

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** password-reset, existing-user

```gherkin:en
Scenario: Handle submission with existing user email

Given I am on the password reset page
When I enter a known test email (carlos.mendoza@nextspark.dev)
And I click the submit button
Then I should see a success message
```

```gherkin:es
Scenario: Manejar envio con email de usuario existente

Given estoy en la pagina de reset de password
When ingreso un email de prueba conocido (carlos.mendoza@nextspark.dev)
And hago click en el boton de enviar
Then deberia ver un mensaje de exito
```

### Expected Results
- Same success message as non-existing email
- No email enumeration vulnerability

---

## @test PWD-RESET-008: Form Keyboard Accessibility

### Metadata
- **Priority:** Normal
- **Type:** Accessibility
- **Tags:** password-reset, keyboard, a11y

```gherkin:en
Scenario: Submit form with Enter key

Given I am on the password reset page
When I enter an email and press Enter
Then the form should be submitted
```

```gherkin:es
Scenario: Enviar formulario con tecla Enter

Given estoy en la pagina de reset de password
When ingreso un email y presiono Enter
Then el formulario deberia ser enviado
```

### Expected Results
- Enter key submits form
- Keyboard navigation works

---

## UI Elements

| Element | Selector | Description |
|---------|----------|-------------|
| Forgot Password Link | `[data-cy="login-forgot-password"]` | Link on login page |
| Form | `[data-cy="forgot-password-form"]` | Password reset form |
| Email Input | `[data-cy="forgot-password-email"]` | Email input field |
| Submit Button | `[data-cy="forgot-password-submit"]` | Submit button |
| Success Message | `[data-cy="forgot-password-success"]` | Success message |
| Error Message | `[data-cy="forgot-password-error"]` | Error message |
| Back to Login | `[data-cy="forgot-password-back"]` | Back to login link |

> Note: Tests use `AuthPOM` from `src/core/AuthPOM.ts` which loads selectors from `fixtures/selectors/auth.json`

---

## Summary

| Test ID | Block | Description | Tags |
|---------|-------|-------------|------|
| PWD-RESET-001 | Access | Page access from login | `@smoke` |
| PWD-RESET-002 | Access | Direct URL access | `@smoke` |
| PWD-RESET-003 | Submit | Submit valid email | `@smoke` |
| PWD-RESET-004 | Validation | Empty email error | |
| PWD-RESET-005 | Validation | Invalid format error | |
| PWD-RESET-006 | Navigation | Back to login | |
| PWD-RESET-007 | Submit | Existing user email | |
| PWD-RESET-008 | A11y | Keyboard accessibility | |
