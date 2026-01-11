'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight, ChevronDown, Code, Database, Layers, Puzzle, PanelLeftClose, PanelLeft, Folder, FolderOpen } from 'lucide-react'
import { Input } from '../../ui/input'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import type { ApiRouteEntry, RouteCategory } from '../../../lib/services/api-routes.service'
import type { HttpMethod } from '../api-tester/types'

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  PATCH: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  PUT: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  DELETE: 'bg-red-500/20 text-red-600 dark:text-red-400',
  OPTIONS: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
}

const categoryConfig: Record<RouteCategory, { icon: typeof Code; label: string; color: string }> = {
  core: { icon: Code, label: 'Core', color: 'text-violet-600 dark:text-violet-400' },
  entity: { icon: Database, label: 'Entities', color: 'text-blue-600 dark:text-blue-400' },
  theme: { icon: Layers, label: 'Theme', color: 'text-pink-600 dark:text-pink-400' },
  plugin: { icon: Puzzle, label: 'Plugins', color: 'text-green-600 dark:text-green-400' },
}

interface PathPrefixGroup {
  prefix: string
  routes: ApiRouteEntry[]
}

function groupByPathPrefix(routes: ApiRouteEntry[]): PathPrefixGroup[] {
  const groups = new Map<string, ApiRouteEntry[]>()

  for (const route of routes) {
    // Extract first path segment after /api/v1/
    // e.g., /api/v1/billing/checkout → billing
    const pathWithoutBase = route.path.replace(/^\/api\/v1\//, '')
    const firstSegment = pathWithoutBase.split('/')[0] || 'root'

    if (!groups.has(firstSegment)) {
      groups.set(firstSegment, [])
    }
    groups.get(firstSegment)!.push(route)
  }

  // Sort groups alphabetically
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, routes]) => ({ prefix, routes }))
}

interface SelectedEndpoint {
  path: string
  method: HttpMethod
}

interface ApiEndpointsSidebarProps {
  routes: Record<RouteCategory, ApiRouteEntry[]>
  selectedEndpoint: SelectedEndpoint | null
  onSelectEndpoint: (path: string, method: HttpMethod, route: ApiRouteEntry) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ApiEndpointsSidebar({
  routes,
  selectedEndpoint,
  onSelectEndpoint,
  isCollapsed,
  onToggleCollapse,
}: ApiEndpointsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<RouteCategory>>(
    new Set(['core', 'entity', 'theme', 'plugin'])
  )
  const [expandedPrefixes, setExpandedPrefixes] = useState<Set<string>>(new Set())

  // Filter routes by search query
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes

    const query = searchQuery.toLowerCase()
    const result: Record<RouteCategory, ApiRouteEntry[]> = {
      core: [],
      entity: [],
      theme: [],
      plugin: [],
    }

    for (const category of Object.keys(routes) as RouteCategory[]) {
      result[category] = routes[category].filter(
        (route) =>
          route.path.toLowerCase().includes(query) ||
          route.source?.toLowerCase().includes(query) ||
          route.methods.some((m: string) => m.toLowerCase().includes(query))
      )
    }

    return result
  }, [routes, searchQuery])

  const toggleCategory = (category: RouteCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const togglePrefix = (category: RouteCategory, prefix: string) => {
    const key = `${category}:${prefix}`
    setExpandedPrefixes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const totalRoutes = Object.values(filteredRoutes).reduce((sum, arr) => sum + arr.length, 0)

  // Collapsed view - just icons
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full w-14 border-r bg-card" data-cy={sel('devtools.apiExplorer.sidebar.collapsed')}>
        <div className="p-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-full"
            data-cy={sel('devtools.apiExplorer.sidebar.expand')}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center gap-2 p-2">
          {(Object.keys(categoryConfig) as RouteCategory[]).map((category) => {
            const config = categoryConfig[category]
            const Icon = config.icon
            const count = filteredRoutes[category].length
            return (
              <Button
                key={category}
                variant="ghost"
                size="icon"
                className={cn('relative', config.color)}
                title={`${config.label} (${count})`}
                onClick={() => {
                  onToggleCollapse()
                  setExpandedCategories(new Set([category]))
                }}
              >
                <Icon className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-muted rounded-full px-1">
                    {count}
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-72 shrink-0 border-r bg-card" data-cy={sel('devtools.apiExplorer.sidebar.container')}>
      {/* Header */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Endpoints</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {totalRoutes}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleCollapse}
              data-cy={sel('devtools.apiExplorer.sidebar.collapse')}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-cy={sel('devtools.apiExplorer.sidebar.search')}
          />
        </div>
      </div>

      {/* Endpoints List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {(Object.keys(categoryConfig) as RouteCategory[]).map((category) => {
            const config = categoryConfig[category]
            const Icon = config.icon
            const categoryRoutes = filteredRoutes[category]
            const isExpanded = expandedCategories.has(category)

            if (categoryRoutes.length === 0 && searchQuery) return null

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium',
                      'hover:bg-muted/50 transition-colors',
                      config.color
                    )}
                    data-cy={sel('devtools.apiExplorer.sidebar.category', { category })}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{config.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {categoryRoutes.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-2 mt-1 space-y-0.5">
                    {categoryRoutes.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">
                        No endpoints in this category
                      </p>
                    ) : (
                      groupByPathPrefix(categoryRoutes).map((group) => {
                        const prefixKey = `${category}:${group.prefix}`
                        const isPrefixExpanded = expandedPrefixes.has(prefixKey)

                        return (
                          <Collapsible
                            key={prefixKey}
                            open={isPrefixExpanded}
                            onOpenChange={() => togglePrefix(category, group.prefix)}
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                className={cn(
                                  'flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-xs',
                                  'hover:bg-muted/50 transition-colors text-muted-foreground'
                                )}
                                data-cy={sel('devtools.apiExplorer.sidebar.prefix', { category, prefix: group.prefix })}
                              >
                                {isPrefixExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                {isPrefixExpanded ? (
                                  <FolderOpen className="h-3 w-3 shrink-0" />
                                ) : (
                                  <Folder className="h-3 w-3 shrink-0" />
                                )}
                                <span className="flex-1 text-left font-medium">{group.prefix}</span>
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  {group.routes.length}
                                </Badge>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {group.routes.map((route, idx) => (
                                  <EndpointItem
                                    key={`${route.path}-${idx}`}
                                    route={route}
                                    prefix={group.prefix}
                                    selectedEndpoint={selectedEndpoint}
                                    onSelect={onSelectEndpoint}
                                  />
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

interface EndpointItemProps {
  route: ApiRouteEntry
  prefix: string
  selectedEndpoint: SelectedEndpoint | null
  onSelect: (path: string, method: HttpMethod, route: ApiRouteEntry) => void
}

function EndpointItem({ route, prefix, selectedEndpoint, onSelect }: EndpointItemProps) {
  // Show each method as a separate clickable item
  return (
    <>
      {route.methods.map((method: string) => {
        const isSelected =
          selectedEndpoint?.path === route.path && selectedEndpoint?.method === method
        // Show path without /api/v1/{prefix}
        const shortPath = route.path.replace(/^\/api\/v1\//, '').replace(new RegExp(`^${prefix}\/?`), '')

        return (
          <button
            key={`${route.path}-${method}`}
            onClick={() => onSelect(route.path, method as HttpMethod, route)}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs',
              'hover:bg-muted/50 transition-colors text-left',
              isSelected && 'bg-primary/10 ring-1 ring-primary/20'
            )}
            data-cy={sel('devtools.apiExplorer.sidebar.endpoint', { method: method.toLowerCase(), path: route.path.replace(/\//g, '-') })}
          >
            <Badge
              variant="secondary"
              className={cn('font-mono text-[10px] px-1.5 py-0 shrink-0', methodColors[method])}
            >
              {method}
            </Badge>
            <span className="font-mono truncate text-muted-foreground">/{shortPath || ''}</span>
          </button>
        )
      })}
    </>
  )
}
