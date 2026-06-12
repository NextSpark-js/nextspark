# Referencia de Configuración: EntityConfig

Esta es la referencia completa de todas las propiedades disponibles en `EntityConfig`. El archivo de configuración es el corazón del sistema de entidades y define completamente su comportamiento.

## Estructura General

```typescript
interface EntityConfig {
  // 1. BASIC IDENTIFICATION
  slug: string
  enabled: boolean
  names: { singular: string; plural: string }
  icon: LucideIcon

  // 2. ACCESS AND SCOPE CONFIGURATION
  access: { public: boolean; api: boolean; metadata: boolean; shared?: boolean; basePath?: string }

  // 3. UI/UX FEATURES
  ui: {
    dashboard: { showInMenu: boolean; showInTopbar: boolean; filters?: EntityFilterConfig[] }
    public: { hasArchivePage: boolean; hasSinglePage: boolean }
    features: { searchable: boolean; sortable: boolean; filterable: boolean; bulkOperations: boolean; importExport: boolean }
  }

  // 4. PERMISSIONS SYSTEM (centralized in permissions.config.ts)
  // Note: Permissions are NO LONGER defined in entity config files.
  // See: permissions.config.ts → entities.{entitySlug}

  // 5. INTERNATIONALIZATION
  i18n: { fallbackLocale: SupportedLocale; loaders: Record<SupportedLocale, TranslationLoader> }

  // FIELDS
  fields: EntityField[]

  // OPTIONAL
  childEntities?: ChildEntityConfig
  idStrategy?: { type: 'uuid' | 'serial'; autoGenerate?: boolean }
  isCore?: boolean
  source?: 'core' | 'theme' | 'plugin'
}

// Filter configuration type
interface EntityFilterConfig {
  field: string                              // Field name (must have options)
  type: 'multiSelect' | 'singleSelect'       // Filter UI type
  label?: string                             // Label override
  urlParam?: string                          // URL param override
}
```

---

## 1. Identificación Básica

### `slug` (required)

El slug es la **única fuente de verdad** y define todos los nombres derivados automáticamente.

**Tipo:** `string`

**Uso:**
- URLs: `/dashboard/{slug}`
- API endpoints: `/api/v1/{slug}`
- Tabla de BD: `{slug}`
- Tabla de metadata: `{slug}_metas`
- Namespace i18n: `{slug}`

**Convenciones:**
- Usar minúsculas
- Plural (ej: `tasks`, `products`, `users`)
- Separar con guiones si es necesario (ej: `blog-posts`)

```typescript
{
  slug: 'tasks'
  // Deriva automáticamente:
  // - tableName: 'tasks'
  // - metaTableName: 'tasks_metas'
  // - apiPath: '/api/v1/tasks'
  // - i18nNamespace: 'tasks'
}
```

### `enabled` (required)

Controla si la entidad está activa o no en el sistema.

**Tipo:** `boolean`

**Efecto:**
- `true`: Entidad funcional, aparece en navegación, APIs disponibles
- `false`: Entidad deshabilitada, no aparece, APIs retornan 404

```typescript
{
  enabled: true  // Entidad activa
}
```

### `names` (required)

Nombres legibles para mostrar en la UI.

**Tipo:** `{ singular: string; plural: string }`

**Uso:**
- `singular`: Títulos de formularios, detalles ("Edit Task", "New Product")
- `plural`: Listas, navegación ("Tasks", "All Products")

```typescript
{
  names: {
    singular: 'task',      // "Create task", "Edit task"
    plural: 'Tasks'        // "All Tasks", "Tasks List"
  }
}
```

### `icon` (required)

Icono de Lucide React para la UI.

**Tipo:** `LucideIcon`

**Uso:**
- Menú de navegación
- Breadcrumbs
- Headers de página
- Quick-create dropdown

```typescript
import { CheckSquare, ShoppingBag, Users, Package } from 'lucide-react'

{
  icon: CheckSquare  // Icono de check para tasks
}
```

**Iconos recomendados por tipo:**
- Tasks/Todos: `CheckSquare`, `ListTodo`
- Products: `ShoppingBag`, `Package`
- Users/Clients: `Users`, `UserCircle`
- Projects: `Folder`, `Briefcase`
- Documents: `FileText`, `File`

---

## 2. Control de Acceso y Alcance

### `access` (required)

Define el alcance y disponibilidad de la entidad.

**Tipo:** `{ public: boolean; api: boolean; metadata: boolean; shared?: boolean }`

### `access.public`

¿Es accesible sin autenticación?

**Tipo:** `boolean`

**Comportamiento:**
- `true`: Usuarios anónimos pueden leer (requiere RLS apropiado)
- `false`: Solo usuarios autenticados

```typescript
{
  access: {
    public: false  // Solo usuarios autenticados
  }
}
```

**Nota:** con `public: true`, las lecturas públicas/no autenticadas entran con
`userId = null` → **conexión de servicio (RLS-bypass)** y se filtran en SQL en el handler
(p.ej. `status = 'published'`). **No** dependen del rol `anon`: las policies `TO anon`
solo aplican si exponés la Data API / PostgREST de Supabase directamente (ver
[RLS → Enforcement Layer](../10-backend/03-rls-policies.md#enforcement-layer-beta167)).

### `access.api`

¿Tiene API externa con API keys?

**Tipo:** `boolean`

**Comportamiento:**
- `true`: Endpoints disponibles con autenticación vía API key
- `false`: Solo autenticación por sesión

```typescript
{
  access: {
    api: true  // API externa disponible
  }
}
```

### `access.metadata`

¿Soporta sistema de metadata?

**Tipo:** `boolean`

**Comportamiento:**
- `true`: Crea tabla `{slug}_metas` automáticamente
- `false`: Sin soporte de metadata

```typescript
{
  access: {
    metadata: true  // Tabla tasks_metas disponible
  }
}
```

**Beneficios:**
- Campos dinámicos sin migración
- Datos extensibles por usuario
- Schema flexible

### `access.shared`

¿Compartida entre usuarios?

**Tipo:** `boolean | undefined`

**Comportamiento:**
- `false` o `undefined`: Cada usuario ve solo sus registros (filtro `userId`)
- `true`: Todos los usuarios ven todos los registros (sin filtro `userId`)

```typescript
{
  access: {
    shared: false  // CASE 1: Solo mis tareas (default)
  }
}

{
  access: {
    shared: true   // CASE 2: Todas las tareas del workspace
  }
}
```

**Casos de uso:**
- `shared: false` → Tareas personales, productos del usuario
- `shared: true` → Categorías globales, configuraciones del sistema

### `access.basePath`

Define la URL base para entidades públicas con Page Builder habilitado.

**Tipo:** `string | undefined`

**Comportamiento:**
- Solo aplica a entidades con `builder.enabled: true`
- El sistema usa **longest-match-first** para resolver URLs
- URLs públicas se generan como `{basePath}/{slug}`

```typescript
// Pages - renders at /[slug]
{
  access: {
    public: true,
    basePath: '/'  // /about, /contact, /pricing
  }
}

// Posts - renders at /blog/[slug]
{
  access: {
    public: true,
    basePath: '/blog'  // /blog/hello-world, /blog/my-post
  }
}

// Tutorials - renders at /tutorials/[slug]
{
  access: {
    public: true,
    basePath: '/tutorials'  // /tutorials/getting-started
  }
}
```

**Reglas:**
- Debe empezar con `/`
- Solo aplica a entidades builder-enabled
- Paths más largos tienen prioridad (longest-match-first)

**Resolución de URLs:**

| Entity | basePath | Public URLs |
|--------|----------|-------------|
| Pages | `/` | `/about`, `/contact`, `/pricing` |
| Posts | `/blog` | `/blog/hello-world`, `/blog/my-post` |
| Docs | `/docs` | `/docs/getting-started`, `/docs/api-reference` |

**Archive Pages:**

Cuando la URL coincide exactamente con el basePath (ej: `/blog`), se muestra una página de archivo con todos los items publicados. Requiere `ui.public.hasArchivePage: true`.

---

## 3. Características de UI/UX

### `ui` (required)

Controla cómo se muestra y comporta en la interfaz.

**Tipo:** `{ dashboard: {...}; public: {...}; features: {...} }`

### `ui.dashboard`

Configuración para el área del dashboard.

**Tipo:** `{ showInMenu: boolean; showInTopbar: boolean; filters?: EntityFilterConfig[] }`

```typescript
{
  ui: {
    dashboard: {
      showInMenu: true,      // Aparece en menú lateral
      showInTopbar: true,    // Aparece en quick-create dropdown
      filters: [             // Filtros en lista (opcional)
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect' }
      ]
    }
  }
}
```

**`showInMenu`:**
- `true`: Item visible en navegación principal
- `false`: Sin entrada en menú (útil para entidades internas)

**`showInTopbar`:**
- `true`: Botón rápido de creación en el header
- `false`: Sin quick-create

**`filters`:** (opcional)
- Array de configuraciones de filtro para la vista de lista
- Los filtros se sincronizan automáticamente con la URL (compartible, back/forward funciona)
- Las opciones se derivan automáticamente de `field.options`
- Requiere `ui.features.filterable: true` para activarse

**EntityFilterConfig:**

| Propiedad | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `field` | string | ✅ | Nombre del campo (debe existir en fields[] y tener options) |
| `type` | 'multiSelect' \| 'singleSelect' | ✅ | Tipo de UI del filtro |
| `label` | string | ❌ | Label personalizado (default: field.display.label) |
| `urlParam` | string | ❌ | Parámetro URL personalizado (default: field.name) |

**Ejemplo con filtros:**

```typescript
{
  ui: {
    dashboard: {
      showInMenu: true,
      showInTopbar: true,
      filters: [
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect', label: 'Prioridad' },
        { field: 'categoryId', type: 'multiSelect', label: 'Category' }
      ]
    },
    features: {
      filterable: true  // ⚠️ Requerido para activar filtros
    }
  }
}
```

**URL resultante:** `/dashboard/tasks?status=todo,in-progress&priority=high`

### `ui.public`

Configuración para páginas públicas.

**Tipo:** `{ hasArchivePage: boolean; hasSinglePage: boolean }`

```typescript
{
  ui: {
    public: {
      hasArchivePage: true,   // Página /blog/posts
      hasSinglePage: true     // Página /blog/posts/[slug]
    }
  }
}
```

**`hasArchivePage`:**
- `true`: Genera listado público
- `false`: Sin página de listado

**`hasSinglePage`:**
- `true`: Genera página de detalle público
- `false`: Sin página de detalle

**Casos de uso:**
- Blog posts: Ambas `true`
- Tasks privadas: Ambas `false`
- Portfolio projects: `hasArchivePage: true`, `hasSinglePage: true`

### `ui.features`

Features funcionales de la entidad.

**Tipo:**
```typescript
{
  searchable: boolean
  sortable: boolean
  filterable: boolean
  bulkOperations: boolean
  importExport: boolean
}
```

```typescript
{
  ui: {
    features: {
      searchable: true,       // Incluida en búsqueda global
      sortable: true,         // Permite ordenar en tablas
      filterable: true,       // Permite filtrar en tablas
      bulkOperations: true,   // Operaciones en lote (delete múltiple, etc.)
      importExport: false     // Import/Export CSV
    }
  }
}
```

**`searchable`:**
- Incluye la entidad en la búsqueda global del dashboard
- Busca en campos con `api.searchable: true`

**`sortable`:**
- Habilita ordenamiento en listas
- Funciona con campos `api.sortable: true`

**`filterable`:**
- Habilita filtros en listas
- Genera filtros automáticos por tipo de campo

**`bulkOperations`:**
- Checkbox de selección múltiple
- Acciones en lote (eliminar, exportar, etc.)

**`importExport`:**
- Botones de import/export CSV
- Mapeo automático de campos

---

## 4. Sistema de Permisos

> **Importante:** Los permisos de entidades se definen **exclusivamente** en `permissions.config.ts`. Definir permisos directamente en `entity.config.ts` ya **no está soportado**.

**Ubicación:** `contents/themes/{theme}/config/permissions.config.ts`

```typescript
// permissions.config.ts - ÚNICO LUGAR PARA DEFINIR PERMISOS
export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  entities: {
    tasks: [
      { action: 'create', roles: ['owner', 'admin', 'member'] },
      { action: 'read', roles: ['owner', 'admin', 'member'] },
      { action: 'list', roles: ['owner', 'admin', 'member'] },
      { action: 'update', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', roles: ['owner', 'admin'], dangerous: true },
    ],
  },
}
```

**Roles de equipo disponibles:**

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `owner` | 100 | Dueño del equipo, control total |
| `admin` | 50 | Administrador, mayoría de permisos |
| `member` | 10 | Miembro estándar |
| `viewer` | 1 | Solo lectura |
| `editor`* | Custom | Rol personalizado por tema |

*Los roles personalizados se definen en `permissions.config.ts → roles`

**Validación:**
- Aplicada automáticamente en APIs via `canPerformAction()`
- Verificada en componentes UI via `usePermission()`
- Integrada con RLS en base de datos

**Ejemplos por escenario:**

```typescript
// Entidad privada (cada usuario ve solo sus registros)
entities: {
  tasks: [
    { action: 'create', roles: ['owner', 'admin', 'member'] },
    { action: 'read', roles: ['owner', 'admin', 'member'] },
    { action: 'update', roles: ['owner', 'admin', 'member'] },
    { action: 'delete', roles: ['owner', 'admin', 'member'] },
  ],
}

// Entidad compartida con acceso diferenciado
entities: {
  projects: [
    { action: 'create', roles: ['owner', 'admin'] },
    { action: 'read', roles: ['owner', 'admin', 'member', 'viewer'] },
    { action: 'update', roles: ['owner', 'admin'] },
    { action: 'delete', roles: ['owner'], dangerous: true },
  ],
}

// Entidad solo admin
entities: {
  settings: [
    { action: 'read', roles: ['owner', 'admin'] },
    { action: 'update', roles: ['owner'] },
  ],
}
```

Ver **[Permissions](./09-permissions.md)** para documentación completa del sistema de permisos

---

## 5. Internacionalización

### `i18n` (required)

Configuración de traducciones multiidioma.

**Tipo:**
```typescript
{
  fallbackLocale: SupportedLocale
  loaders: Record<SupportedLocale, TranslationLoader>
}
```

**SupportedLocale:** `'en' | 'es'`

```typescript
{
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  }
}
```

**`fallbackLocale`:**
- Idioma por defecto si la traducción no existe
- Usualmente `'en'`

**`loaders`:**
- Funciones dinámicas que cargan archivos JSON
- Lazy loading para performance
- Un loader por idioma soportado

**Estructura de archivos de traducción:**

```json
{
  "name": "Task",
  "pluralName": "Tasks",
  "description": "Manage your tasks",
  "actions": {
    "create": "Create Task",
    "edit": "Edit Task",
    "delete": "Delete Task",
    "view": "View Task"
  },
  "fields": {
    "title": "Task Title",
    "description": "Description",
    "status": "Status",
    "priority": "Priority"
  },
  "messages": {
    "created": "Task created successfully",
    "updated": "Task updated successfully",
    "deleted": "Task deleted successfully"
  }
}
```

---

## 6. Campos (Fields)

### `fields` (required)

Array de definiciones de campos de la entidad.

**Tipo:** `EntityField[]`

> **⚠️ System Fields**: Los campos `id`, `createdAt`, `updatedAt`, `userId` y `teamId` son **implícitos** y NO deben declararse en este array. El sistema los maneja automáticamente. Ver [System Fields](./04-field-types.md#system-fields-implicit) para más detalles.

Ver [Field Types](./04-field-types.md) para documentación completa de tipos de campos.

```typescript
{
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      display: {
        label: 'Title',
        description: 'Task title',
        placeholder: 'Enter title...',
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
    }
    // ... más campos
  ]
}
```

**Propiedades de EntityField:**

| Propiedad | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `name` | string | ✅ | Nombre del campo (columna en BD) |
| `type` | EntityFieldType | ✅ | Tipo de dato |
| `required` | boolean | ✅ | Campo obligatorio |
| `defaultValue` | any | ❌ | Valor por defecto |
| `validation` | ZodSchema | ❌ | Schema de validación Zod |
| `display` | FieldDisplay | ✅ | Configuración de UI |
| `api` | FieldAPI | ✅ | Configuración de API |
| `options` | FieldOption[] | ❌ | Opciones (para select/multiselect) |
| `relation` | RelationConfig | ❌ | Configuración de relación |

---

## 7. Propiedades Opcionales

### `childEntities`

Configuración de entidades hijas.

**Tipo:** `ChildEntityConfig | undefined`

Ver [Child Entities](./06-child-entities.md) para documentación completa.

```typescript
{
  childEntities: {
    'comments': {
      table: 'task_comments',
      fields: [...],
      showInParentView: true,
      hasOwnRoutes: false,
      display: {...}
    }
  }
}
```

### `idStrategy`

Estrategia de generación de IDs.

**Tipo:** `{ type: 'uuid' | 'serial'; autoGenerate?: boolean } | undefined`

```typescript
{
  idStrategy: {
    type: 'uuid',           // UUID (default) o serial
    autoGenerate: true      // Auto-generar (default: true)
  }
}
```

**Opciones:**
- `uuid`: UUID v4 aleatorio (recomendado)
- `serial`: Integer auto-incrementado

**Casos de uso:**
- `uuid`: Para datos distribuidos, APIs públicas, seguridad
- `serial`: Para IDs secuenciales legibles (ej: Order #1234)

### `isCore`

Indica si es una entidad del sistema core.

**Tipo:** `boolean | undefined`

```typescript
{
  isCore: true  // Entidad fundamental del sistema
}
```

**Efecto:**
- Entidades core no pueden ser sobrescritas por themes/plugins
- Proteción contra modificaciones accidentales

### `source`

Origen de la entidad.

**Tipo:** `'core' | 'theme' | 'plugin' | undefined`

```typescript
{
  source: 'theme'  // Definida en el tema actual
}
```

**Valores:**
- `core`: Sistema base
- `theme`: Tema activo
- `plugin`: Plugin específico

---

## Derivaciones Automáticas del Slug

El sistema deriva automáticamente varios nombres a partir del `slug`:

```typescript
slug: 'tasks'

// Deriva:
// ↓
tableName: 'tasks'
metaTableName: 'tasks_metas'
apiPath: '/api/v1/tasks'
i18nNamespace: 'tasks'
foreignKey: 'entityId' (genérico para todas las entidades en metadata)
```

**No necesitas configurar:**
- Nombres de tablas
- Rutas de API
- Namespaces de traducción
- Foreign keys en metadata

---

## Ejemplo Completo Comentado

```typescript
import { CheckSquare } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'
import { taskFields } from './tasks.fields'

export const taskEntityConfig: EntityConfig = {
  // 1. IDENTIFICACIÓN BÁSICA
  slug: 'tasks',           // → Deriva tableName, apiPath, etc.
  enabled: true,           // Entidad activa
  names: {
    singular: 'task',      // UI singular
    plural: 'Tasks'        // UI plural
  },
  icon: CheckSquare,       // Icono Lucide

  // 2. CONTROL DE ACCESO
  access: {
    public: false,         // Solo autenticados
    api: true,             // API externa disponible
    metadata: true,        // Soporta metadata
    shared: false          // Cada usuario ve sus tareas
  },

  // 3. UI/UX
  ui: {
    dashboard: {
      showInMenu: true,    // En menú lateral
      showInTopbar: true,  // Quick-create
      filters: [           // Filtros URL-sincronizados
        { field: 'status', type: 'multiSelect' },
        { field: 'priority', type: 'multiSelect' }
      ]
    },
    public: {
      hasArchivePage: false,  // Sin listado público
      hasSinglePage: false    // Sin detalle público
    },
    features: {
      searchable: true,    // En búsqueda global
      sortable: true,      // Permite ordenar
      filterable: true,    // Permite filtrar (⚠️ requerido para ui.dashboard.filters)
      bulkOperations: true, // Operaciones lote
      importExport: false  // Sin import/export
    }
  },

  // 4. PERMISOS (definidos centralmente)
  // Los permisos de esta entidad se definen en:
  // contents/themes/{theme}/config/permissions.config.ts → entities.tasks

  // 5. I18N
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },

  // CAMPOS (importados)
  fields: taskFields,

  // OPCIONALES
  idStrategy: {
    type: 'uuid',
    autoGenerate: true
  },
  source: 'theme'
}
```

---

## Quick Reference: Propiedades por Caso de Uso

### Entidad Privada (ej: Tasks personales)

```typescript
// entity.config.ts
{
  access: { public: false, shared: false },
  ui: { public: { hasArchivePage: false, hasSinglePage: false } },
}
// permissions.config.ts → entities.tasks
```

### Entidad Compartida (ej: Team Wiki)

```typescript
// entity.config.ts
{
  access: { public: false, shared: true },
  ui: { public: { hasArchivePage: false, hasSinglePage: false } },
}
// permissions.config.ts → entities.wiki con roles: ['owner', 'admin', 'member', 'viewer']
```

### Entidad Pública (ej: Blog Posts)

```typescript
// entity.config.ts
{
  access: { public: true, shared: true },
  ui: { public: { hasArchivePage: true, hasSinglePage: true } },
}
// permissions.config.ts → entities.posts
```

### Entidad Solo Admin (ej: System Settings)

```typescript
// entity.config.ts
{
  access: { public: false, shared: true },
  ui: { dashboard: { showInMenu: false }, public: { ... } },
}
// permissions.config.ts → entities.settings con roles: ['owner', 'admin'] solo
```

---

## Próximos Pasos

1. **[Field Types](./04-field-types.md)** - Tipos de campo disponibles
2. **[Relationships](./05-relationships.md)** - Conectar entidades
3. **[Child Entities](./06-child-entities.md)** - Relaciones padre-hijo
4. **[Permissions](./09-permissions.md)** - Sistema de permisos en detalle

---

> 💡 **Tip**: Usa la configuración de `tasks` en `contents/themes/default/entities/tasks/tasks.config.ts` como referencia para ver una implementación completa.
