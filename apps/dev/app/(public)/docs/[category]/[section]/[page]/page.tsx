import { notFound } from 'next/navigation'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { getTranslations } from 'next-intl/server'
import path from 'path'
import type { Metadata } from 'next'

interface DocsPageProps {
  params: Promise<{
    category: string
    section: string
    page: string
  }>
}

export async function generateStaticParams() {
  const params = []

  // Generate params for core docs
  for (const section of DOCS_REGISTRY.core) {
    for (const page of section.pages) {
      params.push({
        category: 'core',
        section: section.slug,
        page: page.slug
      })
    }
  }

  // Generate params for theme docs
  for (const section of DOCS_REGISTRY.theme) {
    for (const page of section.pages) {
      params.push({
        category: 'theme',
        section: section.slug,
        page: page.slug
      })
    }
  }

  // Future: Plugin docs
  // for (const section of DOCS_REGISTRY.plugins || []) {
  //   for (const page of section.pages) {
  //     params.push({
  //       category: 'plugins',
  //       section: section.slug,
  //       page: page.slug
  //     })
  //   }
  // }

  return params
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { category, section: sectionSlug, page: pageSlug } = resolvedParams

  // Get correct registry based on category
  const registry = category === 'core' ? DOCS_REGISTRY.core :
                   category === 'theme' ? DOCS_REGISTRY.theme :
                   []

  // Find section and page
  const section = registry.find(s => s.slug === sectionSlug)
  if (!section) return { title: 'Page Not Found' }

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) return { title: 'Page Not Found' }

  // Parse markdown to get metadata
  const filePath = path.join(process.cwd(), page.path)
  const { metadata } = await parseMarkdownFile(filePath)

  return {
    title: `${metadata.title} | Documentation`,
    description: metadata.description || `Documentation for ${metadata.title}`
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const resolvedParams = await params
  const { category, section: sectionSlug, page: pageSlug } = resolvedParams
  const t = await getTranslations('docs')

  // Get correct registry based on category
  const registry = category === 'core' ? DOCS_REGISTRY.core :
                   category === 'theme' ? DOCS_REGISTRY.theme :
                   []

  // Find section in registry
  const section = registry.find(s => s.slug === sectionSlug)
  if (!section) notFound()

  // Find page in section
  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) notFound()

  // Parse markdown file
  const filePath = path.join(process.cwd(), page.path)
  const { metadata, html } = await parseMarkdownFile(filePath)

  // Get category label for breadcrumbs
  const categoryLabels: Record<string, string> = {
    core: t('categories.core'),
    theme: t('categories.theme'),
    plugins: t('categories.plugins')
  }
  const categoryLabel = categoryLabels[category] || category

  return (
    <div className="max-w-4xl" data-cy="docs-page">
      <DocsBreadcrumbs
        items={[
          { label: t('breadcrumbs.home'), href: '/docs' },
          { label: categoryLabel, href: `/docs/${category}` },
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
