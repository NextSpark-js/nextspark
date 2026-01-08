---
title: Tasks Entity
description: Complete guide to the Tasks entity implementation with CRUD operations, metadata, and API access.
---

# Tasks Entity

## Introduction

The **Tasks** entity is the primary example entity included in the default theme. It demonstrates a complete entity implementation with full CRUD operations, metadata support, API access, and internationalization.

## Entity Configuration

### Basic Setup

```typescript
{
  slug: 'tasks',
  enabled: true,
  names: {
    singular: 'task',
    plural: 'Tasks'
  },
  icon: CheckSquare
}
```

### Access Configuration

```typescript
access: {
  public: false,      // Not accessible without authentication
  api: true,          // External API access enabled
  metadata: true,     // Metadata system supported
  shared: false       // User-scoped (not shared between users)
}
```

**Implications:**
- Users must be authenticated to access tasks
- Tasks are available via API key
- Each task can have custom metadata
- Users only see their own tasks

### UI Features

```typescript
ui: {
  dashboard: {
    showInMenu: true,       // Appears in sidebar
    showInTopbar: true      // Quick access in topbar
  },
  public: {
    hasArchivePage: false,  // No public archive
    hasSinglePage: false    // No public detail page
  },
  features: {
    searchable: true,       // Full-text search enabled
    sortable: true,         // Column sorting
    filterable: true,       // Advanced filters
    bulkOperations: true,   // Select multiple tasks
    importExport: false     // No CSV import/export
  }
}
```

### Permissions

```typescript
permissions: {
  read: ['admin', 'colaborator', 'member'],
  create: ['admin', 'colaborator', 'member'],
  update: ['admin', 'colaborator', 'member'],
  delete: ['admin', 'colaborator', 'member']
}
```

**All roles** can perform all operations on tasks.

## Fields

### Standard Fields

**Title:**
```typescript
{
  name: 'title',
  type: 'text',
  label: 'Title',
  required: true,
  searchable: true,
  sortable: true
}
```

**Description:**
```typescript
{
  name: 'description',
  type: 'textarea',
  label: 'Description',
  required: false
}
```

**Status:**
```typescript
{
  name: 'status',
  type: 'select',
  label: 'Status',
  options: [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }
  ]
}
```

**Priority:**
```typescript
{
  name: 'priority',
  type: 'select',
  label: 'Priority',
  options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]
}
```

## Database Schema

### Tasks Table

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tasks Metadata Table

```sql
CREATE TABLE tasks_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  meta_key VARCHAR(255) NOT NULL,
  meta_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### List Tasks

```bash
GET /api/v1/tasks
Authorization: Bearer {API_KEY}
```

**Query Parameters:**
- `search` - Full-text search
- `status` - Filter by status
- `priority` - Filter by priority
- `sort` - Sort by field (e.g., `sort=created_at:desc`)
- `limit` - Results per page
- `offset` - Pagination offset

### Get Single Task

```bash
GET /api/v1/tasks/{id}
Authorization: Bearer {API_KEY}
```

### Create Task

```bash
POST /api/v1/tasks
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "title": "New Task",
  "description": "Task description",
  "status": "pending",
  "priority": "high"
}
```

### Update Task

```bash
PUT /api/v1/tasks/{id}
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "completed"
}
```

### Delete Task

```bash
DELETE /api/v1/tasks/{id}
Authorization: Bearer {API_KEY}
```

## Translations

### English (`messages/en.json`)

```json
{
  "tasks": {
    "title": "Tasks",
    "singular": "Task",
    "fields": {
      "title": "Title",
      "description": "Description",
      "status": "Status",
      "priority": "Priority"
    },
    "status": {
      "pending": "Pending",
      "in_progress": "In Progress",
      "completed": "Completed"
    },
    "priority": {
      "low": "Low",
      "medium": "Medium",
      "high": "High"
    }
  }
}
```

### Spanish (`messages/es.json`)

```json
{
  "tasks": {
    "title": "Tareas",
    "singular": "Tarea",
    "fields": {
      "title": "Título",
      "description": "Descripción",
      "status": "Estado",
      "priority": "Prioridad"
    },
    "status": {
      "pending": "Pendiente",
      "in_progress": "En Progreso",
      "completed": "Completada"
    },
    "priority": {
      "low": "Baja",
      "medium": "Media",
      "high": "Alta"
    }
  }
}
```

## Usage Examples

### In Components

```typescript
import { useTranslations } from 'next-intl'
import { useEntityData } from '@/core/hooks/use-entity-data'

export function TasksList() {
  const t = useTranslations('tasks')
  const { data: tasks, isLoading } = useEntityData('tasks')

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h1>{t('title')}</h1>
      {tasks.map(task => (
        <div key={task.id}>
          <h3>{task.title}</h3>
          <p>{t(`status.${task.status}`)}</p>
        </div>
      ))}
    </div>
  )
}
```

### With Metadata

```typescript
// Add metadata to task
await addMetadata('tasks', taskId, 'custom_field', 'custom_value')

// Get metadata
const metadata = await getMetadata('tasks', taskId, 'custom_field')

// Update metadata
await updateMetadata('tasks', taskId, 'custom_field', 'new_value')

// Delete metadata
await deleteMetadata('tasks', taskId, 'custom_field')
```

## Row Level Security (RLS)

### Policy: Users see only their tasks

```sql
CREATE POLICY "Users can only see their own tasks"
ON tasks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only create their own tasks"
ON tasks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own tasks"
ON tasks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own tasks"
ON tasks FOR DELETE
USING (auth.uid() = user_id);
```

## Dashboard Integration

### Navigation Menu

Tasks automatically appear in:
- **Sidebar** - Full navigation entry
- **Topbar** - Quick access button

### Mobile Navigation

Configured in `app.config.ts`:

```typescript
mobileNav: {
  items: [
    {
      id: 'tasks',
      labelKey: 'common.mobileNav.tasks',
      href: '/dashboard/tasks',
      icon: 'CheckSquare',
      enabled: true,
    }
  ]
}
```

## Customization

### Add Custom Fields

```typescript
// entities/tasks/tasks.fields.ts
{
  name: 'due_date',
  type: 'date',
  label: 'Due Date',
  required: false,
  sortable: true
}
```

### Change Permissions

```typescript
// entities/tasks/tasks.config.ts
permissions: {
  read: ['admin', 'colaborator', 'member'],
  create: ['admin', 'colaborator'],        // Only admin and colaborator
  update: ['admin', 'colaborator'],
  delete: ['admin']                        // Only admin
}
```

### Disable API Access

```typescript
access: {
  public: false,
  api: false,       // Disable API access
  metadata: true,
  shared: false
}
```

## Next Steps

- **[Entity System](/docs/core/entities/introduction)** - Complete entity documentation
- **[API System](/docs/core/api/introduction)** - API reference
- **[Permissions](/docs/core/authentication/permissions-and-roles)** - Permission system
