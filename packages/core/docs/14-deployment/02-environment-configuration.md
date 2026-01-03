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

### Database

```bash
# Supabase PostgreSQL connection
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

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
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your App Name
```

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
BETTER_AUTH_URL=http://localhost:5173
NEXT_PUBLIC_APP_URL=http://localhost:5173
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
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
