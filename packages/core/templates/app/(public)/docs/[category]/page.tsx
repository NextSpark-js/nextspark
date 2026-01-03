import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { BookOpen, FileText, ArrowRight, Layers } from 'lucide-react'

interface CategoryPageProps {
  params: Promise<{
    category: string
  }>
}

export default async function CategoryIndexPage({ params }: CategoryPageProps) {
  const { category } = await params

  // Get sections for this category
  let sections
  let categoryTitle
  let categoryDescription

  if (category === 'core') {
    sections = DOCS_REGISTRY.core
    categoryTitle = 'Core Documentation'
    categoryDescription = 'Complete documentation for the core framework features, architecture, and patterns.'
  } else if (category === 'theme') {
    sections = DOCS_REGISTRY.theme
    categoryTitle = 'Theme Documentation'
    categoryDescription = 'Documentation for the active theme, including customization and styling guides.'
  } else if (category === 'plugins') {
    sections = DOCS_REGISTRY.plugins
    categoryTitle = 'Plugins Documentation'
    categoryDescription = 'Documentation for all active plugins and their features.'
  } else {
    notFound()
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">{categoryTitle}</h1>
          <p className="text-muted-foreground mb-6">{categoryDescription}</p>
          <p className="text-muted-foreground">No documentation available for this category yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </div>
        <h1 className="text-4xl font-bold mb-4">{categoryTitle}</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          {categoryDescription}
        </p>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 gap-6">
        {sections.map((section) => {
          const firstPageUrl = section.pages[0]
            ? category === 'plugins' && section.pluginName
              ? `/docs/plugins/${section.pluginName}/${section.slug}/${section.pages[0].slug}`
              : `/docs/${category}/${section.slug}/${section.pages[0].slug}`
            : '#'

          return (
            <Card key={section.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{section.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">
                      {section.pages.length} {section.pages.length === 1 ? 'page' : 'pages'} available
                      {section.pluginName && (
                        <span className="ml-2 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                          Plugin: {section.pluginName}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={firstPageUrl}>
                      <span className="sr-only">View {section.title}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {section.pages.map((page) => {
                    const pageUrl = category === 'plugins' && section.pluginName
                      ? `/docs/plugins/${section.pluginName}/${section.slug}/${page.slug}`
                      : `/docs/${category}/${section.slug}/${page.slug}`

                    return (
                      <Link
                        key={page.slug}
                        href={pageUrl}
                        className="flex items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors group"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {page.title}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Back to Docs */}
      <div className="mt-12 text-center">
        <Button asChild variant="outline">
          <Link href="/docs">
            <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
            Back to Documentation Home
          </Link>
        </Button>
      </div>
    </div>
  )
}
