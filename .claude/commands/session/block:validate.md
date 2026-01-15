# /session:block:validate

Validate block structure and consistency.

---

## Syntax

```
/session:block:validate [block-name] [--theme <name>]
```

---

## Behavior

Validates that blocks follow project conventions and have consistent structure.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:block:validate                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Locate block(s) to validate                                 │
│     ↓                                                           │
│  2. Check file structure                                        │
│     - All 5 files present?                                      │
│     ↓                                                           │
│  3. Validate schema                                             │
│     - Extends baseBlockSchema?                                  │
│     - Valid Zod types?                                          │
│     ↓                                                           │
│  4. Validate fields                                             │
│     - Match schema?                                             │
│     - Valid field types?                                        │
│     ↓                                                           │
│  5. Validate component                                          │
│     - Uses props correctly?                                     │
│     - Has data-cy attributes?                                   │
│     ↓                                                           │
│  6. Report results                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Validate Single Block

```
/session:block:validate hero-banner
```

Output:

```
✅ BLOCK VALIDATION: hero-banner

Theme: default

─────────────────────────────────────────

📁 FILE STRUCTURE

- [x] config.ts exists
- [x] schema.ts exists
- [x] fields.ts exists
- [x] component.tsx exists
- [x] index.ts exists

─────────────────────────────────────────

📐 SCHEMA VALIDATION

- [x] Extends baseBlockSchema
- [x] All fields have valid Zod types
- [x] Required fields have no default OR are truly required
- [x] Optional fields marked correctly

─────────────────────────────────────────

📋 FIELDS VALIDATION

- [x] All schema fields have field definitions
- [x] Field types match schema types
- [x] Labels defined for all fields

─────────────────────────────────────────

🎨 COMPONENT VALIDATION

- [x] Default export present
- [x] Props destructured from schema type
- [x] data-cy attribute on root element
- [x] Handles optional fields gracefully

─────────────────────────────────────────

📊 RESULT

Status: VALID
Issues: 0
Warnings: 0

✓ Block 'hero-banner' is valid
```

---

## Example: Validate All Blocks

```
/session:block:validate
```

Output:

```
✅ BLOCK VALIDATION: All Blocks

Theme: default
Blocks found: 10

─────────────────────────────────────────

## Results

| Block | Files | Schema | Fields | Component | Status |
|-------|-------|--------|--------|-----------|--------|
| hero | ✓ | ✓ | ✓ | ✓ | VALID |
| hero-banner | ✓ | ✓ | ✓ | ✓ | VALID |
| hero-video | ✓ | ⚠ | ✓ | ✓ | WARNING |
| text-block | ✓ | ✓ | ✓ | ✓ | VALID |
| features-grid | ✓ | ✓ | ✓ | ❌ | INVALID |
| testimonials | ✓ | ✓ | ✓ | ✓ | VALID |
| faq | ✓ | ✓ | ✓ | ✓ | VALID |
| pricing | ✓ | ✓ | ✓ | ✓ | VALID |
| cta-section | ✓ | ✓ | ✓ | ✓ | VALID |
| newsletter | ✓ | ✓ | ✓ | ✓ | VALID |

─────────────────────────────────────────

## Issues

### features-grid (INVALID)

❌ Component: Missing data-cy attribute on root element

Location: component.tsx:15
Current:
```tsx
<div className="features-grid">
```

Expected:
```tsx
<div className="features-grid" data-cy="block-features-grid">
```

─────────────────────────────────────────

## Warnings

### hero-video (WARNING)

⚠ Schema: Field 'autoplay' is boolean but defaults to undefined

Suggestion: Add explicit default value:
```typescript
autoplay: z.boolean().default(false)
```

─────────────────────────────────────────

📊 SUMMARY

Valid: 8
Warnings: 1
Invalid: 1

Run '/session:block:update features-grid' to fix issues.
```

---

## Validation Rules

| Check | Severity | Description |
|-------|----------|-------------|
| Missing file | Error | All 5 files required |
| No baseBlockSchema | Error | Must extend base |
| Missing data-cy | Error | Required for testing |
| Missing field definition | Warning | Should match schema |
| No default for optional | Warning | Recommended |

---

## Options

| Option | Description |
|--------|-------------|
| `--theme <name>` | Validate in specific theme |
| `--fix` | Attempt to auto-fix issues |
| `--strict` | Treat warnings as errors |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:block:create` | Create new block |
| `/session:block:update` | Fix invalid blocks |
| `/session:block:list` | List all blocks |
