/**
 * Public documentation page for a host with `cacheComponents` on (variant of ./page).
 *
 * The page and its metadata are the same; what differs is what Next.js refuses under Cache Components:
 * - `dynamicParams = false` is left out. A section/page pair that is not listed renders on demand and answers
 *   notFound(); the proxy already answers 404 for a missing docs page before anything renders. Cache
 *   Components needs generateStaticParams to return at least one pair, so a project with no public docs
 *   returns a placeholder that no page matches.
 * - Parsing a markdown file reads the clock (the highlighter times itself), which Next.js does not allow while
 *   prerendering. The parse moves into one `'use cache'` function that the page and its metadata share, so a
 *   document is parsed once and cached with the page.
 */
import { notFound } from 'next/navigation'
import { cacheLife } from 'next/cache'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { parseMarkdownFile } from '@nextsparkjs/core/lib/docs/parser'
import { DocsBreadcrumbs } from '@nextsparkjs/core/components/docs/docs-breadcrumbs'
import { DocsContent } from '@nextsparkjs/core/components/docs/docs-content'
import { sel } from '@nextsparkjs/core/selectors/public'
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'
import { resolveRegistryDoc } from '@nextsparkjs/core/lib/docs/registry-doc'
import { pageMetadata } from '@nextsparkjs/core/lib/seo/page-metadata'
import type { Metadata } from 'next'

interface DocsPageProps {
  params: Promise<{
    section: string
    page: string
  }>
}

export async function generateStaticParams() {
  const params = []

  // Generate params for public docs only
  for (const section of DOCS_REGISTRY.public) {
    for (const page of section.pages) {
      params.push({
        section: section.slug,
        page: page.slug
      })
    }
  }

  return params.length > 0 ? params : [{ section: '_', page: '_' }]
}

/**
 * The parsed document of a section/page pair, or null when it is not a public doc. Reachable as a server reference, so it
 * takes only the two names and reads only the registry's files under `docs/public`.
 */
async function loadDoc(sectionSlug: string, pageSlug: string) {
  'use cache'
  cacheLife('max')

  const doc = resolveRegistryDoc(DOCS_REGISTRY.public, 'public', sectionSlug, pageSlug)
  if (!doc) return null

  const { metadata, html } = await parseMarkdownFile(doc.filePath)
  return { sectionTitle: doc.sectionTitle, metadata, html }
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { section: sectionSlug, page: pageSlug } = await params
  const doc = await loadDoc(sectionSlug, pageSlug)
  if (!doc) return { title: 'Page Not Found' }

  return pageMetadata({
    title: `${doc.metadata.title} | Documentation`,
    description: doc.metadata.description || `Documentation for ${doc.metadata.title}`,
    path: `/docs/${sectionSlug}/${pageSlug}`
  })
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { section: sectionSlug, page: pageSlug } = await params
  const t = await getPublicTranslations('docs')
  const tCommon = await getPublicTranslations('common')

  const doc = await loadDoc(sectionSlug, pageSlug)
  if (!doc) notFound()
  const { metadata, html } = doc

  return (
    <div className="max-w-4xl" data-cy={sel('public.docs.pageDetail')}>
      <DocsBreadcrumbs
        label={tCommon('a11y.breadcrumb')}
        items={[
          { label: t('breadcrumbs.home'), href: '/docs' },
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
  )
}
