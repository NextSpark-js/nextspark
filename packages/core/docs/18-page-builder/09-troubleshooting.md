# Troubleshooting

This guide helps you diagnose and fix common issues with the Page Builder system.

## Common Issues

### Block Not Appearing in Picker

**Symptoms**: Your custom block doesn't show up in the block picker.

**Causes & Solutions**:

1. **Registry not rebuilt**
   ```bash
   # Run the registry builder
   node core/scripts/build/registry.mjs
   ```

2. **Missing or invalid config.ts**
   ```typescript
   // Ensure config.ts exports correctly
   export const config = {
     slug: 'my-block',        // Required
     name: 'My Block',        // Required
     description: '...',      // Required
     category: 'content',     // Required (valid category)
   }
   ```

3. **Block in wrong directory**
   ```text
   ✅ contents/themes/default/blocks/my-block/
   ❌ core/blocks/my-block/
   ❌ contents/blocks/my-block/
   ```

4. **Theme not active**
   - Check `NEXT_PUBLIC_ACTIVE_THEME` in `.env`

---

### "Block not found" Error in Preview

**Symptoms**: Block shows error message instead of rendering.

**Causes & Solutions**:

1. **Component not in BLOCK_COMPONENTS map**
   ```typescript
   // app/components/page-renderer.tsx
   const BLOCK_COMPONENTS = {
     // Add your block here
     'my-block': MyBlockComponent,
   }
   ```

2. **Lazy import path incorrect**
   ```typescript
   // Check the import path
   const MyBlock = lazy(() =>
     import('@/contents/themes/default/blocks/my-block/component')
       .then(m => ({ default: m.MyBlock }))  // Named export
   )
   ```

3. **Component not exported**
   ```typescript
   // In component.tsx, ensure you export
   export function MyBlock(props) { ... }  // Not just default export
   ```

---

### Changes Not Saving

**Symptoms**: Edits disappear after refreshing.

**Causes & Solutions**:

1. **Not clicking Save**
   - Look for "Unsaved" indicator
   - Click the Save button explicitly

2. **Validation errors**
   - Check browser console for errors
   - Ensure required fields are filled

3. **Session expired**
   - Log out and log back in
   - Check network tab for 401 errors

4. **Database connection issue**
   ```bash
   # Check database connectivity
   npm run db:verify
   ```

---

### Preview Not Updating

**Symptoms**: Changes in settings don't reflect in preview.

**Causes & Solutions**:

1. **Debounce delay**
   - Wait 500ms after typing for changes to apply

2. **Block component not re-rendering**
   ```typescript
   // Ensure props are spread correctly
   <BlockComponent {...normalizedProps} />
   ```

3. **Props not normalized**
   - Check `normalizeBlockProps` in page-renderer.tsx
   - Dot notation (`cta.text`) must be converted to nested objects

4. **Cache issue**
   - Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`

---

### Page Not Showing Publicly

**Symptoms**: Published page shows 404.

**Causes & Solutions**:

1. **Page not published**
   - Check the Published status in editor
   - Click Publish button

2. **Slug conflicts with route**
   ```typescript
   // Reserved slugs that won't work:
   'api', 'auth', 'dashboard', 'admin', 'login', 'signup'
   ```

3. **ISR cache stale**
   - Wait up to 1 hour for cache refresh
   - Or trigger revalidation programmatically

4. **Entity archive taking precedence**
   - Pages should have priority, but check the slug
   - Ensure no entity has the same slug

---

### Form Fields Not Showing

**Symptoms**: Settings panel is empty or missing fields.

**Causes & Solutions**:

1. **fieldDefinitions not exported**
   ```typescript
   // fields.ts must export
   export const fieldDefinitions: FieldDefinition[] = [...]
   ```

2. **Missing tab property**
   ```typescript
   {
     name: 'title',
     type: 'text',
     tab: 'content',  // Required!
   }
   ```

3. **Registry outdated**
   ```bash
   node core/scripts/build/registry.mjs
   ```

---

### TypeScript Errors

**Symptoms**: Build fails with type errors in blocks.

**Causes & Solutions**:

1. **Props type mismatch**
   ```typescript
   // Ensure component props match schema
   import type { MyBlockProps } from './schema'
   export function MyBlock(props: MyBlockProps) { ... }
   ```

2. **Missing schema merge**
   ```typescript
   // Must merge with base schema
   export const schema = baseBlockSchema.merge(mySpecificSchema)
   ```

3. **Invalid field type**
   ```typescript
   // Use only supported types
   type: 'text' | 'textarea' | 'rich-text' | 'url' | 'number' | 'select' | 'image' | 'array'
   ```

---

### Drag and Drop Not Working

**Symptoms**: Can't reorder blocks.

**Causes & Solutions**:

1. **Wrong view mode**
   - Drag only works in Layout mode
   - Switch from Preview to Layout

2. **Browser extension interference**
   - Disable ad blockers temporarily
   - Try incognito mode

3. **dnd-kit dependency issue**
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable
   ```

---

### Array Field Issues

**Symptoms**: Can't add/remove items in repeater fields.

**Causes & Solutions**:

1. **maxItems reached**
   ```typescript
   // Check if you've hit the limit
   maxItems: 12  // Can't add more than 12
   ```

2. **minItems preventing removal**
   ```typescript
   // Can't remove if at minimum
   minItems: 1  // Can't go below 1 item
   ```

3. **itemFields not defined**
   ```typescript
   {
     type: 'array',
     itemFields: [  // Required for array type
       { name: 'title', type: 'text', ... }
     ]
   }
   ```

---

## Debugging Tools

### Browser DevTools

1. **Inspect data attributes**
   ```html
   <div data-block-id="abc-123" data-block-slug="hero">
   ```

2. **Check console for errors**
   - Open DevTools → Console tab
   - Look for red error messages

3. **Network tab**
   - Check API calls to `/api/v1/pages`
   - Look for failed requests (red)

### Data Attributes Reference

| Attribute | Location | Purpose |
|-----------|----------|---------|
| `data-page-id` | Page wrapper | Page UUID |
| `data-page-slug` | Page wrapper | Page URL slug |
| `data-block-id` | Block wrapper | Block instance UUID |
| `data-block-slug` | Block wrapper | Block type slug |
| `data-cy="..."` | Various | Cypress test selectors |

### Useful Console Commands

```javascript
// Check current blocks (in browser console)
JSON.parse(localStorage.getItem('page-blocks-debug'))

// Check block registry
import { BLOCK_REGISTRY } from '@/core/lib/registries/block-registry'
console.log(Object.keys(BLOCK_REGISTRY))
```

### Database Queries

```sql
-- Check page data
SELECT id, slug, title, published, blocks
FROM pages
WHERE slug = 'your-page-slug';

-- Check for duplicate slugs
SELECT slug, locale, COUNT(*)
FROM pages
GROUP BY slug, locale
HAVING COUNT(*) > 1;
```

---

## Getting Help

### Information to Gather

When reporting issues, include:

1. **Browser and version**
2. **Steps to reproduce**
3. **Console errors** (screenshot)
4. **Network errors** (screenshot)
5. **Block slug** (if block-specific)

### Log Locations

| Log | Location | Contents |
|-----|----------|----------|
| Server | Terminal running `npm run dev` | API errors |
| Browser | DevTools Console | Client errors |
| Build | `npm run build` output | Type/build errors |

### Quick Fixes Checklist

- [ ] Rebuild registry: `node core/scripts/build/registry.mjs`
- [ ] Restart dev server: `npm run dev`
- [ ] Clear browser cache: `Ctrl+Shift+R`
- [ ] Check database connection
- [ ] Verify environment variables
- [ ] Check for TypeScript errors: `npm run tsc`

---

## Still Stuck?

1. Check existing documentation
2. Search for similar issues in the codebase
3. Review recent changes that might have caused the issue
4. Contact the development team

---

> **Pro Tip**: Most issues are resolved by rebuilding the registry and restarting the dev server.

**Last Updated**: 2025-01-21
**Version**: 1.0.0
**Status**: Stable
