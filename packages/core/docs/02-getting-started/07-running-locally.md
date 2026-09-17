# Running Locally

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

## Introduction

Complete guide to running the development server, understanding watch modes, and optimizing your local development workflow.

---

## Starting Development Server

**Command:**
```bash
pnpm dev
```

The root script delegates to `apps/dev` and starts one Next.js process. It reads the port from `apps/dev/.env`:

```text
> @nextsparkjs/dev dev
> dotenv -e .env -- sh -c 'next dev --turbopack -p $PORT'
```

**Access:** use the local URL printed by Next.js (port 3010 in the measured `apps/dev/.env`).

---

## Development Processes

### Main Process and Optional Registry Watcher

**1. APP (`pnpm dev`)**
- Starts Next.js with Turbopack.
- Watches application code and the theme CSS imported by `apps/dev/app/globals.css`.
- Uses `PORT` from `apps/dev/.env`.

**2. REGISTRY (optional, separate terminal)**

```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --watch
```

- Watches: `CONFIG.pluginsDir`, `<contentsDir>/entities`, `CONFIG.themesDir`, and `<contentsDir>/config`
- Rebuilds: `.nextspark/registries/*.ts`, including `docs-registry.ts`
- Documentation metadata comes from the active theme's `docs/public/` and `docs/superadmin/` directories
- Triggers: Server restart needed

---

## Hot Module Replacement (HMR)

**What triggers instant reload:**
- ✅ React component changes
- ✅ Page route changes
- ✅ API route changes (server restarts)
- ✅ CSS changes imported by Next.js

**What requires manual restart:**
- ⏸️ Registry changes (entity/plugin configs)
- ⏸️ Environment variable changes
- ⏸️ Next.js config changes
- ⏸️ TypeScript config changes

**How to restart:**
```bash
# Stop server (Ctrl+C)
# Start again
pnpm dev
```

---

## Watch Modes Explained

### Theme CSS

`apps/dev/app/globals.css` imports the active theme stylesheet. Next.js watches that dependency directly:
```text
themes/default/styles/
├── globals.css
├── components.css
└── utilities.css
```

There is no separate `theme:build` or theme watcher script at the monorepo root.

### Registry Watcher

**Watches:**
```text
CONFIG.pluginsDir
<contentsDir>/entities
CONFIG.themesDir
<contentsDir>/config
```

**On change:**
1. Regenerates registries
2. Outputs to `.nextspark/registries/`
3. **Requires server restart**

**Why restart needed:**
- Registries imported at app init
- Can't hot reload imports
- Must reload entire app

**Restart:**
```bash
# Ctrl+C to stop
pnpm dev
```

---

## Development Commands

**Start dev server:**
```bash
pnpm dev                   # One Next.js development process
```

**Build manually:**
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs  # Registries only, including docs
pnpm build                 # Production app build, including imported theme CSS
```

**Database:**
```bash
pnpm db:migrate            # Run migrations
cd apps/dev && node ../../packages/core/scripts/db/verify-tables.mjs             # Inspect Better Auth tables
```

**Testing:**
```bash
pnpm test:core             # Core unit tests
pnpm test:theme            # Active-theme unit tests
pnpm cy:run                # E2E tests
pnpm cy:open               # Cypress UI
```

**Linting:**
```bash
pnpm lint                                      # Check code
pnpm lint --fix                                # Auto-fix
pnpm --dir apps/dev exec tsc --noEmit          # Application TypeScript
```

---

## Development Workflow

### Making Changes

**1. Component changes:**
```typescript
// Edit core/components/ui/Button.tsx
// → Instant hot reload
```

**2. CSS changes:**
```css
/* Edit themes/default/styles/globals.css */
/* → Next.js recompiles the imported CSS */
```

**3. Entity changes:**
```typescript
// Edit contents/themes/default/entities/tasks/tasks.config.ts
// → Registry watcher rebuilds
// → MUST restart server
```

**4. API route changes:**
```typescript
// Edit app/api/v1/tasks/route.ts
// → Server restarts automatically
// → Test in browser/Postman
```

### When to Manually Rebuild

**Registry changes not detected:**
```bash
# Stop server
rm -rf .nextspark/registries
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
pnpm dev
```

**Theme changes not applying:**
```bash
# Stop server
# Verify the stylesheet import, then restart
grep -F 'themes/default/styles/globals.css' apps/dev/app/globals.css
pnpm dev
```

**Stale .next cache:**
```bash
# Stop server
rm -rf .next
pnpm dev
```

---

## Console Output

**Normal startup:**
```text
> @nextsparkjs/dev dev
> dotenv -e .env -- sh -c 'next dev --turbopack -p $PORT'

▲ Next.js
- Local: http://localhost:3010
✓ Ready
```

**Errors to watch for:**
```text
❌ Registry build failed → Check entity configs
❌ Type error → Check TypeScript
❌ Port in use → Kill process or use different port
```

---

## Auto-Generated Files (Never Edit)

**Generated output:**

```text
.next/                     # Next.js cache
.nextspark/registries/     # Written by an explicit registry build/watcher
```

**To make changes:**
- **Registries:** Edit source in `themes/` or `plugins/`, then rebuild registries.
- **Theme CSS:** Edit in `themes/*/styles/`; Next.js follows the import from `apps/dev/app/globals.css`.
- **Served assets:** Update the files under `apps/dev/public/theme/` used by the app.

---

## Performance Tips

**Faster startup:**
1. Close unnecessary apps
2. Use SSD for project
3. Exclude from antivirus
4. Increase Node.js memory

**Faster rebuilds:**
1. Only edit one file at a time
2. Wait for watchers to finish
3. Use manual builds when needed
4. Clear caches periodically

**Better HMR:**
1. Keep DevTools open
2. Disable browser cache
3. Use Chrome/Edge (better React DevTools)
4. Close unused tabs

---

## Port Configuration

**Source:** `PORT` in `apps/dev/.env` (3010 in the measured checkout).

**Change port:**
```bash
# Edit apps/dev/.env
PORT=3000

# Keep application URLs aligned with the same port
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Restart
pnpm dev
```

---

## Troubleshooting

**Server won't start:**
1. Check the `PORT` from `apps/dev/.env` is free
2. Check Node.js version (22.14+)
3. Check pnpm version (9.0.0)
4. Clear node_modules and reinstall

**HMR not working:**
1. Restart dev server
2. Clear .next directory
3. Hard refresh browser (Cmd+Shift+R)
4. Check console for errors

**Changes not appearing:**
1. Check correct file being edited
2. Wait for rebuild to finish
3. Manually rebuild if needed
4. Restart server

**See:** [Troubleshooting Guide](./08-troubleshooting.md)

---

## Summary

**Start development:**
- `pnpm dev` → one Next.js process on `PORT` from `apps/dev/.env`
- Access: use the local URL printed by Next.js

**Watch modes:**
- Theme CSS: Recompiled by Next.js
- Registry: Optional separate watcher (app restart may be needed)
- Next.js: Hot module replacement

**Manual commands:**
- `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` - Rebuild registries
- `pnpm build` - Build the application and imported theme CSS
- `pnpm lint` - Check code quality

**Never edit:**
- `.next/`
- `.nextspark/registries/`

**Next:** [First Customization](./06-first-customization.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
