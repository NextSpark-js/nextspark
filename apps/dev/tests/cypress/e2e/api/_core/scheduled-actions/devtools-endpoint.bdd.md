---
feature: Scheduled Actions DevTools Endpoint API
priority: critical
tags: [api, feat-scheduled-actions, devtools, filters, pagination, regression]
grepTags: ["@api", "@feat-scheduled-actions"]
coverage: 13 tests
---

# Scheduled Actions DevTools Endpoint API

> API tests for the `/api/v1/devtools/scheduled-actions` endpoint that provides access to scheduled actions with filtering, pagination, and metadata. Requires superadmin/developer API key authentication.

## Endpoint Covered

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/devtools/scheduled-actions` | GET | List scheduled actions with filters |

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter: pending, running, completed, failed |
| `action_type` | string | - | Filter by action type name |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page |

---

## @test SA_DEVTOOLS_AUTH_001: Should return 401 without API key

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, scheduled-actions, authentication, 401
- **AC:** -

```gherkin:en
Scenario: Request without API key returns 401

Given I make a request without x-api-key header
When I make a GET request to /api/v1/devtools/scheduled-actions
Then the response status should be 401
And the error code should be AUTHENTICATION_REQUIRED
```

```gherkin:es
Scenario: Solicitud sin API key retorna 401

Given hago una solicitud sin header x-api-key
When hago una solicitud GET a /api/v1/devtools/scheduled-actions
Then el status de respuesta deberia ser 401
And el codigo de error deberia ser AUTHENTICATION_REQUIRED
```

---

## @test SA_DEVTOOLS_AUTH_002: Should return 200 with valid API key

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, scheduled-actions, authentication
- **AC:** -

```gherkin:en
Scenario: Valid API key is accepted

Given I have a valid superadmin API key
When I make a GET request to /api/v1/devtools/scheduled-actions
Then the response status should be 200
And the response body should have success true
```

```gherkin:es
Scenario: API key valido es aceptado

Given tengo una API key de superadmin valida
When hago una solicitud GET a /api/v1/devtools/scheduled-actions
Then el status de respuesta deberia ser 200
And el body deberia tener success true
```

---

## @test SA_DEVTOOLS_001: Should filter by status=pending

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, filtering, status
- **AC:** AC-27

```gherkin:en
Scenario: Filter by pending status

Given I have a valid API key
When I make a GET request with ?status=pending
Then the response status should be 200
And all returned actions should have status "pending"
```

```gherkin:es
Scenario: Filtrar por estado pending

Given tengo una API key valida
When hago una solicitud GET con ?status=pending
Then el status de respuesta deberia ser 200
And todas las acciones retornadas deberian tener status "pending"
```

---

## @test SA_DEVTOOLS_002: Should filter by status=completed

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, filtering, status
- **AC:** AC-27

```gherkin:en
Scenario: Filter by completed status

Given I have a valid API key
When I make a GET request with ?status=completed
Then the response status should be 200
And all returned actions should have status "completed"
```

```gherkin:es
Scenario: Filtrar por estado completed

Given tengo una API key valida
When hago una solicitud GET con ?status=completed
Then el status de respuesta deberia ser 200
And todas las acciones retornadas deberian tener status "completed"
```

---

## @test SA_DEVTOOLS_003: Should filter by action_type

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, filtering, action-type
- **AC:** AC-28

```gherkin:en
Scenario: Filter by action type

Given I have a valid API key
When I make a GET request with ?action_type=webhook:send
Then the response status should be 200
And all returned actions should have actionType "webhook:send"
```

```gherkin:es
Scenario: Filtrar por tipo de accion

Given tengo una API key valida
When hago una solicitud GET con ?action_type=webhook:send
Then el status de respuesta deberia ser 200
And todas las acciones retornadas deberian tener actionType "webhook:send"
```

---

## @test SA_DEVTOOLS_004: Should filter by status AND action_type together

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, filtering, combined
- **AC:** AC-29

```gherkin:en
Scenario: Combined filters work together

Given I have a valid API key
When I make a GET request with ?status=completed&action_type=webhook:send
Then the response status should be 200
And all returned actions should have status "completed"
And all returned actions should have actionType "webhook:send"
```

```gherkin:es
Scenario: Filtros combinados funcionan juntos

Given tengo una API key valida
When hago una solicitud GET con ?status=completed&action_type=webhook:send
Then el status de respuesta deberia ser 200
And todas las acciones retornadas deberian tener status "completed"
And todas las acciones retornadas deberian tener actionType "webhook:send"
```

---

## @test SA_DEVTOOLS_005: Should return empty array for non-existent action_type

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, filtering, empty
- **AC:** AC-30

```gherkin:en
Scenario: Non-existent action type returns empty

Given I have a valid API key
When I make a GET request with ?action_type=non-existent:action
Then the response status should be 200
And the actions array should be empty
And pagination total should be 0
```

```gherkin:es
Scenario: Tipo de accion inexistente retorna vacio

Given tengo una API key valida
When hago una solicitud GET con ?action_type=non-existent:action
Then el status de respuesta deberia ser 200
And el array de acciones deberia estar vacio
And el total de paginacion deberia ser 0
```

---

## @test SA_DEVTOOLS_006: Should paginate filtered results correctly

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, pagination
- **AC:** AC-31

```gherkin:en
Scenario: Pagination with filters

Given I have a valid API key
When I make a GET request with ?status=completed&limit=5&page=1
Then the response status should be 200
And pagination should show page 1
And pagination should show limit 5
And actions count should be at most 5
```

```gherkin:es
Scenario: Paginacion con filtros

Given tengo una API key valida
When hago una solicitud GET con ?status=completed&limit=5&page=1
Then el status de respuesta deberia ser 200
And la paginacion deberia mostrar pagina 1
And la paginacion deberia mostrar limite 5
And el conteo de acciones deberia ser maximo 5
```

---

## @test SA_DEVTOOLS_007: Should include registeredActionTypes in meta

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, meta, registry
- **AC:** AC-32

```gherkin:en
Scenario: Response includes registered action types

Given I have a valid API key
When I make a GET request to /api/v1/devtools/scheduled-actions
Then the response should contain meta object
And meta should contain registeredActionTypes array
And registeredActionTypes should include "webhook:send"
And registeredActionTypes should include "billing:check-renewals"
```

```gherkin:es
Scenario: Respuesta incluye tipos de accion registrados

Given tengo una API key valida
When hago una solicitud GET a /api/v1/devtools/scheduled-actions
Then la respuesta deberia contener objeto meta
And meta deberia contener array registeredActionTypes
And registeredActionTypes deberia incluir "webhook:send"
And registeredActionTypes deberia incluir "billing:check-renewals"
```

---

## @test SA_DEVTOOLS_008: Should return correct action structure

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, response-structure
- **AC:** -

```gherkin:en
Scenario: Action object has correct structure

Given I have a valid API key
When I make a GET request with ?limit=1
Then the response status should be 200
And action should have id, actionType, status, payload
And action should have teamId, scheduledAt, createdAt, updatedAt
And action should have attempts, recurringInterval
```

```gherkin:es
Scenario: Objeto de accion tiene estructura correcta

Given tengo una API key valida
When hago una solicitud GET con ?limit=1
Then el status de respuesta deberia ser 200
And la accion deberia tener id, actionType, status, payload
And la accion deberia tener teamId, scheduledAt, createdAt, updatedAt
And la accion deberia tener attempts, recurringInterval
```

---

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "abc123",
        "actionType": "webhook:send",
        "status": "completed",
        "payload": { "entityId": "123", "eventType": "created" },
        "teamId": "team-001",
        "scheduledAt": "2025-12-30T10:00:00Z",
        "startedAt": "2025-12-30T10:01:00Z",
        "completedAt": "2025-12-30T10:01:05Z",
        "errorMessage": null,
        "attempts": 1,
        "recurringInterval": null,
        "createdAt": "2025-12-30T10:00:00Z",
        "updatedAt": "2025-12-30T10:01:05Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "meta": {
      "registeredActionTypes": [
        "webhook:send",
        "billing:check-renewals"
      ]
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

---

## Test Summary

| Test ID | Description | Priority | AC |
|---------|-------------|----------|-----|
| SA_DEVTOOLS_AUTH_001 | 401 without API key | Critical | - |
| SA_DEVTOOLS_AUTH_002 | 200 with valid API key | Critical | - |
| SA_DEVTOOLS_001 | Filter by status=pending | Critical | AC-27 |
| SA_DEVTOOLS_002 | Filter by status=completed | Critical | AC-27 |
| SA_DEVTOOLS_002b | Filter by status=failed | Normal | AC-27 |
| SA_DEVTOOLS_002c | Filter by status=running | Normal | AC-27 |
| SA_DEVTOOLS_003 | Filter by action_type=webhook:send | Critical | AC-28 |
| SA_DEVTOOLS_003b | Filter by action_type=billing:check-renewals | Normal | AC-28 |
| SA_DEVTOOLS_004 | Combined status + action_type filters | Critical | AC-29 |
| SA_DEVTOOLS_005 | Empty array for non-existent type | Normal | AC-30 |
| SA_DEVTOOLS_005b | Handle invalid status gracefully | Normal | AC-30 |
| SA_DEVTOOLS_006 | Pagination with filters | Critical | AC-31 |
| SA_DEVTOOLS_006b | Navigate to page 2 | Normal | AC-31 |
| SA_DEVTOOLS_007 | Meta includes registeredActionTypes | Critical | AC-32 |
| SA_DEVTOOLS_008 | Action structure validation | Critical | - |

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  GET /api/v1/devtools/scheduled-actions                         │
│  + x-api-key: sk_test_...                                       │
│  + ?status=completed&action_type=webhook:send&limit=10&page=1   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Authentication Check                                            │
│  ├── No API key? → 401 AUTHENTICATION_REQUIRED                  │
│  ├── Invalid key? → 401 or 403                                  │
│  └── Valid key? → Continue                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Build Query                                                     │
│  ├── Add status filter if provided                              │
│  ├── Add action_type filter if provided                         │
│  └── Apply pagination (limit, offset)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response                                                        │
│  {                                                               │
│    success: true,                                                │
│    data: {                                                       │
│      actions: [...],                                             │
│      pagination: { total, page, limit, totalPages },            │
│      meta: { registeredActionTypes: [...] }                     │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SUPERADMIN_API_KEY` | API key with superadmin/developer access |
