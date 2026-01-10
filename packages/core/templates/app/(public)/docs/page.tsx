import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { BookOpen, Folder, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Complete documentation for the application'
}

export default function DocsPage() {
  const sections = DOCS_REGISTRY.public

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Documentation
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Guides and reference documentation to help you get the most out of the application.
        </p>
      </div>

      {/* Documentation Sections */}
      {sections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Card key={section.slug} className="h-full hover:shadow-lg transition-shadow" data-cy={`docs-section-card-${section.slug}`}>
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
                  {section.pages.length} {section.pages.length === 1 ? 'page' : 'pages'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link
                        href={`/docs/${section.slug}/${page.slug}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group"
                        data-cy={`docs-page-link-${page.slug}`}
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
          <h2 className="text-xl font-semibold mb-2">No Documentation Available</h2>
          <p className="text-muted-foreground">
            Documentation will appear here once it is added to the project.
          </p>
        </div>
      )}
    </div>
  )
}
