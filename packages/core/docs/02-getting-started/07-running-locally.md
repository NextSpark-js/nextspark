# Running Locally

## Introduction

Complete guide to running the development server, understanding watch modes, and optimizing your local development workflow.

---

## Starting Development Server

**Command:**
```bash
pnpm dev
```

**What happens (10-15 seconds):**

```text
[THEME]    Building theme CSS...        ✓ (2.1s)
[REGISTRY] Building registries...       ✓ (5.4s)
[DOCS]     Building docs index...       ✓ (1.1s)
[PLUGINS]  Starting plugin dev servers.. ✓ (1.8s)
[APP]      Starting Next.js...          ✓ (3.2s)

  ▲ Next.js 15.4.6
  - Local:        http://localhost:5173
  - Turbopack:    enabled

 ✓ Ready in 12s
```

**Access:** http://localhost:5173

---

## Development Processes

### 5 Concurrent Processes

**1. THEME (build-theme.mjs --watch)**
- Watches: `contents/themes/*/styles/*.css`
- Rebuilds: `app/theme-styles.css`
- Copies: `public/theme/` assets
- Triggers: Browser hot reload

**2. REGISTRY (build-registry.mjs --watch)**
- Watches: `contents/themes/`, `contents/plugins/`
- Rebuilds: `core/lib/registries/*.ts`
- Triggers: Server restart needed

**3. DOCS (build-docs-registry.mjs)**
- Runs once at startup
- Indexes: `core/docs/**/*.md`
- Outputs: `core/lib/registries/docs-registry.ts`

**4. PLUGINS (turbo dev)**
- Watches: Plugin source files
- Rebuilds: Plugin packages
- Triggers: Hot reload

**5. APP (next dev --turbopack)**
- Watches: `app/`, `core/components/`, etc.
- Rebuilds: React components, API routes
- Triggers: Fast refresh (< 100ms)

---

## Hot Module Replacement (HMR)

**What triggers instant reload:**
- ✅ React component changes
- ✅ Page route changes
- ✅ API route changes (server restarts)
- ✅ CSS changes (theme watcher)

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

### Theme Watcher

**Watches:**
```text
contents/themes/default/styles/
├── globals.css
├── components.css
└── utilities.css
```

**On change:**
1. Recompiles CSS
2. Outputs to `app/theme-styles.css`
3. Browser hot reloads

**Debounce:** 300ms (waits for multiple changes)

### Registry Watcher

**Watches:**
```text
contents/themes/default/
├── config/
│   ├── theme.config.ts
│   └── app.config.ts
└── entities/*/

contents/plugins/*/
└── plugin.config.ts
```

**On change:**
1. Regenerates registries
2. Outputs to `core/lib/registries/`
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
pnpm dev                   # All processes
```

**Build manually:**
```bash
pnpm registry:build        # Registries only
pnpm theme:build           # Theme CSS only
pnpm docs:build            # Docs index only
```

**Database:**
```bash
pnpm db:migrate            # Run migrations
pnpm db:verify             # Verify tables
```

**Testing:**
```bash
pnpm test                  # Unit tests
pnpm test:e2e              # E2E tests
pnpm cy:open               # Cypress UI
```

**Linting:**
```bash
pnpm lint                  # Check code
pnpm lint:fix              # Auto-fix
pnpm type-check            # TypeScript
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
/* Edit contents/themes/default/styles/globals.css */
/* → Theme watcher rebuilds → Hot reload */
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
rm -rf core/lib/registries/*
pnpm registry:build
pnpm dev
```

**Theme changes not applying:**
```bash
# Stop server
rm app/theme-styles.css
pnpm theme:build
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
[THEME]    Building theme: default
[THEME]    ✓ Compiled CSS (2.1s)

[REGISTRY] Scanning themes...
[REGISTRY] Scanning plugins...
[REGISTRY] Scanning entities...
[REGISTRY] ✓ Registry build completed (5.4s)

[DOCS]     Indexing 123 markdown files
[DOCS]     ✓ Docs indexed (1.1s)

[PLUGINS]  Starting workspace dev servers
[PLUGINS]  ✓ Plugins ready (1.8s)

[APP]       ▲ Next.js 15.4.6
[APP]       - Local: http://localhost:5173
[APP]      ✓ Ready in 3.2s
```

**Errors to watch for:**
```text
❌ Registry build failed → Check entity configs
❌ Theme build failed → Check CSS syntax
❌ Type error → Check TypeScript
❌ Port in use → Kill process or use different port
```

---

## Auto-Generated Files (Never Edit)

**These regenerate every dev session:**

```text
.next/                    # Next.js cache
core/lib/registries/      # All registry files
app/theme-styles.css      # Compiled theme CSS
public/theme/             # Theme assets
```

**To make changes:**
- **Registries:** Edit source in `contents/`
- **Theme CSS:** Edit in `contents/themes/*/styles/`
- **Assets:** Edit in `contents/themes/*/public/`

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

**Default:** Port 5173

**Change port:**
```bash
# Edit package.json dev script
"dev": "... next dev --turbopack -p 3000"

# Update .env.local
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Restart
pnpm dev
```

---

## Troubleshooting

**Server won't start:**
1. Check port 5173 is free
2. Check Node.js version (18+)
3. Check pnpm version (10.17.0)
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
- `pnpm dev` → 5 processes, 10-15s startup
- Access: http://localhost:5173

**Watch modes:**
- Theme: Auto-rebuilds CSS
- Registry: Auto-rebuilds (needs restart)
- Next.js: Hot module replacement

**Manual commands:**
- `pnpm registry:build` - Rebuild registries
- `pnpm theme:build` - Rebuild theme
- `pnpm lint` - Check code quality

**Never edit:**
- `.next/`
- `core/lib/registries/`
- `app/theme-styles.css`
- `public/theme/`

**Next:** [First Customization](./06-first-customization.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
