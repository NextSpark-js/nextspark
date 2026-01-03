# Background Jobs

## Introduction

Background jobs enable asynchronous task processing outside the request/response cycle. This is essential for long-running operations, scheduled tasks, and resource-intensive processing that shouldn't block user requests.

## Use Cases

**Common Background Job Scenarios:**
- Email sending (verification, notifications, newsletters)
- Image processing and optimization
- Data export generation (CSV, PDF reports)
- Batch operations (bulk updates, imports)
- Scheduled cleanup tasks
- External API synchronization
- Analytics processing
- Webhook delivery

---

## Implementation Patterns

### Pattern 1: Next.js API Routes (Simple Tasks)

For simple async operations without complex scheduling:

```typescript
// app/api/jobs/send-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/core/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html } = await request.json();

    // Process async (fire and forget)
    emailService.send({ to, subject, html })
      .catch(error => console.error('Email send error:', error));

    // Respond immediately
    return NextResponse.json({
      success: true,
      message: 'Email queued for sending'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to queue email' },
      { status: 500 }
    );
  }
}
```

**Pros:**
- Simple implementation
- No additional dependencies
- Works with existing infrastructure

**Cons:**
- No retry mechanism
- No job tracking
- Limited to API route timeout
- No scheduling support

### Pattern 2: Vercel Cron Jobs

For scheduled tasks on Vercel platform:

**Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-cleanup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/hourly-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Implementation:**
```typescript
// app/api/cron/daily-cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Cleanup old sessions
    await cleanupExpiredSessions();

    // Delete old logs
    await deleteOldAuditLogs();

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed'
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
```

**Schedule Syntax:**
```text
┌────────── minute (0 - 59)
│ ┌──────── hour (0 - 23)
│ │ ┌────── day of month (1 - 31)
│ │ │ ┌──── month (1 - 12)
│ │ │ │ ┌── day of week (0 - 6)
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9 AM
- `*/15 * * * *` - Every 15 minutes

### Pattern 3: External Job Queue (BullMQ/Inngest)

For complex job processing with retries and monitoring:

**Installation:**
```bash
pnpm add bullmq ioredis
```

**Queue Setup:**
```typescript
// core/lib/jobs/queue.ts
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Email queue
export const emailQueue = new Queue('email', { connection });

// Process emails
const emailWorker = new Worker(
  'email',
  async (job) => {
    const { to, subject, html } = job.data;

    await emailService.send({ to, subject, html });

    return { sent: true, timestamp: new Date() };
  },
  {
    connection,
    concurrency: 5, // Process 5 emails concurrently
  }
);

// Event listeners
emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, error) => {
  console.error(`Email job ${job?.id} failed:`, error);
});
```

**Adding Jobs:**
```typescript
// Add job to queue
await emailQueue.add(
  'verification-email',
  {
    to: 'user@example.com',
    subject: 'Verify your email',
    html: emailTemplate
  },
  {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000 // Start with 5s delay
    }
  }
);
```

**Scheduled Jobs:**
```typescript
// Add recurring job
await emailQueue.add(
  'weekly-newsletter',
  { template: 'newsletter' },
  {
    repeat: {
      pattern: '0 9 * * 1' // Every Monday at 9 AM
    }
  }
);
```

---

## Job Patterns

### Email Sending

```typescript
// core/lib/jobs/email-jobs.ts
import { emailQueue } from './queue';
import { emailTemplates } from '@/core/lib/email';

export class EmailJobs {
  static async sendVerificationEmail(userId: string, email: string, verificationUrl: string) {
    const template = emailTemplates.verifyEmail({
      userName: email,
      verificationUrl,
      appName: 'Your App'
    });

    await emailQueue.add(
      'verification-email',
      {
        to: email,
        subject: template.subject,
        html: template.html
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    );
  }

  static async sendBulkEmails(recipients: Array<{ email: string; data: any }>) {
    const jobs = recipients.map(({ email, data }) => ({
      name: 'bulk-email',
      data: {
        to: email,
        subject: data.subject,
        html: data.html
      },
      opts: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 }
      }
    }));

    await emailQueue.addBulk(jobs);
  }
}
```

### Data Export

```typescript
// core/lib/jobs/export-jobs.ts
import { exportQueue } from './queue';

export class ExportJobs {
  static async exportUserData(userId: string, format: 'csv' | 'json' | 'pdf') {
    await exportQueue.add(
      'user-data-export',
      {
        userId,
        format,
        timestamp: new Date()
      },
      {
        attempts: 2,
        timeout: 300000, // 5 minutes
        removeOnComplete: 100,
        removeOnFail: 50
      }
    );

    return { queued: true };
  }
}

// Worker
const exportWorker = new Worker(
  'export',
  async (job) => {
    const { userId, format } = job.data;

    // Fetch data
    const userData = await fetchUserData(userId);

    // Generate export
    const file = await generateExport(userData, format);

    // Upload to storage
    const url = await uploadToS3(file, `exports/${userId}.${format}`);

    // Notify user
    await EmailJobs.sendEmail(
      userId,
      'Your export is ready',
      `Download: ${url}`
    );

    return { url, size: file.size };
  },
  { connection }
);
```

### Cleanup Tasks

```typescript
// core/lib/jobs/cleanup-jobs.ts
export class CleanupJobs {
  static async cleanupExpiredSessions() {
    const result = await mutateWithRLS(
      `DELETE FROM session
       WHERE "expiresAt" < CURRENT_TIMESTAMP`,
      [],
      'system'
    );

    return { deleted: result.rowCount };
  }

  static async deleteOldAuditLogs(retentionDays = 90) {
    const result = await mutateWithRLS(
      `DELETE FROM api_audit_logs
       WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'`,
      [],
      'system'
    );

    return { deleted: result.rowCount };
  }

  static async cleanupOldFiles() {
    // Delete files older than 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    // List old files from storage
    const oldFiles = await listFiles({ before: cutoffDate });

    // Delete in batches
    for (const file of oldFiles) {
      await deleteFile(file.key);
    }

    return { deleted: oldFiles.length };
  }
}
```

---

## Monitoring and Debugging

### Job Status Tracking

```typescript
// Check job status
const job = await emailQueue.getJob(jobId);

if (job) {
  const state = await job.getState();
  console.log('Job state:', state); // completed, failed, delayed, active, waiting

  const progress = job.progress;
  console.log('Progress:', progress);

  if (state === 'failed') {
    console.log('Failure reason:', job.failedReason);
    console.log('Stack trace:', job.stacktrace);
  }
}
```

### Queue Metrics

```typescript
// Get queue metrics
const counts = await emailQueue.getJobCounts(
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed'
);

console.log('Queue metrics:', {
  waiting: counts.waiting,
  active: counts.active,
  completed: counts.completed,
  failed: counts.failed,
  delayed: counts.delayed
});
```

### Dashboard (Bull Board)

```bash
pnpm add @bull-board/api @bull-board/nextjs
```

```typescript
// app/api/admin/queues/route.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { NextAdapter } from '@bull-board/nextjs';
import { emailQueue, exportQueue } from '@/core/lib/jobs/queue';

const serverAdapter = new NextAdapter();

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(exportQueue)
  ],
  serverAdapter
});

serverAdapter.setBasePath('/api/admin/queues');

export const GET = serverAdapter.registerPlugin();
```

---

## Error Handling

### Retry Strategies

```typescript
// Exponential backoff
await queue.add('job', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000 // Start with 1s, then 2s, 4s, 8s, 16s
  }
});

// Fixed delay
await queue.add('job', data, {
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 5000 // Always 5s between retries
  }
});

// Custom backoff
await queue.add('job', data, {
  attempts: 3,
  backoff: {
    type: 'custom',
    delay: (attemptsMade) => {
      return attemptsMade * 2000; // 2s, 4s, 6s
    }
  }
});
```

### Dead Letter Queue

```typescript
// Move failed jobs to DLQ after max attempts
emailWorker.on('failed', async (job, error) => {
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    // Move to dead letter queue
    await deadLetterQueue.add('failed-email', {
      originalJob: job.data,
      error: error.message,
      attempts: job.attemptsMade,
      timestamp: new Date()
    });

    // Alert admin
    await notifyAdmin('Job failed permanently', {
      jobId: job.id,
      error: error.message
    });
  }
});
```

---

## Best Practices

### Do's ✅

**1. Set Appropriate Timeouts**
```typescript
await queue.add('long-task', data, {
  timeout: 600000 // 10 minutes
});
```

**2. Clean Up Completed Jobs**
```typescript
await queue.add('task', data, {
  removeOnComplete: 100, // Keep last 100
  removeOnFail: 50 // Keep last 50 failed
});
```

**3. Use Job IDs for Idempotency**
```typescript
await queue.add('unique-task', data, {
  jobId: `task-${userId}-${date}` // Prevents duplicates
});
```

**4. Monitor Failed Jobs**
```typescript
worker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
  // Log to monitoring service
});
```

### Don'ts ❌

**1. Never Block Request Handlers**
```typescript
// ❌ BAD
export async function POST(req: NextRequest) {
  const result = await longRunningTask(); // Blocks request
  return NextResponse.json(result);
}

// ✅ GOOD
export async function POST(req: NextRequest) {
  await queue.add('task', data); // Queue and return
  return NextResponse.json({ queued: true });
}
```

**2. Never Ignore Errors**
```typescript
// ❌ BAD
worker.on('failed', () => {});

// ✅ GOOD
worker.on('failed', (job, error) => {
  logger.error('Job failed', { jobId: job?.id, error });
  notifyAdmins(error);
});
```

**3. Never Use Infinite Retries**
```typescript
// ❌ BAD
{ attempts: Infinity }

// ✅ GOOD
{ attempts: 3, backoff: { type: 'exponential' } }
```

---

## Built-in Solution: Scheduled Actions

> 💡 **Recommended:** For most use cases, use the built-in **Scheduled Actions** system instead of implementing custom job queues.

The Scheduled Actions system provides:
- Database-backed job persistence
- External cron trigger (serverless-compatible)
- Multi-endpoint webhook routing
- Time-window deduplication
- Built-in retry handling

**See:** [Scheduled Actions Documentation](../20-scheduled-actions/01-overview.md)

```typescript
import { scheduleAction } from '@/core/lib/scheduled-actions'

// Schedule a webhook delivery
await scheduleAction('webhook:send', {
  eventType: 'task:created',
  entityType: 'task',
  entityId: task.id,
  data: task
}, { teamId })

// Schedule a recurring job
await scheduleRecurringAction('billing:check-renewals', {}, 'daily')
```

---

## Summary

**Job Processing Options:**
- **Scheduled Actions** (built-in, recommended for most cases)
- Simple async (fire and forget)
- Vercel Cron (scheduled tasks)
- External queue (BullMQ for complex needs)

**Common Patterns:**
- Email sending
- Data export
- Cleanup tasks
- Batch processing
- Webhook delivery (use [Scheduled Actions](../20-scheduled-actions/04-webhooks.md))

**Key Features:**
- Retry mechanisms
- Progress tracking
- Error handling
- Job monitoring
- Scheduled execution

**Best Practices:**
- Set timeouts
- Clean up old jobs
- Monitor failures
- Use idempotent job IDs
- Implement DLQ for permanent failures

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: Complete
