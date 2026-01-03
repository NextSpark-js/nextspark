---
feature: DevTools Registries API
priority: high
tags: [api, feat-devtools, security, regression]
grepTags: ["@api", "@feat-devtools"]
coverage: 16 tests
---

# DevTools Registries API

> API tests for the DevTools registry endpoints that provide access to features, flows, blocks, and testing registries. These endpoints require superadmin or developer user role for access.

## Endpoints Covered

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/devtools/features` | GET | Feature registry with test coverage |
| `/api/v1/devtools/flows` | GET | Flow registry (user journeys) |
| `/api/v1/devtools/blocks` | GET | Block registry with field definitions |
| `/api/v1/devtools/testing` | GET | Complete tags registry |

---

## @test DEVTOOLS_API_001: Features Registry Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, devtools, features, authentication
- **Grep:** `@smoke @feat-devtools`

```gherkin:en
Scenario: Superadmin can access features registry

Given I have a valid superadmin API key
When I make a GET request to /api/v1/devtools/features
Then the response status should be 200
And the response body should have success true
And the data should contain features array
And the data should contain summary with total, withTests, withoutTests
And the data should contain meta with theme and generatedAt
```

```gherkin:es
Scenario: Superadmin puede acceder al registro de features

Given tengo una API key de superadmin válida
When hago una solicitud GET a /api/v1/devtools/features
Then el status de respuesta debería ser 200
And el body debería tener success true
And los datos deberían contener un array de features
And los datos deberían contener summary con total, withTests, withoutTests
And los datos deberían contener meta con theme y generatedAt
```

### Expected Results
- Status: 200 OK
- Response contains features array
- Summary includes coverage statistics
- Meta includes theme and generation timestamp

---

## @test DEVTOOLS_API_002: Authentication Required (Features)

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, devtools, authentication, 401

```gherkin:en
Scenario: Request without API key returns 401

Given I make a request without authentication
When I make a GET request to /api/v1/devtools/features
Then the response status should be 401
And the response body should have success false
And the error code should be AUTHENTICATION_REQUIRED
```

```gherkin:es
Scenario: Solicitud sin API key retorna 401

Given hago una solicitud sin autenticación
When hago una solicitud GET a /api/v1/devtools/features
Then el status de respuesta debería ser 401
And el body debería tener success false
And el código de error debería ser AUTHENTICATION_REQUIRED
```

---

## @test DEVTOOLS_API_003: Invalid API Key (Features)

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, devtools, authentication, invalid-key

```gherkin:en
Scenario: Invalid API key returns 401

Given I have an invalid API key
When I make a GET request to /api/v1/devtools/features
Then the response status should be 401
And the response body should have success false
```

```gherkin:es
Scenario: API key inválida retorna 401

Given tengo una API key inválida
When hago una solicitud GET a /api/v1/devtools/features
Then el status de respuesta debería ser 401
And el body debería tener success false
```

---

## @test DEVTOOLS_API_004: Flows Registry Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, devtools, flows

```gherkin:en
Scenario: Superadmin can access flows registry

Given I have a valid superadmin API key
When I make a GET request to /api/v1/devtools/flows
Then the response status should be 200
And the data should contain flows array
And the data should contain summary with total, withTests, withoutTests
```

```gherkin:es
Scenario: Superadmin puede acceder al registro de flows

Given tengo una API key de superadmin válida
When hago una solicitud GET a /api/v1/devtools/flows
Then el status de respuesta debería ser 200
And los datos deberían contener un array de flows
And los datos deberían contener summary con total, withTests, withoutTests
```

---

## @test DEVTOOLS_API_007: Blocks Registry Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, devtools, blocks

```gherkin:en
Scenario: Superadmin can access blocks registry

Given I have a valid superadmin API key
When I make a GET request to /api/v1/devtools/blocks
Then the response status should be 200
And the data should contain blocks array
And each block should have slug, name, category, and testing properties
And the summary should contain categories array
```

```gherkin:es
Scenario: Superadmin puede acceder al registro de blocks

Given tengo una API key de superadmin válida
When hago una solicitud GET a /api/v1/devtools/blocks
Then el status de respuesta debería ser 200
And los datos deberían contener un array de blocks
And cada block debería tener propiedades slug, name, category y testing
And el summary debería contener un array de categories
```

---

## @test DEVTOOLS_API_010: Testing Registry Access

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, devtools, testing, tags

```gherkin:en
Scenario: Superadmin can access testing/tags registry

Given I have a valid superadmin API key
When I make a GET request to /api/v1/devtools/testing
Then the response status should be 200
And the data should contain tags object
And the summary should contain totalTags and testFiles
And the summary should contain byCategory object
And the summary should contain features and flows statistics
```

```gherkin:es
Scenario: Superadmin puede acceder al registro de testing/tags

Given tengo una API key de superadmin válida
When hago una solicitud GET a /api/v1/devtools/testing
Then el status de respuesta debería ser 200
And los datos deberían contener un objeto tags
And el summary debería contener totalTags y testFiles
And el summary debería contener objeto byCategory
And el summary debería contener estadísticas de features y flows
```

---

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "features|flows|blocks|tags": [...],
    "summary": {
      "total": 0,
      "withTests": 0,
      "withoutTests": 0
    },
    "meta": {
      "theme": "default",
      "generatedAt": "2025-12-29T00:00:00.000Z"
    }
  }
}
```

### Error Response (401)

```json
{
  "success": false,
  "error": {
    "message": "Authentication required",
    "code": "AUTHENTICATION_REQUIRED",
    "details": {
      "hint": "Provide a valid API key via Authorization header or x-api-key header"
    }
  }
}
```

### Error Response (403) - Member Role

```json
{
  "success": false,
  "error": {
    "message": "Access denied: DevTools APIs require superadmin or developer role",
    "code": "DEVTOOLS_ACCESS_DENIED",
    "details": {
      "requiredRoles": ["superadmin", "developer"],
      "hint": "User role \"member\" cannot access DevTools APIs regardless of team role"
    }
  }
}
```

---

## Test Summary

| Test ID | Endpoint | Description | Tags |
|---------|----------|-------------|------|
| DEVTOOLS_API_001 | /features | Success with superadmin key | `@smoke` |
| DEVTOOLS_API_002 | /features | 401 without auth | |
| DEVTOOLS_API_003 | /features | 401 with invalid key | |
| DEVTOOLS_API_004 | /flows | Success with superadmin key | `@smoke` |
| DEVTOOLS_API_005 | /flows | 401 without auth | |
| DEVTOOLS_API_006 | /flows | 401 with invalid key | |
| DEVTOOLS_API_007 | /blocks | Success with superadmin key | `@smoke` |
| DEVTOOLS_API_008 | /blocks | 401 without auth | |
| DEVTOOLS_API_009 | /blocks | 401 with invalid key | |
| DEVTOOLS_API_010 | /testing | Success with superadmin key | `@smoke` |
| DEVTOOLS_API_011 | /testing | 401 without auth | |
| DEVTOOLS_API_012 | /testing | 401 with invalid key | |
| - | All | Response format consistency | |

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SUPERADMIN_API_KEY` | API key for superadmin user |

---

## Security Notes

1. **Role-based access**: Only `superadmin` and `developer` user roles can access these endpoints
2. **Member restriction**: Users with `member` role are denied regardless of their team role
3. **API key validation**: Invalid or missing API keys return 401 Unauthorized
