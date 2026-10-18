# SEO guide

What a NextSpark project does for search engines out of the box, and how to take it further: page metadata, Open Graph images, JSON-LD, the sitemap and `robots.txt`, and the Core Web Vitals practices of the starter.

Everything here is code you write in your project (`templates/`, `lib/`, `nextspark.config.ts`). `src/app` is generated: do not edit it.

## What you get without writing anything

| Piece | Where it comes from |
|-------|---------------------|
| `/robots.txt` | Core's `robots` route. Public pages are allowed; `/dashboard`, `/superadmin`, `/devtools`, `/api` and the auth pages (`/login`, `/signup`, ...) are disallowed. It names the sitemap. |
| `/sitemap.xml` | Core's `sitemap` route, composed by `nextspark prepare` with your static public pages and your `sitemap` settings. |
| `<title>` and Open Graph tags of a page-builder item | `generateMetadata` of the public item route: `seoTitle`, `seoDescription` and `ogImage` (or `featuredImage`) of the entry. |
| `noindex` on a missing public page | Under Cache Components the not-found page of a public item carries `<meta name="robots" content="noindex">` (see [Public rendering](../18-page-builder/07-public-rendering.md)). |

## Metadata

Next.js reads `metadata` (a constant) or `generateMetadata` (a function of the route's params) from a page or layout. In a project, export them from the template that renders the route.

```tsx
// templates/(public)/support/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support',
  description: 'Talk to the team, or browse the answers to the common questions.',
  alternates: { canonical: '/support' },
}

export default function SupportPage() {
  return <main>...</main>
}
```

Relative URLs in metadata (`canonical`, `openGraph.images`) resolve against `metadataBase`. Set it once, in the root layout template, from the same variable the sitemap uses (`NEXT_PUBLIC_APP_URL`):

```tsx
// templates/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: 'My App', template: '%s | My App' },
  description: 'What the app does, in one sentence.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
```

A template that exports its own `metadata` replaces core's default (`NextSpark App`); one that exports none keeps it. The root layout composed by the host wraps your `children` with the providers, so `templates/layout.tsx` returns them as they are.

A dynamic route computes it from its data. This is the starter's blog template, which also shows the `notFound` case (do not index what does not exist):

```tsx
// templates/(public)/blog/[slug]/page.tsx
import type { Metadata } from 'next'
import { PostsService } from '@/entities/posts/posts.service'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await PostsService.getPublishedMetadata(slug)
  if (!post) return { title: 'Not Found', robots: { index: false } }

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || undefined,
      images: post.ogImage ? [post.ogImage] : post.featuredImage ? [post.featuredImage] : [],
      type: 'article',
    },
  }
}
```

Under a Next `basePath`, `canonical` and the metadata files are served with the prefix by Next; build any URL you write by hand with `withBasePath` from `@nextsparkjs/core/lib/base-path`.

## Dynamic Open Graph images

Next.js turns an `opengraph-image` file into the `og:image` tag of its route, and `next/og` draws the image.

A static page gets one next to its `page`:

```tsx
// templates/(public)/support/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Support'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', fontSize: 72 }}>
        Support
      </div>
    ),
    size
  )
}
```

A route per entry (one image per post) is a Route Handler. Serve it **outside `/api`**: `robots.txt` disallows `/api`, and the crawlers that read your pages' Open Graph tags obey it.

```tsx
// templates/og/[slug]/route.tsx  ->  /og/<slug>
import { ImageResponse } from 'next/og'
import { PostsService } from '@/entities/posts/posts.service'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await PostsService.getPublishedMetadata(slug)
  if (!post) return new Response('Not found', { status: 404 })

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80, background: '#0f172a', color: '#fff', fontSize: 64 }}>
        {post.title}
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

Point the entry at it from `generateMetadata`: `openGraph: { images: [`/og/${slug}`] }`. An image set on the entry (`ogImage`) in the page builder wins in the default route; use `post.ogImage ?? `/og/${slug}`` to keep that.

A top-level `og` segment is a route of its own: a page-builder page with the slug `og` would be shadowed by it, as by any top-level route (core's reserved slugs are listed in `lib/constants/reserved-slugs`).

## JSON-LD

Structured data goes in a `<script type="application/ld+json">` in the page. Escape `<` so a title cannot close the tag:

```tsx
// lib/seo/json-ld.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
```

A post (`BlogPosting`) in the blog template, next to the content:

```tsx
// templates/(public)/blog/[slug]/page.tsx (excerpt)
import { notFound } from 'next/navigation'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import { PostsService } from '@/entities/posts/posts.service'
import { JsonLd } from '@/lib/seo/json-ld'

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await PostsService.getPublishedBySlug(slug)
  if (!post) notFound()

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          image: post.featuredImage,
          datePublished: post.createdAt,
          mainEntityOfPage: `${origin}${withBasePath(`/blog/${post.slug}`)}`,
        }}
      />
      {/* the post's content */}
    </>
  )
}
```

A page-builder page uses `@type: 'WebPage'` with `name` and `url`. Describe the organization once, in the home page. Check the result with Google's Rich Results Test; the markup must match what a visitor sees on the page.

## Sitemap and robots.txt

### What the sitemap lists

`/sitemap.xml` lists, once per URL:

1. **Static public pages**: the `(public)` pages of your `templates/` and of your plugins whose URL has no dynamic segment (`templates/(public)/support/page.tsx` is `/support`; the home is `/` once `templates/(public)/page.tsx` exists). Core's own public pages are not listed: its default home only redirects to the dashboard, and the docs are not your content.
2. **Public entity entries**: for every entity that is a builder entity (`builder.enabled: true`) with `access.basePath` and `access.public: true`, its archive page when `ui.public.hasArchivePage` is set, and each **published** row. Posts, page-builder pages and any entity you declare this way are covered with no per-entity code.
3. **Your extra URLs** (`sitemap.urls`).

Each entry has `lastmod` from the row's `updatedAt`.

A row is listed exactly when its public page renders it. The sitemap reads the same table with the same rule as the page (`status = 'published'`, as the service role, since the page is public), so a draft, a scheduled or an archived row never appears and a deleted row is gone. A slug the route answers not found for (`logo.png`, a name with a space) is dropped. Entities that are private, team-scoped (`access.public` not `true`) or without a base path are not even queried.

### Languages (`hreflang`)

The app chooses the language of a visitor from a cookie, the account and `Accept-Language`, not from the URL: there is no `/es/` prefix and every locale is served at the same URL. So an entry is one `<url>` (a repeated `<loc>` is invalid) and its `<xhtml:link rel="alternate" hreflang>` lines name that URL for **every enabled locale** (`i18n.supportedLocales` of `app.config.ts`) plus `x-default` (the `defaultLocale`). If your project serves localized URLs (a locale prefix of your own), replace the sitemap with your own `templates/sitemap.ts` and list the real URLs.

Under a Next `basePath`, every URL carries the prefix.

### Configure it

In `nextspark.config.ts`, validated when the project is built (an unknown field or a malformed path fails `nextspark prepare` with the field named):

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  sitemap: {
    enabled: true,                          // false: no /sitemap.xml and no Sitemap line in robots.txt
    urls: ['/pricing', '/changelog'],       // extra paths, from the app root
    exclude: ['/legal/*', '/blog/draft-*'], // exact paths, or prefixes ending in *
  },
})
```

`exclude` removes matching paths from everything above, the extra URLs included. To drop one entry from the sitemap but keep it published, exclude its path.

Replace the whole sitemap with `templates/sitemap.ts` (default export returning Next's `MetadataRoute.Sitemap`), and `/robots.txt` with `templates/robots.ts`, as with any route: your file wins over core's.

### robots.txt

```
User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /superadmin
Disallow: /devtools
Disallow: /api
Disallow: /login
...
Sitemap: https://example.com/sitemap.xml
```

The sitemap URL is absolute, built from `NEXT_PUBLIC_APP_URL` and the base path. **Set `NEXT_PUBLIC_APP_URL` to your public origin in production**: without it the URLs say `http://localhost:3000`. Crawlers read only the host root: under a Next `basePath` the file is served at `/<base>/robots.txt` and the one at the root is the deployment's concern.

### Caching and size

The sitemap is built at most once an hour per server process; requests in that hour, and requests that arrive while it is being built, share the result (no database query per request). If a refresh fails the last good document keeps being served, and an entity that cannot be read is left out and tried again after a minute. A new post therefore shows up in the sitemap within the hour. It works the same with Cache Components and with legacy ISR, and answers `application/xml`.

One sitemap file holds 50,000 URLs, the protocol's limit. Past that the list is cut (entries ordered by slug) and a warning is logged. Past 50,000 published entries, use `templates/sitemap.ts` with Next's [`generateSitemaps`](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps) to split it into several files.

## Core Web Vitals in the starter

[Core Web Vitals](../13-performance/07-core-web-vitals.md) has the metrics and the tools. These are the practices the starter is built on, and what to keep when you change it:

- **Ship static HTML for public pages.** Cache Components with partial prerendering is the default mode: the shell of a public page is prerendered and only what reads the request streams in. Keep request-dependent code (`cookies()`, `headers()`, `searchParams`) behind its own `<Suspense>` boundary, as the archive pages do, instead of at the top of the page. Do not wrap the `(public)` layout's `children` in Suspense, and put a `loading.tsx` only next to pages that never call `notFound()` or `redirect()` ([why](../18-page-builder/07-public-rendering.md)).
- **LCP: mark the hero image `priority`, and give every image its size.** Use `OptimizedImage` (`@nextsparkjs/core/components/ui/optimized-image`, a `next/image` wrapper) with `width` and `height`, or `fill` inside a container with an aspect ratio, so the browser reserves the space (CLS) and loads the right file size. Only the image above the fold is `priority`; the rest lazy-load.
- **INP and bundle size: keep public routes server-rendered.** A `'use client'` component sends its JavaScript to every visitor of every page that imports it. NextSpark's own repository measures the JavaScript of each starter route against a budget (`scripts/performance/verify-route-js-budget.mjs`); keep your public routes lean the same way, and import client components only in the routes that render them.
- **CLS: reserve space for what loads late.** Fonts come from `next/font` (self-hosted, with a size-adjusted fallback); use it rather than a `<link>` to a font CDN. Give embeds, ads and late banners a fixed height.
- **Third-party scripts last.** Load analytics and chat widgets with `next/script` and `strategy="lazyOnload"`; they are the most common cause of a slow INP.
- **Measure on production builds**, with the field data of Search Console and `next build && next start` locally, never `next dev`.

## Checklist

- `NEXT_PUBLIC_APP_URL` is your public origin.
- `metadataBase` is set; every public page has a unique `title` and `description` and a canonical URL.
- Posts and pages have a `seoTitle`, `seoDescription` and an `ogImage` in the page builder.
- `curl -I https://your-host/sitemap.xml` answers `200` with `application/xml`, and `/robots.txt` names it.
- Content that must stay private is not `published`: a builder entity with a base path serves its published rows on its public routes, `access.public` or not, and the sitemap lists only the entities that set `access.public: true`.
