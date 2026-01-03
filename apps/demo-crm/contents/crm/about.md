# CRM Theme

## Objetivo

Demostrar el modo `single-tenant` donde una empresa tiene un único equipo de trabajo con múltiples usuarios y roles diferenciados para ventas, marketing y gestión.

## Producto

**SalesForce Pro** - CRM empresarial completo para gestión de ventas, clientes y oportunidades de negocio.

## Empresa

**Ventas Pro S.A.** - Empresa B2B de servicios tecnológicos que necesita gestionar su pipeline de ventas y relaciones con clientes de forma estructurada.

## Teams Mode

```
single-tenant
```

- Work team único al registrarse (no personal)
- Sin team switcher (solo 1 equipo)
- Invitaciones habilitadas
- Sin creación de equipos adicionales

## Entidades

| Entidad | Descripción |
|---------|-------------|
| leads | Prospectos y oportunidades iniciales |
| contacts | Contactos de clientes y empresas |
| companies | Empresas clientes |
| opportunities | Oportunidades de venta en pipeline |
| activities | Llamadas, reuniones, tareas relacionadas |
| notes | Notas y comentarios sobre entidades |
| campaigns | Campañas de marketing |
| pipelines | Configuración de etapas de venta |
| products | Catálogo de productos/servicios |

## Features

| Feature | Descripción | Roles |
|---------|-------------|-------|
| reports.sales | Ver reportes de ventas | owner, admin |
| reports.pipeline | Ver reportes de pipeline | owner, admin |
| reports.marketing | Ver reportes de marketing | owner, admin |
| leads.convert | Convertir lead a contacto | owner, admin |
| bulk.import | Importación masiva de datos | owner |
| bulk.export | Exportación masiva de datos | owner |
| settings.pipelines | Configurar etapas de pipeline | owner |
| settings.products | Gestionar catálogo de productos | owner |
| dashboard.forecasting | Ver pronósticos de ventas | owner, admin |

## Permisos Resumidos

| Entidad | owner | admin | member |
|---------|:-----:|:-----:|:------:|
| leads | CRUD | CRUD | CRU |
| contacts | CRUD | CRUD | CRU |
| companies | CRUD | CRUD | R |
| opportunities | CRUD | CRUD | R |
| activities | CRUD | CRUD | CRUD |
| notes | CRUD | CRUD | CRUD |
| campaigns | CRUD | CRUD | R |
| pipelines | CRUD | R | R |
| products | CRUD | R | R |

## Usuarios de Prueba

| Email | Password | Rol | Descripción |
|-------|----------|-----|-------------|
| crm_owner_roberto@nextspark.dev | Test1234 | owner | CEO - Control total |
| crm_admin_sofia@nextspark.dev | Test1234 | admin | Sales Manager |
| crm_member_miguel@nextspark.dev | Test1234 | member | Sales Rep |
| crm_member_laura@nextspark.dev | Test1234 | member | Marketing |

## Billing

### Modelo de Pricing: Enterprise Tiers

> **Los planes y facturas siempre están asociados al team global único. Los tiers se basan en capacidad de usuarios.**

### Planes Disponibles

| Plan | Mensual | Usuarios Incluidos |
|------|---------|-------------------|
| Starter | $299/mes | Hasta 10 |
| Business | $599/mes | Hasta 50 |
| Enterprise | $1,499+/mes | Ilimitados |

### Características por Plan

| Feature | Starter | Business | Enterprise |
|---------|:-------:|:--------:|:----------:|
| Leads/Contacts | Ilimitados | Ilimitados | Ilimitados |
| Pipelines | 2 | 5 | Ilimitados |
| Productos | 10 | 50 | Ilimitados |
| Reports | Básicos | Avanzados | Custom |
| API access | ❌ | ✅ | ✅ |
| Bulk import/export | ❌ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ✅ |
| SLA garantizado | ❌ | ❌ | ✅ |
| Soporte dedicado | ❌ | ❌ | ✅ |

### Facturación

- **Unidad de cobro:** Por team global (tiers por capacidad de usuarios)
- **Ciclos:** Mensual (contratos anuales con descuento disponibles bajo negociación)

### Sample Invoices

| Team | Plan | Invoices | Status | Total |
|------|------|----------|--------|-------|
| Ventas Pro S.A. | Starter | 6 | 5 paid + 1 pending | $1,794 |

## Casos de Uso

1. CEO revisa pronósticos y configura pipelines
2. Sales Manager convierte leads y genera reportes
3. Sales Rep registra actividades y actualiza oportunidades
4. Marketing gestiona campañas y analiza resultados

