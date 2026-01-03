import { Code, Database, Layers, Puzzle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card"
import { Badge } from "@nextsparkjs/core/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nextsparkjs/core/components/ui/tabs"
import { ApiRoutesService } from "@nextsparkjs/core/lib/services/api-routes.service"
import { getTranslations } from "next-intl/server"

/**
 * Method badge colors
 */
const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  PUT: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
}

/**
 * Encode path for Link href to handle dynamic segments
 * Next.js App Router doesn't support [...] in href, so we encode brackets
 */
function encodePathForLink(path: string): string {
  return path
    .replace('/api', '')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
}

/**
 * Category icons and colors
 */
const categoryConfig = {
  core: {
    icon: Code,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-950",
    label: "Core"
  },
  entity: {
    icon: Database,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950",
    label: "Entities"
  },
  theme: {
    icon: Layers,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-950",
    label: "Theme"
  },
  plugin: {
    icon: Puzzle,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-950",
    label: "Plugins"
  }
}

/**
 * Developer API Explorer Page
 *
 * Lists all available API endpoints grouped by category.
 * Shows paths, HTTP methods, and source information.
 */
export default async function DevToolsApiPage() {
  const t = await getTranslations("devtools.api")

  const summary = ApiRoutesService.getSummary()
  const routesByCategory = ApiRoutesService.getRoutesGroupedByCategory()

  return (
    <div className="space-y-6" data-cy="devtools-api-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Code className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-violet-600 dark:text-violet-400">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {summary.totalRoutes} {t('endpointsAvailable')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((category) => {
          const config = categoryConfig[category]
          const Icon = config.icon
          const countKey = category === 'entity' ? 'entities' : category === 'plugin' ? 'plugins' : category
          const count = summary.byCategory[countKey as keyof typeof summary.byCategory]

          return (
            <Card key={category} data-cy={`devtools-api-summary-${category}`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 ${config.bgColor} rounded-lg`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Routes by Category Tabs */}
      <Tabs defaultValue="core" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="core" data-cy="devtools-api-tab-core">
            Core ({summary.byCategory.core})
          </TabsTrigger>
          <TabsTrigger value="entity" data-cy="devtools-api-tab-entity">
            Entities ({summary.byCategory.entities})
          </TabsTrigger>
          <TabsTrigger value="theme" data-cy="devtools-api-tab-theme">
            Theme ({summary.byCategory.theme})
          </TabsTrigger>
          <TabsTrigger value="plugin" data-cy="devtools-api-tab-plugin">
            Plugins ({summary.byCategory.plugins})
          </TabsTrigger>
        </TabsList>

        {(Object.keys(routesByCategory) as Array<keyof typeof routesByCategory>).map((category) => {
          const routes = routesByCategory[category]
          const config = categoryConfig[category]

          return (
            <TabsContent key={category} value={category} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    {config.label} Endpoints
                  </CardTitle>
                  <CardDescription>
                    {routes.length === 0
                      ? t('noRoutesInCategory')
                      : `${routes.length} ${t('endpointsInCategory')}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {routes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('noRoutesMessage')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {routes.map((route, index) => (
                        <Link
                          href={`/devtools/api${encodePathForLink(route.path)}`}
                          key={`${route.path}-${index}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          data-cy={`devtools-api-route-${category}-${index}`}
                        >
                          <div className="flex-1 min-w-0">
                            <code className="text-sm font-mono font-medium break-all">
                              {route.path}
                            </code>
                            {route.source && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Source: {route.source}
                              </p>
                            )}
                            {route.subcategory && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Category: {route.subcategory}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-4 flex-shrink-0">
                            {route.methods.map((method) => (
                              <Badge
                                key={method}
                                variant="secondary"
                                className={`text-xs font-mono ${methodColors[method] || ""}`}
                              >
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Generation Info */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground text-center">
            {t('generatedAt')}: {new Date(summary.generatedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
