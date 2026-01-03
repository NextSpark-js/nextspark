# Metadata in APIs

**Metadata system integration • User preferences • Feature flags • Tenant settings • Performance**

---

## Table of Contents

- [Overview](#overview)
- [What is Metadata](#what-is-metadata)
- [Requesting Metadata](#requesting-metadata)
- [Metadata Merge Strategies](#metadata-merge-strategies)
- [Updating Metadata](#updating-metadata)
- [Use Cases](#use-cases)
- [Performance Considerations](#performance-considerations)
- [Security and Access Control](#security-and-access-control)
- [Client Examples](#client-examples)

---

## Overview

The API v1 includes a **powerful metadata system** that allows you to:

- **Store arbitrary JSON data** alongside any entity
- **Merge metadata from multiple sources** (global, tenant, user, entity)
- **Update metadata via API** without schema changes
- **Use metadata for feature flags**, user preferences, tenant settings, and more

**Key Benefits:**
- ✅ **No database migrations** needed for new metadata fields
- ✅ **Flexible JSON storage** for any data structure
- ✅ **Multi-level merging** (global → tenant → user → entity)
- ✅ **Type-safe TypeScript** integration
- ✅ **Zero performance impact** on regular API operations

---

## What is Metadata

Metadata is **structured JSON data** stored alongside entities that can be used for:

**Configuration:**
- Feature flags (`features.darkMode: true`)
- User preferences (`ui.theme: 'dark'`)
- Tenant settings (`billing.plan: 'enterprise'`)

**Customization:**
- UI customization (`branding.primaryColor: '#ff0000'`)
- Workflow settings (`notifications.email: true`)
- Business rules (`limits.maxUsers: 100`)

**Analytics:**
- User tracking (`analytics.lastLogin: '2025-01-15'`)
- Usage metrics (`metrics.apiCalls: 1000`)
- Custom dimensions (`dimensions.region: 'us-east-1'`)

**Example Metadata:**
```json
{
  "features": {
    "darkMode": true,
    "betaAccess": true,
    "aiAssistant": false
  },
  "ui": {
    "theme": "dark",
    "language": "en",
    "sidebarCollapsed": false
  },
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  },
  "billing": {
    "plan": "pro",
    "seats": 5,
    "addons": ["ai", "analytics"]
  }
}
```

---

## Requesting Metadata

Metadata can be requested in API responses using query parameters.

### Include Metadata in Response

```typescript
GET /api/v1/{entity}?includeMetadata=true
```

**Example Request:**
```bash
curl "https://yourdomain.com/api/v1/tasks?includeMetadata=true" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tsk_abc123",
      "title": "Complete API documentation",
      "status": "in_progress",
      "metadata": {
        "priority": "high",
        "labels": ["documentation", "api"],
        "customFields": {
          "estimatedHours": 8,
          "assignedTeam": "engineering"
        }
      }
    }
  ]
}
```

### Request Specific Metadata Fields

```typescript
GET /api/v1/{entity}?metadataFields=features,ui
```

**Example:**
```bash
curl "https://yourdomain.com/api/v1/tasks/tsk_abc123?metadataFields=priority,labels" \
  -H "Authorization: Bearer sk_live_abc123..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tsk_abc123",
    "title": "Complete API documentation",
    "status": "in_progress",
    "metadata": {
      "priority": "high",
      "labels": ["documentation", "api"]
    }
  }
}
```

### Default Behavior

**By default, metadata is NOT included** in API responses to optimize performance.

```typescript
// No metadata in response
GET /api/v1/tasks

// Metadata included
GET /api/v1/tasks?includeMetadata=true
```

---

## Metadata Merge Strategies

The metadata system supports **multi-level merging** from different sources.

### Merge Priority (Low to High)

```text
1. Global defaults (lowest priority)
   ↓
2. Tenant-level settings
   ↓
3. User-level preferences
   ↓
4. Entity-level metadata (highest priority)
```

**Later values override earlier values** during merge.

### Example: Feature Flags

**Global defaults:**
```json
{
  "features": {
    "darkMode": false,
    "betaAccess": false,
    "aiAssistant": false
  }
}
```

**Tenant settings:**
```json
{
  "features": {
    "betaAccess": true  // Override global default
  }
}
```

**User preferences:**
```json
{
  "features": {
    "darkMode": true  // Override global default
  }
}
```

**Final merged metadata:**
```json
{
  "features": {
    "darkMode": true,       // From user
    "betaAccess": true,     // From tenant
    "aiAssistant": false    // From global defaults
  }
}
```

### API Response with Merged Metadata

```bash
GET /api/v1/users/usr_abc123?includeMetadata=true&mergeMetadata=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "metadata": {
      "features": {
        "darkMode": true,      // User preference
        "betaAccess": true,    // Tenant setting
        "aiAssistant": false   // Global default
      }
    }
  }
}
```

### Merge Strategies

**Deep Merge (default):**
```json
// Source 1
{
  "ui": {
    "theme": "dark",
    "language": "en"
  }
}

// Source 2
{
  "ui": {
    "language": "es",
    "fontSize": 14
  }
}

// Merged result (deep merge)
{
  "ui": {
    "theme": "dark",      // From source 1
    "language": "es",     // From source 2 (override)
    "fontSize": 14        // From source 2
  }
}
```

**Shallow Merge:**
```json
// Source 1
{
  "ui": {
    "theme": "dark",
    "language": "en"
  }
}

// Source 2
{
  "ui": {
    "language": "es",
    "fontSize": 14
  }
}

// Merged result (shallow merge)
{
  "ui": {
    "language": "es",     // Entire ui object replaced
    "fontSize": 14
  }
}
```

**Specify merge strategy:**
```bash
GET /api/v1/users/usr_abc123?includeMetadata=true&mergeStrategy=deep
GET /api/v1/users/usr_abc123?includeMetadata=true&mergeStrategy=shallow
```

---

## Updating Metadata

Metadata can be updated via PATCH requests.

### Update Entity Metadata

```http
PATCH /api/v1/{entity}/{id}
```

**Request Body:**
```json
{
  "metadata": {
    "priority": "high",
    "labels": ["urgent", "bug"],
    "customFields": {
      "severity": "critical",
      "reportedBy": "john@example.com"
    }
  }
}
```

**Example:**
```bash
curl -X PATCH "https://yourdomain.com/api/v1/tasks/tsk_abc123" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "priority": "critical",
      "labels": ["urgent", "security"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tsk_abc123",
    "title": "Fix security vulnerability",
    "status": "in_progress",
    "metadata": {
      "priority": "critical",
      "labels": ["urgent", "security"],
      "customFields": {
        "severity": "critical",
        "reportedBy": "john@example.com"
      }
    }
  }
}
```

### Partial Metadata Update

**Merge with existing metadata:**
```bash
curl -X PATCH "https://yourdomain.com/api/v1/tasks/tsk_abc123" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "labels": ["documentation"]
    }
  }'
```

**Result:**
- Existing metadata fields are preserved
- New fields are added
- Overlapping fields are updated

### Replace Entire Metadata

**Replace all metadata:**
```bash
curl -X PATCH "https://yourdomain.com/api/v1/tasks/tsk_abc123?replaceMetadata=true" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "priority": "low"
    }
  }'
```

**Result:**
- All existing metadata is removed
- Only new metadata is stored

### Delete Metadata Fields

**Set field to null:**
```bash
curl -X PATCH "https://yourdomain.com/api/v1/tasks/tsk_abc123" \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "priority": null,
      "labels": null
    }
  }'
```

**Result:**
- `priority` and `labels` fields are removed from metadata

---

## Use Cases

### 1. User Preferences

**Store user preferences:**
```bash
PATCH /api/v1/users/usr_abc123
{
  "metadata": {
    "preferences": {
      "theme": "dark",
      "language": "en",
      "notifications": {
        "email": true,
        "push": false
      },
      "ui": {
        "sidebarCollapsed": false,
        "fontSize": 14,
        "compactMode": false
      }
    }
  }
}
```

**Retrieve preferences:**
```bash
GET /api/v1/users/usr_abc123?metadataFields=preferences
```

**Client integration:**
```typescript
import { useQuery } from '@tanstack/react-query'

function useUserPreferences() {
  return useQuery({
    queryKey: ['user', 'preferences'],
    queryFn: async () => {
      const response = await fetch(
        'https://yourdomain.com/api/v1/users/me?metadataFields=preferences',
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      )
      const data = await response.json()
      return data.data.metadata?.preferences
    }
  })
}

// Usage in component
function App() {
  const { data: preferences } = useUserPreferences()

  return (
    <div className={preferences?.theme === 'dark' ? 'dark' : 'light'}>
      {/* App content */}
    </div>
  )
}
```

---

### 2. Feature Flags

**Enable beta features for specific tenants:**
```bash
PATCH /api/v1/tenants/tenant_abc123
{
  "metadata": {
    "features": {
      "aiAssistant": true,
      "advancedAnalytics": true,
      "customBranding": true
    }
  }
}
```

**Check feature availability:**
```bash
GET /api/v1/tenants/tenant_abc123?metadataFields=features
```

**Client-side feature flags:**
```typescript
import { useQuery } from '@tanstack/react-query'

function useFeatureFlags() {
  return useQuery({
    queryKey: ['tenant', 'features'],
    queryFn: async () => {
      const response = await fetch(
        'https://yourdomain.com/api/v1/tenants/me?metadataFields=features',
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      )
      const data = await response.json()
      return data.data.metadata?.features || {}
    }
  })
}

// Usage
function Dashboard() {
  const { data: features } = useFeatureFlags()

  return (
    <div>
      {features?.aiAssistant && <AIAssistantButton />}
      {features?.advancedAnalytics && <AnalyticsDashboard />}
    </div>
  )
}
```

---

### 3. Tenant Settings

**Configure tenant-specific settings:**
```bash
PATCH /api/v1/tenants/tenant_abc123
{
  "metadata": {
    "billing": {
      "plan": "enterprise",
      "seats": 50,
      "addons": ["ai", "analytics", "custom-domains"]
    },
    "branding": {
      "primaryColor": "#ff0000",
      "logo": "https://example.com/logo.png",
      "companyName": "Acme Corp"
    },
    "limits": {
      "maxUsers": 50,
      "maxProjects": 100,
      "maxStorage": 10737418240  // 10GB in bytes
    }
  }
}
```

**Retrieve tenant settings:**
```bash
GET /api/v1/tenants/tenant_abc123?includeMetadata=true
```

**Server-side validation:**
```typescript
import { TENANT_METADATA } from '@/core/lib/metadata'

export async function createUser(tenantId: string, userData: any) {
  const tenant = await getTenant(tenantId)
  const limits = tenant.metadata?.limits || {}

  const currentUsers = await countUsers(tenantId)

  if (currentUsers >= limits.maxUsers) {
    throw new Error(`User limit reached (${limits.maxUsers})`)
  }

  // Create user...
}
```

---

### 4. Custom Workflow Data

**Store custom workflow state:**
```bash
PATCH /api/v1/tasks/tsk_abc123
{
  "metadata": {
    "workflow": {
      "currentStage": "review",
      "stages": ["draft", "review", "approved", "published"],
      "approvers": ["usr_xyz789", "usr_abc456"],
      "approvals": [
        {
          "userId": "usr_xyz789",
          "approved": true,
          "timestamp": "2025-01-15T10:30:00Z"
        }
      ]
    }
  }
}
```

**Query tasks by workflow stage:**
```bash
GET /api/v1/tasks?filter={"metadata.workflow.currentStage":"review"}
```

---

### 5. Analytics and Tracking

**Track user activity:**
```bash
PATCH /api/v1/users/usr_abc123
{
  "metadata": {
    "analytics": {
      "lastLogin": "2025-01-15T10:30:00Z",
      "loginCount": 42,
      "featuresUsed": ["tasks", "calendar", "reports"],
      "onboardingCompleted": true
    }
  }
}
```

**Retrieve analytics:**
```bash
GET /api/v1/users?metadataFields=analytics&sort=metadata.analytics.lastLogin&order=desc
```

---

## Performance Considerations

### Metadata Indexing

**Indexed metadata fields** (fast queries):
```json
{
  "metadata": {
    "priority": "high",        // Indexed (BTREE)
    "status": "active",        // Indexed (BTREE)
    "createdAt": "2025-01-15"  // Indexed (BTREE)
  }
}
```

**Non-indexed metadata fields** (slower queries):
```json
{
  "metadata": {
    "customData": {
      "field1": "value1",      // Not indexed (slow)
      "field2": "value2"       // Not indexed (slow)
    }
  }
}
```

**Create indexes for frequently queried metadata:**
```sql
-- PostgreSQL
CREATE INDEX idx_tasks_metadata_priority
ON tasks ((metadata->>'priority'));

CREATE INDEX idx_tasks_metadata_status
ON tasks ((metadata->>'status'));
```

### Response Size Optimization

**Without metadata:**
```bash
GET /api/v1/tasks?limit=100
# Response: ~50KB
```

**With full metadata:**
```bash
GET /api/v1/tasks?limit=100&includeMetadata=true
# Response: ~150KB (3x larger!)
```

**With specific metadata fields:**
```bash
GET /api/v1/tasks?limit=100&metadataFields=priority,labels
# Response: ~75KB (1.5x larger)
```

**✅ Best Practice:** Request only needed metadata fields.

### Caching

**Metadata is cached separately:**
```typescript
// Cache entity data (long TTL)
const entityCache = {
  key: 'entity:tsk_abc123',
  ttl: 3600  // 1 hour
}

// Cache metadata (short TTL, can change frequently)
const metadataCache = {
  key: 'metadata:tsk_abc123',
  ttl: 300   // 5 minutes
}
```

**Client-side caching:**
```typescript
import { useQuery } from '@tanstack/react-query'

function useTask(taskId: string) {
  // Entity data (long cache)
  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTask(taskId),
    staleTime: 3600000  // 1 hour
  })

  // Metadata (short cache)
  const { data: metadata } = useQuery({
    queryKey: ['task', taskId, 'metadata'],
    queryFn: () => fetchTaskMetadata(taskId),
    staleTime: 300000  // 5 minutes
  })

  return { task, metadata }
}
```

---

## Security and Access Control

### Metadata Visibility

**Public metadata** (visible to all users):
```json
{
  "metadata": {
    "public": {
      "displayName": "Acme Corp",
      "website": "https://acme.com"
    }
  }
}
```

**Private metadata** (only visible to authorized users):
```json
{
  "metadata": {
    "private": {
      "apiKey": "sk_live_abc123...",
      "secretToken": "secret123"
    }
  }
}
```

**Role-based access:**
```typescript
export async function getTaskMetadata(taskId: string, userId: string) {
  const task = await getTask(taskId)
  const user = await getUser(userId)

  // Admin: Full metadata access
  if (user.role === 'admin') {
    return task.metadata
  }

  // Owner: Access to private metadata
  if (task.userId === userId) {
    return task.metadata
  }

  // Other users: Only public metadata
  return task.metadata?.public || {}
}
```

### Metadata Validation

**Schema validation:**
```typescript
import { z } from 'zod'

const taskMetadataSchema = z.object({
  priority: z.enum(['low', 'medium', 'high']).optional(),
  labels: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional()
})

export async function updateTaskMetadata(
  taskId: string,
  metadata: unknown
) {
  // Validate metadata schema
  const validatedMetadata = taskMetadataSchema.parse(metadata)

  // Update task
  await updateTask(taskId, { metadata: validatedMetadata })
}
```

**Prevent malicious metadata:**
```typescript
export function sanitizeMetadata(metadata: Record<string, any>) {
  // Remove dangerous fields
  const { __proto__, constructor, ...safe } = metadata

  // Limit metadata size
  const jsonString = JSON.stringify(safe)
  if (jsonString.length > 10000) {
    throw new Error('Metadata too large (max 10KB)')
  }

  return safe
}
```

---

## Client Examples

### JavaScript (Fetch API)

```typescript
// Get entity with metadata
async function getTaskWithMetadata(taskId: string) {
  const response = await fetch(
    `https://yourdomain.com/api/v1/tasks/${taskId}?includeMetadata=true`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  )
  return response.json()
}

// Update metadata
async function updateTaskMetadata(
  taskId: string,
  metadata: Record<string, any>
) {
  const response = await fetch(
    `https://yourdomain.com/api/v1/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ metadata })
    }
  )
  return response.json()
}

// Usage
const task = await getTaskWithMetadata('tsk_abc123')
console.log(task.data.metadata.priority)  // "high"

await updateTaskMetadata('tsk_abc123', {
  priority: 'critical',
  labels: ['urgent']
})
```

### React (TanStack Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Fetch entity with metadata
function useTaskWithMetadata(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId, 'metadata'],
    queryFn: async () => {
      const response = await fetch(
        `https://yourdomain.com/api/v1/tasks/${taskId}?includeMetadata=true`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      )
      return response.json()
    }
  })
}

// Update metadata mutation
function useUpdateTaskMetadata(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (metadata: Record<string, any>) => {
      const response = await fetch(
        `https://yourdomain.com/api/v1/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ metadata })
        }
      )
      return response.json()
    },
    onSuccess: () => {
      // Invalidate cache to refetch
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    }
  })
}

// Usage in component
function TaskDetails({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskWithMetadata(taskId)
  const updateMetadata = useUpdateTaskMetadata(taskId)

  if (isLoading) return <div>Loading...</div>

  const task = data.data
  const metadata = task.metadata || {}

  const handlePriorityChange = (priority: string) => {
    updateMetadata.mutate({
      ...metadata,
      priority
    })
  }

  return (
    <div>
      <h1>{task.title}</h1>
      <select
        value={metadata.priority || 'medium'}
        onChange={(e) => handlePriorityChange(e.target.value)}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  )
}
```

---

## Next Steps

- [Rate Limiting](./07-rate-limiting.md) - API rate limiting documentation
- [Query Parameters](./05-query-parameters.md) - Advanced filtering and pagination
- [Best Practices](./11-best-practices.md) - API best practices guide
- [Authentication](./02-authentication.md) - API authentication

**Documentation:** `core/docs/05-api/06-metadata-in-apis.md`
