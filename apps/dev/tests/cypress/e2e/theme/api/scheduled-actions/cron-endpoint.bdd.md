---
feature: Scheduled Actions Cron Endpoint API
priority: critical
tags: [api, feat-scheduled-actions, security, cron, regression]
grepTags: ["@api", "@feat-scheduled-actions"]
coverage: 10 tests
---

# Scheduled Actions Cron Endpoint API

> API tests for the `/api/v1/cron/process` endpoint that processes pending scheduled actions. This endpoint requires CRON_SECRET authentication and handles batch processing with cleanup.

## Endpoint Covered

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/cron/process` | GET | Process pending scheduled actions |

---

## @test SCHED_CRON_001: Should return 401 without CRON_SECRET header

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, scheduled-actions, authentication, 401
- **AC:** AC-3

```gherkin:en
Scenario: Request without CRON_SECRET returns 401

Given I make a request without x-cron-secret header
When I make a GET request to /api/v1/cron/process
Then the response status should be 401
And the response body should have success false
And the error code should be INVALID_CRON_SECRET
```

```gherkin:es
Scenario: Solicitud sin CRON_SECRET retorna 401

Given hago una solicitud sin header x-cron-secret
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 401
And el body deberia tener success false
And el codigo de error deberia ser INVALID_CRON_SECRET
```

---

## @test SCHED_CRON_002: Should return 401 with invalid CRON_SECRET

### Metadata
- **Priority:** Critical
- **Type:** Security
- **Tags:** api, scheduled-actions, authentication, invalid-secret
- **AC:** AC-3

```gherkin:en
Scenario: Invalid CRON_SECRET returns 401

Given I have an invalid CRON_SECRET
When I make a GET request to /api/v1/cron/process
Then the response status should be 401
And the response body should have success false
And the error code should be INVALID_CRON_SECRET
```

```gherkin:es
Scenario: CRON_SECRET invalido retorna 401

Given tengo un CRON_SECRET invalido
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 401
And el body deberia tener success false
And el codigo de error deberia ser INVALID_CRON_SECRET
```

---

## @test SCHED_CRON_003: Should return 200 with valid CRON_SECRET

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, scheduled-actions, authentication
- **AC:** AC-3, AC-2

```gherkin:en
Scenario: Valid CRON_SECRET is accepted

Given I have a valid CRON_SECRET
When I make a GET request to /api/v1/cron/process
Then the response status should be 200
And the response body should have success true
```

```gherkin:es
Scenario: CRON_SECRET valido es aceptado

Given tengo un CRON_SECRET valido
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 200
And el body deberia tener success true
```

---

## @test SCHED_CRON_010: Should return ProcessResult structure

### Metadata
- **Priority:** Critical
- **Type:** Smoke
- **Tags:** api, scheduled-actions, response-structure
- **AC:** AC-2

```gherkin:en
Scenario: Response contains ProcessResult structure

Given I have a valid CRON_SECRET
When I make a GET request to /api/v1/cron/process
Then the response status should be 200
And the data should contain processing object
And the data should contain cleanup object
And the data should contain executionTime
And processing should have processed, succeeded, failed, errors
And cleanup should have deletedCount
```

```gherkin:es
Scenario: Respuesta contiene estructura ProcessResult

Given tengo un CRON_SECRET valido
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 200
And los datos deberian contener objeto processing
And los datos deberian contener objeto cleanup
And los datos deberian contener executionTime
And processing deberia tener processed, succeeded, failed, errors
And cleanup deberia tener deletedCount
```

---

## @test SCHED_CRON_011: Should include execution time in response

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, metrics

```gherkin:en
Scenario: Response includes execution time

Given I have a valid CRON_SECRET
When I make a GET request to /api/v1/cron/process
Then the response should include execution time metadata
```

```gherkin:es
Scenario: Respuesta incluye tiempo de ejecucion

Given tengo un CRON_SECRET valido
When hago una solicitud GET a /api/v1/cron/process
Then la respuesta deberia incluir metadata de tiempo de ejecucion
```

---

## @test SCHED_CRON_020: Should process at most 10 actions per run

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, batch-processing
- **AC:** AC-20

```gherkin:en
Scenario: Batch size limited to 10 actions

Given I have a valid CRON_SECRET
When I make a GET request to /api/v1/cron/process
Then the processed count should be at most 10
```

```gherkin:es
Scenario: Tamano de batch limitado a 10 acciones

Given tengo un CRON_SECRET valido
When hago una solicitud GET a /api/v1/cron/process
Then el conteo de procesados deberia ser maximo 10
```

---

## @test SCHED_CRON_030: Should handle CRON_SECRET not configured

### Metadata
- **Priority:** Critical
- **Type:** Error Handling
- **Tags:** api, scheduled-actions, configuration

```gherkin:en
Scenario: Handles missing CRON_SECRET configuration

Given CRON_SECRET is not configured in environment
When I make a GET request to /api/v1/cron/process
Then the response status should be 500
And the error code should be CRON_SECRET_NOT_CONFIGURED
```

```gherkin:es
Scenario: Maneja configuracion faltante de CRON_SECRET

Given CRON_SECRET no esta configurado en el entorno
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 500
And el codigo de error deberia ser CRON_SECRET_NOT_CONFIGURED
```

---

## @test SCHED_CRON_031: Should reject POST method

### Metadata
- **Priority:** Normal
- **Type:** Security
- **Tags:** api, scheduled-actions, method-validation

```gherkin:en
Scenario: POST method is rejected

Given I have a valid CRON_SECRET
When I make a POST request to /api/v1/cron/process
Then the response status should be 405
```

```gherkin:es
Scenario: Metodo POST es rechazado

Given tengo un CRON_SECRET valido
When hago una solicitud POST a /api/v1/cron/process
Then el status de respuesta deberia ser 405
```

---

## @test SCHED_CRON_032: Should handle empty pending actions gracefully

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, empty-queue
- **AC:** AC-2

```gherkin:en
Scenario: Empty queue handled gracefully

Given I have a valid CRON_SECRET
And there are no pending scheduled actions
When I make a GET request to /api/v1/cron/process
Then the response status should be 200
And the processed count should be 0
```

```gherkin:es
Scenario: Cola vacia manejada correctamente

Given tengo un CRON_SECRET valido
And no hay acciones programadas pendientes
When hago una solicitud GET a /api/v1/cron/process
Then el status de respuesta deberia ser 200
And el conteo de procesados deberia ser 0
```

---

## @test SCHED_CRON_100: Should be idempotent - multiple calls safe

### Metadata
- **Priority:** Critical
- **Type:** Integration
- **Tags:** api, scheduled-actions, idempotency
- **AC:** AC-2

```gherkin:en
Scenario: Multiple calls are idempotent

Given I have a valid CRON_SECRET
When I make a GET request to /api/v1/cron/process
And I make another GET request immediately
Then both responses should be successful
And no duplicate processing should occur
```

```gherkin:es
Scenario: Multiples llamadas son idempotentes

Given tengo un CRON_SECRET valido
When hago una solicitud GET a /api/v1/cron/process
And hago otra solicitud GET inmediatamente
Then ambas respuestas deberian ser exitosas
And no deberia ocurrir procesamiento duplicado
```

---

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "processing": {
      "processed": 5,
      "succeeded": 4,
      "failed": 1,
      "errors": [
        { "id": "abc123", "error": "Webhook timeout" }
      ]
    },
    "cleanup": {
      "deletedCount": 2
    },
    "executionTime": 1250
  }
}
```

### Error Response (401)

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "INVALID_CRON_SECRET"
}
```

### Error Response (500)

```json
{
  "success": false,
  "error": "CRON_SECRET environment variable is not configured",
  "code": "CRON_SECRET_NOT_CONFIGURED"
}
```

---

## Test Summary

| Test ID | Description | Priority | AC |
|---------|-------------|----------|-----|
| SCHED_CRON_001 | 401 without CRON_SECRET | Critical | AC-3 |
| SCHED_CRON_002 | 401 with invalid CRON_SECRET | Critical | AC-3 |
| SCHED_CRON_003 | 200 with valid CRON_SECRET | Critical | AC-3, AC-2 |
| SCHED_CRON_010 | ProcessResult structure | Critical | AC-2 |
| SCHED_CRON_011 | Execution time included | Normal | - |
| SCHED_CRON_020 | Batch limited to 10 | Critical | AC-20 |
| SCHED_CRON_030 | CRON_SECRET not configured | Critical | - |
| SCHED_CRON_031 | POST method rejected | Normal | - |
| SCHED_CRON_032 | Empty queue handled | Normal | AC-2 |
| SCHED_CRON_100 | Idempotency | Critical | AC-2 |

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Secret key for cron endpoint authentication (min 32 chars) |
