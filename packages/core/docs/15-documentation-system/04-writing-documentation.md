# Writing Documentation

## Introduction

This guide provides standards and best practices for writing effective documentation in NextSpark. Following these conventions ensures consistency, maintainability, and optimal integration with the documentation system.

## File and Directory Naming

### Directory Naming Convention

Directories represent **sections** in the documentation:

**Format:** `{order}-{slug}/`

**Examples:**
```text
01-fundamentals/
02-getting-started/
03-registry-system/
15-documentation-system/
```

**Rules:**
- **Order Prefix:** Two-digit number (01-99)
  - Determines navigation order
  - Lower numbers appear first
  - Use increments of 1 for flexibility
- **Slug:** Kebab-case identifier
  - Lowercase letters and hyphens only
  - Descriptive and concise
  - Auto-converts to section title

### File Naming Convention

Files represent **pages** within sections:

**Format:** `{order}-{slug}.md`

**Examples:**
```text
01-introduction.md
02-architecture.md
03-configuration-reference.md
10-advanced-patterns.md
```

**Rules:**
- **Order Prefix:** Two-digit number
  - Determines page order within section
  - Starts from 00 or 01
  - Use gaps (01, 02, 05, 10) for future insertions
- **Slug:** Kebab-case identifier
  - Lowercase and hyphens only
  - Describes page content
  - Auto-converts to page title
- **Extension:** `.md` (Markdown)

### Auto-Generated Titles

Titles are automatically generated from slugs:

```text
Slug:  "getting-started"      → Title: "Getting Started"
Slug:  "api-authentication"   → Title: "Api Authentication"
Slug:  "rls-policies"         → Title: "Rls Policies"
```

**Note:** Capitalization is automatic but not intelligent. Use frontmatter to override if needed.

## Frontmatter

### Optional Metadata

Frontmatter allows overriding auto-generated metadata:

```markdown
---
title: Custom Page Title
description: SEO-friendly description for this page
---

# Page content starts here
```

### Supported Fields

```yaml
---
title: string           # Override auto-generated title
description: string     # Page description (SEO, breadcrumbs)
---
```

### When to Use Frontmatter

**Use frontmatter when:**
- Auto-generated title is incorrect
- Title requires specific capitalization (e.g., "API" not "Api")
- Adding SEO-optimized descriptions
- Page needs custom metadata

**Example:**
```markdown
---
title: API Authentication
description: Learn how to authenticate API requests using Bearer tokens and API keys
---

# API Authentication

Content starts here...
```

## Markdown Formatting

### Headings

Use semantic heading hierarchy:

```markdown
# H1 - Page Title (auto-generated from filename or frontmatter)

## H2 - Main Sections

### H3 - Subsections

#### H4 - Detailed Points
```

**Best Practices:**
- Only one H1 per page (auto-generated)
- Use H2 for major sections
- Maintain hierarchy (don't skip levels)
- Keep headings concise

### Code Blocks

Use fenced code blocks with language specification:

````markdown
```typescript
export interface EntityConfig {
  name: string
  fields: FieldConfig[]
}
```

```bash
pnpm docs:build
pnpm dev
```

```json
{
  "name": "value",
  "active": true
}
```
````

**Supported Languages:**
- `typescript`, `javascript`, `tsx`, `jsx`
- `bash`, `shell`, `sh`
- `json`, `yaml`, `toml`
- `sql`, `markdown`, `html`, `css`

### Inline Code

Use backticks for inline code:

```markdown
The `DOCS_REGISTRY` constant provides access to all documentation metadata.

Run `pnpm docs:build` to regenerate the registry.

Import from `@/core/lib/registries/docs-registry`.
```

### Lists

**Unordered Lists:**
```markdown
- First item
- Second item
  - Nested item
  - Another nested item
- Third item
```

**Ordered Lists:**
```markdown
1. First step
2. Second step
   - Additional detail
   - Another detail
3. Third step
```

**Task Lists:**
```markdown
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task
```

### Tables

Use Markdown tables for structured data:

```markdown
| Feature | Core | Theme | Plugin |
|---------|------|-------|--------|
| System Docs | ✅ | ❌ | ❌ |
| Custom Docs | ❌ | ✅ | ✅ |
| Conditional | ❌ | ❌ | ✅ |
```

### Links

**Internal Documentation Links:**
```markdown
See [Registry System](../03-registry-system/01-introduction.md) for details.

For theme documentation, visit [Theme System](../07-theme-system/01-introduction.md).
```

**External Links:**
```markdown
Learn more about [Next.js](https://nextjs.org/docs) routing.

View the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).
```

**Anchor Links (Same Page):**
```markdown
Jump to [Best Practices](#best-practices) section.
```

### Emphasis

```markdown
**Bold text** for emphasis or key terms

*Italic text* for subtle emphasis

***Bold and italic*** for strong emphasis

`code` for technical terms and values
```

### Blockquotes

```markdown
> **Note:** This is an important note that requires attention.

> **Warning:** Modifying core files directly can lead to issues during updates.
```

### Horizontal Rules

Use three hyphens for section breaks:

```markdown
---
```

## Images and Assets

### Image Storage

Store images in the `public/docs/` directory:

```text
public/docs/
├── architecture-diagram.svg
├── entity-flow.png
└── api-workflow.jpg
```

### Including Images

```markdown
![Alt text](/docs/architecture-diagram.svg)

![Entity Relationship Diagram](/docs/entity-flow.png)
```

**Best Practices:**
- Use descriptive alt text
- Prefer SVG for diagrams
- Optimize PNG/JPG file sizes
- Use absolute paths from `/docs/`

### Diagrams

For complex diagrams, use ASCII art or SVG:

````markdown
```text
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Next.js    │
│   Server    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │
└─────────────┘
```
````

## Code Examples

### Inline Examples

Keep inline examples concise:

```markdown
Use `getEntityConfig('user')` to retrieve configuration.
```

### Block Examples

Provide context and explanation:

````markdown
Fetch entity configuration from the registry:

```typescript
import { getEntityConfig } from '@/core/lib/registries/entity-registry'

const userConfig = getEntityConfig('user')
console.log(userConfig.fields) // Array of field definitions
```

This returns the complete entity configuration including fields, metadata, and relationships.
````

### Multi-File Examples

Show file paths for clarity:

````markdown
**File: `app/api/users/route.ts`**
```typescript
export async function GET() {
  return Response.json({ users: [] })
}
```

**File: `core/lib/api/users.ts`**
```typescript
export async function fetchUsers() {
  const response = await fetch('/api/users')
  return response.json()
}
```
````

## Documentation Structure

### Standard Page Structure

```markdown
# Page Title

## Introduction

Brief overview of the topic (2-3 sentences)

## Main Concept

Detailed explanation of primary concept

### Sub-Concept

Deeper dive into specific aspect

## Code Examples

Practical examples demonstrating usage

## Best Practices

Recommended patterns and approaches

## Common Pitfalls

Issues to avoid

## Next Steps

Links to related documentation
```

### Section Organization

Organize sections logically:

1. **Introduction** - What and why
2. **Core Concepts** - How it works
3. **Examples** - Practical usage
4. **Reference** - Detailed specifications
5. **Advanced** - Complex patterns
6. **Related** - Cross-references

## Writing Style

### Tone and Voice

- **Clear and Direct:** Use simple, declarative sentences
- **Technical but Accessible:** Balance precision with readability
- **Active Voice:** Prefer "The system generates..." over "The system is generated by..."
- **Present Tense:** "The function returns..." not "The function will return..."

### Technical Accuracy

- Verify code examples compile and run
- Test commands before documenting
- Link to actual file paths in codebase
- Keep documentation synchronized with implementation

### Consistency

- Use consistent terminology throughout
- Follow established naming conventions
- Maintain uniform formatting
- Apply consistent capitalization

### Examples

❌ **Bad:**
```markdown
The docs registry might be generated during build, and it could contain metadata about your documentation if it exists.
```

✅ **Good:**
```markdown
The documentation registry is generated at build time and contains metadata for all documentation pages.
```

## Linking Strategy

### Cross-Document Links

Use relative paths to link between documents:

```markdown
<!-- From 15-documentation-system/04-writing.md -->
See [Docs Registry](./05-docs-registry.md) for structure details.

<!-- Link to different section -->
See [Entity System](../04-entities/01-introduction.md) for entity configuration.
```

### Anchor Links

Link to specific sections:

```markdown
Jump to [File Naming Convention](#file-naming-convention)

See [Code Examples](#code-examples) below
```

### External Resources

```markdown
Learn more about [Markdown syntax](https://www.markdownguide.org/basic-syntax/)

View [Next.js documentation](https://nextjs.org/docs)
```

## Build and Validation

### Regenerating Registry

After adding or modifying documentation:

```bash
pnpm docs:build
```

This regenerates `core/lib/registries/docs-registry.ts` with updated metadata.

### Development Workflow

1. Create/edit markdown files
2. Run `pnpm docs:build`
3. Start dev server: `pnpm dev`
4. Navigate to `/docs` to preview
5. Verify navigation and rendering

### Validation

Check for common issues:

- ✅ File names follow `{order}-{slug}.md` pattern
- ✅ Directory names follow `{order}-{slug}/` pattern
- ✅ No special characters in slugs
- ✅ Code blocks have language specifiers
- ✅ Internal links use correct paths
- ✅ Images exist at specified paths

## Next Steps

- **[Docs Registry](./05-docs-registry.md)** - Registry structure and API
- **[Public Rendering](./06-public-rendering.md)** - How docs are rendered
- **[Extending Documentation](./07-extending-overriding.md)** - Adding theme/plugin docs
