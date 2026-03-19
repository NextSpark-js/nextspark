---
disable-model-invocation: true
---

# /session:block:update

Modify an existing page builder block.

---

## Required Skills

**[MANDATORY]** Read before executing:
- `.claude/skills/page-builder-blocks/SKILL.md` - Block development patterns

---

## Syntax

```
/session:block:update <block-name> [--theme <name>]
```

---

## Behavior

Updates an existing block while maintaining backward compatibility.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:block:update                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Locate block in theme                                       │
│     ↓                                                           │
│  2. Read current structure                                      │
│     - config.ts                                                 │
│     - schema.ts                                                 │
│     - fields.ts                                                 │
│     - component.tsx                                             │
│     ↓                                                           │
│  3. Ask what to modify                                          │
│     - Add field?                                                │
│     - Modify field?                                             │
│     - Update component?                                         │
│     ↓                                                           │
│  4. Apply changes                                               │
│     - Update schema                                             │
│     - Update fields                                             │
│     - Update component                                          │
│     ↓                                                           │
│  5. Ensure backward compatibility                               │
│     - New fields have defaults                                  │
│     - Existing data still works                                 │
│     ↓                                                           │
│  6. Rebuild and validate                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧱 UPDATE BLOCK

Block: hero-banner
Theme: default
Location: contents/themes/default/blocks/hero-banner/

─────────────────────────────────────────

📋 CURRENT STRUCTURE

Fields:
├─ title: string (required)
├─ subtitle: string (optional)
├─ backgroundImage: string (optional)
└─ cta: object (optional)
    ├─ label: string
    └─ href: string

─────────────────────────────────────────

What would you like to modify?
[1] Add new field
[2] Modify existing field
[3] Remove field
[4] Update component logic
[5] Update styling

> 1

─────────────────────────────────────────

📝 ADD NEW FIELD

Field name?
> overlay

Field type?
[1] string
[2] number
[3] boolean
[4] select (enum)
[5] object

> 4

Select options?
> none, light, dark

Default value?
> none

─────────────────────────────────────────

🔧 APPLYING CHANGES

Updating schema.ts...
+ overlay: z.enum(['none', 'light', 'dark']).default('none'),
✓ Schema updated

Updating fields.ts...
+ {
+   name: 'overlay',
+   type: 'select',
+   label: 'Overlay',
+   options: [
+     { value: 'none', label: 'None' },
+     { value: 'light', label: 'Light' },
+     { value: 'dark', label: 'Dark' },
+   ],
+ }
✓ Fields updated

Updating component.tsx...
+ const overlayClass = overlay === 'none' ? '' :
+   overlay === 'light' ? 'bg-white/50' : 'bg-black/50';
✓ Component updated

─────────────────────────────────────────

🔄 REBUILDING REGISTRY

Running pnpm build:blocks...
✓ Registry updated

─────────────────────────────────────────

✅ BACKWARD COMPATIBILITY CHECK

- [x] New field has default value
- [x] Existing pages will render correctly
- [x] No breaking changes detected

─────────────────────────────────────────

✓ Block 'hero-banner' updated successfully
```

---

## Backward Compatibility Rules

| Change Type | Requirement |
|-------------|-------------|
| Add field | Must have default value |
| Modify field | Keep existing values valid |
| Remove field | Must be optional first |
| Rename field | Create alias, deprecate old |

---

## Options

| Option | Description |
|--------|-------------|
| `--theme <name>` | Target theme |
| `--add-field <name>` | Directly add field |
| `--no-validate` | Skip validation |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:block:create` | Create new block |
| `/session:block:validate` | Validate structure |
