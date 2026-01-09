---
feature: Scheduled Actions Scheduling API
priority: critical
tags: [api, feat-scheduled-actions, scheduling, lifecycle, regression]
grepTags: ["@api", "@feat-scheduled-actions"]
coverage: 22 tests
---

# Scheduled Actions Scheduling API

> Documentation tests for the scheduled-actions library. These tests verify the scheduling API, status transitions, error handling, and registry functions through documented behavior.

## Functions Covered

| Function | Description |
|----------|-------------|
| `scheduleAction(actionType, payload, options)` | Schedule one-time action |
| `scheduleRecurringAction(actionType, payload, interval, options)` | Schedule recurring action |
| `registerScheduledAction(name, handler, options)` | Register action handler |
| `getAllRegisteredActions()` | List registered actions |
| `isActionRegistered(name)` | Check if action is registered |
| `cleanupOldActions(retentionDays)` | Cleanup old actions |

---

## @test SCHED_DB_001: Should have scheduledActions table available

### Metadata
- **Priority:** Critical
- **Type:** Infrastructure
- **Tags:** api, scheduled-actions, database
- **AC:** AC-1

```gherkin:en
Scenario: Database table exists

Given the application is deployed
Then the scheduledActions table should exist
And it should have required columns: id, teamId, actionType, status, payload, scheduledAt
```

```gherkin:es
Scenario: Tabla de base de datos existe

Given la aplicacion esta desplegada
Then la tabla scheduledActions deberia existir
And deberia tener columnas requeridas: id, teamId, actionType, status, payload, scheduledAt
```

---

## @test SCHED_SCHEDULE_010: Should schedule one-time action

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, one-time
- **AC:** AC-4

```gherkin:en
Scenario: Schedule one-time action

Given I have a valid action type
When I call scheduleAction(actionType, payload, options)
Then a new action should be created
And the status should be pending
And the action ID should be returned
```

```gherkin:es
Scenario: Programar accion unica

Given tengo un tipo de accion valido
When llamo scheduleAction(actionType, payload, options)
Then una nueva accion deberia crearse
And el status deberia ser pending
And el ID de la accion deberia retornarse
```

---

## @test SCHED_SCHEDULE_011: Should default to immediate execution when no scheduledAt

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, defaults
- **AC:** AC-4

```gherkin:en
Scenario: Default scheduledAt is NOW()

Given I call scheduleAction without scheduledAt option
Then the action should be scheduled for immediate processing
And scheduledAt should default to current time
```

```gherkin:es
Scenario: scheduledAt por defecto es NOW()

Given llamo scheduleAction sin opcion scheduledAt
Then la accion deberia programarse para procesamiento inmediato
And scheduledAt deberia ser el tiempo actual por defecto
```

---

## @test SCHED_SCHEDULE_020: Should schedule recurring action

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, recurring
- **AC:** AC-5

```gherkin:en
Scenario: Schedule recurring action

Given I have a valid action type
When I call scheduleRecurringAction(actionType, payload, interval, options)
Then a recurring action should be created
And it should create a new action after completion
```

```gherkin:es
Scenario: Programar accion recurrente

Given tengo un tipo de accion valido
When llamo scheduleRecurringAction(actionType, payload, interval, options)
Then una accion recurrente deberia crearse
And deberia crear una nueva accion despues de completar
```

---

## @test SCHED_SCHEDULE_021: Should support hourly recurring interval

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, recurring, hourly
- **AC:** AC-5

```gherkin:en
Scenario: Hourly recurring interval

Given I schedule a recurring action with interval "hourly"
Then the next action should be scheduled +1 hour from completion
```

```gherkin:es
Scenario: Intervalo recurrente por hora

Given programo una accion recurrente con intervalo "hourly"
Then la siguiente accion deberia programarse +1 hora desde la completacion
```

---

## @test SCHED_SCHEDULE_022: Should support daily recurring interval

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, recurring, daily
- **AC:** AC-5

```gherkin:en
Scenario: Daily recurring interval

Given I schedule a recurring action with interval "daily"
Then the next action should be scheduled +1 day from completion
```

```gherkin:es
Scenario: Intervalo recurrente diario

Given programo una accion recurrente con intervalo "daily"
Then la siguiente accion deberia programarse +1 dia desde la completacion
```

---

## @test SCHED_SCHEDULE_023: Should support weekly recurring interval

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, recurring, weekly
- **AC:** AC-5

```gherkin:en
Scenario: Weekly recurring interval

Given I schedule a recurring action with interval "weekly"
Then the next action should be scheduled +7 days from completion
```

```gherkin:es
Scenario: Intervalo recurrente semanal

Given programo una accion recurrente con intervalo "weekly"
Then la siguiente accion deberia programarse +7 dias desde la completacion
```

---

## @test SCHED_STATUS_030: Should start with pending status

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, status
- **AC:** AC-4

```gherkin:en
Scenario: Initial status is pending

Given I schedule a new action
Then the status should be "pending"
And the processor will pick it up on next run
```

```gherkin:es
Scenario: Status inicial es pending

Given programo una nueva accion
Then el status deberia ser "pending"
And el procesador la tomara en la siguiente ejecucion
```

---

## @test SCHED_STATUS_031: Should transition to running when processing

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, status, transition
- **AC:** AC-2

```gherkin:en
Scenario: Status transitions to running

Given a pending action is picked up by the processor
Then the status should change to "running"
And this prevents duplicate processing
```

```gherkin:es
Scenario: Status cambia a running

Given una accion pending es tomada por el procesador
Then el status deberia cambiar a "running"
And esto previene procesamiento duplicado
```

---

## @test SCHED_STATUS_032: Should transition to completed on success

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, status, success
- **AC:** AC-7

```gherkin:en
Scenario: Status transitions to completed on success

Given a running action executes successfully
Then the status should change to "completed"
And AC-7 completed actions are marked correctly
```

```gherkin:es
Scenario: Status cambia a completed en exito

Given una accion running se ejecuta exitosamente
Then el status deberia cambiar a "completed"
And AC-7 acciones completadas se marcan correctamente
```

---

## @test SCHED_STATUS_033: Should transition to failed on error

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, status, error
- **AC:** AC-6

```gherkin:en
Scenario: Status transitions to failed on error

Given a running action encounters an error
Then the status should change to "failed"
And the error message should be stored
And AC-6 failed actions are marked with error message
```

```gherkin:es
Scenario: Status cambia a failed en error

Given una accion running encuentra un error
Then el status deberia cambiar a "failed"
And el mensaje de error deberia guardarse
And AC-6 acciones fallidas se marcan con mensaje de error
```

---

## @test SCHED_ERROR_040: Should store error message on failure

### Metadata
- **Priority:** Critical
- **Type:** Error Handling
- **Tags:** api, scheduled-actions, error
- **AC:** AC-6

```gherkin:en
Scenario: Error message is stored

Given an action fails during processing
Then the error message should be stored in errorMessage column
And it should contain the error stack trace or message
And it should be available for debugging
```

```gherkin:es
Scenario: Mensaje de error se almacena

Given una accion falla durante el procesamiento
Then el mensaje de error deberia guardarse en la columna errorMessage
And deberia contener el stack trace o mensaje de error
And deberia estar disponible para debugging
```

---

## @test SCHED_ERROR_041: Should handle unknown action types

### Metadata
- **Priority:** Critical
- **Type:** Error Handling
- **Tags:** api, scheduled-actions, unknown-action
- **AC:** AC-10

```gherkin:en
Scenario: Unknown action types are handled

Given an action has an unregistered action type
When the processor tries to execute it
Then the action should fail
And the error should be "No handler registered for action: unknown:action"
```

```gherkin:es
Scenario: Tipos de accion desconocidos se manejan

Given una accion tiene un tipo de accion no registrado
When el procesador intenta ejecutarla
Then la accion deberia fallar
And el error deberia ser "No handler registered for action: unknown:action"
```

---

## @test SCHED_ERROR_042: Should handle timeout protection

### Metadata
- **Priority:** Critical
- **Type:** Error Handling
- **Tags:** api, scheduled-actions, timeout
- **AC:** AC-21

```gherkin:en
Scenario: Timeout protection implemented

Given an action handler takes too long
When the timeout is exceeded (default 30 seconds)
Then the action should fail
And the error should be "Action timed out after 30000ms"
```

```gherkin:es
Scenario: Proteccion de timeout implementada

Given un handler de accion toma demasiado tiempo
When el timeout es excedido (default 30 segundos)
Then la accion deberia fallar
And el error deberia ser "Action timed out after 30000ms"
```

---

## @test SCHED_REGISTRY_050: Should provide registry function

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, registry
- **AC:** AC-8

```gherkin:en
Scenario: Registry function is provided

Given the scheduled-actions library is available
Then registerScheduledAction function should be exported
And it should accept name, handler, and options parameters
```

```gherkin:es
Scenario: Funcion de registro es proporcionada

Given la libreria scheduled-actions esta disponible
Then la funcion registerScheduledAction deberia exportarse
And deberia aceptar parametros name, handler y options
```

---

## @test SCHED_REGISTRY_051: Should allow handler registration

### Metadata
- **Priority:** Critical
- **Type:** Functional
- **Tags:** api, scheduled-actions, handler
- **AC:** AC-9

```gherkin:en
Scenario: Handlers can be registered

Given I want to register a new action handler
When I call registerScheduledAction(name, handler, options)
Then the handler should be registered
And it should be available for processing
```

```gherkin:es
Scenario: Handlers pueden registrarse

Given quiero registrar un nuevo handler de accion
When llamo registerScheduledAction(name, handler, options)
Then el handler deberia registrarse
And deberia estar disponible para procesamiento
```

---

## @test SCHED_REGISTRY_052: Should list registered actions

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, registry
- **AC:** AC-8

```gherkin:en
Scenario: Can list registered actions

Given actions have been registered
When I call getAllRegisteredActions()
Then I should receive an array of action names
And it should be usable for DevTools UI and monitoring
```

```gherkin:es
Scenario: Puede listar acciones registradas

Given se han registrado acciones
When llamo getAllRegisteredActions()
Then deberia recibir un array de nombres de acciones
And deberia ser usable para DevTools UI y monitoreo
```

---

## @test SCHED_REGISTRY_053: Should check if action is registered

### Metadata
- **Priority:** Normal
- **Type:** Functional
- **Tags:** api, scheduled-actions, validation
- **AC:** AC-8

```gherkin:en
Scenario: Can check if action is registered

Given I want to validate an action type
When I call isActionRegistered(name)
Then I should receive a boolean
And this can be used for validation before scheduling
```

```gherkin:es
Scenario: Puede verificar si accion esta registrada

Given quiero validar un tipo de accion
When llamo isActionRegistered(name)
Then deberia recibir un boolean
And esto puede usarse para validacion antes de programar
```

---

## @test SCHED_CLEANUP_060: Should cleanup old completed actions

### Metadata
- **Priority:** Normal
- **Type:** Maintenance
- **Tags:** api, scheduled-actions, cleanup

```gherkin:en
Scenario: Old actions are cleaned up

Given there are old completed and failed actions
When cleanupOldActions is called (default 7 days retention)
Then actions older than retention period should be deleted
And this is called automatically by the cron endpoint
```

```gherkin:es
Scenario: Acciones antiguas se limpian

Given hay acciones completadas y fallidas antiguas
When se llama cleanupOldActions (default 7 dias retencion)
Then acciones mas antiguas que el periodo de retencion deberian eliminarse
And esto se llama automaticamente por el endpoint cron
```

---

## @test SCHED_CLEANUP_061: Should preserve pending and running actions

### Metadata
- **Priority:** Critical
- **Type:** Safety
- **Tags:** api, scheduled-actions, cleanup, safety

```gherkin:en
Scenario: Active actions are preserved

Given cleanup is running
Then only completed and failed actions should be affected
And pending and running actions should never be deleted
And this ensures no active actions are lost
```

```gherkin:es
Scenario: Acciones activas se preservan

Given el cleanup esta ejecutandose
Then solo acciones completed y failed deberian afectarse
And acciones pending y running nunca deberian eliminarse
And esto asegura que no se pierdan acciones activas
```

---

## @test SCHED_FLOW_100: Should complete full action lifecycle

### Metadata
- **Priority:** Critical
- **Type:** Integration
- **Tags:** api, scheduled-actions, lifecycle
- **AC:** AC-4, AC-6, AC-7

```gherkin:en
Scenario: Full action lifecycle

Given I schedule a new action
When the cron processes it
Then the lifecycle should be:
  1. SCHEDULE: status = pending
  2. PROCESS: status = running
  3. EXECUTE: handler is called
  4. COMPLETE: status = completed OR failed
```

```gherkin:es
Scenario: Ciclo de vida completo de accion

Given programo una nueva accion
When el cron la procesa
Then el ciclo de vida deberia ser:
  1. SCHEDULE: status = pending
  2. PROCESS: status = running
  3. EXECUTE: handler es llamado
  4. COMPLETE: status = completed O failed
```

---

## @test SCHED_FLOW_101: Should handle recurring action lifecycle

### Metadata
- **Priority:** Critical
- **Type:** Integration
- **Tags:** api, scheduled-actions, recurring, lifecycle
- **AC:** AC-5

```gherkin:en
Scenario: Recurring action lifecycle

Given I schedule a recurring action
When the action completes successfully
Then a new action should be scheduled
And the interval should determine the next scheduledAt
```

```gherkin:es
Scenario: Ciclo de vida de accion recurrente

Given programo una accion recurrente
When la accion se completa exitosamente
Then una nueva accion deberia programarse
And el intervalo deberia determinar el siguiente scheduledAt
```

---

## Test Summary

| Test ID | Description | Priority | AC |
|---------|-------------|----------|-----|
| SCHED_DB_001 | Database table exists | Critical | AC-1 |
| SCHED_SCHEDULE_010 | One-time scheduling | Critical | AC-4 |
| SCHED_SCHEDULE_011 | Default scheduledAt | Normal | AC-4 |
| SCHED_SCHEDULE_020 | Recurring scheduling | Critical | AC-5 |
| SCHED_SCHEDULE_021 | Hourly interval | Normal | AC-5 |
| SCHED_SCHEDULE_022 | Daily interval | Normal | AC-5 |
| SCHED_SCHEDULE_023 | Weekly interval | Normal | AC-5 |
| SCHED_STATUS_030 | Initial pending status | Critical | AC-4 |
| SCHED_STATUS_031 | Running transition | Critical | AC-2 |
| SCHED_STATUS_032 | Completed transition | Critical | AC-7 |
| SCHED_STATUS_033 | Failed transition | Critical | AC-6 |
| SCHED_ERROR_040 | Error message storage | Critical | AC-6 |
| SCHED_ERROR_041 | Unknown action handling | Critical | AC-10 |
| SCHED_ERROR_042 | Timeout protection | Critical | AC-21 |
| SCHED_REGISTRY_050 | Registry function | Critical | AC-8 |
| SCHED_REGISTRY_051 | Handler registration | Critical | AC-9 |
| SCHED_REGISTRY_052 | List registered actions | Normal | AC-8 |
| SCHED_REGISTRY_053 | Check registration | Normal | AC-8 |
| SCHED_CLEANUP_060 | Cleanup old actions | Normal | - |
| SCHED_CLEANUP_061 | Preserve active actions | Critical | - |
| SCHED_FLOW_100 | Full lifecycle | Critical | AC-4, AC-6, AC-7 |
| SCHED_FLOW_101 | Recurring lifecycle | Critical | AC-5 |
