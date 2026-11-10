import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { sel } from '@nextsparkjs/core/selectors/public'
import { BookOpen, Folder, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { pageMetadata } from '@nextsparkjs/core/lib/seo/page-metadata'
import type { Metadata } from 'next'
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'

export async function generateMetadata(): Promise<Metadata> {
  const title = (await getPublicTranslations('docs'))('title')
  const description = (await getPublicTranslations('docs.index'))('description')
  return pageMetadata({ title, description, path: '/docs' })
}

export default async function DocsPage() {
  const sections = DOCS_REGISTRY.public
  const title = (await getPublicTranslations('docs'))('title')
  const text = await getPublicTranslations('docs.index')

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          {title}
        </div>
        <h1 className="text-4xl font-bold mb-4">
          {title}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {text('intro')}
        </p>
      </div>

      {/* Documentation Sections */}
      {sections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Card key={section.slug} className="h-full hover:shadow-lg transition-shadow" data-cy={sel('public.docs.sectionCard', { slug: section.slug })}>
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Folder className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  {text(section.pages.length === 1 ? 'pagesOne' : 'pagesMany', { count: section.pages.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link
                        href={`/docs/${section.slug}/${page.slug}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group"
                        data-cy={sel('public.docs.pageLink', { slug: page.slug })}
                      >
                        <FileText className="h-3 w-3" />
                        <span className="flex-1">{page.title}</span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{text('emptyTitle')}</h2>
          <p className="text-muted-foreground">
            {text('emptyDescription')}
          </p>
        </div>
      )}
    </div>
  )
}
