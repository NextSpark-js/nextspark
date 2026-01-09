---
feature: Auth UI Selectors Validation
priority: high
tags: [selectors, auth, ui-validation]
grepTags: [ui-selectors, auth, SEL_AUTH_001, SEL_AUTH_002, SEL_AUTH_003, SEL_AUTH_004, SEL_AUTH_005, SEL_AUTH_006, SEL_AUTH_007]
coverage: 7
---

# Auth UI Selectors Validation

> Validates that authentication component selectors exist in the DOM. This is a lightweight test that ONLY checks selector presence, not functionality. Runs as Phase 12 sub-gate before functional tests.

## @test SEL_AUTH_001: Login Card Structure

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** login, card, structure
- **Grep:** `@ui-selectors` `@SEL_AUTH_001`
- **Status:** Active - 6 tests

```gherkin:en
Scenario: Login page has complete card structure

Given I navigate to the login page
And the login card is visible
Then I should find the login card element
And I should find the login header
And I should find the login footer
And I should find the signup link
And I should find the Google signin button
And I should find the show email button
```

```gherkin:es
Scenario: Pagina de login tiene estructura de card completa

Given navego a la pagina de login
And la card de login esta visible
Then deberia encontrar el elemento card de login
And deberia encontrar el header de login
And deberia encontrar el footer de login
And deberia encontrar el link de signup
And deberia encontrar el boton de Google signin
And deberia encontrar el boton de mostrar email
```

### Expected Results
- `auth.login.card` selector exists
- `auth.login.header` selector exists
- `auth.login.footer` selector exists
- `auth.login.signupLink` selector exists
- `auth.login.googleButton` selector exists
- `auth.login.showEmailButton` selector exists

---

## @test SEL_AUTH_002: Login Form Inputs

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** login, form, inputs
- **Grep:** `@ui-selectors` `@SEL_AUTH_002`
- **Status:** Active - 11 tests

```gherkin:en
Scenario: Login form has all required input selectors

Given I navigate to the login page
And I click the show email button
And the login form is visible
Then I should find the login form element
And I should find the email input
And I should find the password input
And I should find the submit button
And I should find the forgot password link
And I should find the hide email button
And I should find the remember checkbox
When I click submit without filling fields
Then I should find the email error message
When I fill email and click submit
Then I should find the password error message
When I fill both fields with invalid credentials and submit
Then I should find the login error alert
```

```gherkin:es
Scenario: Formulario de login tiene todos los selectores de input requeridos

Given navego a la pagina de login
And hago clic en el boton de mostrar email
And el formulario de login esta visible
Then deberia encontrar el elemento formulario de login
And deberia encontrar el input de email
And deberia encontrar el input de password
And deberia encontrar el boton de submit
And deberia encontrar el link de olvide password
And deberia encontrar el boton de ocultar email
And deberia encontrar el checkbox de recordar
When hago clic en submit sin llenar campos
Then deberia encontrar el mensaje de error de email
When lleno email y hago clic en submit
Then deberia encontrar el mensaje de error de password
When lleno ambos campos con credenciales invalidas y envio
Then deberia encontrar la alerta de error de login
```

### Expected Results
- `auth.login.form` selector exists
- `auth.login.options` selector exists
- `auth.login.emailInput` selector exists
- `auth.login.passwordInput` selector exists
- `auth.login.submitButton` selector exists
- `auth.login.forgotPasswordLink` selector exists
- `auth.login.hideEmailButton` selector exists
- `auth.login.rememberCheckbox` selector exists
- `auth.login.emailError` selector appears on validation failure
- `auth.login.passwordError` selector appears on validation failure
- `auth.login.error` selector appears after failed login attempt

---

## @test SEL_AUTH_003: Signup Form

### Metadata
- **Priority:** High
- **Type:** Selector Validation
- **Tags:** signup, form, inputs
- **Grep:** `@ui-selectors` `@SEL_AUTH_003`
- **Status:** Partial - 9 passing, 1 skipped (Google button)

```gherkin:en
Scenario: Signup form has all required input selectors

Given I navigate to the signup page
And the signup form is visible
Then I should find the signup form element
And I should find the first name input
And I should find the last name input
And I should find the email input
And I should find the password input
And I should find the confirm password input
And I should find the submit button
And I should find the Google signup button
And I should find the login link
When I fill the form with an existing email and submit
Then I should find the signup error message
```

```gherkin:es
Scenario: Formulario de signup tiene todos los selectores de input requeridos

Given navego a la pagina de signup
And el formulario de signup esta visible
Then deberia encontrar el elemento formulario de signup
And deberia encontrar el input de nombre
And deberia encontrar el input de apellido
And deberia encontrar el input de email
And deberia encontrar el input de password
And deberia encontrar el input de confirmar password
And deberia encontrar el boton de submit
And deberia encontrar el boton de Google signup
And deberia encontrar el link de login
When lleno el formulario con un email existente y envio
Then deberia encontrar el mensaje de error de signup
```

### Expected Results
- `auth.signup.form` selector exists
- `auth.signup.firstNameInput` selector exists
- `auth.signup.lastNameInput` selector exists
- `auth.signup.emailInput` selector exists
- `auth.signup.passwordInput` selector exists
- `auth.signup.confirmPasswordInput` selector exists
- `auth.signup.submitButton` selector exists
- `auth.signup.googleButton` selector exists
- `auth.signup.loginLink` selector exists
- `auth.signup.error` selector appears when email already exists

---

## @test SEL_AUTH_004: Forgot Password

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** forgot-password, form
- **Grep:** `@ui-selectors` `@SEL_AUTH_004`
- **Status:** Partial - 4 passing, 4 skipped (require states)

```gherkin:en
Scenario: Forgot password page has all required selectors

Given I navigate to the forgot password page
And the forgot password form is visible
Then I should find the forgot password form element
And I should find the email input
And I should find the submit button
And I should find the back to login link
```

```gherkin:es
Scenario: Pagina de olvide password tiene todos los selectores requeridos

Given navego a la pagina de olvide password
And el formulario de olvide password esta visible
Then deberia encontrar el elemento formulario de olvide password
And deberia encontrar el input de email
And deberia encontrar el boton de submit
And deberia encontrar el link de volver a login
```

### Expected Results
- `auth.forgotPassword.form` selector exists
- `auth.forgotPassword.emailInput` selector exists
- `auth.forgotPassword.submitButton` selector exists
- `auth.forgotPassword.backLink` selector exists

### Skipped Tests (require specific states)
- `auth.forgotPassword.success` - requires successful email submission
- `auth.forgotPassword.successBackLink` - requires success state
- `auth.forgotPassword.retryButton` - requires success state
- `auth.forgotPassword.error` - requires server error

---

## @test SEL_AUTH_005: DevKeyring

### Metadata
- **Priority:** Medium
- **Type:** Selector Validation
- **Tags:** devkeyring, development
- **Grep:** `@ui-selectors` `@SEL_AUTH_005`
- **Status:** Active - 4 tests

```gherkin:en
Scenario: DevKeyring component has all required selectors

Given I navigate to the login page
And the login card is visible
Then I should find the devkeyring container
And I should find the devkeyring trigger
When I click the devkeyring trigger
Then I should find the devkeyring content
And I should find at least one devkeyring user option
```

```gherkin:es
Scenario: Componente DevKeyring tiene todos los selectores requeridos

Given navego a la pagina de login
And la card de login esta visible
Then deberia encontrar el contenedor de devkeyring
And deberia encontrar el trigger de devkeyring
When hago clic en el trigger de devkeyring
Then deberia encontrar el contenido de devkeyring
And deberia encontrar al menos una opcion de usuario de devkeyring
```

### Expected Results
- `auth.devKeyring.container` selector exists
- `auth.devKeyring.trigger` selector exists
- `auth.devKeyring.content` selector exists when opened
- `auth.devKeyring.user(0)` selector exists (at least one user)

---

## @test SEL_AUTH_006: Reset Password

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** reset-password, form
- **Grep:** `@ui-selectors` `@SEL_AUTH_006`
- **Status:** Skipped - requires valid reset token

```gherkin:en
Scenario: Reset password page has all required selectors

Given I have a valid password reset token
And I navigate to the reset password page with the token
Then I should find the reset password form element
And I should find the password input
And I should find the confirm password input
And I should find the submit button
```

```gherkin:es
Scenario: Pagina de reset password tiene todos los selectores requeridos

Given tengo un token valido de reset password
And navego a la pagina de reset password con el token
Then deberia encontrar el elemento formulario de reset password
And deberia encontrar el input de password
And deberia encontrar el input de confirmar password
And deberia encontrar el boton de submit
```

### Expected Results (when token is valid)
- `auth.resetPassword.form` selector exists
- `auth.resetPassword.password` selector exists
- `auth.resetPassword.confirmPassword` selector exists
- `auth.resetPassword.submitButton` selector exists
- `auth.resetPassword.error` selector appears on validation failure

### Notes
All tests in this section are skipped because they require a valid reset token which cannot be generated in automated tests without email access.

---

## @test SEL_AUTH_007: Verify Email

### Metadata
- **Priority:** Low
- **Type:** Selector Validation
- **Tags:** verify-email, email
- **Grep:** `@ui-selectors` `@SEL_AUTH_007`
- **Status:** Skipped - requires pending verification state

```gherkin:en
Scenario: Verify email page has all required selectors

Given I have just signed up and need to verify email
And I am on the verify email page
Then I should find the verify email container
And I should find the resend button
When verification is complete
Then I should find the success message
When verification fails
Then I should find the error message
```

```gherkin:es
Scenario: Pagina de verificar email tiene todos los selectores requeridos

Given acabo de registrarme y necesito verificar email
And estoy en la pagina de verificar email
Then deberia encontrar el contenedor de verificar email
And deberia encontrar el boton de reenviar
When la verificacion se completa
Then deberia encontrar el mensaje de exito
When la verificacion falla
Then deberia encontrar el mensaje de error
```

### Expected Results (when in verification state)
- `auth.verifyEmail.container` selector exists
- `auth.verifyEmail.resendButton` selector exists
- `auth.verifyEmail.success` selector appears on successful verification
- `auth.verifyEmail.error` selector appears on verification failure

### Notes
All tests in this section are skipped because they require a pending email verification state which cannot be reliably set up in automated tests.
