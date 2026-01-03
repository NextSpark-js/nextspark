# Public Documentation Rendering

## Introduction

The documentation system renders markdown content as server-side HTML accessible via public `/docs` routes. This document explains the rendering pipeline, URL structure, components, and styling applied to documentation pages.

## URL Structure

### Route Patterns

**Core Documentation:**
```text
/docs/core/{section}/{page}

Examples:
/docs/core/fundamentals/project-overview
/docs/core/registry-system/introduction
/docs/core/documentation-system/architecture
```

**Theme Documentation:**
```text
/docs/theme/{section}/{page}

Examples:
/docs/theme/customization/styling-guide
/docs/theme/features/custom-components
```

**Plugin Documentation:**
```text
/docs/plugins/{plugin}/{section}/{page}

Examples:
/docs/plugins/ai/features/chat-interface
/docs/plugins/analytics/setup/configuration
```

### Documentation Home

```text
/docs → Documentation landing page
```

## Route Handlers

### Core and Theme Pages

**Location:** `app/(public)/docs/[category]/[section]/[page]/page.tsx`

**Dynamic Segments:**
- `[category]` - `core` or `theme`
- `[section]` - Section slug (e.g., `fundamentals`)
- `[page]` - Page slug (e.g., `project-overview`)

**Rendering Flow:**
```typescript
export default async function DocsPage({ params }: DocsPageProps) {
  const { category, section: sectionSlug, page: pageSlug } = await params
  
  // 1. Lookup section in registry
  const registry = category === 'core' ? DOCS_REGISTRY.core : DOCS_REGISTRY.theme
  const section = registry.find(s => s.slug === sectionSlug)
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

### Plugin Pages

**Location:** `app/(public)/docs/plugins/[plugin]/[section]/[page]/page.tsx`

**Dynamic Segments:**
- `[plugin]` - Plugin name (e.g., `ai`, `analytics`)
- `[section]` - Section slug
- `[page]` - Page slug

**Differences from Core/Theme:**
- Filters `DOCS_REGISTRY.plugins` by plugin name
- Adds plugin badge to page header
- Custom breadcrumb structure with plugin context

## Markdown Processing

### Parser Library

**Location:** `core/lib/docs/parser.ts`

**Dependencies:**
- **gray-matter** - Frontmatter extraction
- **remark** - Markdown AST processing
- **remark-html** - HTML serialization

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
  
  // 3. Convert markdown to HTML
  const processedContent = await remark()
    .use(html, { sanitize: false })  // Allow HTML in markdown
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

### HTML Output

Markdown is converted to semantic HTML:

```markdown
## Section Heading
This is a paragraph with **bold** and *italic* text.

```typescript
const example = 'code block'
```
```

**Becomes:**

```html
<h2>Section Heading</h2>
<p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
<pre><code class="language-typescript">const example = 'code block'</code></pre>
```

## Rendering Components

### DocsLayout

**File:** `core/components/docs/docs-layout.tsx`

**Purpose:** Responsive layout wrapper with sidebar

**Features:**
- Desktop: Fixed sidebar, scrollable content
- Mobile: Collapsible overlay sidebar
- Menu toggle button
- Backdrop overlay for mobile

**Usage:**
```typescript
<DocsLayout>
  <DocsSidebar sections={DOCS_REGISTRY.all} />
  <main>{children}</main>
</DocsLayout>
```

### DocsSidebar

**File:** `core/components/docs/docs-sidebar.tsx`

**Purpose:** Hierarchical navigation tree

**Features:**
- Collapsible sections and categories
- Active page highlighting
- Category grouping (Core, Theme, Plugins)
- Plugin-specific subsections
- Keyboard navigation support

**Structure:**
```typescript
<nav>
  <Category name="Core">
    <Section name="Fundamentals" expanded>
      <Page href="/docs/core/fundamentals/overview" active>
        Overview
      </Page>
      <Page href="/docs/core/fundamentals/architecture">
        Architecture
      </Page>
    </Section>
  </Category>
</nav>
```

### DocsContent

**File:** `core/components/docs/docs-content.tsx`

**Purpose:** Renders parsed HTML with styling

**Implementation:**
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

**Applied Styles:**
- Tailwind Typography (`prose` classes)
- Syntax highlighting for code blocks
- Responsive typography
- Dark mode support

### DocsBreadcrumbs

**File:** `core/components/docs/docs-breadcrumbs.tsx`

**Purpose:** Navigation trail for deep pages

**Example Output:**
```text
Documentation > Core > Registry System > Introduction
```

**Usage:**
```typescript
<DocsBreadcrumbs
  items={[
    { label: 'Documentation', href: '/docs' },
    { label: 'Core', href: '/docs/core' },
    { label: 'Registry System', href: '/docs/core/registry-system' },
    { label: 'Introduction' }  // No href = current page
  ]}
/>
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

### Typography Enhancements

**Headings:**
- H1: 2.25em, bold, margin-top 0
- H2: 1.875em, bold, margin-top 2em
- H3: 1.5em, semibold, margin-top 1.6em
- H4: 1.25em, semibold, margin-top 1.5em

**Code:**
- Inline: Gray background, rounded, padding
- Blocks: Dark background, syntax highlighting, line numbers

**Links:**
- Blue color, underline on hover
- External links: Icon indicator

### Dark Mode Support

Automatic dark mode via `dark:` variants:

```css
/* Light mode */
.prose { color: theme('colors.slate.700'); }
.prose code { background: theme('colors.slate.100'); }

/* Dark mode */
.dark .prose-invert { color: theme('colors.slate.300'); }
.dark .prose-invert code { background: theme('colors.slate.800'); }
```

### Code Syntax Highlighting

Code blocks receive language-specific classes:

```html
<pre><code class="language-typescript">
  export interface Config { ... }
</code></pre>
```

CSS provides syntax highlighting via class selectors.

## Responsive Design

### Breakpoints

**Mobile (< 1024px):**
- Sidebar: Overlay with toggle button
- Content: Full width
- Navigation: Hamburger menu

**Desktop (≥ 1024px):**
- Sidebar: Fixed, always visible
- Content: Offset by sidebar width
- Navigation: Always expanded

### Mobile Optimizations

```typescript
// Mobile menu toggle
<Button
  variant="ghost"
  size="icon"
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="lg:hidden"
>
  <Menu className="h-5 w-5" />
</Button>

// Sidebar with mobile overlay
<aside className={cn(
  "fixed lg:sticky",
  "lg:translate-x-0",
  sidebarOpen ? "translate-x-0" : "-translate-x-full"
)}>
  {/* Sidebar content */}
</aside>
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
- ✅ Instant initial page load
- ✅ SEO-friendly HTML
- ✅ No client-side markdown parsing
- ✅ Reduced JavaScript bundle

### Metadata Generation

Each page generates SEO metadata:

```typescript
export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { metadata } = await parseMarkdownFile(filePath)
  
  return {
    title: metadata.title,
    description: metadata.description,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: 'article'
    }
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
- Fonts: Preloaded
- **FCP:** <300ms

**Navigation:**
- Client-side routing: ~50ms
- No markdown parsing
- Instant transitions

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
- **Arrow Keys:** Navigate within sections

## Next Steps

- **[Extending Documentation](./07-extending-overriding.md)** - Adding theme/plugin docs
- **[Writing Documentation](./04-writing-documentation.md)** - Authoring guidelines
- **[Architecture](./02-architecture.md)** - Complete system overview
