# Troubleshooting

## Introduction

Common issues and solutions when setting up and running NextSpark. This guide covers installation problems, build errors, runtime issues, and debugging strategies.

**Quick Reference:**
- [Installation Issues](#installation-issues)
- [Build Issues](#build-issues)
- [Runtime Issues](#runtime-issues)
- [Development Issues](#development-issues)
- [Deployment Issues](#deployment-issues)
- [Debug Strategies](#debug-strategies)

---

## Installation Issues

### "pnpm: command not found"

**Problem:** pnpm is not installed or not in PATH

**Solution:**
```bash
# Install pnpm globally
npm install -g pnpm@10.17.0

# Verify installation
pnpm -v
# Should show: 10.17.0
```

**Alternative (via Corepack):**
```bash
# Enable Corepack (comes with Node.js 16.9+)
corepack enable

# Install pnpm via Corepack
corepack prepare pnpm@10.17.0 --activate

# Verify
pnpm -v
```

**If still not found:**
```bash
# Find pnpm installation
which pnpm

# Add to PATH (macOS/Linux)
echo 'export PATH="$HOME/.local/share/pnpm:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Windows: Add to System Environment Variables
```

---

### "Node version too old"

**Problem:** Node.js version < 18.0.0

**Check version:**
```bash
node -v
# If showing v16.x.x or lower, upgrade needed
```

**Solution (macOS):**
```bash
# Using Homebrew
brew install node@20

# Verify
node -v
# Should show: v20.x.x
```

**Solution (Linux - Ubuntu/Debian):**
```bash
# Remove old version
sudo apt remove nodejs

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js 20
sudo apt-get install -y nodejs

# Verify
node -v
```

**Solution (Windows):**
- Download installer from [nodejs.org](https://nodejs.org)
- Run installer and follow prompts
- Restart terminal
- Verify with `node -v`

**Solution (nvm - All Platforms):**
```bash
# Install nvm first: https://github.com/nvm-sh/nvm

# Install Node.js 20
nvm install 20

# Use Node.js 20
nvm use 20

# Set as default
nvm alias default 20

# Verify
node -v
```

---

### "Unable to connect to database"

**Problem:** Database connection fails during migration or app startup

**Common Causes:**

#### 1. Incorrect DATABASE_URL format

**✅ Correct (pooler connection):**
```bash
postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres
```

**❌ Wrong (direct connection - fails in serverless):**
```bash
postgresql://postgres.xxxxx:password@aws-0-region.supabase.com:5432/postgres
```

**Fix:**
- Use pooler connection (port :6543)
- Get from Supabase Dashboard → Settings → Database → Connection pooling

#### 2. Password contains special characters

**Problem:** Special characters in password need URL encoding

**Characters that need encoding:**
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `#` → `%23`
- `&` → `%26`

**Example:**
```bash
# Password: my@pass:word
# Encoded: my%40pass%3Aword

DATABASE_URL="postgresql://postgres.xxxxx:my%40pass%3Aword@..."
```

**Auto-encode in JavaScript:**
```javascript
const password = "my@pass:word";
const encoded = encodeURIComponent(password);
console.log(encoded); // my%40pass%3Aword
```

#### 3. Database not running

**Check Supabase status:**
- Go to Supabase Dashboard
- Check if project is paused (free tier pauses after inactivity)
- Restart if needed

**Check local PostgreSQL:**
```bash
# macOS
brew services list | grep postgresql

# If not running:
brew services start postgresql@16

# Linux
sudo systemctl status postgresql

# If not running:
sudo systemctl start postgresql
```

#### 4. Network/firewall issues

**Test connection:**
```bash
# Install PostgreSQL client
brew install libpq  # macOS
sudo apt install postgresql-client  # Linux

# Test connection
psql "$(grep DATABASE_URL .env.local | cut -d'=' -f2-)"

# Should connect without errors
```

**If connection fails:**
- Check firewall settings
- Check VPN/proxy configuration
- Try from different network
- Contact database provider support

---

### Port 5173 already in use

**Problem:** Another process is using port 5173

**Find process:**
```bash
# macOS/Linux
lsof -i :5173

# Output shows:
# COMMAND   PID   USER
# node    12345  youruser
```

**Kill process:**
```bash
# Kill by PID
kill -9 12345

# Or kill all node processes on port 5173
lsof -ti :5173 | xargs kill -9
```

**Use different port:**
```bash
# Temporary (one-time)
next dev --turbopack -p 3000

# Or edit .env.local
PORT=3000

# Remember to update:
# BETTER_AUTH_URL=http://localhost:3000
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### "Dependencies failed to install"

**Problem:** `pnpm install` fails with errors

**Common solutions:**

#### 1. Clear cache and retry
```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

#### 2. Check disk space
```bash
# Check available space
df -h

# pnpm install requires ~1-2GB free space
```

#### 3. Network issues
```bash
# Try different registry
pnpm config set registry https://registry.npmjs.org/

# Or use npm mirror
pnpm config set registry https://registry.npmmirror.com/
```

#### 4. Playwright browsers fail
```bash
# If Playwright browser download fails, install manually
pnpx playwright install

# Or skip Playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install
```

---

## Build Issues

### Registry Build Fails

**Problem:** `pnpm registry:build` fails with errors

**Common Causes:**

#### 1. Syntax error in entity config

**Error message:**
```text
SyntaxError: Unexpected token in entity config
Error in: contents/themes/default/entities/tasks/tasks.config.ts
```

**Solution:**
```bash
# Check TypeScript syntax in config file
code contents/themes/default/entities/tasks/tasks.config.ts

# Run TypeScript checker
pnpm type-check

# Fix syntax errors and rebuild
pnpm registry:build
```

**Common syntax errors:**
- Missing comma in object
- Unclosed bracket
- Invalid property name
- TypeScript type mismatch

#### 2. Invalid plugin config

**Error message:**
```text
Error loading plugin: ai
Plugin config validation failed
```

**Solution:**
```bash
# Check plugin config structure
code contents/plugins/ai/plugin.config.ts

# Verify required fields:
# - id
# - name
# - version
# - enabled (boolean)

# Fix and rebuild
pnpm registry:build
```

#### 3. Missing required fields

**Error message:**
```text
ValidationError: Missing required field 'name' in entity config
```

**Solution:**
```typescript
// Ensure all required fields are present
export const taskConfig: EntityConfig = {
  name: 'tasks',          // REQUIRED
  label: 'Tasks',         // REQUIRED
  pluralLabel: 'Tasks',   // REQUIRED
  icon: 'CheckSquare',    // REQUIRED
  // ... other fields
}
```

#### 4. Circular dependencies

**Error message:**
```text
Error: Circular dependency detected in entity configs
```

**Solution:**
- Check entity dependencies
- Ensure no circular references
- Use lazy loading if needed

**Debug verbose:**
```bash
# Run with debug output
node core/scripts/build/registry.mjs --build --verbose

# Check which entity/plugin is causing the issue
```

---

### Theme Build Fails

**Problem:** `pnpm theme:build` fails

**Common Causes:**

#### 1. CSS syntax errors

**Error message:**
```text
Error compiling CSS: Unexpected token
File: contents/themes/default/styles/globals.css
```

**Solution:**
```bash
# Check CSS syntax
code contents/themes/default/styles/globals.css

# Common errors:
# - Missing semicolon
# - Unclosed bracket
# - Invalid CSS property
# - Malformed @import statement

# Fix and rebuild
pnpm theme:build
```

#### 2. Missing theme files

**Error message:**
```text
Theme not found: default
Required files missing in: contents/themes/default/
```

**Solution:**
```bash
# Verify theme structure
ls -la contents/themes/default/

# Required files:
# - theme.config.ts
# - styles/ (directory)

# If missing, create theme structure
# or check NEXT_PUBLIC_ACTIVE_THEME matches directory name
```

#### 3. Invalid CSS variables

**Error message:**
```text
Invalid CSS variable definition
```

**Solution:**
```css
/* ✅ Correct */
:root {
  --color-primary: #3b82f6;
  --font-sans: Inter, sans-serif;
}

/* ❌ Wrong */
:root {
  --color-primary #3b82f6;  /* Missing colon */
  ---font-sans: Inter;       /* Too many dashes */
}
```

---

### TypeScript Errors

**Problem:** Type checking fails

**Check errors:**
```bash
pnpm type-check

# Or with details
npx tsc --noEmit
```

**Common errors:**

#### 1. Type mismatch

**Error:**
```text
Type 'string | undefined' is not assignable to type 'string'
```

**Solution:**
```typescript
// ❌ Wrong
const value: string = optional?.field;

// ✅ Correct
const value: string = optional?.field ?? '';

// Or with type guard
if (optional?.field) {
  const value: string = optional.field;
}
```

#### 2. Missing type definitions

**Error:**
```text
Could not find a declaration file for module 'some-package'
```

**Solution:**
```bash
# Install type definitions
pnpm add -D @types/some-package

# Or if not available, create declaration
echo "declare module 'some-package';" > some-package.d.ts
```

#### 3. Import path errors

**Error:**
```text
Cannot find module '@/core/lib/...'
```

**Solution:**
```bash
# Check tsconfig.json paths are correct
# Verify file exists at import path
# Check case sensitivity (macOS is case-insensitive, Linux is not)

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## Runtime Issues

### "Theme not found"

**Problem:** App fails to load with theme error

**Error in console:**
```text
Error: Theme not found: default
Theme directory does not exist: contents/themes/default
```

**Solution:**

#### 1. Check NEXT_PUBLIC_ACTIVE_THEME

```bash
# Check .env.local
grep NEXT_PUBLIC_ACTIVE_THEME .env.local

# Should match directory name exactly (case-sensitive)
NEXT_PUBLIC_ACTIVE_THEME="default"
```

#### 2. Verify theme directory exists

```bash
# List themes
ls contents/themes/

# Should show: default/

# If missing, check if you renamed it
# Or create new theme structure
```

#### 3. Rebuild registries

```bash
# Clear and rebuild
rm -rf core/lib/registries/*
pnpm registry:build
```

#### 4. Restart dev server

```bash
# Stop server (Ctrl+C)
# Restart
pnpm dev
```

---

### "Entity not found in registry"

**Problem:** Runtime error when accessing entity

**Error:**
```text
EntityError: Entity 'tasks' not found in registry
```

**Solution:**

#### 1. Check entity exists

```bash
# Verify entity directory
ls contents/themes/default/entities/tasks/

# Should contain:
# - tasks.config.ts
# - tasks.fields.ts (optional)
```

#### 2. Rebuild registry

```bash
# Registry may be out of sync
pnpm registry:build

# Restart dev server
pnpm dev
```

#### 3. Check entity config

```typescript
// Verify entity name matches
export const taskConfig: EntityConfig = {
  name: 'tasks',  // Must match entity directory name
  // ...
}
```

---

### "Failed to load registries"

**Problem:** App crashes on startup with registry error

**Error:**
```text
Error: Failed to load registries
Module not found: core/lib/registries/entity-registry
```

**Solution:**

#### 1. Generate registries

```bash
# Registries may not have been built
pnpm registry:build
```

#### 2. Check registries directory

```bash
# Verify files exist
ls core/lib/registries/

# Should show:
# - entity-registry.ts
# - entity-registry.client.ts
# - plugin-registry.ts
# - etc.
```

#### 3. Clear Next.js cache

```bash
# Clear .next directory
rm -rf .next

# Rebuild registries
pnpm registry:build

# Restart dev server
pnpm dev
```

---

### Database Connection Errors

**Problem:** Runtime database errors

**Error:**
```text
Error: Connection terminated unexpectedly
Error: Could not connect to database
```

**Solutions:**

#### 1. Check DATABASE_URL is loaded

```typescript
// In a server component or API route
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
```

**If NOT SET:**
- Verify `.env.local` exists
- Restart dev server (env vars loaded at startup)
- Check no typos in variable name

#### 2. Test connection

```bash
# Run migrations to test connection
pnpm db:migrate

# If succeeds, database is accessible
```

#### 3. Check connection pooling

**Error:**
```text
Error: remaining connection slots are reserved
```

**Solution:**
- Use pooler connection (:6543)
- Not direct connection (:5432)
- Check Supabase connection pooling settings

---

### Authentication Failures

**Problem:** Login/signup fails

**Common issues:**

#### 1. BETTER_AUTH_SECRET missing

**Error:**
```text
Error: BETTER_AUTH_SECRET is required
```

**Solution:**
```bash
# Generate secret
openssl rand -base64 32

# Add to .env.local
BETTER_AUTH_SECRET="generated-secret-here"

# Restart server
```

#### 2. Redirect URL mismatch

**Error:**
```text
Error: redirect_uri_mismatch
```

**Solution:**
```bash
# Check BETTER_AUTH_URL matches current URL
BETTER_AUTH_URL="http://localhost:5173"

# For Google OAuth, update redirect URI in Google Console:
# http://localhost:5173/api/auth/callback/google
```

#### 3. Email verification not sending

**Check Resend configuration:**
```bash
# Verify API key is set
grep RESEND_API_KEY .env.local

# Verify email is verified in Resend dashboard
grep RESEND_FROM_EMAIL .env.local
```

**Test email sending:**
- Log in to Resend dashboard
- Check API logs for errors
- Verify domain is verified (or use test mode)

---

### Email Sending Failures

**Problem:** Emails not sending

**Error:**
```text
Error: Failed to send email
ResendError: Invalid API key
```

**Solutions:**

#### 1. Check RESEND_API_KEY

```bash
# Verify key is set and correct
grep RESEND_API_KEY .env.local

# Test key in Resend dashboard
# API Keys → Test API Key
```

#### 2. Verify sender email

```bash
# Check sender email is verified
grep RESEND_FROM_EMAIL .env.local

# In Resend dashboard:
# Domains → Verify your domain
# Or use test mode with resend.dev address
```

#### 3. Check rate limits

**Free tier limits:**
- 100 emails/day
- 1 email/second

**If exceeded:**
- Upgrade plan
- Wait for limit reset
- Reduce email frequency

---

## Development Issues

### HMR Not Working

**Problem:** Hot Module Replacement doesn't reload changes

**Solutions:**

#### 1. Restart dev server

```bash
# Stop (Ctrl+C)
# Start
pnpm dev
```

#### 2. Clear Next.js cache

```bash
rm -rf .next
pnpm dev
```

#### 3. Check file watchers

```bash
# macOS - increase file watch limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Linux
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 4. Disable browser cache

- Open DevTools (F12)
- Network tab
- Check "Disable cache"
- Keep DevTools open

---

### Slow Build Times

**Problem:** `pnpm dev` or `pnpm build` takes too long

**Normal times:**
- Dev startup: 10-15 seconds
- Registry build: 5-10 seconds
- Production build: 2-3 minutes

**If slower:**

#### 1. Check CPU usage

```bash
# Monitor during build
top  # macOS/Linux
# or
htop  # If installed
```

**If CPU maxed out:**
- Close unnecessary applications
- Upgrade hardware (if possible)
- Use production build less frequently

#### 2. Clear caches

```bash
# Clear all caches
rm -rf .next
rm -rf node_modules/.cache
rm -rf core/lib/registries/*

# Rebuild
pnpm registry:build
pnpm dev
```

#### 3. Reduce watch scope

```bash
# If using watch modes, they may be too broad
# Check .gitignore to exclude unnecessary paths
```

---

### Memory Issues

**Problem:** Process crashes with memory errors

**Error:**
```text
FATAL ERROR: Ineffective mark-compacts near heap limit
JavaScript heap out of memory
```

**Solution:**

#### 1. Increase Node.js memory

```bash
# In package.json, update scripts:
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=4096' node scripts/... && next dev...",
    "build": "NODE_OPTIONS='--max-old-space-size=4096' node scripts/... && next build"
  }
}
```

#### 2. Close other applications

- Free up system RAM
- Close browser tabs
- Close IDEs not in use

#### 3. Check for memory leaks

```bash
# Use Node.js profiler
node --inspect core/scripts/build/registry.mjs

# Open chrome://inspect in Chrome
# Take heap snapshots to identify leaks
```

---

## Deployment Issues

### Vercel Build Fails

**Problem:** Deployment fails on Vercel

**Common causes:**

#### 1. Environment variables missing

**Error:**
```text
Error: Required environment variable not set
```

**Solution:**
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Add all required variables:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_ACTIVE_THEME`
  - `RESEND_API_KEY`
  - etc.

#### 2. Build command fails

**Error:**
```text
Error: Build failed with exit code 1
```

**Debug:**
- Check Vercel build logs
- Run `pnpm build` locally to reproduce
- Fix errors shown in logs
- Redeploy

#### 3. TypeScript errors in production

**Error:**
```text
Type error: ...
```

**Solution:**
```bash
# Fix TypeScript errors locally first
pnpm type-check

# Ensure all errors are fixed
# Commit and redeploy
```

---

### Function Timeouts

**Problem:** API routes timeout on Vercel

**Error:**
```text
Error: Function execution timed out (30s limit)
```

**Solutions:**

#### 1. Optimize database queries

```typescript
// ❌ Slow
const tasks = await db.query('SELECT * FROM tasks');

// ✅ Fast
const tasks = await db.query(
  'SELECT id, title, status FROM tasks WHERE user_id = $1 LIMIT 20',
  [userId]
);
```

#### 2. Use connection pooling

- Ensure using pooler connection (`:6543`)
- Not direct connection (`:5432`)

#### 3. Implement pagination

```typescript
// Always paginate large datasets
const { page = 1, limit = 20 } = req.query;
const offset = (page - 1) * limit;

const tasks = await db.query(
  'SELECT * FROM tasks ORDER BY created_at DESC LIMIT $1 OFFSET $2',
  [limit, offset]
);
```

#### 4. Upgrade Vercel plan

- Free tier: 10-second timeout
- Pro tier: 60-second timeout
- Enterprise: Custom timeout

---

## Debug Strategies

### Enable Debug Logging

**Server-side:**
```typescript
// Add to .env.local
DEBUG=*

// Or specific module
DEBUG=next:*,better-auth:*
```

**Client-side:**
```typescript
// In browser console
localStorage.setItem('debug', '*');
```

### Check Browser Console

**Open DevTools (F12):**
- Console tab for JavaScript errors
- Network tab for API failures
- Application tab for storage/cookies
- Performance tab for slow operations

**Common console errors:**
```text
Failed to fetch → API route not responding
Hydration mismatch → Server/client render mismatch
CORS error → Cross-origin request blocked
```

### Check Server Logs

**Dev server:**
```bash
# Server logs print to terminal where you ran `pnpm dev`
# Look for errors, warnings, stack traces
```

**Production (Vercel):**
- Go to Vercel Dashboard → Project → Logs
- Filter by error, warning, info
- Check function logs for API routes

### Check Database Logs

**Supabase:**
- Dashboard → Logs → Database
- Check for connection errors
- Check for slow queries
- Check for RLS policy violations

**Local PostgreSQL:**
```bash
# macOS
tail -f /usr/local/var/log/postgres.log

# Linux
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Use Vercel Logs

```bash
# Install Vercel CLI
npm install -g vercel

# View logs
vercel logs <deployment-url>

# Follow logs in real-time
vercel logs <deployment-url> --follow
```

---

## Getting Help

### Before Asking for Help

**Collect information:**

1. **Error message** (exact text)
2. **Steps to reproduce** (what you did)
3. **Environment:**
   - OS (macOS, Linux, Windows)
   - Node.js version (`node -v`)
   - pnpm version (`pnpm -v`)
   - Browser (if frontend issue)

4. **Logs:**
   - Server logs (terminal output)
   - Browser console (F12)
   - Vercel logs (if deployed)

5. **Configuration:**
   - `.env.local` (without secrets)
   - `package.json` versions
   - Active theme name

### Support Channels

**GitHub Issues:**
- Search existing issues first
- Use issue templates
- Provide reproduction steps
- Include error logs

**Discord Community:**
- Real-time help
- Share code snippets
- Screen sharing for debugging

**Stack Overflow:**
- Tag: `nextspark`
- Search before posting
- Include minimal reproducible example

**Documentation:**
- Search docs: [Full Documentation](../README.md)
- Check related guides
- Review examples

---

## Summary

**Common issues:**
1. **Installation** - pnpm, Node.js, database connection
2. **Build** - Registry errors, theme errors, TypeScript errors
3. **Runtime** - Theme not found, entity errors, database errors
4. **Development** - HMR, slow builds, memory issues
5. **Deployment** - Vercel builds, environment variables, timeouts

**Debug workflow:**
1. Read error message carefully
2. Check this troubleshooting guide
3. Search documentation
4. Check browser/server logs
5. Test in isolation
6. Ask for help with details

**Prevention:**
- Keep dependencies updated
- Follow setup guides exactly
- Use recommended versions (Node.js, pnpm)
- Test locally before deploying
- Monitor logs regularly

**Next:** [Get detailed help in specific areas](../README.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
