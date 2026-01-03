# Building Your First Feature

## Introduction

Welcome to your first complete feature development with NextSpark! In this hands-on tutorial, you'll build a **Projects** entity from scratch, learning the full-stack development workflow from database schema to user interface.

**What you'll build:**

A complete "Projects" management system with:
- Database table with migrations
- Full CRUD API endpoints (Create, Read, Update, Delete)
- Entity configuration with auto-generated functionality
- Dashboard pages (list, create, edit, detail)
- Form validation and error handling
- Translations (English + Spanish)
- Comprehensive testing (unit + E2E)

**Why this example:**

The Projects entity demonstrates:
- Config-driven entity development (~40x faster than traditional approach)
- Registry-based architecture (zero runtime I/O)
- Dual authentication (sessions + API keys)
- Row-Level Security (RLS) for data isolation
- Auto-generated APIs and UI components
- Complete testing strategy

**Prerequisites:**
- ✅ Completed [Setup Guide](./02-setup.md)
- ✅ Development environment running (`pnpm dev`)
- ✅ Basic understanding of TypeScript and React
- ✅ Familiarity with SQL

**Time estimate:** 30-45 minutes hands-on

**Final result preview:**

By the end of this tutorial, you'll have:
- ✅ `/api/v1/projects` - Full CRUD API
- ✅ `/dashboard/projects` - Projects list page
- ✅ `/dashboard/projects/new` - Create project form
- ✅ `/dashboard/projects/[id]` - Project detail/edit page
- ✅ Navigation menu integration
- ✅ Complete test coverage

---

## 1. Project Planning

### 1.1 Feature Requirements

Let's define what a "project" is for our application:

**Core Entity:**
- **Name:** What the project is called
- **Description:** Detailed project information
- **Status:** Current state (planning, active, on-hold, completed, archived)
- **Priority:** Importance level (low, medium, high, critical)
- **Start Date:** When the project begins
- **Deadline:** Target completion date
- **Budget:** Allocated budget (optional)
- **Owner:** User who owns the project (relationship to users table)

**Relationships:**
- Many-to-One with Users (each project has one owner)
- Future: One-to-Many with Tasks (projects contain multiple tasks)

**Features:**
- Create new projects
- List all projects with filtering and sorting
- View project details
- Edit project information
- Delete projects
- Track metadata (created_at, updated_at)
- User isolation (users only see their own projects)

### 1.2 Architecture Decisions

**Using Entity System:**

We'll use the entity system because:
- ✅ Auto-generates CRUD API endpoints
- ✅ Provides universal UI components
- ✅ Handles validation automatically
- ✅ Includes RLS by default
- ✅ Supports metadata for extensibility
- ✅ Generates type definitions

**Why not custom implementation:**
- ❌ Would require ~800 lines of boilerplate
- ❌ 8-10 hours of development time
- ❌ Manual API endpoint creation
- ❌ Manual UI component development
- ❌ Manual validation implementation

**With entity system:**
- ✅ ~50 lines of configuration
- ✅ ~15 minutes setup time
- ✅ Everything auto-generated
- ✅ Type-safe and consistent

**Database Schema:**

```sql
projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(50),
  priority VARCHAR(20),
  start_date DATE,
  deadline DATE,
  budget DECIMAL(12,2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**API Structure:**

Using dynamic entity endpoints:
- `GET /api/v1/projects` - List projects (with filters)
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/[id]` - Get project
- `PATCH /api/v1/projects/[id]` - Update project
- `DELETE /api/v1/projects/[id]` - Delete project

**UI Components:**

Using entity wrappers:
- `EntityListWrapper` - Projects list
- `EntityFormWrapper` - Create/edit forms
- `EntityDetailWrapper` - Project details
- Custom components for specific views

---

## 2. Database Setup

### 2.1 Create Migration

**Create migration file:**

```bash
# Create new migration file
touch core/migrations/$(date +%Y%m%d%H%M%S)_create_projects_table.sql
```

Or with a specific timestamp:

```bash
touch core/migrations/20250120120000_create_projects_table.sql
```

**Migration file naming convention:**
- Format: `YYYYMMDDHHMMSS_description.sql`
- Always use UTC timestamp
- Use descriptive name (snake_case)

### 2.2 Migration SQL

**Edit `core/migrations/20250120120000_create_projects_table.sql`:**

```sql
-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  -- Project info
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Status and priority
  status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on-hold', 'completed', 'archived')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Dates
  start_date DATE,
  deadline DATE,

  -- Budget
  budget DECIMAL(12,2),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (deadline IS NULL OR start_date IS NULL OR deadline >= start_date),
  CONSTRAINT positive_budget CHECK (budget IS NULL OR budget >= 0)
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_priority ON projects(priority);
CREATE INDEX idx_projects_deadline ON projects(deadline);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- RLS (Row-Level Security) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own projects
CREATE POLICY projects_user_isolation ON projects
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only insert their own projects
CREATE POLICY projects_insert_own ON projects
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only update their own projects
CREATE POLICY projects_update_own ON projects
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Policy: Users can only delete their own projects
CREATE POLICY projects_delete_own ON projects
  FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE projects IS 'User projects with status tracking and budgeting';
COMMENT ON COLUMN projects.status IS 'Project lifecycle stage: planning, active, on-hold, completed, archived';
COMMENT ON COLUMN projects.priority IS 'Priority level: low, medium, high, critical';
COMMENT ON COLUMN projects.budget IS 'Project budget in base currency';
```

**Key features of this migration:**
- UUID primary key (better for distributed systems)
- Foreign key to users table with CASCADE delete
- Check constraints for data validation
- Indexes for common queries (user_id, status, priority, deadline)
- Full RLS policies (read, insert, update, delete)
- Automatic updated_at trigger
- Comments for documentation

### 2.3 Run Migration

**Execute the migration:**

```bash
pnpm db:migrate
```

**Expected output:**

```text
Running migrations...
  ✓ 20250120120000_create_projects_table.sql
Migrations completed successfully!
```

**Verify table created:**

```bash
# Using psql
psql $DATABASE_URL -c "\d projects"

# Or via Supabase dashboard:
# Go to https://supabase.com/dashboard
# → Your Project → Table Editor
# → Should see "projects" table
```

**Test with sample data:**

```sql
-- Get your user ID first
SELECT id, email FROM "user" LIMIT 1;

-- Insert test project (replace USER_ID)
INSERT INTO projects (user_id, name, description, status, priority, deadline)
VALUES (
  'YOUR_USER_ID',
  'Website Redesign',
  'Complete overhaul of company website',
  'planning',
  'high',
  '2025-06-30'
);

-- Verify insertion
SELECT id, name, status, priority FROM projects;
```

---

## 3. Entity Configuration

### 3.1 Create Entity Directory

**Create the entity structure:**

```bash
mkdir -p contents/themes/default/entities/projects/messages
touch contents/themes/default/entities/projects/projects.config.ts
touch contents/themes/default/entities/projects/projects.fields.ts
touch contents/themes/default/entities/projects/messages/en.json
touch contents/themes/default/entities/projects/messages/es.json
```

**Directory structure:**

```text
contents/themes/default/entities/projects/
├── projects.config.ts      # Entity configuration
├── projects.fields.ts      # Field definitions
├── messages/
│   ├── en.json            # English translations
│   └── es.json            # Spanish translations
└── migrations/            # (Optional) Entity-specific migrations
    └── ...
```

### 3.2 Field Definitions

**Edit `contents/themes/default/entities/projects/projects.fields.ts`:**

```typescript
import type { FieldDefinition } from '@/core/lib/entities/types'

export const projectFields: FieldDefinition[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Project Name',
      placeholder: 'Enter project name...',
      description: 'A descriptive name for your project',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12
    },
    validation: {
      minLength: 3,
      maxLength: 200,
      pattern: undefined
    },
    api: {
      searchable: true,
      sortable: true,
      filterable: false,
      readOnly: false
    }
  },

  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      placeholder: 'Detailed project description...',
      description: 'Provide context and goals for this project',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12
    },
    validation: {
      maxLength: 2000
    },
    api: {
      searchable: true,
      sortable: false,
      filterable: false,
      readOnly: false
    }
  },

  {
    name: 'status',
    type: 'select',
    required: true,
    display: {
      label: 'Status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 6
    },
    options: [
      { value: 'planning', label: 'Planning', color: 'blue' },
      { value: 'active', label: 'Active', color: 'green' },
      { value: 'on-hold', label: 'On Hold', color: 'yellow' },
      { value: 'completed', label: 'Completed', color: 'purple' },
      { value: 'archived', label: 'Archived', color: 'gray' }
    ],
    defaultValue: 'planning',
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false
    }
  },

  {
    name: 'priority',
    type: 'select',
    required: true,
    display: {
      label: 'Priority',
      placeholder: 'Select priority...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 6
    },
    options: [
      { value: 'low', label: 'Low', color: 'gray' },
      { value: 'medium', label: 'Medium', color: 'blue' },
      { value: 'high', label: 'High', color: 'orange' },
      { value: 'critical', label: 'Critical', color: 'red' }
    ],
    defaultValue: 'medium',
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false
    }
  },

  {
    name: 'start_date',
    type: 'date',
    required: false,
    display: {
      label: 'Start Date',
      placeholder: 'Select start date...',
      description: 'When the project is scheduled to begin',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 6
    },
    validation: {
      minDate: undefined, // Could set to today for new projects
      maxDate: undefined
    },
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false
    }
  },

  {
    name: 'deadline',
    type: 'date',
    required: false,
    display: {
      label: 'Deadline',
      placeholder: 'Select deadline...',
      description: 'Target completion date',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 6
    },
    validation: {
      minDate: undefined, // Could validate against start_date
      maxDate: undefined
    },
    api: {
      searchable: false,
      sortable: true,
      filterable: true,
      readOnly: false
    }
  },

  {
    name: 'budget',
    type: 'number',
    required: false,
    display: {
      label: 'Budget',
      placeholder: 'Enter budget amount...',
      description: 'Allocated budget in your base currency',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 7,
      columnWidth: 6,
      prefix: '$',
      suffix: 'USD'
    },
    validation: {
      min: 0,
      max: 999999999.99,
      step: 0.01
    },
    api: {
      searchable: false,
      sortable: true,
      filterable: false,
      readOnly: false
    }
  }
]
```

**Field types available:**
- `text` - Single-line text input
- `textarea` - Multi-line text input
- `select` - Dropdown selection
- `date` - Date picker
- `number` - Numeric input
- `checkbox` - Boolean toggle
- `email` - Email input with validation
- `url` - URL input with validation
- `relationship` - Foreign key to another entity

### 3.3 Entity Configuration

**Edit `contents/themes/default/entities/projects/projects.config.ts`:**

```typescript
import { FolderKanban } from 'lucide-react'
import type { EntityConfig } from '@/core/lib/entities/types'
import { projectFields } from './projects.fields'

export const projectEntityConfig: EntityConfig = {
  // Basic identification
  slug: 'projects',
  enabled: true,
  names: {
    singular: 'project',
    plural: 'Projects'
  },
  icon: FolderKanban,

  // Access control
  access: {
    public: false,        // Not accessible without authentication
    api: true,            // Has external API with API keys
    metadata: true,       // Supports dynamic metadata fields
    shared: false         // User-isolated (RLS enforced)
  },

  // UI/UX features
  ui: {
    dashboard: {
      showInMenu: true,      // Appears in navigation menu
      showInTopbar: true,    // Appears in quick-create dropdown
      menuOrder: 3           // Position in menu (lower = higher)
    },
    public: {
      hasArchivePage: false, // No public listing page
      hasSinglePage: false   // No public detail page
    },
    features: {
      searchable: true,      // Included in global search
      sortable: true,        // Allow sorting in lists
      filterable: true,      // Allow filtering in lists
      bulkOperations: true,  // Enable bulk delete/update
      importExport: false    // CSV import/export (disabled for now)
    }
  },

  // Permissions (role-based)
  permissions: {
    read: ['admin', 'colaborator', 'member'],
    create: ['admin', 'colaborator', 'member'],
    update: ['admin', 'colaborator', 'member'],
    delete: ['admin', 'colaborator']
  },

  // Internationalization
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: () => import('./messages/en.json'),
      es: () => import('./messages/es.json')
    }
  },

  // Field definitions
  fields: projectFields,

  // Default values for new records
  defaults: {
    status: 'planning',
    priority: 'medium'
  },

  // List view configuration
  list: {
    defaultSort: {
      field: 'created_at',
      direction: 'desc'
    },
    defaultFilters: {
      status: ['planning', 'active'] // Hide completed/archived by default
    },
    pageSize: 20,
    showSearch: true,
    showFilters: true,
    showExport: false
  },

  // Form configuration
  form: {
    layout: 'vertical',     // vertical | horizontal
    submitLabel: 'Save Project',
    cancelLabel: 'Cancel',
    resetOnSubmit: true
  }
}
```

### 3.4 Translations

**Edit `contents/themes/default/entities/projects/messages/en.json`:**

```json
{
  "projects.name": "Projects",
  "projects.singular": "Project",
  "projects.description": "Manage your projects",

  "projects.actions.create": "New Project",
  "projects.actions.edit": "Edit Project",
  "projects.actions.delete": "Delete Project",
  "projects.actions.view": "View Project",

  "projects.field.name": "Project Name",
  "projects.field.name.placeholder": "Enter project name...",
  "projects.field.name.description": "A descriptive name for your project",

  "projects.field.description": "Description",
  "projects.field.description.placeholder": "Detailed project description...",
  "projects.field.description.description": "Provide context and goals",

  "projects.field.status": "Status",
  "projects.field.status.planning": "Planning",
  "projects.field.status.active": "Active",
  "projects.field.status.on-hold": "On Hold",
  "projects.field.status.completed": "Completed",
  "projects.field.status.archived": "Archived",

  "projects.field.priority": "Priority",
  "projects.field.priority.low": "Low",
  "projects.field.priority.medium": "Medium",
  "projects.field.priority.high": "High",
  "projects.field.priority.critical": "Critical",

  "projects.field.start_date": "Start Date",
  "projects.field.start_date.placeholder": "Select start date...",

  "projects.field.deadline": "Deadline",
  "projects.field.deadline.placeholder": "Select deadline...",

  "projects.field.budget": "Budget",
  "projects.field.budget.placeholder": "Enter budget amount...",

  "projects.list.title": "Projects",
  "projects.list.empty": "No projects yet",
  "projects.list.empty.description": "Create your first project to get started",

  "projects.detail.title": "Project Details",

  "projects.form.create.title": "Create New Project",
  "projects.form.edit.title": "Edit Project",

  "projects.messages.create.success": "Project created successfully",
  "projects.messages.update.success": "Project updated successfully",
  "projects.messages.delete.success": "Project deleted successfully",
  "projects.messages.delete.confirm": "Are you sure you want to delete this project?",

  "projects.filters.status": "Filter by Status",
  "projects.filters.priority": "Filter by Priority",
  "projects.filters.dateRange": "Date Range"
}
```

**Edit `contents/themes/default/entities/projects/messages/es.json`:**

```json
{
  "projects.name": "Proyectos",
  "projects.singular": "Proyecto",
  "projects.description": "Gestiona tus proyectos",

  "projects.actions.create": "Nuevo Proyecto",
  "projects.actions.edit": "Editar Proyecto",
  "projects.actions.delete": "Eliminar Proyecto",
  "projects.actions.view": "Ver Proyecto",

  "projects.field.name": "Nombre del Proyecto",
  "projects.field.name.placeholder": "Ingresa el nombre del proyecto...",
  "projects.field.name.description": "Un nombre descriptivo para tu proyecto",

  "projects.field.description": "Descripción",
  "projects.field.description.placeholder": "Descripción detallada del proyecto...",
  "projects.field.description.description": "Proporciona contexto y objetivos",

  "projects.field.status": "Estado",
  "projects.field.status.planning": "Planificación",
  "projects.field.status.active": "Activo",
  "projects.field.status.on-hold": "En Espera",
  "projects.field.status.completed": "Completado",
  "projects.field.status.archived": "Archivado",

  "projects.field.priority": "Prioridad",
  "projects.field.priority.low": "Baja",
  "projects.field.priority.medium": "Media",
  "projects.field.priority.high": "Alta",
  "projects.field.priority.critical": "Crítica",

  "projects.field.start_date": "Fecha de Inicio",
  "projects.field.start_date.placeholder": "Selecciona fecha de inicio...",

  "projects.field.deadline": "Fecha Límite",
  "projects.field.deadline.placeholder": "Selecciona fecha límite...",

  "projects.field.budget": "Presupuesto",
  "projects.field.budget.placeholder": "Ingresa el monto del presupuesto...",

  "projects.list.title": "Proyectos",
  "projects.list.empty": "Aún no hay proyectos",
  "projects.list.empty.description": "Crea tu primer proyecto para comenzar",

  "projects.detail.title": "Detalles del Proyecto",

  "projects.form.create.title": "Crear Nuevo Proyecto",
  "projects.form.edit.title": "Editar Proyecto",

  "projects.messages.create.success": "Proyecto creado exitosamente",
  "projects.messages.update.success": "Proyecto actualizado exitosamente",
  "projects.messages.delete.success": "Proyecto eliminado exitosamente",
  "projects.messages.delete.confirm": "¿Estás seguro de que deseas eliminar este proyecto?",

  "projects.filters.status": "Filtrar por Estado",
  "projects.filters.priority": "Filtrar por Prioridad",
  "projects.filters.dateRange": "Rango de Fechas"
}
```

---

## 4. Backend Implementation

### 4.1 Understand Dynamic API

The beauty of the entity system is that you **don't need to write any backend code** for basic CRUD operations. The system automatically generates API endpoints based on your entity configuration.

**Auto-generated endpoints:**

```text
GET    /api/v1/projects       - List all projects (with filters, pagination)
POST   /api/v1/projects       - Create new project
GET    /api/v1/projects/:id   - Get single project
PATCH  /api/v1/projects/:id   - Update project
DELETE /api/v1/projects/:id   - Delete project
```

**How it works:**

1. **Registry system** loads your entity config at build time
2. **Dynamic route handler** in `app/api/v1/[entity]/route.ts` handles all requests
3. **Route handlers registry** maps entity slugs to operations
4. **Service layer** performs database operations with RLS
5. **Validation** happens automatically based on field definitions

**No code needed!** Just rebuild registries and the API is ready.

### 4.2 Test API Endpoints

**Rebuild registries to activate the new entity:**

```bash
# Stop dev server (Ctrl+C)
pnpm registry:build

# Restart dev server
pnpm dev
```

**Expected output:**
```text
🔍 Found 3 entities:
  ✓ tasks (from theme)
  ✓ projects (from theme)  ← NEW!
  ✓ users (from core)

✅ Registry build completed
```

**Test with curl:**

**1. Create a project:**

```bash
# First, get auth cookie by logging in via browser
# Then copy the cookie value

curl -X POST http://localhost:5173/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Mobile App Development",
    "description": "Build iOS and Android app",
    "status": "planning",
    "priority": "high",
    "deadline": "2025-12-31",
    "budget": 50000
  }'
```

**Expected response (201 Created):**

```json
{
  "data": {
    "id": "uuid-here",
    "user_id": "user-uuid",
    "name": "Mobile App Development",
    "description": "Build iOS and Android app",
    "status": "planning",
    "priority": "high",
    "start_date": null,
    "deadline": "2025-12-31",
    "budget": 50000,
    "created_at": "2025-01-20T12:00:00Z",
    "updated_at": "2025-01-20T12:00:00Z"
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2025-01-20T12:00:00Z"
  }
}
```

**2. List projects:**

```bash
curl http://localhost:5173/api/v1/projects \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**With filters:**

```bash
# Filter by status
curl "http://localhost:5173/api/v1/projects?status=planning" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Sort by deadline
curl "http://localhost:5173/api/v1/projects?sort=deadline&direction=asc" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Pagination
curl "http://localhost:5173/api/v1/projects?page=1&limit=10" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**3. Get single project:**

```bash
curl http://localhost:5173/api/v1/projects/PROJECT_ID \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**4. Update project:**

```bash
curl -X PATCH http://localhost:5173/api/v1/projects/PROJECT_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "status": "active",
    "start_date": "2025-01-20"
  }'
```

**5. Delete project:**

```bash
curl -X DELETE http://localhost:5173/api/v1/projects/PROJECT_ID \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**Expected response (204 No Content):**
```text
(empty body)
```

**Test with Postman:**

1. Create new collection "Projects API"
2. Add requests for each endpoint
3. Set Authorization: Cookie → `better-auth.session_token`
4. Test CRUD operations
5. Verify validation errors (try creating project without required name)

### 4.3 Custom Endpoint (Optional)

If you need custom logic beyond CRUD, create a custom endpoint:

**Create `app/api/v1/projects/stats/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/core/lib/auth'
import { db } from '@/core/lib/db'

export async function GET(request: NextRequest) {
  // Authenticate request
  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get project statistics for current user
  const stats = await db.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'planning') as planning,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      SUM(budget) as total_budget,
      AVG(budget) as avg_budget
    FROM projects
    WHERE user_id = $1
  `, [session.user.id])

  return NextResponse.json({
    data: stats.rows[0]
  })
}
```

**Test custom endpoint:**

```bash
curl http://localhost:5173/api/v1/projects/stats \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**Expected response:**

```json
{
  "data": {
    "total": 15,
    "planning": 3,
    "active": 8,
    "completed": 4,
    "total_budget": 250000,
    "avg_budget": 16666.67
  }
}
```

---

## 5. Frontend Implementation

### 5.1 Create Project List Page

**Create `app/(protected)/dashboard/projects/page.tsx`:**

```typescript
import { Suspense } from 'react'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'
import { Skeleton } from '@/core/components/ui/skeleton'

export const metadata = {
  title: 'Projects',
  description: 'Manage your projects'
}

export default async function ProjectsPage() {
  // Get entity configuration from registry (zero I/O)
  const projectConfig = ENTITY_REGISTRY.projects

  return (
    <div className="container py-10">
      <Suspense fallback={<ProjectsListSkeleton />}>
        <EntityListWrapper
          entityName="projects"
          config={projectConfig}
          showFilters={true}
          showSearch={true}
          showCreateButton={true}
        />
      </Suspense>
    </div>
  )
}

function ProjectsListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
```

**EntityListWrapper automatically provides:**
- ✅ Data fetching with TanStack Query
- ✅ List rendering with proper styling
- ✅ Search functionality
- ✅ Filter dropdowns (status, priority)
- ✅ Sorting controls
- ✅ Pagination
- ✅ "Create New" button
- ✅ Empty states
- ✅ Loading states
- ✅ Error handling

### 5.2 Create Project Form Page

**Create `app/(protected)/dashboard/projects/new/page.tsx`:**

```typescript
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { EntityFormWrapper } from '@/core/components/entities/wrappers/EntityFormWrapper'

export const metadata = {
  title: 'Create Project',
  description: 'Create a new project'
}

export default async function NewProjectPage() {
  const projectConfig = ENTITY_REGISTRY.projects

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-3xl font-bold mb-8">Create New Project</h1>

      <EntityFormWrapper
        entityName="projects"
        config={projectConfig}
        mode="create"
        redirectOnSuccess="/dashboard/projects"
      />
    </div>
  )
}
```

**EntityFormWrapper automatically provides:**
- ✅ Form generation from field definitions
- ✅ Validation (client + server)
- ✅ Error messages
- ✅ Loading states
- ✅ Success messages
- ✅ Optimistic updates
- ✅ Redirect after save
- ✅ Cancel button

### 5.3 Create Project Detail/Edit Page

**Create `app/(protected)/dashboard/projects/[id]/page.tsx`:**

```typescript
import { notFound } from 'next/navigation'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { EntityDetailWrapper } from '@/core/components/entities/wrappers/EntityDetailWrapper'
import { EntityFormWrapper } from '@/core/components/entities/wrappers/EntityFormWrapper'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs'

interface ProjectDetailPageProps {
  params: {
    id: string
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const projectConfig = ENTITY_REGISTRY.projects

  // Fetch project data (server-side)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/projects/${params.id}`,
    {
      cache: 'no-store' // Always fresh data
    }
  )

  if (!response.ok) {
    notFound()
  }

  const { data: project } = await response.json()

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-8">{project.name}</h1>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <EntityDetailWrapper
            entityName="projects"
            config={projectConfig}
            data={project}
            showActions={true}
          />
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          <EntityFormWrapper
            entityName="projects"
            config={projectConfig}
            mode="edit"
            initialData={project}
            redirectOnSuccess={`/dashboard/projects/${params.id}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 5.4 Add Navigation Link

**Edit `contents/themes/default/config/app.config.ts`:**

```typescript
export const appConfig = {
  name: 'My SaaS App',
  description: 'Built with NextSpark',

  navigation: {
    dashboard: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'Home'
      },
      {
        label: 'Tasks',
        href: '/dashboard/tasks',
        icon: 'CheckSquare'
      },
      {
        label: 'Projects',           // NEW!
        href: '/dashboard/projects',
        icon: 'FolderKanban'
      }
    ]
  },

  features: {
    enableSignup: true,
    enableOAuth: true,
    enableDarkMode: true
  }
}
```

**Rebuild registries and restart:**

```bash
pnpm registry:build
# Restart pnpm dev
```

**Verify navigation:**
1. Open http://localhost:5173/dashboard
2. Should see "Projects" link in sidebar
3. Click → should navigate to `/dashboard/projects`
4. Should see projects list (empty state if no data)

---

## 6. Styling and UX

### 6.1 Use Theme Variables

**All components automatically use theme variables:**

```css
/* Already applied via EntityListWrapper, EntityFormWrapper, etc. */
background-color: var(--color-background);
color: var(--color-foreground);
border-color: var(--color-border);

/* Status badges use themed colors */
.status-planning { background: var(--color-blue-500); }
.status-active { background: var(--color-green-500); }
.status-completed { background: var(--color-purple-500); }
```

**Customize if needed in `contents/themes/default/styles/globals.css`:**

```css
.project-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--spacing-4);
}

.project-status-badge {
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}
```

### 6.2 Add Loading States

**Already provided by wrappers, but can customize:**

**Custom skeleton for project card:**

```typescript
// components/projects/ProjectCardSkeleton.tsx
export function ProjectCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  )
}
```

### 6.3 Add Empty States

**Already provided by EntityListWrapper, but can customize:**

```typescript
// components/projects/ProjectsEmptyState.tsx
import { FolderKanban } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import Link from 'next/link'

export function ProjectsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Create your first project to start organizing your work and tracking progress.
      </p>
      <Button asChild>
        <Link href="/dashboard/projects/new">
          Create First Project
        </Link>
      </Button>
    </div>
  )
}
```

---

## 7. Testing

### 7.1 Unit Tests

**Create `test/unit/entities/projects.test.ts`:**

```typescript
import { describe, it, expect } from '@jest/globals'
import { projectFields } from '@/contents/themes/default/entities/projects/projects.fields'
import { projectEntityConfig } from '@/contents/themes/default/entities/projects/projects.config'

describe('Projects Entity', () => {
  describe('Field Definitions', () => {
    it('should have required fields defined', () => {
      const requiredFields = projectFields.filter(f => f.required)
      const requiredFieldNames = requiredFields.map(f => f.name)

      expect(requiredFieldNames).toContain('name')
      expect(requiredFieldNames).toContain('status')
      expect(requiredFieldNames).toContain('priority')
    })

    it('should validate name field length', () => {
      const nameField = projectFields.find(f => f.name === 'name')

      expect(nameField?.validation?.minLength).toBe(3)
      expect(nameField?.validation?.maxLength).toBe(200)
    })

    it('should have correct status options', () => {
      const statusField = projectFields.find(f => f.name === 'status')
      const statusValues = statusField?.options?.map(o => o.value)

      expect(statusValues).toEqual([
        'planning',
        'active',
        'on-hold',
        'completed',
        'archived'
      ])
    })
  })

  describe('Entity Configuration', () => {
    it('should be enabled', () => {
      expect(projectEntityConfig.enabled).toBe(true)
    })

    it('should have correct slug', () => {
      expect(projectEntityConfig.slug).toBe('projects')
    })

    it('should not be publicly accessible', () => {
      expect(projectEntityConfig.access.public).toBe(false)
    })

    it('should support API access', () => {
      expect(projectEntityConfig.access.api).toBe(true)
    })

    it('should have proper permissions', () => {
      expect(projectEntityConfig.permissions.actions).toBeDefined()
      expect(Array.isArray(projectEntityConfig.permissions.actions)).toBe(true)

      const readAction = projectEntityConfig.permissions.actions.find((a: any) => a.action === 'read')
      const createAction = projectEntityConfig.permissions.actions.find((a: any) => a.action === 'create')
      const deleteAction = projectEntityConfig.permissions.actions.find((a: any) => a.action === 'delete')

      expect(readAction?.roles).toContain('member')
      expect(createAction?.roles).toContain('member')
      expect(deleteAction?.roles).not.toContain('member')
    })
  })
})
```

**Run unit tests:**

```bash
pnpm test:unit test/unit/entities/projects.test.ts
```

### 7.2 E2E Tests

**Create `test/e2e/projects.cy.ts`:**

```typescript
describe('Projects Feature', () => {
  beforeEach(() => {
    // Login before each test
    cy.session('user-session', () => {
      cy.visit('/login')
      cy.get('[data-cy=email-input]').type('test@example.com')
      cy.get('[data-cy=password-input]').type('password123')
      cy.get('[data-cy=login-button]').click()
      cy.url().should('include', '/dashboard')
    })

    cy.visit('/dashboard/projects')
  })

  it('displays projects list page', () => {
    cy.get('h1').should('contain', 'Projects')
    cy.get('[data-cy=create-project-button]').should('be.visible')
  })

  it('creates a new project', () => {
    // Click create button
    cy.get('[data-cy=create-project-button]').click()
    cy.url().should('include', '/dashboard/projects/new')

    // Fill form
    cy.get('[data-cy=field-name]').type('E2E Test Project')
    cy.get('[data-cy=field-description]').type('Created by Cypress test')
    cy.get('[data-cy=field-status]').select('planning')
    cy.get('[data-cy=field-priority]').select('high')
    cy.get('[data-cy=field-deadline]').type('2025-12-31')
    cy.get('[data-cy=field-budget]').type('10000')

    // Submit
    cy.get('[data-cy=submit-button]').click()

    // Verify redirect and success message
    cy.url().should('include', '/dashboard/projects')
    cy.get('[data-cy=success-message]').should('contain', 'created successfully')

    // Verify project appears in list
    cy.get('[data-cy=project-list]').should('contain', 'E2E Test Project')
  })

  it('edits an existing project', () => {
    // Click on first project
    cy.get('[data-cy=project-list-item]').first().click()

    // Go to edit tab
    cy.get('[data-cy=tab-edit]').click()

    // Change status
    cy.get('[data-cy=field-status]').select('active')
    cy.get('[data-cy=submit-button]').click()

    // Verify update
    cy.get('[data-cy=success-message]').should('contain', 'updated successfully')
    cy.get('[data-cy=tab-details]').click()
    cy.get('[data-cy=field-status-display]').should('contain', 'Active')
  })

  it('deletes a project', () => {
    // Click on first project
    cy.get('[data-cy=project-list-item]').first().click()

    // Click delete button
    cy.get('[data-cy=delete-button]').click()

    // Confirm deletion
    cy.get('[data-cy=confirm-delete-button]').click()

    // Verify redirect and success message
    cy.url().should('include', '/dashboard/projects')
    cy.get('[data-cy=success-message]').should('contain', 'deleted successfully')
  })

  it('filters projects by status', () => {
    // Open filter dropdown
    cy.get('[data-cy=filter-status]').click()
    cy.get('[data-cy=filter-status-option-active]').click()

    // Verify only active projects shown
    cy.get('[data-cy=project-list-item]').each($item => {
      cy.wrap($item).find('[data-cy=status-badge]').should('contain', 'Active')
    })
  })

  it('searches projects by name', () => {
    // Type in search
    cy.get('[data-cy=search-input]').type('Mobile')

    // Verify filtered results
    cy.get('[data-cy=project-list-item]').should('have.length.at.most', 5)
    cy.get('[data-cy=project-list-item]').each($item => {
      cy.wrap($item).should('contain', 'Mobile')
    })
  })
})
```

**Add data-cy attributes to components:**

In your EntityListWrapper, EntityFormWrapper usage, make sure to pass proper test IDs.

**Run E2E tests:**

```bash
# Headless
pnpm test:e2e

# With UI
pnpm cy:open
# Select "projects.cy.ts"
```

### 7.3 Test Coverage

**Run all tests with coverage:**

```bash
pnpm test:coverage
```

**Expected coverage:**
```text
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
projects.config.ts  |   100   |   100    |   100   |   100   |
projects.fields.ts  |   100   |   100    |   100   |   100   |
--------------------|---------|----------|---------|---------|
```

---

## 8. Registry Rebuild and Verification

### 8.1 Rebuild Registries

**Stop dev server and rebuild:**

```bash
# Stop dev server (Ctrl+C)

# Rebuild registries
pnpm registry:build
```

**Verify projects entity registered:**

```bash
# Check entity-registry.ts
grep -A 5 "projects" core/lib/registries/entity-registry.ts

# Should see:
# projects: {
#   slug: 'projects',
#   enabled: true,
#   ...
# }
```

**Restart dev server:**

```bash
pnpm dev
```

### 8.2 Verify Integration

**Complete verification checklist:**

**Backend (API):**
- [ ] `GET /api/v1/projects` returns 200
- [ ] Can create project via `POST /api/v1/projects`
- [ ] Can update project via `PATCH /api/v1/projects/:id`
- [ ] Can delete project via `DELETE /api/v1/projects/:id`
- [ ] Validation errors return 400 with details
- [ ] Unauthorized requests return 401
- [ ] RLS enforced (can't access other users' projects)

**Frontend (UI):**
- [ ] `/dashboard/projects` page loads
- [ ] Projects list displays correctly
- [ ] Can click "New Project" button
- [ ] Form validates required fields
- [ ] Can create project successfully
- [ ] Can edit existing project
- [ ] Can delete project with confirmation
- [ ] Filters work (status, priority)
- [ ] Search works
- [ ] Pagination works

**Translations:**
- [ ] English labels display correctly
- [ ] Spanish labels display when locale=es
- [ ] Field placeholders translated
- [ ] Success/error messages translated

**Testing:**
- [ ] Unit tests pass (100% coverage)
- [ ] E2E tests pass
- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] Linting passes

---

## 9. Enhancement Ideas

Now that you have a working Projects entity, here are some enhancements to explore:

### 9.1 Add Relationships

**Link projects to tasks:**

**Update `task.fields.ts`:**

```typescript
{
  name: 'project_id',
  type: 'relationship',
  relationshipType: 'manyToOne',
  targetEntity: 'projects',
  display: {
    label: 'Project',
    showInList: true,
    showInDetail: true,
    showInForm: true
  },
  api: {
    filterable: true,
    sortable: true
  }
}
```

**Benefits:**
- Tasks can belong to projects
- Filter tasks by project
- Show related tasks in project detail view

### 9.2 Add Metadata

**Use metadata for custom fields:**

```typescript
// Store custom data without schema changes
await MetaService.createMeta({
  entityId: projectId,
  key: 'client_name',
  value: JSON.stringify('Acme Corp'),
  userId: userId
})

// Retrieve metadata
const projectMeta = await MetaService.getMeta(projectId, userId)
// { client_name: 'Acme Corp', ... }
```

**Use cases:**
- Custom project attributes per user
- Feature flags per project
- User preferences for project views
- Tags/labels without database changes

### 9.3 Add Advanced Features

**Search functionality:**

```typescript
// In EntityListWrapper, enable full-text search
const searchableFields = ['name', 'description']
```

**Bulk operations:**

```typescript
// Select multiple projects
// Bulk update status
// Bulk delete
// Bulk export
```

**Export/Import:**

```typescript
// Export to CSV
// Export to PDF
// Import from CSV
// Import from Excel
```

**Activity timeline:**

```typescript
// Track project changes
// Show audit log
// Display who changed what and when
```

**File attachments:**

```typescript
// Upload project documents
// Link to external files
// Version control for files
```

**Team collaboration:**

```typescript
// Assign team members to projects
// Share projects with specific users
// Permission levels per project
```

---

## 10. Deployment Preparation

### 10.1 Environment Variables

**Add to production `.env`:**

```bash
# All required variables from development
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
RESEND_API_KEY=...
```

### 10.2 Migration Strategy

**Production migration steps:**

1. **Backup database:**
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

2. **Test migration on staging:**
```bash
pnpm db:migrate
```

3. **Verify migration successful:**
```bash
pnpm db:verify
```

4. **Deploy application:**
```bash
pnpm build
pnpm start
```

5. **Rollback plan (if needed):**
```bash
psql $DATABASE_URL < backup-20250120.sql
```

### 10.3 Testing Checklist

**Before deploying:**

- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build completes successfully
- [ ] Database migration tested on staging
- [ ] Environment variables configured
- [ ] API endpoints tested in staging
- [ ] UI tested in staging
- [ ] Performance tested (< 2s page load)
- [ ] Accessibility tested (Lighthouse >90)
- [ ] Mobile responsive verified
- [ ] Error handling tested
- [ ] Security review completed

### 10.4 Rollback Plan

**If deployment fails:**

1. **Revert code deployment**
2. **Rollback database migration:**
```sql
-- Revert projects table
DROP TABLE IF EXISTS projects CASCADE;
```

3. **Clear registry cache:**
```bash
rm -rf .next
pnpm registry:build
```

4. **Restart services**
5. **Verify rollback successful**

---

## 11. Summary and Next Steps

### 11.1 What You Learned

**Full-stack development workflow:**
- ✅ Database schema design with RLS
- ✅ Migration creation and execution
- ✅ Entity configuration (config-driven approach)
- ✅ Field definitions with validation
- ✅ Translation management (i18n)
- ✅ Auto-generated API endpoints
- ✅ Frontend implementation (Server + Client Components)
- ✅ Testing strategy (unit + E2E)
- ✅ Registry system integration
- ✅ Deployment preparation

**Entity system mastery:**
- Config vs code (40x productivity improvement)
- Registry-based architecture (17,255x performance)
- Zero runtime I/O philosophy
- Type-safe development
- Auto-generated features

**Time comparison:**

| Approach | Time | Lines of Code | Features |
|----------|------|---------------|----------|
| Traditional | ~10 hours | ~800 lines | Basic CRUD |
| Entity System | ~15 minutes | ~50 lines config | Full-featured CRUD + UI + Tests |

**Improvement:** **40x faster development!**

### 11.2 What You Built

**Complete Projects management system:**
- ✅ Database table with RLS policies
- ✅ Full CRUD API (`/api/v1/projects`)
- ✅ Dashboard pages (list, create, edit, detail)
- ✅ Form validation
- ✅ Translations (en + es)
- ✅ Filtering and search
- ✅ Navigation integration
- ✅ Comprehensive testing
- ✅ Production-ready code

### 11.3 Next Recommended Projects

**Build on this knowledge:**

1. **Add Tasks-Projects relationship:**
   - Link tasks to projects
   - Show tasks in project detail view
   - Filter tasks by project

2. **Create Clients entity:**
   - Manage clients
   - Link projects to clients
   - Client dashboard

3. **Build Time Tracking:**
   - Track time spent on projects
   - Generate time reports
   - Invoice integration

4. **Add Team Management:**
   - Create teams
   - Assign team members to projects
   - Permission levels

5. **Implement Dashboard:**
   - Project statistics
   - Charts and graphs
   - Activity feed

### 11.4 Further Learning

**Explore advanced topics:**

- [Entity Relationships](../04-entities/06-entity-relationships.md)
- [Metadata System](../04-entities/07-metadata-system.md)
- [Custom Validation](../04-entities/10-validation.md)
- [Lifecycle Hooks](../04-entities/08-hooks-and-lifecycle.md)
- [Advanced API Patterns](../05-api/12-advanced-features.md)
- [Performance Optimization](../13-performance/01-overview.md)
- [Deployment Guide](../14-deployment/01-overview.md)

---

## Troubleshooting

### Migration fails

**Error:**
```text
relation "projects" already exists
```

**Solution:**
```sql
DROP TABLE IF EXISTS projects CASCADE;
```

Then re-run migration.

### Registry doesn't show projects

**Error:** Projects not appearing in ENTITY_REGISTRY

**Solution:**
```bash
rm -rf core/lib/registries/*
pnpm registry:build
# Restart dev server
```

### API returns 401 Unauthorized

**Issue:** Can't access API endpoints

**Solution:**
1. Check you're logged in
2. Verify session cookie exists
3. Test in browser (authenticated) before curl
4. Use Postman with cookie authentication

### Form validation not working

**Issue:** Can create projects without required fields

**Solution:**
1. Check field definitions have `required: true`
2. Verify validation rules in field config
3. Rebuild registries
4. Clear browser cache

### Tests failing

**Error:** E2E tests can't find elements

**Solution:**
1. Add `data-cy` attributes to components
2. Check element selectors
3. Verify test data exists
4. Run tests in UI mode (`pnpm cy:open`) for debugging

---

**Congratulations!** 🎉

You've successfully built your first complete feature with NextSpark. You now understand the full-stack development workflow and can build any entity you need with confidence.

**Next recommended:** [First Customization Guide](./09-first-customization.md) to learn about theming, plugins, and advanced customizations.

---

**Last Updated**: 2025-11-20
**Version**: 1.0.0
**Status**: Complete
