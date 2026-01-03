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
| `BETTER_AUTH_URL` | ✅ | `http://localhost:5173` | App URL for auth |
| `NEXT_PUBLIC_ACTIVE_THEME` | ✅ | `default` | Active theme name |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:5173` | Public app URL |
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
BETTER_AUTH_URL="http://localhost:5173"

# === APPLICATION (REQUIRED) ===
NEXT_PUBLIC_ACTIVE_THEME="default"
NEXT_PUBLIC_APP_URL="http://localhost:5173"

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

**See:** [Database Setup Guide](./02-database-setup.md)

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
BETTER_AUTH_URL="http://localhost:5173"
NEXT_PUBLIC_APP_URL="http://localhost:5173"
```

**Production:**
```bash
BETTER_AUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### NEXT_PUBLIC_ACTIVE_THEME

**Purpose:** Active theme name

**Format:**
```bash
NEXT_PUBLIC_ACTIVE_THEME="default"
```

**Important:**
- Must match theme directory: `contents/themes/default/`
- Case-sensitive
- Changes require registry rebuild

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
**Redirect URI:** `http://localhost:5173/api/auth/callback/google`

### Application Name

```bash
NEXT_PUBLIC_APP_NAME="Your SaaS App"
```

### Billing Provider

```bash
BILLING_PROVIDER="stripe"  # or "polar" or "mercadopago"
```

**Plugin config:** `contents/plugins/billing/.env`

---

## Plugin Environment Variables

**Each plugin can have separate `.env` file:**

```text
contents/plugins/billing/.env
contents/plugins/ai/.env
contents/plugins/amplitude/.env
```

**Example (billing):**
```bash
# contents/plugins/billing/.env
STRIPE_SECRET_KEY="sk_test_xxxxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

---

## Environment-Specific Configs

### Development (.env.local)

```bash
DATABASE_URL="postgresql://localhost:5432/dev"
BETTER_AUTH_URL="http://localhost:5173"
NEXT_PUBLIC_APP_URL="http://localhost:5173"
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
- NEXT_PUBLIC_ACTIVE_THEME, NEXT_PUBLIC_APP_URL
- RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME

**Best Practices:**
- Never commit `.env` files
- Use different secrets per environment
- Keep `.env.example` updated

**Next:** [Build Process](./04-build-process.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
