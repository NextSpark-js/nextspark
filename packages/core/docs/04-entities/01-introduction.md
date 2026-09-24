# Introducción al Sistema de Entidades

## ¿Qué es el Sistema de Entidades?

El sistema de entidades es una arquitectura **config-driven** inspirada en WordPress que permite crear, gestionar y mantener modelos de datos completos mediante archivos de configuración. En lugar de escribir código boilerplate para cada nueva funcionalidad, defines la estructura y comportamiento de tus entidades en archivos TypeScript, y el sistema genera automáticamente toda la infraestructura necesaria.

## Filosofía: Configuración sobre Código

### El Problema Tradicional

En el desarrollo web tradicional, crear una nueva entidad de datos requiere trabajo repetitivo en múltiples capas:

```typescript
// ❌ Enfoque Tradicional: ~10 horas de desarrollo

// 1. Definir el modelo TypeScript (30 min)
interface Product {
  id: string
  name: string
  price: number
  // ... más campos
}

// 2. Crear endpoints API (2-3 horas)
// app/api/products/route.ts
// app/api/products/[id]/route.ts

// 3. Implementar componentes UI (3-4 horas)
// ProductList.tsx, ProductForm.tsx, ProductDetail.tsx

// 4. Agregar validación (1 hora)
// Schemas Zod manuales

// 5. Configurar permisos (1 hora)
// Lógica de autorización en cada endpoint

// 6. Integrar en navegación (30 min)
// Actualizar menús, rutas, etc.

// TOTAL: ~10 horas por entidad
```

### La Solución: Config-Driven Entities

Con el sistema de entidades, todo esto se reduce a un archivo de configuración:

```typescript
// ✅ Enfoque Config-Driven: ~15 minutos

import { CheckSquare } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'

export const productEntityConfig: EntityConfig = {
  // Identificación básica
  slug: 'products',
  enabled: true,
  names: {
    singular: 'product',
    plural: 'Products'
  },
  icon: CheckSquare,
  
  // Control de acceso
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: false
  },
  
  // Configuración UI
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true
    },
    public: {
      hasArchivePage: false,
      hasSinglePage: false
    },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: true,
      importExport: false
    }
  },
  
  // Permisos - definidos centralmente en permissions.config.ts
  // Ver: config/permissions.config.ts → entities.products
  
  // Internacionalización
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  // Campos de la entidad
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      display: {
        label: 'Product Name',
        placeholder: 'Enter product name...',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
        columnWidth: 12
      },
      api: {
        searchable: true,
        sortable: true,
        readOnly: false
      }
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      display: {
        label: 'Price',
        placeholder: '0.00',
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 2,
        columnWidth: 6
      },
      api: {
        searchable: false,
        sortable: true,
        readOnly: false
      }
    }
    // ... más campos
  ]
}
```

**El sistema automáticamente genera:**

- ✅ Endpoints API REST completos (`/api/v1/products`)
- ✅ Componentes UI reutilizables (lista, formulario, detalle)
- ✅ Validación de datos con Zod
- ✅ Sistema de permisos integrado
- ✅ Navegación dinámica en el dashboard
- ✅ Soporte de metadata para campos dinámicos
- ✅ Internacionalización completa
- ✅ Queries SQL optimizadas con RLS
- ✅ **System Fields implícitos** (`createdAt`, `updatedAt`) - siempre disponibles sin declararlos

## Arquitectura: 5 Secciones Lógicas

El sistema está diseñado alrededor de **5 secciones lógicas** que definen completamente una entidad:

### 1. Identificación Básica

Define el nombre, slug (URL) e icono de la entidad.

```typescript
{
  slug: 'tasks',           // Single source of truth - deriva todo lo demás
  enabled: true,           // Entidad activa/inactiva
  names: {
    singular: 'task',      // Nombre singular
    plural: 'Tasks'        // Nombre plural
  },
  icon: CheckSquare        // Icono de Lucide React
}
```

**Derivaciones Automáticas del Slug:**
- `tableName`: `tasks` (nombre de tabla en BD)
- `metaTableName`: `tasks_metas` (tabla de metadata)
- `apiPath`: `/api/v1/tasks` (endpoint API)
- `i18nNamespace`: `tasks` (namespace de traducciones)

### 2. Control de Acceso y Alcance

Define quién puede acceder y cómo se comporta la entidad.

```typescript
{
  access: {
    public: false,         // ¿Accesible sin autenticación?
    api: true,             // ¿Tiene API externa con API keys?
    metadata: true,        // ¿Soporta campos metadata dinámicos?
    shared: false          // ¿Compartida entre usuarios? (sin filtro userId)
  }
}
```

**Casos de RLS (Row-Level Security):**
- `shared: false` → Solo el usuario owner ve sus registros
- `shared: true` → Todos los usuarios autenticados ven todos los registros
- `public: true` → Usuarios anónimos pueden leer (con RLS apropiado)

### 3. Características de UI/UX

Controla cómo se muestra y comporta en la interfaz.

```typescript
{
  ui: {
    dashboard: {
      showInMenu: true,      // Aparece en navegación del dashboard
      showInTopbar: true,    // Aparece en quick-create dropdown
      filters: [             // Filtros URL-sincronizados (opcional)
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect' }
      ]
    },
    public: {
      hasArchivePage: false, // Tiene página pública de listado
      hasSinglePage: false   // Tiene página pública de detalle
    },
    features: {
      searchable: true,      // Incluida en búsqueda global
      sortable: true,        // Permite ordenar en listas
      filterable: true,      // Permite filtrar (requerido para ui.dashboard.filters)
      bulkOperations: true,  // Operaciones en lote
      importExport: false    // Import/Export CSV
    }
  }
}
```

**Filtros URL-sincronizados:** Las opciones del filtro se derivan de `field.options`. Las URLs son compartibles (ej: `/dashboard/tasks?status=todo,in-progress&priority=high`).

### 4. Sistema de Permisos

Los permisos de entidades se definen **centralmente** en `permissions.config.ts`:

```typescript
// config/permissions.config.ts
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  entities: {
    products: [
      { action: 'read', roles: ['owner', 'admin', 'member'] },
      { action: 'create', roles: ['owner', 'admin'] },
      { action: 'update', roles: ['owner', 'admin'] },
      { action: 'delete', roles: ['owner'], dangerous: true }
    ]
  }
}
```

**Roles Disponibles:**
- `owner` - Dueño del equipo con control total (nivel 100)
- `admin` - Administrador con permisos amplios (nivel 50)
- `member` - Miembro con permisos estándar (nivel 10)
- `viewer` - Solo lectura (nivel 1)
- Roles personalizados definidos en `permissions.config.ts → roles`

### 5. Internacionalización

Soporte multiidioma integrado.

```typescript
{
  i18n: {
    fallbackLocale: 'en',  // Idioma por defecto
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  }
}
```

## Características Principales

### Config-Driven Development

- **Una sola fuente de verdad**: El archivo de configuración define TODO
- **Cero boilerplate**: No necesitas escribir código repetitivo
- **Cambios instantáneos**: Modifica la config y todo se actualiza automáticamente
- **Type-safe**: TypeScript garantiza consistencia en toda la app

### Generación Automática

El sistema genera automáticamente:

1. **APIs REST completas** con autenticación dual (sesión + API key)
2. **Componentes UI universales** (EntityListWrapper, EntityFormWrapper, EntityDetailWrapper)
3. **Validación de datos** con Zod schemas
4. **Queries SQL optimizadas** con soporte RLS
5. **Sistema de permisos** integrado en cada operación
6. **Navegación dinámica** en el dashboard
7. **Soporte de metadata** para campos extensibles

### Seguridad por Defecto

- **Row-Level Security (RLS)**: Aislamiento de datos por usuario en PostgreSQL
- **Validación automática**: Todos los inputs son validados
- **Permisos granulares**: Control por rol en cada operación
- **API Keys scoped**: APIs externas con permisos configurables

### Performance Optimizado

- **Queries eficientes**: SQL optimizado con índices automáticos
- **Metadata en 1 query**: Merge inteligente de datos principales + metadata
- **Caching inteligente**: Registry con pre-loading en el dashboard
- **Componentes optimizados**: Wrappers con manejo eficiente de estados

## Casos de Uso Ideales

### ✅ Perfecto Para

- **Entidades CRUD estándar**: Productos, clientes, pedidos, tareas
- **Admin panels**: Gestión de usuarios, configuraciones
- **Content management**: Posts, páginas, media
- **Business workflows**: Tickets, proyectos, leads
- **Multi-tenant apps**: Datos aislados por usuario/organización

### ⚠️ Considerar Alternativas Para

- **Lógica de negocio muy compleja**: Mejor implementación custom
- **Features en tiempo real**: Chat, notificaciones live
- **Visualizaciones complejas**: Dashboards, analytics avanzados
- **Procesamiento de archivos pesado**: Conversiones, transformaciones

## Métricas de Impacto

| Métrica | Desarrollo Tradicional | Sistema de Entidades | Mejora |
|---------|------------------------|----------------------|--------|
| Tiempo por entidad | ~10 horas | ~15 minutos | **40x más rápido** |
| Líneas de código | ~800 líneas | ~50 líneas config | **16x menos código** |
| Archivos a crear | 8-12 archivos | 1 archivo config | **8-12x menos archivos** |
| Tiempo de testing | 2-3 horas | 15 minutos | **8x más rápido** |
| Mantenimiento | Alto (múltiples archivos) | Bajo (un solo archivo) | **~80% menos esfuerzo** |
| Consistencia | Manual (propensa a errores) | Automática (garantizada) | **100% consistente** |

## Ejemplo Real: Tasks Entity

El proyecto incluye una implementación completa de referencia en:

- **Configuración**: `entities/tasks/tasks.config.ts`
- **Campos**: `entities/tasks/tasks.fields.ts`
- **Tipos**: `entities/tasks/tasks.types.ts`
- **Service**: `entities/tasks/tasks.service.ts`
- **Traducciones**: `entities/tasks/messages/`
- **UI en Dashboard**: `app/dashboard/(main)/tasks/`

Esta entidad de tareas demuestra:
- Configuración completa de 5 secciones
- 15+ campos de diferentes tipos
- Relaciones con otras entidades (clients, users)
- Metadata para campos extensibles
- Permisos por rol
- UI completamente funcional

## Próximos Pasos

1. **[Quick Start](./02-quick-start.md)** - Crea tu primera entidad en 15 minutos
2. **[Configuration Reference](./03-configuration-reference.md)** - Referencia completa de EntityConfig
3. **[Field Types](./04-field-types.md)** - Todos los tipos de campo disponibles
4. **[Examples](./12-examples.md)** - Ejemplos completos listos para usar

## System Fields (Campos Implícitos)

El sistema incluye **campos implícitos** que NO necesitas declarar en tu configuración de `fields`. Estos campos son manejados automáticamente:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único (auto-generado) |
| `createdAt` | TIMESTAMPTZ | Fecha de creación del registro |
| `updatedAt` | TIMESTAMPTZ | Fecha de última modificación |
| `userId` | UUID | Usuario propietario del registro |
| `teamId` | UUID | Equipo para aislamiento de datos |

Estos campos:
- **Siempre existen** en la base de datos (definidos en migraciones)
- **Siempre se incluyen** en las respuestas de la API
- **Siempre disponibles** para ordenamiento en componentes frontend
- **Nunca aparecen** en formularios (manejados por la DB)

> 📁 Ver implementación en `core/lib/entities/system-fields.ts`

## Estructura de Archivos por Entidad

Cada entidad del tema tiene una estructura estándar de **4 archivos principales**:

```text
entities/[entity]/
├── [entity].config.ts      # Configuración principal (slug, access, ui, permissions, i18n)
├── [entity].fields.ts      # Definición de campos (name, type, display, api)
├── [entity].types.ts       # Tipos TypeScript específicos de la entidad
├── [entity].service.ts     # Service con métodos de acceso a datos
├── messages/               # Traducciones (i18n)
│   ├── en.json
│   └── es.json
├── migrations/             # Migraciones SQL (opcional)
└── components/             # Componentes UI específicos (opcional)
```

### Archivos Requeridos

| Archivo | Propósito | Requerido |
|---------|-----------|-----------|
| `[entity].config.ts` | Define identificación, acceso, UI, permisos, i18n | ✅ Sí |
| `[entity].fields.ts` | Define los campos y su comportamiento | ✅ Sí |
| `[entity].types.ts` | Tipos TypeScript para type safety | ✅ Sí |
| `[entity].service.ts` | Métodos de acceso a datos (queries) | ✅ Sí |
| `messages/` | Traducciones de la entidad | ✅ Sí |

### Archivos Opcionales

| Archivo | Propósito | Cuándo Usar |
|---------|-----------|-------------|
| `migrations/` | Migraciones SQL de la entidad | Si la entidad requiere tablas nuevas |
| `components/` | Componentes UI específicos | Si necesitas UI custom (headers, cards, etc.) |

## Entity Services

Los **Entity Services** son clases estáticas que encapsulan la lógica de acceso a datos, separando las queries SQL de los templates y componentes.

### ¿Por qué usar Services?

- **Separación de concerns**: Templates solo renderizan, services manejan datos
- **Reutilización**: Mismas queries desde Server Components, API routes, etc.
- **Type Safety**: Tipos específicos para cada contexto (público vs autenticado)
- **Testability**: Fácil de mockear en tests

### Patrón de Service

```typescript
// entities/posts/posts.service.ts

import { query, queryOne, queryOneWithRLS } from '@/core/lib/db'
import type { PostPublic, PostMetadata } from './posts.types'

export class PostsService {
  // === PÚBLICOS (sin RLS) ===

  /**
   * Get published post by slug
   */
  static async getPublishedBySlug(slug: string): Promise<PostPublic | null> {
    // Query sin RLS para acceso público
    return queryOne<PostPublic>('SELECT ... WHERE slug = $1', [slug])
  }

  // === AUTENTICADOS (con RLS) ===

  /**
   * Get post by ID (requires authentication)
   */
  static async getById(id: string, userId: string): Promise<PostPublic | null> {
    // Query con RLS para dashboard
    return queryOneWithRLS<PostPublic>('SELECT ... WHERE id = $1', [id], userId)
  }
}
```

### Uso en Templates

```typescript
// templates/(public)/blog/[slug]/page.tsx

import { PostsService } from '@/entities/posts/posts.service'

export default async function BlogPost({ params }: PageProps) {
  const post = await PostsService.getPublishedBySlug((await params).slug)
  if (!post) notFound()

  return <PostRenderer post={post} />
}
```

> 📖 **Ver más**: [Service Layer](../10-backend/05-service-layer.md) para patrones avanzados y best practices.

## Recursos Adicionales

- **Tipos TypeScript**: `core/lib/entities/types.ts` - Definiciones completas
- **System Fields**: `core/lib/entities/system-fields.ts` - Campos implícitos del sistema
- **Registry System**: `core/lib/entities/registry.ts` - Sistema central de registro
- **Wrappers UI**: `core/components/entities/wrappers/` - Componentes reutilizables
- **API Generator**: `core/lib/entities/api-generator.ts` - Generación de endpoints
- **Service Pattern**: `core/lib/services/user.service.ts` - Ejemplo de service en core

---

> 💡 **Tip**: El sistema de entidades está diseñado para ser incremental. Puedes empezar con una configuración básica y agregar características avanzadas gradualmente según las necesites.
