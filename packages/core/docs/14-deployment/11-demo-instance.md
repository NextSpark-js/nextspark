# Public Demo Instance

## Introduction

A demo is a public, throwaway instance of a project with its sample data, where visitors sign in with sample accounts and a scheduled job puts everything back. `NEXTSPARK_DEMO_MODE=true` turns it on. Only that exact value does, there is no config option for it, and without it nothing on this page applies.

This is an operations note for whoever runs such an instance. Never set the variable on a project with real users.

---

## What the variable changes

| Area | In demo mode |
|------|--------------|
| Email | Every message goes to the server log (the console provider), whatever `EMAIL_PROVIDER` says. Nothing is sent. |
| Billing | The server runs as `provider: 'none'`: checkout, portal and cancellation answer 501, and the provider webhook routes answer 404. A browser still shows the buttons of the configured provider. |
| Uploads | Only `STORAGE_DRIVER=local` works; any other driver answers 503. The reset empties `UPLOADS_DIR`. |
| Sign-up | No account can be created by password, code, sign-in link, social provider or invitation, and `/signup` redirects to `/login`. |
| Login | Only email and password, whatever `auth.methods` says. The page lists the `devKeyring` users of `config/dev.config.ts`, with their passwords. |

The server **refuses to start** in demo mode, and the reset refuses to run, when the environment could reach a real service. The message names the variables, never their values:

- any `RESEND_*`, `SMTP_*` or `S3_*` variable, or `BLOB_READ_WRITE_TOKEN`;
- any `*KEY*`, `*TOKEN*` or `*SECRET*` variable of Stripe, Polar, Lemon Squeezy or Paddle, test keys included;
- `EMAIL_PROVIDER` set to anything but `console`;
- `STORAGE_DRIVER` other than `local`, or no `UPLOADS_DIR`.

---

## Requirements

- **One long-running server with the project on its disk**: a VM or a single container, not a serverless platform. The reset needs the migration files, and it empties the same `UPLOADS_DIR` the server writes to, so it has to run on that host.
- **An empty PostgreSQL database used for nothing else**. The reset drops its `public` schema, so the role of `MIGRATE_DATABASE_URL` (or `DATABASE_URL` without it) must own that schema. Use a direct connection, not a transaction-mode pooler.

The environment of the server and of the reset:

```bash
NEXTSPARK_DEMO_MODE=true
NODE_ENV=production
DATABASE_URL=postgresql://demo_owner:CHANGE_ME@db.example.com:5432/demo
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=https://demo.example.com
NEXT_PUBLIC_APP_URL=https://demo.example.com
STORAGE_DRIVER=local
UPLOADS_DIR=/var/lib/nextspark-demo/uploads
```

---

## Deploy

Create the project from a released version of the CLI, then, from its directory on the host:

```bash
# 1. The build's login check expects a real email provider, which a demo must not have
NEXTSPARK_AUTH_PREFLIGHT=off pnpm build

# 2. Load the sample data. Run this instead of db:migrate: a database with tables
#    that this command did not create is refused
pnpm exec nextspark db:demo-reset

# 3. Start the server
pnpm start
```

Sign in with one of the accounts on `/login`. The reset takes away their global `superadmin` and `developer` roles, because their password is public: visitors are ordinary team members.

---

## Scheduled reset

`db:demo-reset` drops every table, runs the migrations with the sample data, locks the sample accounts and deletes the uploads. Run it from the host's scheduler, not from a scheduled action: those live in the tables it drops. Every six hours with cron, with `flock` so that two runs never overlap:

```bash
0 */6 * * * cd /srv/demo && flock -n /tmp/demo-reset.lock pnpm exec nextspark db:demo-reset >> /var/log/demo-reset.log 2>&1
```

While it runs (seconds), requests fail and visitors are signed out. Recurring scheduled actions are seeded when the server boots, so restart it after the reset if the demo needs them.

The reset refuses to run, and changes nothing, without `NEXTSPARK_DEMO_MODE=true`, next to a real service, or on a database that has tables and no mark from an earlier reset. In `UPLOADS_DIR` it deletes only files with a name the server generates.

### Last reset time

```bash
pnpm exec nextspark db:demo-reset --status
```

It prints the time of the last completed reset, `never`, or `unfinished` when one started and failed. In that case run the reset again. The same value is in the `last_reset_at` column of the `_nextspark_demo` table.

---

## Verify the guard rails

With `DEMO=https://demo.example.com`:

```bash
# Password only, with the sample accounts
curl -s "$DEMO/api/auth/readiness"

# Sign-up is closed: 403 or 503, never 200
curl -si -X POST "$DEMO/api/auth/sign-up/email" -H "content-type: application/json" -H "origin: $DEMO" \
  -d '{"email":"visitor@example.com","password":"a-long-enough-password","name":"Visitor"}' | head -1

# Webhooks are closed: 404
curl -si -X POST "$DEMO/api/v1/billing/webhooks/stripe" | head -1

# The server does not start next to a real credential: exits with 1 and names the variable
RESEND_API_KEY=anything pnpm start

# The reset refuses outside demo mode: exits with 1, and the database is untouched
env -u NEXTSPARK_DEMO_MODE pnpm exec nextspark db:demo-reset --no-env-file
```

Then upload a file while signed in, check it appears in `UPLOADS_DIR`, run the reset, and check that it is gone, that the media library is back to its sample items, and that `--status` shows the new time.

---

## Link to the demo

Once the instance is live, add its URL to the project README and the docs home, and say there that it is reset periodically.
