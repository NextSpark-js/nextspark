# Entity Server Actions - Usage Guide

How to use Server Actions from entities defined in a theme.

## Overview

Server Actions allow Client Components to perform CRUD operations without going through HTTP API. Auth is obtained automatically from the server session.

## Import

```typescript
import {
  createEntity,
  updateEntity,
  deleteEntity,
  deleteEntities,
  getEntity,
  listEntities,
  entityExists,
  countEntities,
} from '@nextsparkjs/core/actions'
```

## Example: Leads Entity (CRM Theme)

Given the entity `leads` defined in `themes/crm/entities/leads/`:

### 1. Create a Lead

```typescript
'use client'

import { createEntity } from '@nextsparkjs/core/actions'
import { toast } from 'sonner'

export function CreateLeadForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createEntity('leads', {
      name: formData.get('name'),
      email: formData.get('email'),
      company: formData.get('company'),
      status: 'new',
      source: 'website',
    })

    if (result.success) {
      toast.success('Lead created successfully')
      // result.data contains the created lead with id
    } else {
      toast.error(result.error)
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="company" placeholder="Company" />
      <button type="submit">Create Lead</button>
    </form>
  )
}
```

### 2. Update a Lead

```typescript
'use client'

import { updateEntity } from '@nextsparkjs/core/actions'

interface UpdateLeadButtonProps {
  leadId: string
  newStatus: string
}

export function UpdateLeadStatus({ leadId, newStatus }: UpdateLeadButtonProps) {
  async function handleUpdate() {
    const result = await updateEntity('leads', leadId, {
      status: newStatus,
    }, {
      // Optional: revalidate cache after update
      revalidatePaths: ['/dashboard/leads'],
      revalidateTags: ['leads-list'],
    })

    if (!result.success) {
      console.error('Failed to update:', result.error)
    }
  }

  return <button onClick={handleUpdate}>Mark as {newStatus}</button>
}
```

### 3. Delete a Lead

```typescript
'use client'

import { deleteEntity } from '@nextsparkjs/core/actions'

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  async function handleDelete() {
    if (!confirm('Are you sure?')) return

    const result = await deleteEntity('leads', leadId, {
      // Optional: redirect after successful delete
      redirectTo: '/dashboard/leads',
    })

    // Note: if redirectTo is set, this code won't execute
    // because redirect() throws in Next.js
    if (!result.success) {
      alert(result.error)
    }
  }

  return <button onClick={handleDelete}>Delete</button>
}
```

### 4. Batch Delete Leads

```typescript
'use client'

import { deleteEntities } from '@nextsparkjs/core/actions'

export function BulkDeleteButton({ selectedIds }: { selectedIds: string[] }) {
  async function handleBulkDelete() {
    const result = await deleteEntities('leads', selectedIds)

    if (result.success) {
      console.log(`Deleted ${result.data.deletedCount} leads`)
    }
  }

  return (
    <button onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
      Delete Selected ({selectedIds.length})
    </button>
  )
}
```

### 5. Get a Single Lead

```typescript
'use client'

import { getEntity } from '@nextsparkjs/core/actions'
import { useEffect, useState } from 'react'

interface Lead {
  id: string
  name: string
  email: string
  status: string
}

export function LeadDetail({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<Lead | null>(null)

  useEffect(() => {
    async function fetchLead() {
      const result = await getEntity<Lead>('leads', leadId)
      if (result.success) {
        setLead(result.data)
      }
    }
    fetchLead()
  }, [leadId])

  if (!lead) return <div>Loading...</div>

  return (
    <div>
      <h1>{lead.name}</h1>
      <p>{lead.email}</p>
      <span>Status: {lead.status}</span>
    </div>
  )
}
```

### 6. List Leads with Filters

```typescript
'use client'

import { listEntities } from '@nextsparkjs/core/actions'
import { useEffect, useState } from 'react'

interface Lead {
  id: string
  name: string
  status: string
}

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function fetchLeads() {
      const result = await listEntities<Lead>('leads', {
        where: { status: 'new' },
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 20,
        offset: 0,
      })

      if (result.success) {
        setLeads(result.data.data)
        setTotal(result.data.total)
      }
    }
    fetchLeads()
  }, [])

  return (
    <div>
      <h2>New Leads ({total})</h2>
      <ul>
        {leads.map(lead => (
          <li key={lead.id}>{lead.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 7. Check if Lead Exists

```typescript
'use client'

import { entityExists } from '@nextsparkjs/core/actions'

export async function checkLeadExists(leadId: string): Promise<boolean> {
  const result = await entityExists('leads', leadId)
  return result.success && result.data === true
}
```

### 8. Count Leads

```typescript
'use client'

import { countEntities } from '@nextsparkjs/core/actions'
import { useEffect, useState } from 'react'

export function LeadStats() {
  const [counts, setCounts] = useState({ new: 0, qualified: 0, converted: 0 })

  useEffect(() => {
    async function fetchCounts() {
      const [newResult, qualifiedResult, convertedResult] = await Promise.all([
        countEntities('leads', { status: 'new' }),
        countEntities('leads', { status: 'qualified' }),
        countEntities('leads', { status: 'converted' }),
      ])

      setCounts({
        new: newResult.success ? newResult.data : 0,
        qualified: qualifiedResult.success ? qualifiedResult.data : 0,
        converted: convertedResult.success ? convertedResult.data : 0,
      })
    }
    fetchCounts()
  }, [])

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>New: {counts.new}</div>
      <div>Qualified: {counts.qualified}</div>
      <div>Converted: {counts.converted}</div>
    </div>
  )
}
```

## Type Safety

Define your entity type for better TypeScript support:

```typescript
// types/leads.ts
export interface Lead {
  id: string
  name: string
  email: string
  company?: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  source: string
  createdAt: string
  updatedAt: string
}

// Usage with generics
const result = await getEntity<Lead>('leads', id)
if (result.success) {
  const lead: Lead = result.data  // Fully typed
}
```

## Security Notes

1. **Auth is automatic**: `userId` comes from server session, `teamId` from httpOnly cookie
2. **Permissions checked**: Each action validates against `permissions.config.ts`
3. **Team isolation**: Users can only access entities from their active team
4. **Never pass userId/teamId**: These are obtained server-side, not from client

## When to Use Server Actions vs API

| Use Case | Server Actions | API HTTP |
|----------|----------------|----------|
| Client Component mutations | ✅ | ❌ |
| Form submissions | ✅ | ❌ |
| Real-time UI updates | ✅ | ❌ |
| External integrations | ❌ | ✅ |
| Webhooks | ❌ | ✅ |
| Mobile apps | ❌ | ✅ |

## Common Patterns

### Optimistic Updates

```typescript
'use client'

import { updateEntity } from '@nextsparkjs/core/actions'
import { useState } from 'react'

export function LeadStatusToggle({ lead }: { lead: Lead }) {
  const [optimisticStatus, setOptimisticStatus] = useState(lead.status)

  async function toggleStatus() {
    const newStatus = optimisticStatus === 'new' ? 'contacted' : 'new'

    // Optimistic update
    setOptimisticStatus(newStatus)

    const result = await updateEntity('leads', lead.id, { status: newStatus })

    if (!result.success) {
      // Rollback on error
      setOptimisticStatus(lead.status)
    }
  }

  return (
    <button onClick={toggleStatus}>
      Status: {optimisticStatus}
    </button>
  )
}
```

### With React Hook Form

```typescript
'use client'

import { createEntity } from '@nextsparkjs/core/actions'
import { useForm } from 'react-hook-form'

interface LeadFormData {
  name: string
  email: string
  company?: string
}

export function CreateLeadFormRHF() {
  const { register, handleSubmit, reset } = useForm<LeadFormData>()

  async function onSubmit(data: LeadFormData) {
    const result = await createEntity('leads', {
      ...data,
      status: 'new',
    })

    if (result.success) {
      reset()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: true })} />
      <input {...register('email', { required: true })} type="email" />
      <input {...register('company')} />
      <button type="submit">Create</button>
    </form>
  )
}
```
