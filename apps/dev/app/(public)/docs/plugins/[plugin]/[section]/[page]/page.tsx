import { notFound } from 'next/navigation'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { getTranslations } from 'next-intl/server'
import path from 'path'
import type { Metadata } from 'next'

interface PluginDocsPageProps {
  params: Promise<{
    plugin: string
    section: string
    page: string
  }>
}

export async function generateStaticParams() {
  const params = []

  // Generate params for all plugin docs
  for (const section of DOCS_REGISTRY.plugins) {
    for (const page of section.pages) {
      if (!section.pluginName) continue

      params.push({
        plugin: section.pluginName,
        section: section.slug,
        page: page.slug
      })
    }
  }

  return params
}

export async function generateMetadata({ params }: PluginDocsPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const { plugin: pluginName, section: sectionSlug, page: pageSlug } = resolvedParams

  // Find plugin sections
  const pluginSections = DOCS_REGISTRY.plugins.filter(s => s.pluginName === pluginName)

  // Find section and page
  const section = pluginSections.find(s => s.slug === sectionSlug)
  if (!section) return { title: 'Page Not Found' }

  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) return { title: 'Page Not Found' }

  // Parse markdown to get metadata
  const filePath = path.join(process.cwd(), page.path)
  const { metadata } = await parseMarkdownFile(filePath)

  // Format plugin name for display
  const pluginDisplayName = pluginName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return {
    title: `${metadata.title} | ${pluginDisplayName} Plugin | Documentation`,
    description: metadata.description || `${pluginDisplayName} plugin documentation for ${metadata.title}`
  }
}

export default async function PluginDocsPage({ params }: PluginDocsPageProps) {
  const resolvedParams = await params
  const { plugin: pluginName, section: sectionSlug, page: pageSlug } = resolvedParams
  const t = await getTranslations('docs')

  // Find plugin sections
  const pluginSections = DOCS_REGISTRY.plugins.filter(s => s.pluginName === pluginName)

  if (pluginSections.length === 0) {
    notFound()
  }

  // Find section in plugin sections
  const section = pluginSections.find(s => s.slug === sectionSlug)
  if (!section) notFound()

  // Find page in section
  const page = section.pages.find(p => p.slug === pageSlug)
  if (!page) notFound()

  // Parse markdown file
  const filePath = path.join(process.cwd(), page.path)
  const { metadata, html } = await parseMarkdownFile(filePath)

  // Format plugin name for display
  const pluginDisplayName = pluginName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <div className="max-w-4xl" data-cy="plugin-docs-page">
      <DocsBreadcrumbs
        items={[
          { label: t('breadcrumbs.home'), href: '/docs' },
          { label: t('categories.plugins'), href: '/docs/plugins' },
          { label: `${pluginDisplayName} Plugin` },
          { label: section.title },
          { label: metadata.title }
        ]}
      />

      <article className="mt-8 prose prose-slate dark:prose-invert max-w-none">
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            {pluginDisplayName} Plugin
          </span>
        </div>

        <h1 className="text-4xl font-bold mb-2">{metadata.title}</h1>
        {metadata.description && (
          <p className="text-xl text-muted-foreground mb-8">{metadata.description}</p>
        )}

        <DocsContent html={html} />
      </article>
    </div>
  )
}
