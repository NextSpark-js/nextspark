# Troubleshooting

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

Common issues and solutions for the NPM distribution system.

## Build Issues

### Registry Generation Fails

**Error:**
```
Error: Cannot find module './registry/config.mjs'
```

**Solution:**
Check that you're running from project root:

```bash
cd /path/to/project
pnpm build:registries
```

### TypeScript Path Resolution

**Error:**
```
Cannot find module '@/core/components/...'
```

**Solutions:**

1. Check `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/core/*": ["./packages/core/*"]
    }
  }
}
```

2. Restart TypeScript server in IDE

3. Clear TypeScript cache:
```bash
pnpm exec tsc --noEmit
```

### Script Path Errors

**Error:**
```
ENOENT: no such file or directory 'core/templates/...'
```

**Cause:** Script using old `core/` path instead of `packages/core/`

**Solution:** Update the script's path resolution:

```javascript
// Check rootDir calculation
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')  // Adjust levels

// Use new path
const templatesDir = join(ROOT_DIR, 'packages/core/templates')
```

## Configuration Issues

### Config Not Loading

**Symptoms:**
- Plugins not activating
- Features not applying
- Default values used everywhere

**Debug:**
```bash
# Resolve the active theme and list its generated config files
theme=$(sed -n 's/^NEXT_PUBLIC_ACTIVE_THEME=//p' .env | tr -d '"')
ls "contents/themes/$theme/config"
```

**Common causes:**

1. **Theme mismatch:** `NEXT_PUBLIC_ACTIVE_THEME` does not match a directory in `contents/themes/`

2. **Syntax error:** Run `pnpm exec tsc --noEmit`

3. **Wrong export in a manually created `nextspark.config.ts`:**
```typescript
// ❌ Wrong
module.exports = { ... }

// ✅ Correct
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({ ... })
```

The wizard does not create `nextspark.config.ts`; generated configuration lives
under `contents/themes/<theme>/config/`.

### Plugins Not Activating

**Debug:**
```bash
# Check plugin exists
ls contents/plugins/

# Check the active theme's plugin list
theme=$(sed -n 's/^NEXT_PUBLIC_ACTIVE_THEME=//p' .env | tr -d '"')
grep -n 'plugins:' "contents/themes/$theme/config/theme.config.ts"
```

**Solutions:**

1. Verify plugin name matches directory name
2. Check the active theme's `config/theme.config.ts` has the plugin listed
3. Regenerate registries: `pnpm build:registries`

### Features Not Disabling

**Symptoms:** Features still appear despite being disabled in config

**Check:**
```typescript
// nextspark.config.ts
export default defineConfig({
  features: {
    billing: false  // Must be explicit false, not undefined
  }
})
```

**Then:** Regenerate and rebuild:
```bash
pnpm build:registries
pnpm build
```

## Template Issues

### Theme Template Changes Not Applied

**Symptoms:** Theme customizations not appearing

**Debug:**
```bash
# Check theme is set
grep '^NEXT_PUBLIC_ACTIVE_THEME=' .env

# Check template overrides exist for the active theme
theme=$(sed -n 's/^NEXT_PUBLIC_ACTIVE_THEME=//p' .env | tr -d '"')
ls "contents/themes/$theme/templates/"
```

**Solutions:**

1. Set theme in `.env`:
```
NEXT_PUBLIC_ACTIVE_THEME=mytheme
```

2. Regenerate registries and copied template overrides:
```bash
pnpm build:registries
```

### Client/Server Component Error

**Error:**
```
Error: Cannot export generateMetadata from client component
```

**Cause:** Template has `'use client'` but also exports `generateMetadata`

**Solution:** Remove `'use client'` or move metadata to separate file:

```ejs
<%# page.tsx.ejs - Server Component %>
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: '<%= appName %>' }
}

export default function Page() {
  return <div>Content</div>
}
```

## CLI Issues

### Command Not Found

**Error:**
```
nextspark: command not found
```

**Solutions:**

1. Invoke the locally installed CLI through pnpm:
```bash
pnpm exec nextspark --help
```

2. Check installation:
```bash
ls node_modules/@nextsparkjs/cli/bin/
```

3. Reinstall:
```bash
pnpm install --frozen-lockfile
```

### Permission Denied

**Error:**
```
permission denied: nextspark
```

**Solution (Unix):**
```bash
chmod +x node_modules/@nextsparkjs/cli/bin/nextspark.js
```

## Database Issues

### Migration Fails

**Error:**
```
Error: relation "users" does not exist
```

**Solutions:**

1. Check `DATABASE_URL` is set correctly
2. Run migrations in order:
```bash
pnpm db:migrate
```

3. Check migration files exist:
```bash
ls node_modules/@nextsparkjs/core/migrations/
```

## Development Server Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. Kill existing process:
```bash
lsof -tiTCP:3000 -sTCP:LISTEN
ps -o command= -p <PID>
kill <PID>
```

2. Use different port:
```bash
PORT=3001 pnpm dev
```

### Hot Reload Not Working

**Causes:**
- File watcher limit reached
- Wrong file being watched

**Solutions:**

1. Increase watcher limit (Linux):
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

2. Clear cache:
```bash
rm -rf .next
pnpm dev
```

## Registry Issues

### Stale Registry Data

**Symptoms:**
- New entities not appearing
- Old entities still showing
- Wrong translations

**Solution:**
```bash
pnpm build:registries
```

### Registry Import Errors

**Error:**
```
Circular dependency detected in registry
```

**Debug:**
```bash
# Check for circular imports
pnpm lint
```

**Solution:** Ensure registries only contain data, no business logic.

## Getting Help

If none of these solutions work:

1. **Check logs:**
```bash
pnpm build:registries
```

2. **Open an issue:** Include:
   - Error message
   - Steps to reproduce
   - Environment (OS, Node version)
   - Config files

3. **Debug mode:**
```bash
DEBUG=nextspark:* pnpm dev
```

## Related

- [06-path-resolution.md](./06-path-resolution.md) - Path issues
- [04-config-system.md](./04-config-system.md) - Config issues
- [07-template-system.md](./07-template-system.md) - Template issues
