import { notFound } from 'next/navigation'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { sel } from '@nextsparkjs/core/selectors'
import { getTranslations } from 'next-intl/server'
import path from 'path'
import type { Metadata } from 'next'

interface DocsPageProps {
  params: Promise<{
    section: string
    page: string
  }>
}

export async function generateStaticParams() {
  const params: Array<{ section: string; page: string }> = []

  // Generate params for public docs only
  for (const section of DOCS_REGISTRY.public) {
    for (const page of section.pages) {
      params.push({
        section: section.slug,
        page: page.slug
      })
    }
  }

  return params
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { section: sectionSlug, page: pageSlug } = resolvedParams

  const section = DOCS_REGISTRY.public.find(s => s.slug === sectionSlug)
  if (!section) return { title: 'Page Not Found' }

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) return { title: 'Page Not Found' }

  const filePath = path.join(process.cwd(), page.path)
  const { metadata } = await parseMarkdownFile(filePath)

  return {
    title: `${metadata.title} | Documentation`,
    description: metadata.description || `Documentation for ${metadata.title}`
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const resolvedParams = await params
  const { section: sectionSlug, page: pageSlug } = resolvedParams
  const t = await getTranslations('docs')

  // Find section in public docs
  const section = DOCS_REGISTRY.public.find(s => s.slug === sectionSlug)
  if (!section) notFound()

  // Find page in section
  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) notFound()

  // Parse markdown file
  const filePath = path.join(process.cwd(), page.path)
  const { metadata, html } = await parseMarkdownFile(filePath)

  return (
    <div className="max-w-4xl" data-cy={sel('public.docs.pageDetail')}>
      <DocsBreadcrumbs
        items={[
          { label: t('breadcrumbs.home'), href: '/docs' },
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
    </div>
  )
}
