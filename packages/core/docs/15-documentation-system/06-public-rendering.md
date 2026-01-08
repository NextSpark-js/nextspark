# Public Documentation Rendering

## Introduction

The documentation system renders markdown content as server-side HTML accessible via public `/docs` routes and admin `/superadmin/docs` routes. This document explains the rendering pipeline, URL structure, components, and styling applied to documentation pages.

## URL Structure

### Route Patterns

**Public Documentation:**
```text
/docs/{section}/{page}

Examples:
/docs/getting-started/introduction
/docs/features/overview
/docs/customization/styling-guide
```

**Superadmin Documentation:**
```text
/superadmin/docs/{section}/{page}

Examples:
/superadmin/docs/setup/configuration
/superadmin/docs/setup/deployment
/superadmin/docs/management/users
```

### Documentation Home

```text
/docs                → Public documentation landing page
/superadmin/docs     → Admin documentation landing page
```

## Route Handlers

### Public Documentation Pages

**Location:** `app/(public)/docs/[section]/[page]/page.tsx`

**Dynamic Segments:**
- `[section]` - Section slug (e.g., `getting-started`)
- `[page]` - Page slug (e.g., `introduction`)

**Rendering Flow:**
```typescript
export default async function DocsPage({ params }: DocsPageProps) {
  const { section: sectionSlug, page: pageSlug } = await params

  // 1. Lookup section in public registry
  const section = DOCS_REGISTRY.public.find(s => s.slug === sectionSlug)
  if (!section) notFound()

  // 2. Lookup page in section
  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) notFound()

  // 3. Parse markdown file
  const filePath = path.join(process.cwd(), page.path)
  const { metadata, html } = await parseMarkdownFile(filePath)

  // 4. Render components
  return (
    <div className="max-w-4xl">
      <DocsBreadcrumbs items={breadcrumbItems} />
      <article className="prose">
        <h1>{metadata.title}</h1>
        <DocsContent html={html} />
      </article>
    </div>
  )
}
```

### Superadmin Documentation Pages

**Location:** `app/superadmin/docs/[section]/[page]/page.tsx`

**Dynamic Segments:**
- `[section]` - Section slug (e.g., `setup`)
- `[page]` - Page slug (e.g., `configuration`)

**Differences from Public:**
- Uses `DOCS_REGISTRY.superadmin` instead of `DOCS_REGISTRY.public`
- Uses `SuperadminDocsSidebar` component
- Admin-only access with `robots: 'noindex, nofollow'`
- Red/shield theming consistent with superadmin area

## Markdown Processing

### Parser Library

**Location:** `core/lib/docs/parser.ts`

**Dependencies:**
- **gray-matter** - Frontmatter extraction
- **remark** - Markdown AST processing
- **remark-gfm** - GitHub Flavored Markdown
- **rehype-shiki** - Syntax highlighting

### Parsing Pipeline

```typescript
export async function parseMarkdownFile(filePath: string): Promise<{
  metadata: DocMetadata
  content: string
  html: string
}> {
  // 1. Read file
  const fileContent = fs.readFileSync(filePath, 'utf-8')

  // 2. Parse frontmatter
  const { data, content } = matter(fileContent)

  // 3. Convert markdown to HTML with syntax highlighting
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, { theme: 'github-dark' })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content)

  return {
    metadata: data as DocMetadata,
    content,
    html: processedContent.toString()
  }
}
```

### Frontmatter Support

Optional YAML frontmatter for metadata:

```markdown
---
title: Custom Page Title
description: SEO-friendly description
---

# Page content starts here
```

**Supported Fields:**
- `title` - Overrides auto-generated title
- `description` - Page description for SEO

## Rendering Components

### DocsLayout

**File:** `core/components/docs/docs-layout.tsx`

**Purpose:** Responsive layout wrapper with sidebar

**Features:**
- Desktop: Fixed sidebar, scrollable content
- Mobile: Collapsible overlay sidebar
- Menu toggle button
- Backdrop overlay for mobile

### DocsSidebar (Public)

**File:** `core/components/docs/docs-sidebar.tsx`

**Purpose:** Hierarchical navigation tree for public docs

**Features:**
- Collapsible sections
- Active page highlighting
- Search functionality
- Keyboard navigation support
- Uses `DOCS_REGISTRY.public`

### SuperadminDocsSidebar

**File:** `core/components/docs/superadmin-docs-sidebar.tsx`

**Purpose:** Navigation tree for admin docs

**Features:**
- Red/shield theming
- Collapsible sections
- Active page highlighting
- Uses `DOCS_REGISTRY.superadmin`

### DocsContent

**File:** `core/components/docs/docs-content.tsx`

**Purpose:** Renders parsed HTML with styling

```typescript
export function DocsContent({ html }: DocsContentProps) {
  return (
    <div
      className="docs-content"
      dangerouslySetInnerHTML={{ __html: html }}
      data-cy="docs-content"
    />
  )
}
```

### DocsBreadcrumbs

**File:** `core/components/docs/docs-breadcrumbs.tsx`

**Purpose:** Navigation trail for deep pages

**Public Example:**
```text
Documentation > Getting Started > Introduction
```

**Admin Example:**
```text
Super Admin > Documentation > Setup > Configuration
```

## Styling System

### Tailwind Typography (Prose)

Documentation content uses Tailwind's typography plugin:

```typescript
<article className="prose prose-slate dark:prose-invert max-w-none">
  <DocsContent html={html} />
</article>
```

**Prose Styles:**
- `prose` - Base typography styles
- `prose-slate` - Slate color scheme
- `dark:prose-invert` - Dark mode adaptation
- `max-w-none` - Remove max-width constraint

### Code Syntax Highlighting

Code blocks receive Shiki-based syntax highlighting with the `github-dark` theme:

```html
<pre><code class="language-typescript">
  export interface Config { ... }
</code></pre>
```

## Server-Side Rendering

### Rendering Strategy

**All documentation pages are server-rendered:**

```typescript
// Server Component
export default async function DocsPage({ params }: DocsPageProps) {
  // Markdown parsed on server
  const { metadata, html } = await parseMarkdownFile(filePath)

  // HTML rendered on server
  return <article dangerouslySetInnerHTML={{ __html: html }} />
}
```

**Benefits:**
- Instant initial page load
- SEO-friendly HTML
- No client-side markdown parsing
- Reduced JavaScript bundle

### Metadata Generation

Each page generates SEO metadata:

```typescript
export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { metadata } = await parseMarkdownFile(filePath)

  return {
    title: metadata.title,
    description: metadata.description,
    // Superadmin docs also include: robots: 'noindex, nofollow'
  }
}
```

## Performance Characteristics

### Server-Side

**Page Rendering:**
- Registry lookup: ~6ms (memory)
- Markdown parsing: ~20-30ms
- HTML generation: ~10ms
- **Total:** ~40-50ms per page

**Caching:**
- Static pages cached by Next.js
- Subsequent loads: <5ms (cached)

### Client-Side

**Initial Load:**
- HTML: Pre-rendered (instant)
- JavaScript: Minimal hydration (~50KB)
- **FCP:** <300ms

## Accessibility

### Semantic HTML

Documentation uses semantic HTML5 elements:

```html
<article>
  <h1>Page Title</h1>
  <nav aria-label="Breadcrumbs">...</nav>
  <section>
    <h2>Section Title</h2>
    <p>Content...</p>
  </section>
</article>
```

### ARIA Labels

Navigation includes descriptive labels:

```typescript
<nav aria-label="Documentation sidebar">
<button aria-expanded={isExpanded} aria-controls="section-id">
<a aria-current={isActive ? 'page' : undefined}>
```

### Keyboard Navigation

Full keyboard support:
- **Tab:** Navigate links and buttons
- **Enter/Space:** Toggle sections

## Next Steps

- **[Extending Documentation](./07-extending-overriding.md)** - Adding theme docs
- **[Writing Documentation](./04-writing-documentation.md)** - Authoring guidelines
- **[Architecture](./02-architecture.md)** - Complete system overview
