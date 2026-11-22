# Environment Configuration

## Introduction

Environment variables configure your application for different deployment environments. This guide covers the file structure, variable management, and security considerations for production deployments.

---

## Environment File Structure

### File Hierarchy

```bash
nextspark/
├── .env                 # Development (local)
├── .env.staging        # Staging overrides (DO NOT commit)
├── .env.prod           # Production overrides (DO NOT commit)
└── .env.example        # Template (safe to commit)
```

### Variable Precedence

The deployment script merges variables in this order:

```typescript
const MERGE_ORDER = [
  '1. .env',              // Base configuration
  '2. plugins/**/.env',   // Plugin-specific variables
  '3. .env.staging',      // Environment overrides (staging)
  '3. .env.prod',         // Environment overrides (production)
]

// Later sources override earlier ones
// Example: .env.staging > plugins > .env
```

---

## Critical Variables

### Application URLs

```bash
# Must match your Vercel domain
BETTER_AUTH_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Staging example
BETTER_AUTH_URL=https://stg-app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://stg-app.yourdomain.com
```

The auth base URL (the host of the links and callbacks Better Auth builds) is resolved in this order:

1. `BETTER_AUTH_URL`
2. `NEXT_PUBLIC_APP_URL`
3. `https://${VERCEL_URL}`, only when `VERCEL_ENV` is `preview`
4. a localhost URL (the built-in fallback for local development)

A Vercel preview deployment without the first two variables therefore uses its own deployment URL. Production
never uses `VERCEL_URL`: set `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` there.

The links the app builds outside Better Auth (the invitation email, the billing return URLs, the invited sign-up
call, the server-side entity API client, the CSP report endpoint, the sitemap and robots routes, and the OAuth
redirect URI of the social media publisher plugin) use the same order without its first step: `NEXT_PUBLIC_APP_URL`,
the preview `VERCEL_URL`, then localhost. They ignore `BETTER_AUTH_URL`, which may carry a path. The client-side
code (`useOrigin`, the auth client) reads `window.location`, or `NEXT_PUBLIC_APP_URL` where there is no window, and
stays outside this order. The CORS allow-lists read the configured `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`
values on purpose: they list origins an operator chose.

A Preview scope that sets `NEXT_PUBLIC_APP_URL` (a staging domain, for example) never reaches `VERCEL_URL`, by
design: an explicit value always wins.

MCP browser sign-in (`features.mcpOAuth`) publishes two URLs built from these variables, and a client refuses a
token whose URLs do not match what it was told:

| URL | Built from | Example |
| --- | --- | --- |
| The MCP resource: what access tokens are issued for, and the audience `/api/mcp` accepts | The origin of the app URL (`NEXT_PUBLIC_APP_URL`, then the preview `VERCEL_URL`, then localhost), the Next.js `basePath` and `/api/mcp`. `BETTER_AUTH_URL` is not used | `https://app.yourdomain.com/api/mcp` |
| The issuer: the authorization server | The auth base URL above. A `BETTER_AUTH_URL` with a path of its own is the issuer as it is; without a path it is the origin, the `basePath` and `/api/auth` | `https://app.yourdomain.com/api/auth` |

In production set both variables to the public https URL of the app. A deployment that leaves
`NEXT_PUBLIC_APP_URL` unset in production publishes a localhost resource, and no client can connect. See
[MCP browser sign-in deployment](./12-mcp-browser-sign-in.md).

### Database

```bash
# Runtime connection for USER requests. After the RLS cutover (beta.167) this
# connects as the non-owner role `nextspark_app` so RLS is actually evaluated.
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# SERVICE connection (RLS-bypass) for system operations: Better Auth,
# scheduler/processor, payment webhooks, superadmin bypass, team/subscription
# bootstrap. Supabase: the service_role string. Optional only while DATABASE_URL is the
# owner (falls back to it); REQUIRED once DATABASE_URL is nextspark_app, or sign-in and
# API keys answer 401.
# DATABASE_SERVICE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Optional — connection used to RUN MIGRATIONS/seeds (must be the table OWNER).
# Falls back to DATABASE_URL if unset.
# MIGRATE_DATABASE_URL=postgresql://owner:[PASSWORD]@[HOST]:5432/postgres
```

Optional query limits for every pool core creates (see
[Environment Configuration](../02-getting-started/05-environment-configuration.md#db_query_timeout_ms--db_statement_timeout_ms-optional)):
`DB_QUERY_TIMEOUT_MS` (default `60000`, `0` disables) and `DB_STATEMENT_TIMEOUT_MS` (default off; direct connections only).

> The RLS cutover is **opt-in and backward-compatible**: while `DATABASE_URL` is the owner,
> leave `DATABASE_SERVICE_URL` unset and the app behaves as before. Once `DATABASE_URL` is
> `nextspark_app`, `DATABASE_SERVICE_URL` is required (owner or `BYPASSRLS` role); without it
> sign-in and API keys answer 401. See
> [Backend → RLS Policies → Enforcement Layer](../10-backend/03-rls-policies.md#enforcement-layer-beta167).

### Authentication

```bash
# Better Auth configuration
BETTER_AUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32

# OAuth providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Email Service

```bash
# Resend for transactional emails
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name
```

`EMAIL_FROM` and `EMAIL_FROM_NAME` are the sender of every email provider. A deployment that still sets `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` keeps working: those are read when the `EMAIL_FROM` variables are unset, and when both are set `EMAIL_FROM` wins.

To send through SendGrid, Mailgun, SES, Postmark or your own server instead, set `EMAIL_PROVIDER=smtp` and the `SMTP_*` variables, and run `pnpm add nodemailer`: see `docs/06-authentication/13-email-providers.md`.

### MCP Server

```bash
# The MCP endpoint, /api/mcp. In production it is OFF unless this is exactly 'true'.
# In development it is on unless this is 'false'.
MCP_ENABLED=true

# Optional. Prefix of the tool names (app_list_tasks, ...). Default: app.
# Lowercased, and every run of other characters becomes "_".
# MCP_TOOL_PREFIX=app

# Optional. Runtime switch of MCP browser sign-in. Only the exact value 'false' turns it off,
# without a build. Unset, the feature is on when the project was built with it.
# MCP_OAUTH_ENABLED=false
```

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_ENABLED` | Development: on. Production: off | With the endpoint off, `/api/mcp` answers `404`, and so does everything of browser sign-in. |
| `MCP_TOOL_PREFIX` | `app` | Prefix of every generated tool name. |
| `MCP_OAUTH_ENABLED` | Unset (on, if built) | `false` switches MCP browser sign-in off at runtime: the discovery documents, the consent and team pages and the internal OAuth routes answer `404`, and `/api/mcp` takes an API key only. Any other value, or none, leaves it on. |

`MCP_OAUTH_ENABLED` is not what turns the feature on. That is a build-time setting of the project,
`features: { mcpOAuth: true }` in `nextspark.config.ts`, read by `nextspark prepare` (which `nextspark build` and
`nextspark dev` run): without it the host has none of the OAuth routes and the variable has nothing to switch.
A project may read the variable in its own `nextspark.config.ts` to decide the build flag (the repository's
`apps/dev` does: `features: { mcpOAuth: process.env.MCP_OAUTH_ENABLED === 'true' }`); that is the project's choice,
not something core does.

One more setting of the feature is not an environment variable: the optional list of applications that may
connect, `mcp.oauth.allowedClientHosts` in `config/app.config.ts`. See
[MCP browser sign-in deployment](./12-mcp-browser-sign-in.md).

### Rate Limiting (Upstash Redis)

```bash
# Optional, but needed for limits that hold across instances. BOTH are required:
# with only one set, every limit is counted in the memory of each process.
UPSTASH_REDIS_REST_URL=https://<your-database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

Core talks to Redis through Upstash's REST API only (`@upstash/redis`, `@upstash/ratelimit`). A `redis://`
connection string is not supported: `REDIS_URL` is not read, and neither are the `KV_REST_API_URL` and
`KV_REST_API_TOKEN` that Vercel's Marketplace creates (see
[Vercel Deployment](./03-vercel-deployment.md#upstash-redis-from-vercels-marketplace)).

With both variables set, every rate limit tier is counted in Redis: the per-address tiers and the per-credential
tier (`credential`, 1000 charges a minute per API key or MCP connection). Without them each process counts on its
own, which on a serverless platform or behind several instances multiplies every limit by the number of instances.
When Redis is configured and fails, the limiter lets the request through; for the per-credential tier the count of
the process still applies.

`DISABLE_RATE_LIMITING=true` turns off the per-address tiers and Better Auth's sign-in, sign-up and one-time-code
limits. It is for development and tests, never for production. It does not turn off the per-credential tier.

### Vercel Deployment

```bash
# Required for automated deployment
VERCEL_TEAM=your-team-slug
VERCEL_PROJECT=your-project-name  # Optional: defaults to theme name
VERCEL_TOKEN=your-vercel-token    # Optional: for CI/CD
```

---

## Environment-Specific Configuration

### Development (.env)

```bash
# Local development
BETTER_AUTH_URL=http://localhost:3010
NEXT_PUBLIC_APP_URL=http://localhost:3010
DATABASE_URL=postgresql://localhost/dev_db

# Debug flags (OK in development)
NEXT_PUBLIC_DISPLAY_DEBUGGER=true
```

### Staging (.env.staging)

```bash
# Only override what differs from development
BETTER_AUTH_URL=https://stg-app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://stg-app.yourdomain.com

# Staging database
DATABASE_URL=postgresql://...staging-db...

# Debug disabled (automatic)
NEXT_PUBLIC_DISPLAY_DEBUGGER=false  # Auto-set by script
```

### Production (.env.prod)

```bash
# Production overrides
BETTER_AUTH_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Production database
DATABASE_URL=postgresql://...production-db...

# All debug flags disabled (automatic)
NEXT_PUBLIC_DISPLAY_DEBUGGER=false
```

---

## Automatic Normalization

### What Gets Normalized

The deployment script automatically:

```typescript
// 1. Removes extra quotes
'VARIABLE="value"'  → 'VARIABLE=value'

// 2. Cleans whitespace
'VARIABLE= value '  → 'VARIABLE=value'

// 3. Removes newlines in values
'VARIABLE=line1\nline2' → 'VARIABLE=line1 line2'

// 4. Sanitizes debug variables
'NEXT_PUBLIC_DISPLAY_DEBUGGER=true' → 'false' (in staging/prod)
```

### Debug Variable Sanitization

```bash
# These are automatically set to 'false' in staging/prod:
NEXT_PUBLIC_DISPLAY_DEBUGGER=false
DEBUG=false
NODE_ENV=production  # Set by Vercel
```

---

## Validation

### Required Variables Check

The script validates these critical variables exist:

```bash
# Required for application to run
✅ BETTER_AUTH_URL
✅ BETTER_AUTH_SECRET
✅ DATABASE_URL
✅ NEXT_PUBLIC_APP_URL

# Required for deployment
✅ VERCEL_TEAM (or VERCEL_ORG_ID)
✅ VERCEL_PROJECT (or derived from theme)
```

### Validation Errors

```bash
# Missing critical variable
❌ Error: BETTER_AUTH_URL is required
Solution: Add to .env.staging or .env.prod

# Invalid URL format
❌ Error: BETTER_AUTH_URL must be a valid URL
Solution: Check URL includes https://

# Mismatched URLs
⚠️ Warning: BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL don't match
Solution: Ensure both point to same domain
```

---

## Security Considerations

### DO NOT Commit

```bash
# ❌ NEVER commit these files
.env.staging
.env.prod
.env.local

# ✅ Safe to commit
.env.example
```

### Secrets Management

```typescript
const SECURITY_PRACTICES = {
  secrets: [
    'Use long, random values for BETTER_AUTH_SECRET',
    'Rotate API keys periodically',
    'Use different secrets per environment',
    'Store secrets in Vercel dashboard as backup',
  ],
  
  access: [
    'Limit who can access Vercel project settings',
    'Use Vercel team roles appropriately',
    'Enable 2FA on Vercel account',
  ],
  
  audit: [
    'Review environment variables regularly',
    'Remove unused variables',
    'Check Vercel deployment logs',
  ],
}
```

### Generating Secrets

```bash
# Generate random secret
openssl rand -base64 32

# Generate UUID
uuidgen

# Example output
BETTER_AUTH_SECRET=Jk3mN9pQ2rS5tU8vW1xY4zA7bC0dE6fG
```

---

## Managing Variables

### Via Deployment Script

```bash
# Update variables and deploy
pnpm vercel:deploy --staging

# Deploy without updating variables
pnpm vercel:deploy --staging --skip-env
```

### Via Vercel Dashboard

```bash
# 1. Go to project settings
# 2. Environment Variables section
# 3. Add/Edit variables
# 4. Select environment scope (Production/Preview)
# 5. Save changes
# 6. Redeploy to apply
```

### Viewing Current Variables

```bash
# List project environment variables
vercel env ls

# Pull environment variables
vercel env pull .env.vercel
```

---

## Quick Reference

### File Purposes

```bash
.env              # Base config (development)
.env.staging      # Staging overrides only
.env.prod         # Production overrides only
.env.example      # Template for new developers
```

### Variable Scopes (Vercel)

```bash
Production        # Only production deployments
Preview           # All preview deployments (including staging)
Development       # Local development (vercel dev)
```

### Common Variables

```bash
# URLs (environment-specific)
BETTER_AUTH_URL
NEXT_PUBLIC_APP_URL

# Secrets (same or different per env)
BETTER_AUTH_SECRET
DATABASE_URL
RESEND_API_KEY

# Deployment (same across environments)
VERCEL_TEAM
VERCEL_PROJECT

# Optional: MCP server and shared rate limits
MCP_ENABLED                 # 'true' to serve /api/mcp in production
MCP_TOOL_PREFIX
MCP_OAUTH_ENABLED           # 'false' switches MCP browser sign-in off at runtime
UPSTASH_REDIS_REST_URL      # both, or neither
UPSTASH_REDIS_REST_TOKEN
```

---

**Last Updated:** 2026-11-22  
**Version:** 1.1.0  
**Status:** In Development
