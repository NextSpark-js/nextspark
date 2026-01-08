---
title: Tasks Management
description: Guide for administrators to manage the tasks entity in the application.
---

# Tasks Management

Tasks are the core entity in this starter theme. This guide covers administrative operations for managing tasks across all users and teams.

## Overview

The tasks entity provides:

- **CRUD Operations**: Create, read, update, and delete tasks
- **Team Scoping**: Tasks are automatically scoped to the user's active team
- **Status Tracking**: Track task progress through customizable statuses
- **Assignment**: Assign tasks to team members

## Entity Configuration

Tasks are configured in the theme's entity definition:

```typescript
// entities/tasks/config.ts
export const tasksConfig = {
  slug: 'tasks',
  names: {
    singular: 'Task',
    plural: 'Tasks'
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'status', type: 'select', options: ['pending', 'in_progress', 'completed'] },
    { name: 'dueDate', type: 'date' },
    { name: 'assignedTo', type: 'relation', target: 'users' }
  ]
}
```

## Admin Operations

### Viewing All Tasks

As a superadmin, you can view tasks across all teams:

1. Navigate to **Superadmin > Dashboard**
2. Access the tasks overview panel
3. Use filters to narrow by team, status, or date range

### Bulk Operations

Perform bulk actions on multiple tasks:

```typescript
// API: Bulk status update
POST /api/v1/tasks/bulk
{
  "ids": ["task-1", "task-2", "task-3"],
  "action": "updateStatus",
  "data": { "status": "completed" }
}
```

### Data Export

Export task data for reporting:

1. Go to **Superadmin > Tasks**
2. Apply desired filters
3. Click **Export** and select format (CSV, JSON)

## Database Schema

The tasks table structure:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | varchar(255) | Task title |
| description | text | Detailed description |
| status | varchar(50) | Current status |
| dueDate | timestamp | Due date (optional) |
| assignedTo | uuid | FK to users table |
| teamId | uuid | FK to teams table |
| createdBy | uuid | FK to users table |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update |

## API Endpoints

### List Tasks (Admin)

```bash
GET /api/v1/tasks?teamId=all
Authorization: Bearer {admin-token}
```

### Get Task Statistics

```bash
GET /api/v1/tasks/stats
Authorization: Bearer {admin-token}
```

Response:

```json
{
  "total": 150,
  "byStatus": {
    "pending": 45,
    "in_progress": 30,
    "completed": 75
  },
  "overdue": 12
}
```

## Permissions

Task-related permissions for team roles:

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| tasks.create | Yes | Yes | Yes | No |
| tasks.read | Yes | Yes | Yes | Yes |
| tasks.update | Yes | Yes | Own | No |
| tasks.delete | Yes | Yes | No | No |

## Customization

### Adding Custom Fields

Extend the tasks entity with custom fields:

1. Update the entity config
2. Create a migration for new columns
3. Update the form schema

### Custom Statuses

Modify available statuses in the entity configuration:

```typescript
{
  name: 'status',
  type: 'select',
  options: [
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'In Review' },
    { value: 'done', label: 'Done' }
  ]
}
```

## Troubleshooting

### Tasks Not Appearing

- Verify the user has `tasks.read` permission
- Check that the team filter is correct
- Ensure RLS policies are properly configured

### Assignment Issues

- Confirm the assignee is a member of the same team
- Verify the `users` relation is properly configured

## Related

- [Entity System](/docs/entities/overview)
- [Permissions](/docs/permissions/overview)
- [API Reference](/docs/api/entities)
