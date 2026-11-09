---
title: Worker (pg-boss)
description: The optional pg-boss worker on the same Postgres, and when to choose it over the external cron
---

# Worker (pg-boss)

> **Experimental:** like the rest of Scheduled Actions, the worker is not part of the stable 1.0 surface.

`nextspark worker` runs an optional long-lived process next to the app. It uses [pg-boss](https://github.com/timgit/pg-boss) on the **same Postgres**: queues, retries with backoff and cron schedules are declared in the app config, and each job runs a handler registered with `registerScheduledAction`. There is no new infrastructure.

It is **off by default**. Nothing changes for an app that does not run it.

## Worker or external cron

| | External cron (default) | Worker |
|---|---|---|
| Processes | Only the app | The app **and a second process**, `nextspark worker` |
| Trigger | An external scheduler calls the cron endpoint (`x-cron-secret`) every minute | The worker polls its queues and fires its own cron schedules |
| Serverless (Vercel, Cloudflare) | Yes: the documented path | No: a serverless host cannot keep a process running |
| Latency | Up to the cron period | Seconds |
| Retries | Linear backoff, 5 min per attempt | Per queue: limit, delay, exponential backoff |
| Recurring tasks | `recurringInterval` rows, one external schedule for all | Cron expressions with a time zone, declared in the config |
| Concurrency | `scheduledActions.concurrencyLimit` per run | `concurrency` per queue |
| Extra dependency | None | `pg-boss` in your project |

Choose the **external cron** on a serverless host, or when a minute of latency is fine and you want nothing else to run. Choose the **worker** on a host that runs long-lived processes (a VM, a container, a self-hosted deploy) when you need sub-minute pick-up, per-queue retry policy or recurring tasks without configuring a scheduler for each one.

The two can coexist: the worker only runs the queues you declare in `jobs`, and the cron endpoint keeps processing the `scheduled_actions` table exactly as before.

## Set it up

1. Install pg-boss in the project (it is an optional peer dependency of core, loaded only by the worker):

   ```bash
   pnpm add -w pg-boss # a generated project is a pnpm workspace; drop -w otherwise
   ```

2. Declare the queues in the app config:

   ```typescript
   // config/app.config.ts
   export const APP_CONFIG_OVERRIDES = {
     jobs: {
       enabled: true,
       queues: {
         // the queue name allows letters, digits, _ - . / ; `handler` names the Scheduled Actions action type
         'purge-teams': { handler: 'teams:purge-deleted' },
         'send-digest': {
           concurrency: 2,
           retryLimit: 5,        // tries again up to 5 times (6 attempts)
           retryDelay: 10,       // seconds
           retryBackoff: true,   // 10 s, ~20 s, ~40 s ... with jitter
           retryDelayMax: 600,
           timeout: 120,         // seconds before pg-boss gives the job up and retries it
         },
       },
       schedules: [
         { queue: 'purge-teams', cron: '0 3 * * *', tz: 'UTC' },
         { queue: 'send-digest', cron: '0 8 * * 1-5', tz: 'Europe/Madrid', data: { kind: 'daily' } },
       ],
     },
   }
   ```

   | Option | Default | Meaning |
   |---|---|---|
   | `enabled` | `false` | The worker refuses to start unless `true` |
   | `schema` | `pgboss` | Postgres schema pg-boss creates: letters, digits and `_`, not starting with a digit, up to 50 characters |
   | `shutdownTimeout` | `30` | Seconds to wait for running jobs on SIGTERM (see [Shutdown](#shutdown)) |
   | `queues.<name>.handler` | the queue name | Scheduled Actions action type that runs each job |
   | `queues.<name>.concurrency` | `1` | Jobs of the queue run at once |
   | `queues.<name>.retryLimit` | `2` | Retries after a failure (attempts = retryLimit + 1) |
   | `queues.<name>.retryDelay` | `0` | Seconds before a retry |
   | `queues.<name>.retryBackoff` | `false` | Exponential delay with jitter |
   | `queues.<name>.retryDelayMax` | none | Longest delay with backoff, in seconds |
   | `queues.<name>.timeout` | `900` | Seconds a job may run before pg-boss fails it (and retries it if retries are left). It does not cancel the handler, and the `timeout` option of `registerScheduledAction` is ignored by the worker: this one decides |
   | `schedules[].queue / cron / tz / data / key` | | Five-field cron, time zone (default UTC), payload, key to tell apart several schedules on one queue |

3. Register the handlers as for any Scheduled Action (`registerAllHandlers` of the project, or a core handler). A queue whose handler is not registered stops the worker at start with a message naming it.

4. Run the worker:

   ```bash
   nextspark worker
   ```

   It needs the generated registries (`nextspark prepare`) and the same `.env` as the app.

A schedule you remove from the config stops firing the next time the worker starts.

## Run it as a second process

The worker is **a separate process from the app**. Start and supervise it wherever you run the app:

- a second service in your process manager (systemd unit, `pm2`, a Docker Compose service, a second container or Procfile entry) with the command `nextspark worker`;
- the same image and environment variables as the app, with the web process and the worker process as two entries;
- one worker process is enough. More than one is safe (pg-boss hands each job to one worker and fires each schedule once), but only add them for throughput.

A deploy that restarts the app must restart the worker too, so it runs the new handlers. On Vercel and other serverless hosts there is nowhere to run it: stay on the external cron.

## Which database role runs what

pg-boss creates and migrates its own schema (`pgboss` by default). The app role (`DATABASE_URL`) is unprivileged and runs under RLS, so it cannot create a schema. The worker therefore connects pg-boss with **`MIGRATE_DATABASE_URL`** when set, and with `DATABASE_URL` otherwise, the same precedence as `nextspark db:migrate`.

- That connection is used **only** for pg-boss's own tables. It is never handed to a handler.
- Handlers run in the worker process with the same `lib/db` pools as the app, as the app role. A handler that reads or writes team data uses `queryWithRLS(sql, params, userId)` (or `null` for a system operation, exactly like a Scheduled Actions handler), so RLS applies as it does anywhere else.
- Put the team in the payload (`{ teamId, ... }`): it is passed to the handler as `action.teamId`.
- If you would rather not run a long-lived process with the migration role, install the pg-boss schema once with a privileged role and grant the app role usage on it; that setup is outside what `nextspark worker` does for you.

## Shutdown

On SIGTERM or SIGINT the worker stops taking jobs and waits up to `shutdownTimeout` seconds for the running ones, then closes the database pools. `nextspark worker` exits 0 after a clean stop.

A job still running when `shutdownTimeout` ends is **marked failed by pg-boss at once**. It is tried again only if its queue has retries left; **with `retryLimit: 0` it is lost** (it stays `failed` in `pgboss.job`). Make handlers idempotent, keep `retryLimit` above 0 for work you cannot lose, and set the supervisor's grace period above `shutdownTimeout` (Docker `stop_grace_period`, systemd `TimeoutStopSec`, Kubernetes `terminationGracePeriodSeconds`), or it kills the worker before it can finish.

## Enqueueing jobs

Jobs enter a queue from the cron `schedules` you declare, or from code that opens its own `PgBoss` on the same database with the migration role (`MIGRATE_DATABASE_URL`) and calls `send`. The app role has no permission on the `pgboss` schema, so the app itself, its API routes and its handlers cannot enqueue through pg-boss. To enqueue work from the app, use `scheduleAction` (Scheduled Actions) as before.

## Without the worker

Nothing in the app or in Scheduled Actions imports pg-boss or the jobs module. Without `jobs.enabled`, without pg-boss installed, and without running `nextspark worker`, the app, the cron endpoint and the `scheduled_actions` table behave exactly as before.
