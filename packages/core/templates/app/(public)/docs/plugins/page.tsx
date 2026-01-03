import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { Puzzle, FileText, ArrowRight, Layers } from 'lucide-react'

export default function PluginsIndexPage() {
  const pluginSections = DOCS_REGISTRY.plugins

  // Group sections by plugin name
  const pluginsByName = pluginSections.reduce((acc, section) => {
    if (!section.pluginName) return acc
    if (!acc[section.pluginName]) {
      acc[section.pluginName] = {
        name: section.pluginName,
        sections: []
      }
    }
    acc[section.pluginName].sections.push(section)
    return acc
  }, {} as Record<string, { name: string; sections: typeof pluginSections }>)

  const plugins = Object.values(pluginsByName)

  if (plugins.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Plugins Documentation</h1>
          <p className="text-muted-foreground mb-6">
            Documentation for all active plugins and their features.
          </p>
          <p className="text-muted-foreground">No plugins documentation available yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
          <Puzzle className="h-4 w-4" />
          Plugins
        </div>
        <h1 className="text-4xl font-bold mb-4">Plugins Documentation</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Complete documentation for all active plugins, including installation guides, feature documentation, and usage examples.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Plugins</CardDescription>
            <CardTitle className="text-3xl">{plugins.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Sections</CardDescription>
            <CardTitle className="text-3xl">{pluginSections.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Pages</CardDescription>
            <CardTitle className="text-3xl">
              {pluginSections.reduce((sum, section) => sum + section.pages.length, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 gap-8">
        {plugins.map((plugin) => {
          const pluginDisplayName = plugin.name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          const totalPages = plugin.sections.reduce((sum, section) => sum + section.pages.length, 0)
          const firstSection = plugin.sections[0]
          const firstPageUrl = firstSection?.pages[0]
            ? `/docs/plugins/${plugin.name}/${firstSection.slug}/${firstSection.pages[0].slug}`
            : '#'

          return (
            <Card key={plugin.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-purple-500/10 rounded-lg">
                        <Puzzle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{pluginDisplayName} Plugin</CardTitle>
                        <CardDescription className="text-base mt-1">
                          {plugin.sections.length} {plugin.sections.length === 1 ? 'section' : 'sections'} • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={firstPageUrl}>
                      Get Started
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {plugin.sections.map((section) => (
                    <div key={section.slug} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{section.title}</h3>
                      </div>
                      <div className="space-y-2">
                        {section.pages.map((page) => {
                          const pageUrl = `/docs/plugins/${plugin.name}/${section.slug}/${page.slug}`

                          return (
                            <Link
                              key={page.slug}
                              href={pageUrl}
                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                            >
                              <FileText className="h-3.5 w-3.5 group-hover:text-primary" />
                              <span>{page.title}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
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
