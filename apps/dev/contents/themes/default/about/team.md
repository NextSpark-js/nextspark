# Default Theme

> **Note:** This file contains fictional test data for development and QA purposes only. Users, teams, and credentials listed here are sample data used for testing the application.

## Objetivo

Demo genérico del boilerplate mostrando el modo `multi-tenant` con múltiples empresas, usuarios con diferentes roles, y aislamiento de datos por team.

## Producto

**Boilerplate** - Aplicación base para gestión de tareas y clientes con sistema completo de teams y permisos.

## Teams Mode

```
multi-tenant
```

- Usuarios pueden pertenecer a múltiples teams
- Team Switcher habilitado
- Crear teams habilitado
- Invitaciones habilitadas

## Entidades

| Entidad | Descripción |
|---------|-------------|
| tasks | Tareas con título, descripción, estado |
| customers | Clientes con datos de contacto y metadata |
| invoices | Facturas del sistema de billing (solo owners) |

## Permisos

### tasks

| Action | owner | admin | member | viewer |
|--------|:-----:|:-----:|:------:|:------:|
| create | ✅ | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ | ❌ |

### customers

| Action | owner | admin | member | viewer |
|--------|:-----:|:-----:|:------:|:------:|
| create | ✅ | ✅ | ❌ | ❌ |
| read | ✅ | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ | ❌ |

## Usuarios de Prueba

| Email | Nombre | Teams |
|-------|--------|-------|
| carlos.mendoza@nextspark.dev | Carlos Mendoza | Everpoint (owner), Riverstone (member) |
| james.wilson@nextspark.dev | James Wilson | Everpoint (admin) |
| ana.garcia@nextspark.dev | Ana García | Ironvale (owner) |
| sofia.lopez@nextspark.dev | Sofia López | Riverstone (owner), Ironvale (admin) |
| emily.johnson@nextspark.dev | Emily Johnson | Everpoint (member), Riverstone (admin) |
| diego.ramirez@nextspark.dev | Diego Ramírez | Everpoint (member) |
| michael.brown@nextspark.dev | Michael Brown | Ironvale (member) |
| sarah.davis@nextspark.dev | Sarah Davis | Ironvale (viewer) |

**Password:** `Test1234`

## Teams

| Team | Industria | Miembros |
|------|-----------|----------|
| Everpoint Labs | Technology | 4 |
| Ironvale Global | Consulting | 4 |
| Riverstone Ventures | Investment | 3 |

## Casos de Uso

1. Equipos de diferentes industrias compartiendo la misma plataforma
2. Usuarios con diferentes roles en diferentes empresas
3. Aislamiento completo de datos entre teams
