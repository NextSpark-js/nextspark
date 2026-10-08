# Environment Configuration

## Introduction

Complete reference for all environment variables used in NextSpark. This guide covers required and optional variables, configuration for different environments, and plugin-specific settings.

**Quick Start:** See [Quick Start → Minimal Environment](./00-quick-start.md#step-2-minimal-environment-setup)

---

## Quick Reference Table

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:6543/db` | PostgreSQL connection (pooler) |
| `BETTER_AUTH_SECRET` | ✅ | `Zx8Kp2...` (32 chars) | Session encryption key |
| `BETTER_AUTH_URL` | ⬜ | `http://localhost:3010` | App URL for auth; defaults to `NEXT_PUBLIC_APP_URL`, and a generated project's `.env` does not set it |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3010` | Public app URL |
| `RESEND_API_KEY` | ✅ | `re_xxxxx` | Email service key |
| `RESEND_FROM_EMAIL` | ✅ | `noreply@domain.com` | Sender email |
| `RESEND_FROM_NAME` | ✅ | `App Name` | Sender display name |
| `GOOGLE_CLIENT_ID` | ⬜ | `xxxx.apps.googleusercontent.com` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⬜ | `GOCSPX-xxxxx` | Google OAuth secret |

---

## Minimal Configuration

```bash
# Copy to .env.local and fill in your values

# === DATABASE (REQUIRED) ===
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"

# === AUTHENTICATION (REQUIRED) ===
# Generate: openssl rand -base64 32
BETTER_AUTH_SECRET="your-generated-32-character-secret"
BETTER_AUTH_URL="http://localhost:3010"

# === APPLICATION (REQUIRED) ===
NEXT_PUBLIC_APP_URL="http://localhost:3010"

# === EMAIL SERVICE (REQUIRED) ===
RESEND_API_KEY="re_xxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
RESEND_FROM_NAME="Your App Name"
```

---

## Required Variables

### DATABASE_URL

**Purpose:** PostgreSQL database connection string

**Format:**
```bash
DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]"
```

**Supabase (Recommended):**
```bash
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

**Important:**
- ✅ Use pooler connection (port `:6543`)
- ❌ Don't use direct connection (port `:5432`)
- URL-encode special characters in password
- Get from: Supabase Dashboard → Settings → Database → Connection pooling
- After the **RLS cutover** (beta.167), this connects as the non-owner role
  `nextspark_app`. Before the cutover it stays the owner/admin connection.

### DATABASE_SERVICE_URL (optional)

**Purpose:** Service connection that **bypasses RLS** for system operations (Better Auth
login/verification, the scheduler/processor, payment webhooks, the superadmin bypass
check, and the privileged team/subscription bootstrap).

**Format:** typically a **direct** (non-pooler) connection.
```bash
# Supabase: the service_role connection string (has BYPASSRLS)
DATABASE_SERVICE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

- Optional — **falls back to `DATABASE_URL`** when unset (pre-cutover behavior unchanged).
- Setting it is part of the RLS cutover. See
  [Backend → RLS Policies → Enforcement Layer](../10-backend/03-rls-policies.md#enforcement-layer-beta167).

### MIGRATE_DATABASE_URL (optional)

**Purpose:** Connection used to **run migrations and seeds** (must be the table **owner**).
After the cutover `DATABASE_URL` is the non-owner `nextspark_app`, so migrations need the
owner credential here.
```bash
MIGRATE_DATABASE_URL="postgresql://owner:password@host:5432/database"
```
- Optional — **falls back to `DATABASE_URL`** when unset.

**See:** [Database Setup Guide](./03-database-setup.md)

### DB_QUERY_TIMEOUT_MS / DB_STATEMENT_TIMEOUT_MS (optional)

**Purpose:** Bound how long a query may wait, so a connection the provider or a NAT dropped silently (Neon, Supabase
poolers, load balancers) fails fast instead of hanging for minutes until the OS gives up. They apply to every pool
core creates (app, service and Better Auth). `DB_QUERY_TIMEOUT_MS` is what makes a dead connection fail fast; a client whose
query timed out is discarded. Core's pools also enable TCP keep-alive (first probe after 10 s; later detection depends on the OS),
close idle connections after 10 s and log, without crashing, an error on any connection (code only).

| Variable | Default | Meaning |
|---|---|---|
| `DB_QUERY_TIMEOUT_MS` | `60000` | The client gives up on a query with no answer after this long. Works behind any pooler. `0` disables it. |
| `DB_STATEMENT_TIMEOUT_MS` | unset (off) | Also asks the server to cancel a statement after this long. Sent as a connection startup parameter, so leave it unset behind a transaction pooler (PgBouncer) that rejects it. |

```bash
DB_QUERY_TIMEOUT_MS=30000
DB_STATEMENT_TIMEOUT_MS=30000   # direct connections only
```

- A value that is not a non-negative integer is ignored with a warning and the default applies.
- Migrations (`pnpm db:migrate`) do not use these pools and are not limited by them; see `MIGRATION_TIMEOUT_SECONDS`.
- Queries that legitimately run longer than 60 s (reports, bulk updates) need a higher value or `0`.
- Nothing is retried: a query that times out fails, and the next one gets a fresh connection.

### BETTER_AUTH_SECRET

**Purpose:** Secret key for encrypting session tokens

**Generate:**
```bash
openssl rand -base64 32
```

**Usage:**
```bash
BETTER_AUTH_SECRET="Zx8Kp2Lm9Nq3Rs4Tu5Vw6Xy7Za8Bc9Cd0Ef1Gh="
```

**Important:**
- Keep secret - never commit
- Use different secret per environment
- Changing invalidates all sessions

### BETTER_AUTH_URL & NEXT_PUBLIC_APP_URL

**Purpose:** Application URL for auth redirects

**Development:**
```bash
BETTER_AUTH_URL="http://localhost:3010"
NEXT_PUBLIC_APP_URL="http://localhost:3010"
```

**Production:**
```bash
BETTER_AUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### Project discovery

Project selection is not configured through the environment. Commands discover the nearest `nextspark.config.ts`.

### RESEND Variables

**RESEND_API_KEY:**
```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxx"
```

**RESEND_FROM_EMAIL:**
```bash
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

**RESEND_FROM_NAME:**
```bash
RESEND_FROM_NAME="Your App Name"
```

**Setup:**
1. Sign up at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Verify domain (or use test mode: `onboarding@resend.dev`)

---

## Optional Variables

### Google OAuth

```bash
GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"
```

**Setup:** [Google Cloud Console](https://console.cloud.google.com)
**Redirect URI:** `http://localhost:3010/api/auth/callback/google`

### Application Name

```bash
NEXT_PUBLIC_APP_NAME="Your SaaS App"
```

### Billing Provider

```bash
BILLING_PROVIDER="stripe"  # or "polar" or "mercadopago"
```

**Plugin config:** `plugins/billing/.env`

---

## Plugin Environment Variables

**Each plugin can have separate `.env` file:**

```text
plugins/billing/.env
plugins/ai/.env
plugins/amplitude/.env
```

**Example (billing):**
```bash
# plugins/billing/.env
STRIPE_SECRET_KEY="sk_test_xxxxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

---

## Environment-Specific Configs

### Development (.env.local)

```bash
DATABASE_URL="postgresql://localhost:5432/dev"
BETTER_AUTH_URL="http://localhost:3010"
NEXT_PUBLIC_APP_URL="http://localhost:3010"
RESEND_FROM_EMAIL="onboarding@resend.dev"  # Test mode
```

### Production (Vercel)

Set in Vercel Dashboard → Environment Variables:

```bash
DATABASE_URL="postgresql://production-url"
BETTER_AUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

---

## Validation

**Check variables loaded:**
```typescript
// Server-side
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Client-side (only NEXT_PUBLIC_* available)
console.log('App URL:', process.env.NEXT_PUBLIC_APP_URL);
```

---

## Troubleshooting

**Variable not loaded:**
1. Check `.env.local` exists
2. Restart dev server
3. No spaces around `=` sign
4. Check variable name spelling

**Special characters in password:**
```bash
# URL encode special characters
# @ → %40, : → %3A, / → %2F
DATABASE_URL="postgresql://user:my%40pass%3Aword@host:port/db"
```

---

## Summary

**8 Required Variables:**
- DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
- RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME

**Best Practices:**
- Never commit `.env` files
- Use different secrets per environment
- Keep `.env.example` updated

**Next:** [Build Process](./06-build-process.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
