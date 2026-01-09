---
feature: Authentication via DevKeyring
priority: critical
tags: [auth, login, logout, devkeyring]
grepTags: [uat, feat-auth, smoke, critical]
coverage: 4
---

# Authentication via DevKeyring

> Test suite for user authentication using DevKeyring development tool. Covers login flows for Owner, Member, and Admin roles, plus logout functionality.

## @test LOGIN-001: Owner Login via DevKeyring

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** login, owner, devkeyring
- **Grep:** `@smoke` `@critical`

```gherkin:en
Scenario: Owner can login and access dashboard

Given I am on the login page
And the DevKeyring component is visible
When I select the Owner user (owner@nextspark.dev)
And I click to login
Then I should be redirected to the dashboard
And the dashboard container should be visible
```

```gherkin:es
Scenario: Owner puede loguearse y acceder al dashboard

Given estoy en la pagina de login
And el componente DevKeyring esta visible
When selecciono el usuario Owner (owner@nextspark.dev)
And hago clic para iniciar sesion
Then deberia ser redirigido al dashboard
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- DevKeyring component displays user selector
- Owner user (owner@nextspark.dev) is selectable
- Login redirects to /dashboard
- Dashboard container is visible after login

---

## @test LOGIN-002: Member Login via DevKeyring

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** login, member, devkeyring
- **Grep:** `@smoke` `@critical`

```gherkin:en
Scenario: Member can login and access dashboard

Given I am on the login page
And the DevKeyring component is visible
When I select the Member user (member@nextspark.dev)
And I click to login
Then I should be redirected to the dashboard
And the dashboard container should be visible
```

```gherkin:es
Scenario: Member puede loguearse y acceder al dashboard

Given estoy en la pagina de login
And el componente DevKeyring esta visible
When selecciono el usuario Member (member@nextspark.dev)
And hago clic para iniciar sesion
Then deberia ser redirigido al dashboard
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Member user (member@nextspark.dev) is selectable
- Login redirects to /dashboard
- Dashboard container is visible after login
- Member has read-only access to most entities

---

## @test LOGIN-003: Admin Login via DevKeyring

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** login, admin, devkeyring

```gherkin:en
Scenario: Admin can login and access dashboard

Given I am on the login page
And the DevKeyring component is visible
When I select the Admin user (admin@nextspark.dev)
And I click to login
Then I should be redirected to the dashboard
And the dashboard container should be visible
```

```gherkin:es
Scenario: Admin puede loguearse y acceder al dashboard

Given estoy en la pagina de login
And el componente DevKeyring esta visible
When selecciono el usuario Admin (admin@nextspark.dev)
And hago clic para iniciar sesion
Then deberia ser redirigido al dashboard
And el contenedor del dashboard deberia estar visible
```

### Expected Results
- Admin user (admin@nextspark.dev) is selectable
- Login redirects to /dashboard
- Dashboard container is visible after login
- Admin has delegated full CRUD access

---

## @test LOGOUT-001: User Logout Flow

### Metadata
- **Priority:** High
- **Type:** Regression
- **Tags:** logout, signout, navigation

```gherkin:en
Scenario: User can logout successfully

Given I am logged in as Owner
And I am on the dashboard
When I click on the user menu in the top navigation
And I click "Sign Out"
Then I should be redirected to the login page
And the DevKeyring component should be visible again
```

```gherkin:es
Scenario: Usuario puede cerrar sesion exitosamente

Given estoy logueado como Owner
And estoy en el dashboard
When hago clic en el menu de usuario en la navegacion superior
And hago clic en "Cerrar Sesion"
Then deberia ser redirigido a la pagina de login
And el componente DevKeyring deberia estar visible nuevamente
```

### Expected Results
- User menu is accessible in top navigation
- Sign Out option is visible in menu
- Clicking Sign Out clears session
- User is redirected to login page
- DevKeyring component is visible for re-login
