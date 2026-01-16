# /how-to:deploy

Interactive guide to deploy NextSpark to production.

---

## Syntax

```
/how-to:deploy
```

---

## Behavior

Guides the user through deploying to Vercel, managing environment variables, and configuring production settings.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Prepare for Deployment
        └── Pre-deployment checklist

Step 2: Deploy to Vercel
        └── Connect and deploy

Step 3: Configure Environment
        └── Production variables

Step 4: Post-Deployment Setup
        └── Database, domains, monitoring
```

---

## Step 1: Prepare for Deployment

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: DEPLOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Prepare for Deployment

Complete this checklist before deploying:

┌─────────────────────────────────────────────┐
│  PRE-DEPLOYMENT CHECKLIST                   │
│  ─────────────────────────────────────────  │
│                                             │
│  [ ] Build passes locally                   │
│      pnpm build                             │
│                                             │
│  [ ] Tests pass                             │
│      pnpm test                              │
│                                             │
│  [ ] Environment variables documented       │
│      All required vars in .env.example      │
│                                             │
│  [ ] Database migrations ready              │
│      pnpm db:migrate works                  │
│                                             │
│  [ ] No console.log statements              │
│      Remove debug logs                      │
│                                             │
│  [ ] Images optimized                       │
│      Use next/image for all images          │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Verify Build:

```bash
# Clean build
rm -rf .next
pnpm build

# Expected output:
# ✓ Compiled successfully
# ✓ Linting and checking validity of types
# ✓ Collecting page data
# ✓ Generating static pages
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Check Bundle Size:

```bash
# Analyze bundle
pnpm build:analyze

# Should see:
# - No packages > 500KB
# - Proper code splitting
# - Tree shaking working
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Required Services:

Before deployment, ensure you have:

| Service | Purpose | Provider |
|---------|---------|----------|
| Database | PostgreSQL | Supabase, Neon, AWS RDS |
| Email | Transactional | Resend, SendGrid |
| Storage | File uploads | S3, R2, Supabase Storage |
| Payments | Billing | Stripe |
| Hosting | App hosting | Vercel |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Deploy to Vercel)
[2] Show me how to set up Supabase
[3] How do I fix build errors?
```

---

## Step 2: Deploy to Vercel

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Deploy to Vercel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Option A: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time - will prompt for config)
vercel

# Deploy to production
vercel --prod
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Option B: Deploy via GitHub

1. Push your code to GitHub:
```bash
git push origin main
```

2. Go to vercel.com/new

3. Import your repository

4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: pnpm build
   - Install Command: pnpm install

5. Click "Deploy"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Vercel Project Settings:

```
Project Settings > General
├── Framework Preset: Next.js
├── Build Command: pnpm build
├── Output Directory: .next
├── Install Command: pnpm install
└── Node.js Version: 20.x
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 vercel.json Configuration:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/process-scheduled-actions",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Automatic Deployments:

Vercel automatically deploys:
- **Production**: Push to `main` branch
- **Preview**: Push to any other branch
- **PR Previews**: Open pull request

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Environment)
[2] Deploy to other platforms (Railway, Render)
[3] Set up custom domain
```

---

## Step 3: Configure Environment

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Configure Production Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set environment variables in Vercel dashboard:

📋 Required Variables:

```env
# ============================================
# DATABASE (Supabase/Neon)
# ============================================
DATABASE_URL="postgresql://..."

# ============================================
# AUTHENTICATION
# ============================================
# Generate: openssl rand -base64 32
BETTER_AUTH_SECRET="production-secret-min-32-chars"
BETTER_AUTH_URL="https://your-domain.com"
BETTER_AUTH_TRUST_HOST="true"

# ============================================
# APPLICATION
# ============================================
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_APP_NAME="Your App Name"
NEXT_PUBLIC_ACTIVE_THEME="your-theme"

# ============================================
# EMAIL (Resend)
# ============================================
RESEND_API_KEY="re_xxxx"
EMAIL_FROM="noreply@your-domain.com"

# ============================================
# PAYMENTS (Stripe)
# ============================================
STRIPE_SECRET_KEY="sk_live_xxxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxx"

# ============================================
# FILE STORAGE (S3/R2)
# ============================================
S3_BUCKET="your-bucket"
S3_REGION="auto"
S3_ACCESS_KEY_ID="xxxx"
S3_SECRET_ACCESS_KEY="xxxx"
S3_ENDPOINT="https://xxx.r2.cloudflarestorage.com"

# ============================================
# BACKGROUND JOBS
# ============================================
# Generate: openssl rand -hex 16
CRON_SECRET="your-cron-secret"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Add Variables in Vercel:

1. Go to Project Settings > Environment Variables

2. Add each variable:
   - Name: DATABASE_URL
   - Value: postgresql://...
   - Environment: Production (and Preview if needed)

3. Click "Save"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Using Vercel CLI:

```bash
# Add single variable
vercel env add DATABASE_URL production

# Pull all env vars locally
vercel env pull .env.local

# List all variables
vercel env ls
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Environment-Specific Variables:

| Variable | Development | Production |
|----------|-------------|------------|
| DATABASE_URL | Local PostgreSQL | Supabase/Neon |
| BETTER_AUTH_URL | localhost:3000 | your-domain.com |
| STRIPE_* | sk_test_xxx | sk_live_xxx |
| Email | Console output | Resend API |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SECURITY NOTES:

- Never commit .env files to git
- Use different secrets for production
- Rotate secrets periodically
- Use Vercel's secret storage for sensitive values

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Post-Deployment)
[2] How do I set up Stripe webhooks?
[3] Configure OAuth for production
```

---

## Step 4: Post-Deployment Setup

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Post-Deployment Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 1. Run Database Migrations:

```bash
# Option A: Via Vercel Function
# Create: app/api/migrate/route.ts (temporary)

# Option B: Direct connection
DATABASE_URL="production-url" pnpm db:migrate

# Option C: Via Supabase SQL Editor
# Paste migration SQL directly
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 2. Configure Custom Domain:

1. Go to Project Settings > Domains
2. Add your domain: your-domain.com
3. Add DNS records as shown
4. Wait for SSL certificate (automatic)

```
DNS Records to add:
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 3. Set Up Stripe Webhooks:

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: https://your-domain.com/api/webhooks/stripe
3. Select events:
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_failed
4. Copy webhook secret to STRIPE_WEBHOOK_SECRET

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 4. Configure OAuth Callbacks:

Update OAuth provider settings with production URLs:

Google Cloud Console:
- Authorized redirect URI: https://your-domain.com/api/auth/callback/google

GitHub Developer Settings:
- Authorization callback URL: https://your-domain.com/api/auth/callback/github

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 5. Set Up Monitoring:

```typescript
// Vercel Analytics (built-in)
// Add to app/layout.tsx:
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 6. Configure Cron Jobs:

In vercel.json:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-scheduled-actions",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/cleanup-sessions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Post-Deployment Checklist:

[ ] Database migrations ran successfully
[ ] Custom domain configured with SSL
[ ] Stripe webhooks set up
[ ] OAuth callbacks updated
[ ] Cron jobs configured
[ ] Analytics enabled
[ ] Error tracking set up (Sentry optional)
[ ] First user can sign up
[ ] Email sending works
[ ] File uploads work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Test Production:

```bash
# Test signup
curl -X POST https://your-domain.com/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","name":"Test"}'

# Test API
curl https://your-domain.com/api/health
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

Your app is deployed with:
• Vercel hosting
• Production environment
• Custom domain
• Stripe webhooks
• Monitoring

📚 Related tutorials:
   • /how-to:setup-authentication - Auth configuration
   • /how-to:customize-app - App settings

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:setup-authentication` | Auth setup |
| `/how-to:setup-database` | Database setup |
