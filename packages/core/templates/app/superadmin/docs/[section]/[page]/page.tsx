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

export async function generateStaticParams() {
  const params = []

  for (const section of DOCS_REGISTRY.superadmin) {
    for (const page of section.pages) {
      params.push({
        section: section.slug,
        page: page.slug
      })
    }
  }

  return params
}

export async function generateMetadata({ params }: SuperadminDocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { section: sectionSlug, page: pageSlug } = resolvedParams

  const section = DOCS_REGISTRY.superadmin.find(s => s.slug === sectionSlug)
  if (!section) return { title: 'Page Not Found' }

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) return { title: 'Page Not Found' }

  const filePath = path.join(process.cwd(), page.path)
  const { metadata } = await parseMarkdownFile(filePath)

  return {
    title: `${metadata.title} | Admin Docs`,
    description: metadata.description || `Admin documentation for ${metadata.title}`,
    robots: 'noindex, nofollow'
  }
}

export default async function SuperadminDocsDetailPage({ params }: SuperadminDocsPageProps) {
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
