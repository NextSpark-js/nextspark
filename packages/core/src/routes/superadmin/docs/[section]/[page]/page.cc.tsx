/**
 * Superadmin documentation page for a host with `cacheComponents` on (variant of ./page).
 *
 * Same page and metadata; what differs is what Next.js refuses under Cache Components:
 * - `dynamicParams = false` is left out. A section/page pair that is not listed renders on demand and answers
 *   notFound(); the proxy already answers 404 for a missing docs page before anything renders. Cache
 *   Components needs generateStaticParams to return at least one pair, so a project with no superadmin
 *   docs returns a placeholder that no page matches.
 * - `await connection()` is left out. At the top of the page it made the whole page request-time, so no listed
 *   document prerendered. The listed pairs prerender, an unlisted one renders on demand. (Next.js fails a
 *   build whose route is otherwise prerenderable when its metadata reads `params`, which the shell of an
 *   unlisted pair does; the superadmin layout declares its content request-time, see group-layouts.cc.)
 * - Parsing a markdown file reads the clock (the highlighter times itself), which Next.js does not allow while
 *   prerendering. The parse moves into one `'use cache'` function, as in the public docs page.
 */
import { notFound } from 'next/navigation'
import { cacheLife } from 'next/cache'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { SuperadminDocsSidebar } from '@nextsparkjs/core/components/docs/superadmin-docs-sidebar'
import path from 'path'
import type { Metadata } from 'next'
import { generateStaticParams as listDocsParams } from './page'

interface SuperadminDocsPageProps {
  params: Promise<{
    section: string
    page: string
  }>
}

export async function generateStaticParams() {
  const params = await listDocsParams()
  return params.length > 0 ? params : [{ section: '_', page: '_' }]
}

/** The parsed document of a section/page pair, or null when the registry has none. */
async function loadDoc(sectionSlug: string, pageSlug: string) {
  'use cache'
  cacheLife('max')

  const section = DOCS_REGISTRY.superadmin.find(s => s.slug === sectionSlug)
  const page = section?.pages.find(p => p.slug === pageSlug)
  if (!section || !page) return null

  const { metadata, html } = await parseMarkdownFile(path.join(process.cwd(), page.path))
  return { sectionTitle: section.title, metadata, html }
}

export async function generateMetadata({ params }: SuperadminDocsPageProps): Promise<Metadata> {
  const { section: sectionSlug, page: pageSlug } = await params

  const section = DOCS_REGISTRY.superadmin.find(s => s.slug === sectionSlug)
  if (!section) return { title: 'Page Not Found' }

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) return { title: 'Page Not Found' }

  const title = page.title || pageSlug.replace(/-/g, ' ')
  return {
    title: `${title} | Admin Docs`,
    description: `Admin documentation for ${title}`,
    robots: 'noindex, nofollow'
  }
}

export default async function SuperadminDocsDetailPage({ params }: SuperadminDocsPageProps) {
  const { section: sectionSlug, page: pageSlug } = await params

  const doc = await loadDoc(sectionSlug, pageSlug)
  if (!doc) notFound()
  const { metadata, html } = doc

  return (
    <div className="flex gap-8" data-cy="superadmin-docs-page">
      <aside className="hidden lg:block w-64 shrink-0">
        <SuperadminDocsSidebar sections={DOCS_REGISTRY.superadmin} />
      </aside>

      <div className="flex-1 max-w-4xl">
        <DocsBreadcrumbs
          items={[
            { label: 'Super Admin', href: '/superadmin' },
            { label: 'Documentation', href: '/superadmin/docs' },
            { label: doc.sectionTitle },
            { label: metadata.title }
          ]}
        />

        <article className="mt-8 prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2">{metadata.title}</h1>
          {metadata.description && (
            <p className="text-xl text-muted-foreground mb-8">{metadata.description}</p>
          )}

          <DocsContent html={html} />
        </article>
      </div>
    </div>
  )
}
