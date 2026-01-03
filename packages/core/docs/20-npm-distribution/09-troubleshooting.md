# Troubleshooting

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
rm -rf node_modules/.cache
pnpm tsc --noEmit
```

### Script Path Errors

**Error:**
```
ENOENT: no such file or directory 'core/presets/...'
```

**Cause:** Script using old `core/` path instead of `packages/core/`

**Solution:** Update the script's path resolution:

```javascript
// Check rootDir calculation
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')  // Adjust levels

// Use new path
const presetsDir = join(ROOT_DIR, 'packages/core/presets')
```

## Configuration Issues

### Config Not Loading

**Symptoms:**
- Plugins not activating
- Features not applying
- Default values used everywhere

**Debug:**
```bash
# Check config file exists
cat nextspark.config.ts

# Check for syntax errors
pnpm tsc nextspark.config.ts --noEmit
```

**Common causes:**

1. **File doesn't exist:** Create `nextspark.config.ts` in project root

2. **Syntax error:** Check for TypeScript errors

3. **Wrong export:**
```typescript
// ❌ Wrong
module.exports = { ... }

// ✅ Correct
export default defineConfig({ ... })
```

### Plugins Not Activating

**Debug:**
```bash
# Check plugin exists
ls contents/plugins/

# Check config
grep plugins nextspark.config.ts
```

**Solutions:**

1. Verify plugin name matches directory name
2. Check `nextspark.config.ts` has plugin listed
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

### Template Not Applied

**Symptoms:** Theme customizations not appearing

**Debug:**
```bash
# Check theme is set
echo $NEXT_PUBLIC_ACTIVE_THEME

# Check template exists
ls contents/themes/${NEXT_PUBLIC_ACTIVE_THEME}/templates/app/
```

**Solutions:**

1. Set theme in `.env`:
```
NEXT_PUBLIC_ACTIVE_THEME=mytheme
```

2. Regenerate app:
```bash
pnpm build:app
```

### EJS Syntax Error

**Error:**
```
SyntaxError: Unexpected token '%' in template
```

**Common causes:**

1. **Unclosed tag:**
```ejs
<% if (true) { %>  ← Missing closing %>
```

2. **Escaped percent:**
```ejs
<%% Use double percent to escape %>
```

3. **Quote mismatch:**
```ejs
<%= "string with ' mixed quotes" %>
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

1. Use npx:
```bash
npx nextspark --help
```

2. Check installation:
```bash
ls node_modules/@nextspark/core/bin/
```

3. Reinstall:
```bash
pnpm install
```

### Permission Denied

**Error:**
```
permission denied: nextspark
```

**Solution (Unix):**
```bash
chmod +x node_modules/@nextspark/core/bin/nextspark.mjs
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
ls packages/core/migrations/
```

## Development Server Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5173
```

**Solutions:**

1. Kill existing process:
```bash
lsof -i :5173
kill -9 <PID>
```

2. Use different port:
```bash
PORT=3000 pnpm dev
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
# Clear and regenerate
rm packages/core/lib/registries/*.ts
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
pnpm build:registries --verbose
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
