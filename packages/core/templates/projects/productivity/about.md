# Productivity Theme

## Objetivo

Demostrar el modo `multi-tenant` donde usuarios pueden gestionar múltiples workspaces con diferentes roles en cada team, similar a Trello o Notion.

## Producto

**TaskFlow** - Aplicación de gestión de tareas estilo Trello para equipos pequeños y medianos.

## Empresa

**FlowWorks Labs** - Empresa de software de productividad que cree en la colaboración flexible y la organización visual del trabajo.

## Teams Mode

```
multi-tenant
```

- Múltiples work teams (workspaces)
- Team switcher habilitado
- Puede crear nuevos teams
- Invitaciones habilitadas (owner/admin pueden invitar)

## Entidades

| Entidad | Descripción |
|---------|-------------|
| boards | Tableros de proyectos con nombre, descripción, color y estado |
| lists | Columnas dentro de tableros para organizar tarjetas |
| cards | Tareas individuales con título, descripción, prioridad y fechas |

## Features

| Feature | Descripción | Roles |
|---------|-------------|-------|
| boards.archive | Archivar tableros completados | owner, admin |
| cards.move | Mover tarjetas entre listas | owner, admin, member |

## Permisos

### boards

| Action | owner | admin | member |
|--------|:-----:|:-----:|:------:|
| create | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ❌ |
| delete | ✅ | ❌ | ❌ |
| archive | ✅ | ✅ | ❌ |

### lists

| Action | owner | admin | member |
|--------|:-----:|:-----:|:------:|
| create | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ |

### cards

| Action | owner | admin | member |
|--------|:-----:|:-----:|:------:|
| create | ✅ | ✅ | ✅ |
| read | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ✅ |
| delete | ✅ | ✅ | ❌ |
| move | ✅ | ✅ | ✅ |

## Usuarios de Prueba

| Email | Password | Product Team | Marketing Hub |
|-------|----------|--------------|---------------|
| prod_owner_patricia@nextspark.dev | Test1234 | owner | owner |
| prod_admin_member_lucas@nextspark.dev | Test1234 | admin | member |
| prod_member_diana@nextspark.dev | Test1234 | member | - |
| prod_member_marcos@nextspark.dev | Test1234 | - | member |

## Billing

### Modelo de Pricing: Suscripción por Team (Flat Rate)

> **Los planes y facturas siempre están asociados al team. El precio es fijo independiente del número de miembros (hasta el límite del plan).**

### Planes Disponibles

| Plan | Mensual | Anual | Descuento |
|------|---------|-------|-----------|
| Free | $0 | $0 | - |
| Team | $12/mes | $115/año | ~20% off |
| Business | $24/mes | $230/año | ~20% off |

### Características por Plan

| Feature | Free | Team | Business |
|---------|:----:|:----:|:--------:|
| Boards | 1 | Ilimitados | Ilimitados |
| Miembros | 3 | 10 | Ilimitados |
| Listas por board | 5 | Ilimitadas | Ilimitadas |
| Archivos adjuntos | ❌ | 10MB/archivo | 100MB/archivo |
| Integraciones | ❌ | ❌ | ✅ |
| Admin controls | ❌ | ❌ | ✅ |

### Facturación

- **Unidad de cobro:** Por team (flat rate, no per-seat)
- **Ciclos:** Mensual o anual (20% descuento)

### Sample Invoices

| Team | Plan | Invoices | Status | Total |
|------|------|----------|--------|-------|
| Product Team | Team | 6 | 5 paid + 1 pending | $72 |
| Marketing Hub | Team | 6 | 5 paid + 1 pending | $72 |

## Casos de Uso

1. Equipo de desarrollo gestionando sprints
2. Agencia creativa organizando proyectos
3. Startup coordinando tareas entre departamentos

