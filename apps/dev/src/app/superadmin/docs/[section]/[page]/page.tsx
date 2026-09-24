import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { SuperadminDocsSidebar } from '@nextsparkjs/core/components/docs/superadmin-docs-sidebar'
import path from 'path'
import type { Metadata } from 'next'

interface SuperadminDocsPageProps {
  params: Promise<{
    section: string
    page: string
  }>
}

// generateStaticParams below lists every superadmin doc page, and
// dynamicParams = false answers 404 for any other section/page pair in
// `next dev`. connection() keeps these pages from being prerendered, so a
// production build renders them on demand, where Next has no prerendered list
// to check, and the notFound() calls below cannot set the status either: they
// run inside the superadmin layout's Suspense boundary, after the response
// head has gone out with a 200. For those requests the proxy answers 404
// before anything renders (isMissingDocsPage in proxy.ts).
export const dynamicParams = false

export async function generateStaticParams() {
  return DOCS_REGISTRY.superadmin.flatMap(section =>
    section.pages.map(page => ({ section: section.slug, page: page.slug }))
  )
}

export async function generateMetadata({ params }: SuperadminDocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { section: sectionSlug, page: pageSlug } = resolvedParams

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
  await connection()
  const resolvedParams = await params
  const { section: sectionSlug, page: pageSlug } = resolvedParams

  const section = DOCS_REGISTRY.superadmin.find(s => s.slug === sectionSlug)
  if (!section) notFound()

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) notFound()

  const filePath = path.join(process.cwd(), page.path)
  const { metadata, html } = await parseMarkdownFile(filePath)

  return (
    <div className="flex gap-8" data-cy="superadmin-docs-page">
      <aside className="hidden lg:block w-64 shrink-0">
        <SuperadminDocsSidebar sections={DOCS_REGISTRY.superadmin} />
      </aside>

      <main className="flex-1 max-w-4xl">
        <DocsBreadcrumbs
          items={[
            { label: 'Super Admin', href: '/superadmin' },
            { label: 'Documentation', href: '/superadmin/docs' },
            { label: section.title },
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
      </main>
    </div>
  )
}
