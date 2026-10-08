# Deployment Overview

## Introduction

> **Experimental:** Deployment to Vercel is not part of the stable 1.0 surface and may change without a deprecation period. `next start` is the stable way to run a project, also behind a TLS reverse proxy with the settings in [Client address](./10-client-address). Standalone output (`output: 'standalone'`) is planned to be stable for 1.0 only if a Linux CI job for it lands before the release candidate; there is no such job yet, so treat it as experimental until the [Support matrix](../22-stability-and-support/02-support-matrix) says otherwise.

This page describes deploying to **Vercel** (experimental) with an automated deployment script that handles environment configuration, variable management, and deployment in a single command.

**Current Status:** ⚠️ Deployment infrastructure is functional but actively being improved. This documentation covers the current working setup.

---

## Deployment Strategy

### Vercel-First Approach

```typescript
const DEPLOYMENT_STRATEGY = {
  platform: 'Vercel',
  automation: 'Fully automated via core/scripts/deploy/vercel-deploy.mjs',
  environments: {
    production: 'main branch → app.yourdomain.com',
    staging: 'staging branch → stg-app.yourdomain.com',
  },
  features: [
    'Automatic environment variable merging',
    'Project linking and domain configuration',
    'Environment-specific deployments',
    'Instant rollbacks via Vercel dashboard',
  ],
}
```

---

## Quick Start

### First Time Setup

```bash
# 1. Configure Vercel project in .env
VERCEL_TEAM=your-team-slug
VERCEL_PROJECT=your-project-name  # Optional: defaults to theme name

# 2. Create staging environment overrides
cat > .env.staging <<EOF
BETTER_AUTH_URL=https://stg-app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://stg-app.yourdomain.com
EOF

# 3. Login to Vercel
vercel login

# 4. Deploy to staging
pnpm vercel:deploy --staging
```

### Subsequent Deployments

```bash
# Deploy to staging (preview environment)
pnpm vercel:deploy --staging

# Deploy to production
pnpm vercel:deploy --prod

# Skip environment variable update
pnpm vercel:deploy --prod --skip-env
```

---

## Architecture

### Single Project + Multiple Environments

**Recommended setup** uses one Vercel project with two environments:

```text
Vercel Project: your-app
├── Production Environment
│   ├── Domain: app.yourdomain.com
│   ├── Branch: main (auto-deploy)
│   └── Variables: production scope
│
└── Preview Environment (Staging)
    ├── Domain: stg-app.yourdomain.com
    ├── Branch: staging (auto-deploy)
    └── Variables: preview scope
```

**Benefits:**
- ✅ Single project to manage
- ✅ Unified deployment history
- ✅ Easy promotion from staging → production
- ✅ Cost-effective
- ✅ Native Vercel environment separation

---

## Automated Deployment Script

### What It Does

The `vercel:deploy` script automatically:

1. **Merges environment variables** from multiple sources:
   - `.env` (base configuration)
   - Plugin `.env` files
   - `.env.staging` or `.env.prod` (environment-specific)

2. **Normalizes values**:
   - Removes extra quotes
   - Cleans whitespace and newlines
   - Sanitizes debug variables (sets to `false`)

3. **Validates configuration**:
   - Checks critical variables
   - Shows diff of changes before upload

4. **Deploys to Vercel**:
   - Links project if first time
   - Uploads environment variables
   - Triggers deployment

---

## Pre-Deployment Checklist

### Before First Deployment

```typescript
const PRE_DEPLOYMENT_CHECKLIST = {
  required: [
    '✅ Code pushed to GitHub',
    '✅ Vercel account created',
    '✅ Database configured (Supabase)',
    '✅ VERCEL_TEAM and VERCEL_PROJECT in .env',
    '✅ Production URLs configured in .env.prod',
    '✅ Email service configured (Resend)',
    '✅ NEXTSPARK_CLIENT_IP_SOURCE set for the platform (see 10-client-address.md)',
  ],
  
  recommended: [
    '✅ Test locally with production build',
    '✅ Run migrations on database',
    '✅ Review environment variables',
    '✅ Set up custom domains in Vercel',
  ],
}
```

### Before Each Deployment

```bash
# 1. Test locally
pnpm build
pnpm --dir apps/dev exec next start -p 3010

# 2. Run migrations if needed
pnpm db:migrate

# 3. Review changes
git diff main

# 4. Deploy to staging first
pnpm vercel:deploy --staging

# 5. Test staging environment
# Visit https://stg-app.yourdomain.com

# 6. Deploy to production
pnpm vercel:deploy --prod
```

---

## Environment Variables

### Critical Variables

```bash
# App URLs (must match Vercel domains)
BETTER_AUTH_URL=https://app.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Database
DATABASE_URL=postgresql://...

# Authentication
BETTER_AUTH_SECRET=your-secret-key

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Vercel deployment
VERCEL_TEAM=your-team-slug
VERCEL_PROJECT=your-project-name
```

**See:** [Environment Configuration](./02-environment-configuration.md) for complete list.

---

## Deployment Workflow

### Staging Deployment

```bash
# 1. Create/checkout staging branch
git checkout -b staging
# or
git checkout staging

# 2. Make changes and commit
git add .
git commit -m "Feature: new functionality"

# 3. Push to GitHub
git push origin staging

# 4. Deploy to staging
pnpm vercel:deploy --staging

# 5. Test staging environment
# https://stg-app.yourdomain.com

# 6. If successful, merge to main
git checkout main
git merge staging
git push origin main
```

### Production Deployment

```bash
# Option 1: Manual deployment
pnpm vercel:deploy --prod

# Option 2: Automatic via GitHub
# Push to main branch triggers auto-deploy

# Option 3: Promote from Vercel dashboard
# Vercel UI → Deployments → Promote to Production
```

---

## Self-hosting on Node

A generated project does not need Vercel. Two ways of running it on your own machine or container were checked on `0.1.0-beta.193` (a new `starter` project: `next start` with and without Cache Components, standalone with Cache Components).

**`nextspark build` and `next start`** (the project directory must stay in place):

```bash
pnpm build        # nextspark build: generates src/app and the registries, then next build
pnpm start        # next start
```

**Standalone output** (a directory you copy without the project). Add `output: 'standalone'` to `next.config.mjs`, build, and copy three things:

```bash
pnpm build
mkdir -p deploy/.next
cp -R .next/standalone/. deploy/
cp -R .next/static deploy/.next/static
cp -R public deploy/public
cd deploy && PORT=3000 HOSTNAME=0.0.0.0 node server.js
```

With the project directory moved out of the way, `/`, `/login`, `/api/health` and the static assets answered from `deploy/` alone.

- Next copies the `.env` (and `.env.production`) it loaded into `.next/standalone`. Keep that file out of an image or archive you share, and give the server its configuration as environment variables.
- `DATABASE_URL`, `BETTER_AUTH_SECRET` and the rest of the project's variables are read when the server starts; export them where `node server.js` runs (the check above ran with the project's `.env` values exported in the shell and the copied `.env` removed).
- A production server connects to PostgreSQL over SSL. Against a database without SSL (a local container, for one) `/api/health` answers 503 with `The server does not support SSL connections` until you add `sslmode=disable` to the connection string.
- Run `pnpm db:migrate` from the project (or any checkout with the same `migrations/`) before starting a new database; the standalone directory does not migrate.
- **Media uploads need a storage provider.** A production server does not write uploads to `public/` (Next serves `public/` from what it indexed at startup, so the file would answer 404 until a restart, and a container's disk is lost on redeploy). Set `BLOB_READ_WRITE_TOKEN` (a Vercel Blob token); without it `POST /api/v1/media/upload` answers `503` with code `STORAGE_NOT_CONFIGURED` and the media library shows that message. See `21-media-library/05-configuration.md`.

---

## Troubleshooting

### Common Issues

```typescript
// Project not linked
// Solution: Run pnpm vercel:deploy --staging
// Follow prompts to link project

// Environment variables not updating
// Solution: Remove --skip-env flag
pnpm vercel:deploy --staging

// Domain not working
// Solution: Check domain configuration in Vercel dashboard
// Settings → Domains → Add/Configure domain

// Build fails
// Solution: Check Vercel build logs
// Deployments → Click failed deployment → Logs
```

---

## Quick Reference

### Commands

```bash
# Deployment
pnpm vercel:deploy --staging     # Deploy to staging
pnpm vercel:deploy --prod        # Deploy to production
pnpm vercel:deploy --prod --skip-env  # Skip env update

# Vercel CLI (manual)
vercel login                     # Login to Vercel
vercel --prod                    # Deploy to production
vercel rollback                  # Rollback deployment

# Database
pnpm db:migrate                  # Run migrations
# Inspect the affected production schema with read-only queries in the database console
```

### Environment Files

```bash
.env              # Base configuration (development)
.env.staging      # Staging overrides (DO NOT commit)
.env.prod         # Production overrides (DO NOT commit)
.env.example      # Template (safe to commit)
```

---

## Next Steps

This deployment section covers:

1. **[Deployment Overview](./01-deployment-overview.md)** (this document) - Strategy and workflow
2. **[Environment Configuration](./02-environment-configuration.md)** - Environment variables
3. **[Vercel Deployment](./03-vercel-deployment.md)** - Detailed Vercel setup
4. **[CI/CD Pipeline](./04-ci-cd-pipeline.md)** - Automated deployments
5. **[Database Migrations](./05-database-migrations-production.md)** - Production migrations
6. **[Monitoring](./06-monitoring.md)** - Monitoring and analytics
7. **[Logging](./07-logging.md)** - Logging strategy
8. **[Rollback Procedures](./08-rollback-procedures.md)** - Rollback and recovery
9. **[Disaster Recovery](./09-disaster-recovery.md)** - Backup and recovery

**Additional Resources:**
- [DEPLOYMENT.md](/DEPLOYMENT.md) - Complete technical guide
- [Vercel Documentation](https://vercel.com/docs) - Official Vercel docs

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development  
**Platform:** Vercel
