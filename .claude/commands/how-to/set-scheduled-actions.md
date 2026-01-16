# /how-to:set-scheduled-actions

Interactive guide to configure background tasks and scheduled actions in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/scheduled-actions/SKILL.md` - Background task processing patterns

---

## Syntax

```
/how-to:set-scheduled-actions
```

---

## Behavior

Guides the user through creating scheduled actions for background task processing, cron jobs, and webhooks.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Scheduled Actions
        └── How background tasks work

Step 2: Create an Action Handler
        └── Define the task logic

Step 3: Schedule the Action
        └── One-time or recurring

Step 4: Configure Webhooks
        └── External trigger endpoint

Step 5: Monitor and Debug
        └── Logs and execution status
```

---

## Step 1: Understanding Scheduled Actions

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SET SCHEDULED ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Scheduled Actions

Scheduled Actions let you run tasks in the background:

┌─────────────────────────────────────────────┐
│  SCHEDULED ACTIONS SYSTEM                   │
│  ─────────────────────────────────────────  │
│                                             │
│  • One-time tasks (run at specific time)    │
│  • Recurring tasks (cron expressions)       │
│  • Webhook-triggered tasks                  │
│  • Queue-based processing                   │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Architecture:

```
Scheduler
    │
    ├──→ Database Queue (scheduled_actions table)
    │         │
    │         ├── Pending actions
    │         ├── Running actions
    │         └── Completed/Failed actions
    │
    ├──→ Webhook Endpoint (/api/v1/cron)
    │
    └──→ Action Handlers (core/lib/actions/)
              │
              ├── email.handler.ts
              ├── cleanup.handler.ts
              └── custom.handler.ts
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Use Cases:

• Send reminder emails
• Clean up expired data
• Generate reports
• Sync with external services
• Process queued jobs
• Recurring maintenance tasks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Create Handler)
[2] How does the queue work?
[3] Show me the database schema
```

---

## Step 2: Create an Action Handler

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Create an Action Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a handler to define what the action does:

```typescript
// core/lib/actions/handlers/send-reminder-email.handler.ts
import type { ActionHandler, ActionResult } from '@/core/types/actions'
import { z } from 'zod'
import { EmailService } from '@/core/lib/services/email.service'

// Define payload schema
const SendReminderPayloadSchema = z.object({
  userId: z.string().uuid(),
  taskId: z.string().uuid(),
  taskName: z.string(),
  dueDate: z.string().datetime(),
})

type SendReminderPayload = z.infer<typeof SendReminderPayloadSchema>

export const sendReminderEmailHandler: ActionHandler<SendReminderPayload> = {
  // Unique identifier
  type: 'send-reminder-email',

  // Display name for logs
  name: 'Send Reminder Email',

  // Payload validation
  schema: SendReminderPayloadSchema,

  // Execution logic
  async execute(payload, context): Promise<ActionResult> {
    const { userId, taskId, taskName, dueDate } = payload

    try {
      // Get user email
      const user = await UserService.getById(userId)
      if (!user?.email) {
        return {
          success: false,
          error: 'User not found or no email',
        }
      }

      // Send the email
      await EmailService.send({
        to: user.email,
        template: 'task-reminder',
        data: {
          userName: user.name,
          taskName,
          dueDate: new Date(dueDate).toLocaleDateString(),
          taskUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tasks/${taskId}`,
        },
      })

      return {
        success: true,
        message: `Reminder sent to ${user.email}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,  // Allow retry on failure
      }
    }
  },

  // Optional: Retry configuration
  retry: {
    maxAttempts: 3,
    backoffMs: 5000,  // 5 seconds between retries
  },
}

export default sendReminderEmailHandler
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Handler Structure:

• type: Unique identifier for the action
• name: Human-readable name
• schema: Zod schema for payload validation
• execute: Async function with the logic
• retry: Optional retry configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2️⃣  Register the handler:

```typescript
// core/lib/actions/registry.ts
import { sendReminderEmailHandler } from './handlers/send-reminder-email.handler'

export const ACTION_HANDLERS = {
  'send-reminder-email': sendReminderEmailHandler,
  // ... other handlers
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Schedule Action)
[2] Show me more handler examples
[3] How do I handle errors?
```

---

## Step 3: Schedule the Action

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Schedule the Action
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Schedule actions programmatically:

```typescript
// core/lib/services/scheduled-action.service.ts
import { ScheduledActionService } from '@/core/lib/services/scheduled-action.service'

// 1. Schedule a one-time action
await ScheduledActionService.schedule({
  type: 'send-reminder-email',
  payload: {
    userId: 'user-123',
    taskId: 'task-456',
    taskName: 'Complete project proposal',
    dueDate: '2024-01-15T09:00:00Z',
  },
  scheduledFor: new Date('2024-01-14T09:00:00Z'),  // 1 day before
  teamId: 'team-789',  // For team context
})

// 2. Schedule a recurring action (cron)
await ScheduledActionService.scheduleRecurring({
  type: 'cleanup-expired-sessions',
  payload: {},
  cron: '0 2 * * *',  // Every day at 2 AM
  name: 'Daily Session Cleanup',
})

// 3. Schedule relative to an event
await ScheduledActionService.scheduleRelative({
  type: 'send-follow-up',
  payload: { invoiceId: 'inv-123' },
  delayMs: 7 * 24 * 60 * 60 * 1000,  // 7 days from now
})
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Cron Expression Examples:

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-6, Sunday=0)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)

Common patterns:
• '0 * * * *'     - Every hour
• '0 0 * * *'     - Every day at midnight
• '0 9 * * 1'     - Every Monday at 9 AM
• '0 0 1 * *'     - First day of month
• '*/15 * * * *'  - Every 15 minutes
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 In Your Code (e.g., when creating a task):

```typescript
// app/api/v1/entities/tasks/route.ts
export async function POST(request: NextRequest) {
  // ... create task ...

  // Schedule reminder if task has due date
  if (task.dueDate && task.assignedTo) {
    const reminderDate = new Date(task.dueDate)
    reminderDate.setDate(reminderDate.getDate() - 1)  // 1 day before

    await ScheduledActionService.schedule({
      type: 'send-reminder-email',
      payload: {
        userId: task.assignedTo,
        taskId: task.id,
        taskName: task.name,
        dueDate: task.dueDate,
      },
      scheduledFor: reminderDate,
      teamId,
    })
  }

  return Response.json({ success: true, data: task })
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Webhooks)
[2] How do I cancel a scheduled action?
[3] Show me the database schema
```

---

## Step 4: Configure Webhooks

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Configure Webhooks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The cron endpoint processes scheduled actions:

```typescript
// app/api/v1/cron/route.ts
import { processScheduledActions } from '@/core/lib/actions/processor'
import { verifyCronSecret } from '@/core/lib/auth/cron'

export async function POST(request: NextRequest) {
  // Verify the request is from authorized source
  const authHeader = request.headers.get('authorization')
  if (!verifyCronSecret(authHeader)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Process pending actions
  const result = await processScheduledActions({
    maxActions: 100,  // Process up to 100 actions per call
    timeout: 55000,   // 55 second timeout (for 60s cron)
  })

  return Response.json({
    success: true,
    processed: result.processed,
    failed: result.failed,
    remaining: result.remaining,
  })
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configure External Cron Service:

**Option 1: Vercel Cron Jobs**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/v1/cron",
      "schedule": "* * * * *"
    }
  ]
}
```

**Option 2: External Cron Service (cron-job.org)**

URL: `https://your-domain.com/api/v1/cron`
Method: POST
Headers: `Authorization: Bearer YOUR_CRON_SECRET`
Schedule: Every minute

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Environment Variables:

```env
# .env
CRON_SECRET=your-secure-random-string
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Manual Trigger (development):

```bash
curl -X POST http://localhost:3000/api/v1/cron \
  -H "Authorization: Bearer your-cron-secret"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Monitor)
[2] How do I secure the webhook?
[3] Show me Vercel cron setup
```

---

## Step 5: Monitor and Debug

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Monitor and Debug
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 View Action Status:

```typescript
// Get scheduled actions for a team
const actions = await ScheduledActionService.list({
  teamId: 'team-123',
  status: 'pending',  // pending | running | completed | failed
  type: 'send-reminder-email',  // optional filter
})

// Get action by ID
const action = await ScheduledActionService.getById('action-123')
console.log(action.status)     // 'completed'
console.log(action.result)     // { success: true, message: '...' }
console.log(action.executedAt) // '2024-01-14T09:00:15Z'
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Action Statuses:

• pending   - Waiting to be executed
• running   - Currently executing
• completed - Successfully finished
• failed    - Execution failed
• cancelled - Manually cancelled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Dashboard Integration:

Access the scheduled actions dashboard:
`/superadmin/scheduled-actions`

Features:
• View all scheduled actions
• Filter by status, type, team
• Manually retry failed actions
• Cancel pending actions
• View execution logs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Debug Logging:

```typescript
// In your handler
export const myHandler: ActionHandler = {
  async execute(payload, context) {
    // Access logger from context
    context.log.info('Starting action', { payload })

    try {
      // ... logic ...
      context.log.info('Action completed', { result })
      return { success: true }
    } catch (error) {
      context.log.error('Action failed', { error })
      return { success: false, error: error.message }
    }
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• How scheduled actions work
• Creating action handlers
• Scheduling one-time and recurring tasks
• Webhook configuration
• Monitoring and debugging

📚 Related tutorials:
   • /how-to:create-api - Custom API endpoints
   • /how-to:create-plugin - Add actions in plugins

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:create-api` | Custom API endpoints |
| `/how-to:create-plugin` | Plugin with scheduled actions |
