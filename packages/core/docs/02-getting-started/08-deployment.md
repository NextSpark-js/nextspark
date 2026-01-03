# Deployment

## Introduction

Complete guide to deploying NextSpark to production using Vercel (recommended platform). Covers environment setup, database configuration, deployment process, and post-deployment verification.

**Estimated time:** 15-20 minutes

---

## Why Vercel?

**Optimized for Next.js:**
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Edge Functions
- ✅ Instant rollbacks
- ✅ Preview deployments
- ✅ Free tier available

**Alternatives:** Render, Railway, fly.io, AWS, DigitalOcean

---

## Pre-Deployment Checklist

**Before deploying, ensure:**

- [ ] App runs locally without errors (`pnpm dev`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Database migrations tested locally
- [ ] Environment variables documented
- [ ] Domain name ready (optional)

**Verify production build:**
```bash
# Clean build
rm -rf .next

# Build production bundle
pnpm build

# Test production server locally
pnpm start

# Visit http://localhost:5173
# Verify all features work
```

**If build fails:**
- Check error messages
- Fix TypeScript errors
- Fix linting errors
- See: [Troubleshooting → Build Issues](./08-troubleshooting.md#build-issues)

---

## Step 1: Production Database Setup

**Use Supabase for production:**

### Option A: New Production Database

**Create new project:**
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Settings:
   - **Name:** `nextspark-prod`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to your users
   - **Plan:** Free tier or Pro
4. Wait 2-3 minutes for provisioning

**Get connection string:**
1. Go to **Settings** → **Database**
2. Scroll to **Connection pooling**
3. Copy **Connection string** (Transaction mode)
4. Replace `[YOUR-PASSWORD]` with password

**Important:**
- ✅ Use pooler connection (port `:6543`)
- ❌ Don't use direct connection (port `:5432`)

### Option B: Upgrade Development Database

**If using separate dev/prod:**
- Create separate Supabase project
- Run migrations on new database
- Keep development database for testing

**If sharing database:**
- Use same database (not recommended)
- Be careful with migrations
- Consider using different schemas

---

## Step 2: Run Production Migrations

**Connect to production database:**
```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="postgresql://postgres.xxxxx:password@...pooler.supabase.com:6543/postgres"

# Run migrations
pnpm db:migrate

# Output:
# Running migrations from: core/migrations/
# ✓ 001_initial_schema.sql
# ✓ 002_add_metadata.sql
# ...
# All migrations completed!

# Verify tables
pnpm db:verify
```

**⚠️ Caution:**
- Ensure DATABASE_URL is production URL
- Migrations are irreversible
- Backup before running (if existing data)

---

## Step 3: Vercel Account Setup

### Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose GitHub integration (recommended)
4. Authorize Vercel for your repositories

### Install Vercel CLI (Optional)

```bash
# Install globally
npm install -g vercel

# Login
vercel login
```

---

## Step 4: Connect Repository to Vercel

### Via Vercel Dashboard

**Import project:**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your repository
4. Click "Import"

**Configure project:**
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `.` (leave default)
- **Build Command:** `pnpm build` (auto-detected)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `pnpm install` (auto-detected)

**Node.js version:**
- Go to **Settings** → **General** → **Node.js Version**
- Select `20.x` or `18.x`

---

## Step 5: Environment Variables

**Add production environment variables:**

### Required Variables

**In Vercel Dashboard:**
1. Go to **Settings** → **Environment Variables**
2. Add each variable:

**Database:**
```text
DATABASE_URL
postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
```

**Authentication:**
```text
BETTER_AUTH_SECRET
[Generate new secret with: openssl rand -base64 32]
```

```text
BETTER_AUTH_URL
https://your-domain.vercel.app
```

**Application:**
```text
NEXT_PUBLIC_ACTIVE_THEME
default
```

```text
NEXT_PUBLIC_APP_URL
https://your-domain.vercel.app
```

**Email (Resend):**
```text
RESEND_API_KEY
re_xxxxxxxxxxxxxxxxxxxxx
```

```text
RESEND_FROM_EMAIL
noreply@yourdomain.com
```

```text
RESEND_FROM_NAME
Your App Name
```

### Optional Variables

**Google OAuth (if using):**
```text
GOOGLE_CLIENT_ID
xxxx.apps.googleusercontent.com
```

```text
GOOGLE_CLIENT_SECRET
GOCSPX-xxxxx
```

**Important:** Update OAuth redirect URI:
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Update redirect URI to: `https://your-domain.vercel.app/api/auth/callback/google`

**Application Name:**
```text
NEXT_PUBLIC_APP_NAME
Your SaaS App
```

**Billing (if using):**
```text
BILLING_PROVIDER
stripe
```

### Plugin Variables

**Add plugin-specific variables if needed:**
```text
STRIPE_SECRET_KEY
sk_live_xxxxx
```

```text
STRIPE_PUBLISHABLE_KEY
pk_live_xxxxx
```

```text
STRIPE_WEBHOOK_SECRET
whsec_xxxxx
```

---

## Step 6: Deploy

### Automatic Deployment

**Via Git Push:**
1. Commit your code
2. Push to main branch:
   ```bash
   git add .
   git commit -m "feat: initial production deployment"
   git push origin main
   ```text
3. Vercel auto-deploys on push

**Deployment process:**
```text
Building...
[00:00:05] Installing dependencies (pnpm install)
[00:00:35] Running build command (pnpm build)
  [THEME]    Building theme CSS... ✓
  [REGISTRY] Building registries... ✓
  [DOCS]     Building docs index... ✓
  [APP]      Building Next.js... ✓
[00:02:30] Deploying to Edge Network...
[00:02:45] ✅ Deployment ready

URL: https://your-project-xxxxx.vercel.app
```

### Manual Deployment (CLI)

```bash
# From project directory
vercel

# Follow prompts:
# ? Set up and deploy? Yes
# ? Which scope? [Your account]
# ? Link to existing project? No
# ? What's your project's name? nextspark
# ? In which directory is your code located? ./

# Deploy to production
vercel --prod
```

---

## Step 7: Post-Deployment Verification

### Check Deployment Status

**In Vercel Dashboard:**
1. Go to **Deployments**
2. Check latest deployment status
3. Click deployment to see logs

### Verify Application

**Test these endpoints:**

**1. Homepage:**
```text
https://your-domain.vercel.app/
✓ Loads correctly
✓ No console errors
✓ Assets load (CSS, images)
```

**2. Authentication:**
```text
https://your-domain.vercel.app/sign-in
✓ Sign-in form renders
✓ Can create account
✓ Email verification sent
✓ Can log in after verification
```

**3. API Endpoints:**
```text
https://your-domain.vercel.app/api/v1/tasks
✓ Returns 401 (unauthorized) or data if logged in
✓ Correct response format
```

**4. Database Connection:**
```text
# Check logs in Vercel Dashboard
# Look for database connection messages
# Verify no connection errors
```

**5. Environment Variables:**
```text
# In browser console (if NEXT_PUBLIC_* variables):
console.log(process.env.NEXT_PUBLIC_APP_URL)
// Should output: https://your-domain.vercel.app
```

### Check Deployment Logs

**If issues occur:**
1. Go to **Deployments** → Latest deployment
2. Click **View Function Logs**
3. Check for errors:
   - Database connection errors
   - Missing environment variables
   - Build errors
   - Runtime errors

---

## Step 8: Custom Domain (Optional)

### Add Custom Domain

**In Vercel Dashboard:**
1. Go to **Settings** → **Domains**
2. Enter your domain: `yourdomain.com`
3. Click **Add**

**Configure DNS:**

**Option A: Vercel Nameservers (Recommended)**
1. Update nameservers at your registrar:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
2. Wait for DNS propagation (5-60 minutes)

**Option B: CNAME Record**
1. Add CNAME record at your registrar:
   - **Type:** CNAME
   - **Name:** `www` (or `@` for root)
   - **Value:** `cname.vercel-dns.com`
2. Add A records for root domain (if needed)

**Verify domain:**
- Vercel automatically provisions SSL certificate
- Visit `https://yourdomain.com`
- Check for HTTPS lock icon

### Update Environment Variables

**After domain is active:**
1. Update `BETTER_AUTH_URL` to `https://yourdomain.com`
2. Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com`
3. Redeploy (Vercel auto-redeploys on env change)

**Update OAuth redirects:**
- Google OAuth: Update redirect URI to `https://yourdomain.com/api/auth/callback/google`

---

## Advanced Configuration

### Build Settings

**Override defaults:**
1. Go to **Settings** → **General** → **Build & Development Settings**
2. Override commands if needed:
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next`
   - **Install Command:** `pnpm install`
   - **Development Command:** `pnpm dev`

### Environment Variable Scopes

**Choose scope per variable:**
- **Production:** Only production deployments
- **Preview:** Only preview deployments (branches)
- **Development:** Only local development (vercel dev)

**Example:**
- `DATABASE_URL` → Production only
- `BETTER_AUTH_URL` → Production & Preview (different values)

### Serverless Function Configuration

**If needed, configure timeouts:**

**Create:** `vercel.json`
```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10
    }
  }
}
```

**Defaults:**
- Hobby plan: 10s max
- Pro plan: 60s max

---

## CI/CD Integration

### Automatic Deployments

**Branch deployments:**
- **main** branch → Production
- Other branches → Preview deployments

**Preview deployments:**
- Unique URL per branch/PR
- Great for testing features
- Example: `https://nextspark-git-feature-xxx.vercel.app`

### GitHub Integration

**Automatic comments on PRs:**
- Vercel bot comments with preview URL
- Deploy status checks
- Auto-deploy on merge

**Configure:**
1. Go to **Settings** → **Git**
2. Enable:
   - ✅ GitHub comments on PRs
   - ✅ Deploy previews
   - ✅ Production branch (main)

---

## Monitoring & Analytics

### Vercel Analytics

**Enable analytics:**
1. Go to **Analytics** tab
2. Enable Web Vitals tracking
3. Add to app:

```bash
pnpm add @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

### Monitoring Dashboard

**Check in Vercel:**
- **Analytics:** Web Vitals, Core metrics
- **Logs:** Runtime logs, errors
- **Usage:** Bandwidth, function invocations

---

## Troubleshooting Deployment

### Build Fails

**Error: "Build command failed"**
```bash
# Check build logs in Vercel Dashboard
# Common causes:
- TypeScript errors
- Missing dependencies
- Environment variables not set
- Build script issues
```

**Fix:**
1. Run `pnpm build` locally
2. Fix all errors
3. Commit and push
4. Redeploy

### Database Connection Errors

**Error: "Unable to connect to database"**
```text
Check:
- DATABASE_URL is correct (pooler connection)
- Password URL-encoded if special characters
- Database is running (Supabase)
- Firewall allows connections
```

**Fix:**
1. Verify DATABASE_URL in Vercel Dashboard
2. Test connection locally with production URL
3. Check Supabase project status

### Missing Environment Variables

**Error: "BETTER_AUTH_SECRET is not defined"**
```text
Missing required environment variable
```

**Fix:**
1. Go to Vercel **Settings** → **Environment Variables**
2. Add missing variable
3. Redeploy (automatic on env change)

### Authentication Issues

**Error: "Invalid redirect URI"**
```text
OAuth redirect doesn't match configured URI
```

**Fix:**
1. Go to Google Cloud Console (or OAuth provider)
2. Update redirect URI to production URL
3. Format: `https://yourdomain.com/api/auth/callback/google`

### Function Timeout

**Error: "Function execution timed out"**
```text
Serverless function exceeded max duration
```

**Fix:**
1. Optimize function (reduce processing time)
2. Increase timeout in `vercel.json` (if on Pro plan)
3. Consider edge functions for faster response

**See:** [Troubleshooting → Deployment Issues](./08-troubleshooting.md#deployment-issues)

---

## Rollback Deployment

**If deployment has issues:**

### Via Dashboard

1. Go to **Deployments**
2. Find previous working deployment
3. Click three dots → **Promote to Production**
4. Confirm rollback

### Via CLI

```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

**Instant rollback:**
- Takes ~30 seconds
- No build required
- Previous deployment becomes active

---

## Performance Optimization

**After deployment:**

### Enable Edge Functions

**Move API routes to edge:**
```typescript
// app/api/edge-example/route.ts
export const runtime = 'edge'

export async function GET() {
  return new Response('Hello from Edge')
}
```

**Benefits:**
- Faster response times
- Lower latency
- Global distribution

### Image Optimization

**Use Next.js Image component:**
```typescript
import Image from 'next/image'

<Image
  src="/theme/images/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
/>
```

**Automatic optimization:**
- WebP/AVIF conversion
- Responsive sizes
- Lazy loading

### Bundle Analysis

**Analyze bundle size:**
```bash
# Install analyzer
pnpm add -D @next/bundle-analyzer

# Analyze
ANALYZE=true pnpm build
```

**Optimize:**
- Code split large components
- Lazy load routes
- Remove unused dependencies

---

## Security Checklist

**Post-deployment security:**

- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Environment variables secure (not exposed)
- [ ] Database connection uses pooler
- [ ] Strong BETTER_AUTH_SECRET (32+ chars)
- [ ] OAuth redirect URIs match production
- [ ] CORS configured if needed
- [ ] Rate limiting enabled (if needed)
- [ ] Database RLS policies active

---

## Cost Optimization

**Vercel Free Tier Limits:**
- 100GB bandwidth/month
- 6,000 GB-hours compute
- 100 deployments/day

**If exceeding limits:**
- Upgrade to Pro plan ($20/month)
- Optimize images (reduce bandwidth)
- Enable caching (reduce compute)
- Use edge functions (more efficient)

**Monitor usage:**
- Go to **Settings** → **Usage**
- Check bandwidth, compute, deployments

---

## Next Steps

**After successful deployment:**

1. **Set up monitoring:** Error tracking, analytics
2. **Configure backups:** Database backups (Supabase)
3. **Create staging environment:** Separate Vercel project
4. **Document deployment:** Update team documentation
5. **Plan updates:** CI/CD workflow, automated testing

---

## Summary

**Deployment checklist:**
- ✅ Production database setup (Supabase)
- ✅ Migrations run on production
- ✅ Vercel account connected
- ✅ Repository imported
- ✅ Environment variables configured
- ✅ Deployment successful
- ✅ Post-deployment verification complete
- ✅ Custom domain (optional)

**Key points:**
- Use pooler connection (`:6543`)
- Generate new BETTER_AUTH_SECRET for production
- Update OAuth redirect URIs
- Monitor deployment logs
- Test all features after deployment

**Resources:**
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
