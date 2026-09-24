# Blog Theme

## Objetivo

Demostrar el modo `single-user` donde un único usuario tiene control total de su contenido sin colaboración ni equipos de trabajo.

## Producto

**BlogSpace** - Plataforma de blogging personal para creadores de contenido independientes.

## Empresa

**ContentFirst Inc.** - Startup enfocada en herramientas para creadores individuales que valoran la simplicidad y el control total sobre su contenido.

## Teams Mode

```
single-user
```

- Personal team automático al registrarse
- Sin invitaciones
- Sin team switcher
- Sin creación de equipos adicionales

## Entidades

| Entidad | Descripción |
|---------|-------------|
| posts | Artículos del blog con título, contenido, slug, imagen destacada, estado y categorías |

## Features

| Feature | Descripción | Roles |
|---------|-------------|-------|
| posts.export_json | Exportar posts en formato JSON | owner |
| posts.import_json | Importar posts desde JSON | owner |

## Permisos

| Entidad | create | read | update | delete |
|---------|:------:|:----:|:------:|:------:|
| posts | ✅ | ✅ | ✅ | ✅ |

## Usuario de Prueba

| Email | Password | Rol |
|-------|----------|-----|
| blog_owner_alex@nextspark.dev | Test1234 | owner |

## Billing

### Modelo de Pricing: Suscripción Simple

> **Los planes y facturas siempre están asociados al team (que en single-user = 1 usuario).**

### Planes Disponibles

| Plan | Mensual | Anual | Descuento |
|------|---------|-------|-----------|
| Free | $0 | $0 | - |
| Creator | $9/mes | $86/año | ~20% off |
| Pro | $19/mes | $182/año | ~20% off |

### Características por Plan

| Feature | Free | Creator | Pro |
|---------|:----:|:-------:|:---:|
| Posts | 3 | Ilimitados | Ilimitados |
| Dominio custom | ❌ | ✅ | ✅ |
| Analytics | ❌ | Básicas | Avanzadas |
| SEO tools | ❌ | ❌ | ✅ |
| Branding plataforma | ✅ | ✅ | ❌ |
| Export JSON | ❌ | ✅ | ✅ |
| Import JSON | ❌ | ❌ | ✅ |

### Facturación

- **Unidad de cobro:** Por team (1 team = 1 usuario)
- **Ciclos:** Mensual o anual (20% descuento)

### Sample Invoices

| Team | Plan | Invoices | Status | Total |
|------|------|----------|--------|-------|
| Alex's Blog | Creator | 6 | 5 paid + 1 pending | $54 |

## Casos de Uso

1. Blogger independiente que publica artículos
2. Portafolio personal con blog integrado
3. Newsletter con archivo de contenido

