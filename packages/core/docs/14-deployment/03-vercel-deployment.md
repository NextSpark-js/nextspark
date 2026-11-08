# Vercel Deployment

> **Experimental:** Deployment to Vercel is not part of the stable 1.0 surface and may change without a deprecation period.

## Introduction

Vercel is an experimental deployment target, offering **zero-configuration deployments** for Next.js applications with automatic HTTPS, global CDN, and instant rollbacks.

---

## Initial Setup

### 1. Create Vercel Account

```bash
# Sign up at https://vercel.com
# Can use GitHub account for easy integration
```

### 2. Install Vercel CLI

```bash
# Install globally
npm install -g vercel

# Or use with pnpm
pnpm add -g vercel

# Verify installation
vercel --version
```

### 3. Login to Vercel

```bash
# Login via CLI
vercel login

# Follow prompts to authenticate
```

### 4. Configure Project

```bash
# Add to .env
VERCEL_TEAM=your-team-slug
VERCEL_PROJECT=your-project-name  # Optional

# Find team slug: Vercel Dashboard → Settings → General
```

### 5. Set the Client Address Source

Add `NEXTSPARK_CLIENT_IP_SOURCE=vercel` to the production and preview environment variables, so rate limits and audit logs use the client address Vercel sets. See [Client Address](./10-client-address.md).

---

## Using the Automated Script

### First Deployment

```bash
# Deploy to staging (first time)
pnpm vercel:deploy --staging

# Script will prompt to:
# 1. Set up and link project
# 2. Select team/scope
# 3. Link to existing project or create new
# 4. Upload environment variables
# 5. Deploy
```

### Subsequent Deployments

```bash
# Deploy to staging
pnpm vercel:deploy --staging

# Deploy to production
pnpm vercel:deploy --prod

# Skip environment variable update
pnpm vercel:deploy --prod --skip-env
```

---

## Project Linking

### Automatic Linking

The script handles project linking automatically:

```bash
# First run creates .vercel directory
pnpm vercel:deploy --staging

# Creates:
.vercel/
├── project.json      # Project configuration
└── README.txt        # Vercel CLI info
```

### Manual Linking

```bash
# Link to existing project
vercel link

# Create new project
vercel --yes
```

---

## Domain Configuration

### Adding Custom Domain

```bash
# 1. Go to Vercel Dashboard
# 2. Project → Settings → Domains
# 3. Add domain (e.g., app.yourdomain.com)
# 4. Configure DNS with your provider

# DNS Configuration (example)
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

### Environment-Specific Domains

```bash
# Production
app.yourdomain.com → Production environment

# Staging
stg-app.yourdomain.com → Preview environment (staging)

# Automatic preview URLs
your-project-git-branch-team.vercel.app
```

---

## Build Configuration

### Vercel Settings

```json
// vercel.json (optional customization)
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"]  // US East (optional)
}
```

### Build Settings in Dashboard

```bash
# Project Settings → General
Framework Preset: Next.js
Root Directory: ./
Build Command: pnpm build
Install Command: pnpm install
Output Directory: .next
Node Version: 22.x
```

### The Project's API Directory

Vercel treats a root `api/` directory as a directory of its own functions, also in a Next.js project with a custom Build Command. A project that keeps its Route Handlers in the default `api/` gets each file built twice: once by `next build`, through the generated route under `src/app/api/`, and once more as a separate function. Builds take much longer (the time grows with the number of files), and the deployment carries functions the application does not use.

Any other directory name avoids it. Vercel only looks at the `api/` directory at the root of the project.

To move the directory:

1. Set `apiDir` in `nextspark.config.ts`:

   ```ts
   export default defineConfig({
     apiDir: 'routes', // or 'server/api'
   })
   ```

2. Move the files, for example with `git mv api routes`.
3. Replace the imports of the old location (`@/api/` becomes `@/routes/`).
4. Run `pnpm nextspark prepare`. A route file left in `api/` stops it with `NS_HOST_API_DIR_LEFTOVER`.
5. Restart `nextspark dev` if it was running.

The URLs do not change: the directory is still served at `/api/<path>`. `apiDir` is a relative path inside the project with segments of letters, digits, `-` and `_`. It cannot be, or live under, a root directory with another use (`app`, `public`, `node_modules`, `templates`, `lib` and the like), or `api/` itself.

The other options of `vercel.json` do not solve this:

| Option | Why not |
| --- | --- |
| `builds` with `@vercel/next` | It turns the detection off, but Vercel recommends against the property, it cannot be combined with `functions`, and nothing guarantees that your Build Command still runs, so a deployment could skip a step such as its migrations. |
| `.vercelignore` with `api/` | It removes the files the generated routes under `src/app/api/` import, so the build fails. |
| `functions` and `excludeFiles` | They configure a function that was already detected. `excludeFiles` leaves files out of its bundle. No option takes a path out of the detection. |

---

## Deployment Scopes

### Production vs Preview

```typescript
const DEPLOYMENT_SCOPES = {
  production: {
    command: 'pnpm vercel:deploy --prod',
    environment: 'production',
    domain: 'app.yourdomain.com',
    variables: 'Production scope',
  },
  
  staging: {
    command: 'pnpm vercel:deploy --staging',
    environment: 'preview',
    domain: 'stg-app.yourdomain.com',
    variables: 'Preview scope',
  },
}
```

---

## Monitoring Deployments

### Vercel Dashboard

```bash
# View deployments
1. Go to project in Vercel Dashboard
2. Deployments tab
3. See status, logs, and details

# Deployment states:
- Building  → In progress
- Ready     → Successful
- Error     → Failed (check logs)
```

### CLI Monitoring

```bash
# List deployments
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Inspect deployment
vercel inspect [deployment-url]
```

---

## Troubleshooting

### Build Failures

```bash
# Check build logs in Vercel Dashboard
# Common issues:

# 1. Missing environment variables
Solution: Ensure all required vars are set
Check: Project Settings → Environment Variables

# 2. Build errors
Solution: Test build locally first
pnpm build

# 3. Node version mismatch
Solution: Set Node version in Project Settings
Recommended: 22.x

# 4. Out of memory
Solution: Contact Vercel support or optimize build
```

### Deployment Errors

```bash
# Domain not resolving
Solution: Check DNS configuration
Wait: DNS propagation can take 24-48 hours

# Environment variables not applied
Solution: Redeploy after variable changes
pnpm vercel:deploy --staging

# Preview deployment not working
Solution: Check branch name matches Git branch
Ensure branch is pushed to GitHub
```

---

## Manual Deployment (Alternative)

### Using Vercel CLI Directly

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Deploy with specific environment
vercel --env VARIABLE=value --prod
```

### GitHub Integration

```bash
# 1. Connect repository in Vercel Dashboard
# 2. Configure automatic deployments:
#    - main branch → Production
#    - staging branch → Preview (staging)
#    - feature branches → Preview

# 3. Push to GitHub triggers automatic deployment
git push origin main  # Auto-deploys to production
```

---

## Quick Reference

### Commands

```bash
# Automated script (recommended)
pnpm vercel:deploy --staging     # Deploy staging
pnpm vercel:deploy --prod        # Deploy production

# Vercel CLI
vercel                           # Deploy preview
vercel --prod                    # Deploy production
vercel login                     # Login
vercel link                      # Link project
vercel env ls                    # List variables
vercel logs                      # View logs
vercel rollback                  # Rollback deployment
```

### Dashboard URLs

```bash
# Main dashboard
https://vercel.com/dashboard

# Project settings
https://vercel.com/[team]/[project]/settings

# Deployments
https://vercel.com/[team]/[project]/deployments

# Environment variables
https://vercel.com/[team]/[project]/settings/environment-variables
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development  
**Platform:** Vercel
