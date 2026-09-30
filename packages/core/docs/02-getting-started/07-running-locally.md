# Running Locally

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark prepare --watch`.

## Introduction

Complete guide to running the development server, understanding watch modes, and optimizing your local development workflow.

---

## Starting Development Server

**Command:**
```bash
pnpm dev
```

The root script delegates to `apps/dev`, which runs `nextspark dev`. It reads the port from `apps/dev/.env`:

```text
> @nextsparkjs/dev dev
> dotenv -e .env -- sh -c 'node ../../packages/cli/dist/cli.js dev --turbopack -p $PORT'
```

**Access:** use the local URL printed by Next.js (port 3010 in the measured `apps/dev/.env`).

---

## Development Processes

### One Command: Generation, Watcher and Next.js

**`pnpm dev`**
- Generates `src/app` and the registries before Next starts (and stops if that fails).
- Starts Next.js with Turbopack.
- Keeps a watcher that regenerates them when the sources change.
- Watches application code and the theme CSS imported by the generated root layout (`apps/dev/src/app/layout.tsx`).
- Uses `PORT` from `apps/dev/.env`.

**Standalone watcher (optional; `pnpm dev` already includes it)**

```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare --watch
```

- Watches: `templates/`, `api/`, `plugins/`, `entities/`, `config/`, `blocks/`, `messages/`, `emails/`, `auth/`, `docs/public/`, `docs/superadmin/`, `nextspark.config.ts` and `next.config.*`
- Rebuilds: `src/app` and `.nextspark/registries/*.ts`, including `docs-registry.ts`
- Triggers: nothing to restart; the dev server serves the regenerated files

---

## Hot Module Replacement (HMR)

**What triggers instant reload:**
- ✅ React component changes
- ✅ Page route changes
- ✅ API route changes (server restarts)
- ✅ CSS changes imported by Next.js

**Regenerated automatically (no restart):**
- ✅ Entity, plugin, block, message, template and config changes

**What requires manual restart:**
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

the generated root layout (`apps/dev/src/app/layout.tsx`, written by `nextspark prepare`) imports the project stylesheet. Next.js watches that dependency directly:
```text
styles/
├── globals.css
├── components.css
└── utilities.css
```

There is no separate `theme:build` or theme watcher script at the monorepo root.

### Registry Watcher

**Watches:**
```text
plugins/<enabled-plugin>/
entities/
config/
blocks/
messages/
templates/
```

**On change:**
1. Regenerates `src/app` and the registries
2. Outputs to `.nextspark/registries/`
3. The dev server serves the result; **no restart**

If a regeneration fails (for example a syntax error), the last valid output stays and the error shows in the terminal and in the browser; fix the file and it regenerates.

---

## Development Commands

**Start dev server:**
```bash
pnpm dev                   # Generates, watches and runs Next.js
```

**Build manually:**
```bash
cd apps/dev && node ../../packages/cli/dist/cli.js prepare  # Registries only, including docs
pnpm build                 # Generates, then builds the app (including imported theme CSS)
```

**Database:**
```bash
pnpm db:migrate            # Run migrations
cd apps/dev && node ../../packages/core/scripts/db/verify-tables.mjs             # Inspect Better Auth tables
```

**Testing:**
```bash
pnpm test:core             # Core unit tests
pnpm --dir apps/dev exec jest --watchman=false            # Project unit tests
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
/* Edit styles/globals.css */
/* → Next.js recompiles the imported CSS */
```

**3. Entity changes:**
```typescript
// Edit entities/tasks/tasks.config.ts
// → The watcher regenerates src/app and the registries
// → No restart needed
```

**4. API route changes:**
```typescript
// Edit api/tasks/route.ts
// → Server restarts automatically
// → Test in browser/Postman
```

### When to Manually Rebuild

**Registry changes not detected:**
```bash
# Stop server
rm -rf .nextspark/registries
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
pnpm dev
```

**Theme changes not applying:**
```bash
# Verify the stylesheet import; if it is missing, regenerate
grep -F 'styles/globals.css' apps/dev/src/app/layout.tsx
cd apps/dev && node ../../packages/cli/dist/cli.js prepare
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
- **Registries:** Edit root-first project source or `plugins/`, then rebuild registries.
- **Theme CSS:** Edit in `styles/`; Next.js follows the import from the generated `apps/dev/src/app/layout.tsx`.
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

**See:** [Troubleshooting Guide](./10-troubleshooting.md)

---

## Summary

**Start development:**
- `pnpm dev` → generation, watcher and Next.js on `PORT` from `apps/dev/.env`
- Access: use the local URL printed by Next.js

**Watch modes:**
- Theme CSS: Recompiled by Next.js
- Registry and `src/app`: regenerated by `pnpm dev` on change (no restart)
- Next.js: Hot module replacement

**Manual commands:**
- `cd apps/dev && node ../../packages/cli/dist/cli.js prepare` - Rebuild registries
- `pnpm build` - Build the application and imported theme CSS
- `pnpm lint` - Check code quality

**Never edit:**
- `.next/`
- `.nextspark/registries/`

**Next:** [First Customization](./09-first-customization.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
