# Quick Start: Tu Primera Entidad en 15 Minutos

Esta guía te llevará paso a paso para crear tu primera entidad completamente funcional con el sistema config-driven.

## Requisitos Previos

- Proyecto Next.js configurado con el boilerplate
- PostgreSQL database activo (local o Supabase)
- Conocimientos básicos de TypeScript

## Paso 1: Crear la Estructura de Directorios

Las entidades se definen dentro del tema activo. Por defecto: `contents/themes/default/entities/`

```bash
# Crear directorio para tu entidad (ejemplo: products)
mkdir -p contents/themes/default/entities/products
mkdir -p contents/themes/default/entities/products/messages
```

Tu estructura debe verse así:

```text
contents/themes/default/entities/
└── products/
    ├── products.config.ts      # Configuración principal
    ├── products.fields.ts      # Definición de campos
    ├── products.types.ts       # Tipos TypeScript específicos
    ├── products.service.ts     # Service de acceso a datos
    └── messages/
        ├── en.json             # Traducciones en inglés
        └── es.json             # Traducciones en español
```

## Paso 2: Definir los Campos de la Entidad

Crea `products.fields.ts`:

```typescript
// contents/themes/default/entities/products/products.fields.ts

import type { EntityField } from '@/core/lib/entities/types'

export const productFields: EntityField[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Product Name',
      description: 'The name of the product',
      placeholder: 'Enter product name...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'Detailed product description',
      placeholder: 'Describe the product...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12,
    },
    api: {
      searchable: true,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'price',
    type: 'number',
    required: true,
    defaultValue: 0,
    display: {
      label: 'Price',
      description: 'Product price in USD',
      placeholder: '0.00',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 6,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'status',
    type: 'select',
    required: false,
    defaultValue: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'archived', label: 'Archived' },
    ],
    display: {
      label: 'Status',
      description: 'Publication status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 6,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
]
```

## Paso 3: Crear la Configuración Principal

Crea `products.config.ts`:

```typescript
// contents/themes/default/entities/products/products.config.ts

import { ShoppingBag } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'
import { productFields } from './products.fields'

export const productEntityConfig: EntityConfig = {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  slug: 'products',
  enabled: true,
  names: {
    singular: 'product',
    plural: 'Products'
  },
  icon: ShoppingBag,
  
  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    public: false,      // Solo usuarios autenticados
    api: true,          // API externa disponible con API keys
    metadata: true,     // Soporta campos metadata dinámicos
    shared: false       // Cada usuario ve solo sus productos
  },
  
  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      showInMenu: true,     // Aparece en el menú lateral
      showInTopbar: true    // Aparece en quick-create dropdown
    },
    public: {
      hasArchivePage: false,  // Sin página pública de listado
      hasSinglePage: false    // Sin página pública de detalle
    },
    features: {
      searchable: true,       // Búsqueda global incluida
      sortable: true,         // Permite ordenar
      filterable: true,       // Permite filtrar
      bulkOperations: true,   // Operaciones en lote
      importExport: false     // Sin import/export
    }
  },
  
  // ==========================================
  // 4. PERMISSIONS SYSTEM
  // ==========================================
  permissions: {
    read: ['admin', 'colaborator', 'member'],
    create: ['admin', 'colaborator', 'member'],
    update: ['admin', 'colaborator', 'member'],
    delete: ['admin', 'colaborator']
  },
  
  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      es: () => import('./messages/es.json'),
      en: () => import('./messages/en.json')
    }
  },
  
  // ==========================================
  // FIELDS
  // ==========================================
  fields: productFields,
}
```

## Paso 4: Crear los Tipos TypeScript

Crea `products.types.ts`:

```typescript
// contents/themes/default/entities/products/products.types.ts

/**
 * Product Service Types
 */

export type ProductStatus = 'draft' | 'published' | 'archived'

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  status: ProductStatus
  createdAt?: string
  updatedAt?: string
}

export interface ProductListOptions {
  limit?: number
  offset?: number
  status?: ProductStatus
  orderBy?: 'name' | 'price' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

export interface ProductListResult {
  products: Product[]
  total: number
}
```

## Paso 5: Crear el Service

Crea `products.service.ts`:

```typescript
// contents/themes/default/entities/products/products.service.ts

import { queryOneWithRLS, queryWithRLS } from '@/core/lib/db'
import type { Product, ProductListOptions, ProductListResult } from './products.types'

export class ProductsService {
  /**
   * Get product by ID (authenticated)
   */
  static async getById(id: string, userId: string): Promise<Product | null> {
    try {
      if (!id || !userId) {
        throw new Error('Product ID and User ID are required')
      }

      return await queryOneWithRLS<Product>(
        `SELECT id, name, description, price, status, "createdAt", "updatedAt"
         FROM products WHERE id = $1`,
        [id],
        userId
      )
    } catch (error) {
      console.error('ProductsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch product')
    }
  }

  /**
   * List products with pagination
   */
  static async list(userId: string, options: ProductListOptions = {}): Promise<ProductListResult> {
    try {
      const { limit = 10, offset = 0, status, orderBy = 'createdAt', orderDir = 'desc' } = options

      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (status) {
        conditions.push(`status = $${paramIndex++}`)
        params.push(status)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Count total
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM products ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get products
      params.push(limit, offset)
      const products = await queryWithRLS<Product>(
        `SELECT id, name, description, price, status, "createdAt", "updatedAt"
         FROM products ${whereClause}
         ORDER BY "${orderBy}" ${orderDir === 'asc' ? 'ASC' : 'DESC'}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params,
        userId
      )

      return { products, total }
    } catch (error) {
      console.error('ProductsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list products')
    }
  }
}
```

> 💡 **Tip**: Los services usan `queryWithRLS` para queries autenticadas y `query` para queries públicas. Ver [Service Layer](../10-backend/05-service-layer.md) para más detalles.

## Paso 6: Crear Archivos de Traducción

Crea `messages/en.json`:

```json
{
  "name": "Product",
  "pluralName": "Products",
  "description": "Manage your products",
  "actions": {
    "create": "Create Product",
    "edit": "Edit Product",
    "delete": "Delete Product",
    "view": "View Product"
  },
  "fields": {
    "name": "Product Name",
    "description": "Description",
    "price": "Price",
    "status": "Status"
  },
  "messages": {
    "created": "Product created successfully",
    "updated": "Product updated successfully",
    "deleted": "Product deleted successfully"
  }
}
```

Crea `messages/es.json`:

```json
{
  "name": "Producto",
  "pluralName": "Productos",
  "description": "Gestiona tus productos",
  "actions": {
    "create": "Crear Producto",
    "edit": "Editar Producto",
    "delete": "Eliminar Producto",
    "view": "Ver Producto"
  },
  "fields": {
    "name": "Nombre del Producto",
    "description": "Descripción",
    "price": "Precio",
    "status": "Estado"
  },
  "messages": {
    "created": "Producto creado exitosamente",
    "updated": "Producto actualizado exitosamente",
    "deleted": "Producto eliminado exitosamente"
  }
}
```

## Paso 7: Registrar la Entidad en el Registry

Edita el archivo de registro de entidades del tema:

```typescript
// contents/themes/default/entities/index.ts

import { taskEntityConfig } from './tasks/tasks.config'
import { productEntityConfig } from './products/products.config'  // ← Agregar

export const themeEntities = [
  taskEntityConfig,
  productEntityConfig,  // ← Agregar aquí
]
```

## Paso 8: Crear la Tabla en la Base de Datos

Crea una migración SQL para la tabla:

> **Nota sobre System Fields**: Los campos `createdAt` y `updatedAt` son **system fields implícitos**. Deben existir en la tabla de la base de datos pero **NO** deben declararse en el array `fields` de tu configuración. El sistema los maneja automáticamente. Ver [System Fields](./04-field-types.md#system-fields-implicit) para más detalles.

```sql
-- migrations/XXX_create_products_table.sql

-- Tabla principal de products
CREATE TABLE IF NOT EXISTS "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "status" VARCHAR(50) DEFAULT 'draft',
  "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  -- System fields (always required in DB, but NOT in entity fields config)
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS "idx_products_userId" ON "products"("userId");
CREATE INDEX IF NOT EXISTS "idx_products_status" ON "products"("status");
CREATE INDEX IF NOT EXISTS "idx_products_createdAt" ON "products"("createdAt");

-- Row Level Security (RLS)
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver sus propios productos
CREATE POLICY "products_select_own" ON "products"
  FOR SELECT
  USING ("userId" = auth.uid());

-- Policy: Los usuarios solo pueden crear sus propios productos
CREATE POLICY "products_insert_own" ON "products"
  FOR INSERT
  WITH CHECK ("userId" = auth.uid());

-- Policy: Los usuarios solo pueden actualizar sus propios productos
CREATE POLICY "products_update_own" ON "products"
  FOR UPDATE
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- Policy: Los usuarios solo pueden eliminar sus propios productos
CREATE POLICY "products_delete_own" ON "products"
  FOR DELETE
  USING ("userId" = auth.uid());

-- Tabla de metadata (si access.metadata: true)
CREATE TABLE IF NOT EXISTS "products_metas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entityId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "metaKey" VARCHAR(255) NOT NULL,
  "metaValue" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("entityId", "metaKey")
);

-- Índice para metadata
CREATE INDEX IF NOT EXISTS "idx_products_metas_entityId" ON "products_metas"("entityId");
CREATE INDEX IF NOT EXISTS "idx_products_metas_metaKey" ON "products_metas"("metaKey");

-- RLS para metadata
ALTER TABLE "products_metas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_metas_select" ON "products_metas"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "products"
      WHERE "products"."id" = "products_metas"."entityId"
      AND "products"."userId" = auth.uid()
    )
  );
```

Ejecuta la migración:

```bash
pnpm db:migrate
```

## Paso 9: Crear las Páginas del Dashboard

### Página de Listado

Crea `app/dashboard/(main)/products/page.tsx`:

```typescript
'use client'

import { EntityListWrapper } from '@/core/components/entities/wrappers'

export default function ProductsPage() {
  return (
    <div className="container mx-auto py-8">
      <EntityListWrapper 
        entityType="products"
      />
    </div>
  )
}
```

### Página de Creación

Crea `app/dashboard/(main)/products/create/page.tsx`:

```typescript
'use client'

import { EntityFormWrapper } from '@/core/components/entities/wrappers'
import { useRouter } from 'next/navigation'

export default function CreateProductPage() {
  const router = useRouter()
  
  return (
    <div className="container mx-auto py-8">
      <EntityFormWrapper
        entityType="products"
        mode="create"
        onSuccess={(id) => {
          router.push(`/dashboard/products/${id}`)
        }}
        onCancel={() => {
          router.push('/dashboard/products')
        }}
      />
    </div>
  )
}
```

### Página de Edición

Crea `app/dashboard/(main)/products/[id]/edit/page.tsx`:

```typescript
'use client'

import { EntityFormWrapper } from '@/core/components/entities/wrappers'
import { useRouter } from 'next/navigation'

export default function EditProductPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const router = useRouter()
  
  return (
    <div className="container mx-auto py-8">
      <EntityFormWrapper
        entityType="products"
        mode="edit"
        id={params.id}
        onSuccess={() => {
          router.push(`/dashboard/products/${params.id}`)
        }}
        onCancel={() => {
          router.push(`/dashboard/products/${params.id}`)
        }}
      />
    </div>
  )
}
```

### Página de Detalle

Crea `app/dashboard/(main)/products/[id]/page.tsx`:

```typescript
'use client'

import { EntityDetailWrapper } from '@/core/components/entities/wrappers'

export default function ProductDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  return (
    <div className="container mx-auto py-8">
      <EntityDetailWrapper
        entityType="products"
        id={params.id}
      />
    </div>
  )
}
```

## Paso 10: Verificar que Todo Funciona

### 1. Verificar el Registry

Abre el navegador en modo desarrollo y verifica en la consola:

```typescript
// En DevTools Console
// El sistema debería haber registrado tu entidad automáticamente
```

### 2. Verificar la API

Tu entidad ya tiene endpoints automáticos:

```bash
# Listar productos
GET /api/v1/products

# Crear producto
POST /api/v1/products

# Obtener producto
GET /api/v1/products/{id}

# Actualizar producto
PATCH /api/v1/products/{id}

# Eliminar producto
DELETE /api/v1/products/{id}
```

### 3. Verificar la UI

1. Inicia el servidor de desarrollo: `pnpm dev`
2. Abre el dashboard: `http://localhost:3000/dashboard`
3. Deberías ver "Products" en el menú lateral
4. Navega a `/dashboard/products` para ver la lista
5. Clic en "Create Product" para probar el formulario

### 4. Verificar las Funcionalidades

- ✅ **Navegación**: El menú muestra "Products"
- ✅ **Listado**: `/dashboard/products` muestra la tabla vacía
- ✅ **Creación**: Formulario funcional con validación
- ✅ **Edición**: Editar productos existentes
- ✅ **Detalle**: Ver información completa del producto
- ✅ **Eliminación**: Borrar productos con confirmación
- ✅ **Búsqueda**: Buscar en el campo "name"
- ✅ **Ordenamiento**: Ordenar por cualquier columna
- ✅ **Permisos**: Solo el owner puede ver/editar sus productos

## Estructura de Archivos Final

```text
contents/themes/default/entities/products/
├── products.config.ts              # ✅ Configuración principal
├── products.fields.ts              # ✅ Definición de campos
├── products.types.ts               # ✅ Tipos TypeScript
├── products.service.ts             # ✅ Service de datos
└── messages/
    ├── en.json                     # ✅ Traducciones inglés
    └── es.json                     # ✅ Traducciones español

app/dashboard/(main)/products/
├── page.tsx                        # ✅ Lista de productos
├── create/
│   └── page.tsx                    # ✅ Crear producto
└── [id]/
    ├── page.tsx                    # ✅ Detalle de producto
    └── edit/
        └── page.tsx                # ✅ Editar producto

migrations/
└── XXX_create_products_table.sql   # ✅ Migración de BD
```

## Lo que Obtuviste Automáticamente

Sin escribir lógica de negocio adicional, ahora tienes:

- ✅ **CRUD Completo**: Crear, leer, actualizar, eliminar productos
- ✅ **APIs REST**: 5 endpoints automáticos con autenticación
- ✅ **Validación**: Campos validados client y server side
- ✅ **UI Completa**: Lista, formularios, detalle con diseño consistente
- ✅ **Permisos**: RLS en base de datos + control por rol
- ✅ **Búsqueda**: Filtrado en campos searchable
- ✅ **Ordenamiento**: Por cualquier campo sortable
- ✅ **Multiidioma**: Soporte español e inglés
- ✅ **Metadata**: Sistema extensible de campos adicionales
- ✅ **Navegación**: Integrada automáticamente en el dashboard

## Personalización Rápida

### Agregar más campos

Edita `products.fields.ts` y agrega nuevos campos:

```typescript
{
  name: 'category',
  type: 'select',
  required: true,
  options: [
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'food', label: 'Food' },
  ],
  // ... resto de la configuración
}
```

### Cambiar permisos

Edita `products.config.ts`:

```typescript
permissions: {
  read: ['admin', 'colaborator', 'member'],
  create: ['admin', 'colaborator'],        // Solo admin y colaborator
  update: ['admin'],                       // Solo admin puede editar
  delete: ['admin']                        // Solo admin puede eliminar
}
```

### Agregar relaciones

Agrega un campo de relación en `products.fields.ts`:

```typescript
{
  name: 'categoryId',
  type: 'relation',
  required: false,
  relation: {
    entity: 'categories',
    titleField: 'name',
    userFiltered: true
  },
  // ... resto de la configuración
}
```

## Troubleshooting

### Error: "Entity not found"

- Verifica que registraste la entidad en `contents/themes/default/entities/index.ts`
- Reinicia el servidor de desarrollo

### Error: "Table does not exist"

- Ejecuta la migración: `pnpm db:migrate`
- Verifica la conexión a la base de datos

### No aparece en el menú

- Verifica `ui.dashboard.showInMenu: true` en la config
- Verifica que el usuario tiene permisos de `read`

### API retorna 403

- Verifica las policies RLS en la base de datos
- Verifica que el usuario está autenticado
- Verifica los permisos en `permissions`

## Próximos Pasos

1. **[Configuration Reference](./03-configuration-reference.md)** - Explora todas las opciones de configuración
2. **[Field Types](./04-field-types.md)** - Descubre todos los tipos de campo disponibles
3. **[Relationships](./05-relationships.md)** - Aprende a conectar entidades
4. **[Examples](./12-examples.md)** - Ve ejemplos más complejos

---

> 💡 **Tip**: Revisa la entidad `tasks` en `contents/themes/default/entities/tasks/` para ver un ejemplo completo con más características avanzadas.
