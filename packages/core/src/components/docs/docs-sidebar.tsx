'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { ChevronRight, FileText, Folder, BookOpen, Palette, Puzzle, Search, X } from 'lucide-react'
import { useState } from 'react'
import type { DocSectionMeta } from '@nextsparkjs/registries/docs-registry'
import { useTranslations } from 'next-intl'
import { Input } from '../ui/input'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry'

interface DocsSidebarProps {
  sections: DocSectionMeta[]
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('docs')

  // Helper function to detect active elements from pathname
  const getActiveElements = () => {
    // Parse pathname: /docs/[category]/[section]/[page] or /docs/plugins/[plugin]/[section]/[page]
    const parts = pathname.split('/').filter(Boolean)

    if (parts[0] !== 'docs' || parts.length < 3) {
      return { category: null, section: null, plugin: null }
    }

    const category = parts[1] // 'core', 'theme', or 'plugins'

    if (category === 'plugins' && parts.length >= 5) {
      // Plugin path: /docs/plugins/[plugin]/[section]/[page]
      return {
        category: 'plugins',
        plugin: parts[2],
        section: parts[3]
      }
    } else if (parts.length >= 4) {
      // Regular path: /docs/[category]/[section]/[page]
      return {
        category,
        section: parts[2],
        plugin: null
      }
    }

    return { category: null, section: null, plugin: null }
  }

  const activeElements = getActiveElements()

  // Extract theme configuration
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  const themeAppConfig = THEME_REGISTRY[activeTheme]?.appConfig

  // Get category configs with defaults
  const themeConfig = themeAppConfig?.docs?.theme ?? { enabled: true, open: false, label: 'Theme' }
  const pluginsConfig = themeAppConfig?.docs?.plugins ?? { enabled: true, open: false, label: 'Plugins' }
  const coreConfig = themeAppConfig?.docs?.core ?? { enabled: true, open: false, label: 'Core' }

  // Initialize states with active elements and config-based default expansion
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return activeElements.section ? new Set([activeElements.section]) : new Set()
  })

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    // Add active category if present
    if (activeElements.category) {
      expanded.add(activeElements.category)
    }
    // Add categories that should be open by default (only if not already active)
    if (!activeElements.category) {
      if (themeConfig.open) expanded.add('theme')
      if (pluginsConfig.open) expanded.add('plugins')
      if (coreConfig.open) expanded.add('core')
    }
    return expanded
  })

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter sections based on search query
  const filterSections = (sections: DocSectionMeta[]): DocSectionMeta[] => {
    if (!searchQuery.trim()) return sections

    const query = searchQuery.toLowerCase().trim()

    return sections
      .map(section => {
        // Check if section title matches
        const sectionMatches = section.title.toLowerCase().includes(query)

        // Filter pages that match the query
        const matchingPages = section.pages.filter(page =>
          page.title.toLowerCase().includes(query)
        )

        // Include section if it matches OR has matching pages
        if (sectionMatches || matchingPages.length > 0) {
          return {
            ...section,
            pages: sectionMatches ? section.pages : matchingPages
          }
        }

        return null
      })
      .filter((section): section is DocSectionMeta => section !== null)
  }

  const toggleSection = (slug: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(slug)) {
      newExpanded.delete(slug)
    } else {
      newExpanded.add(slug)
    }
    setExpandedSections(newExpanded)
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const handleKeyDown = (e: React.KeyboardEvent, slug: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSection(slug)
    }
  }

  const handleCategoryKeyDown = (e: React.KeyboardEvent, category: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleCategory(category)
    }
  }

  // Group sections by source and apply search filter
  const coreSections = filterSections(sections.filter(s => s.source === 'core'))
  const themeSections = filterSections(sections.filter(s => s.source === 'theme'))
  const pluginSections = filterSections(sections.filter(s => s.source === 'plugin'))

  // Apply visibility filters based on config
  // Additional environment-based check for plugins (production mode)
  const isProduction = process.env.NODE_ENV === 'production'
  const showPluginsDocsInProd = themeAppConfig?.docs?.showPluginsDocsInProd ?? false
  const finalPluginsEnabled = pluginsConfig.enabled && (!isProduction || showPluginsDocsInProd)

  // Apply visibility filters
  const visibleCoreSections = coreConfig.enabled ? coreSections : []
  const visibleThemeSections = themeConfig.enabled ? themeSections : []
  const visiblePluginSections = finalPluginsEnabled ? pluginSections : []

  // Group plugin sections by plugin name (use visible sections only)
  const pluginsByName = visiblePluginSections.reduce((acc, section) => {
    if (!section.pluginName) return acc
    if (!acc[section.pluginName]) {
      acc[section.pluginName] = []
    }
    acc[section.pluginName].push(section)
    return acc
  }, {} as Record<string, DocSectionMeta[]>)

  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(() => {
    return activeElements.plugin ? new Set([activeElements.plugin]) : new Set()
  })

  const togglePlugin = (pluginName: string) => {
    const newExpanded = new Set(expandedPlugins)
    if (newExpanded.has(pluginName)) {
      newExpanded.delete(pluginName)
    } else {
      newExpanded.add(pluginName)
    }
    setExpandedPlugins(newExpanded)
  }

  const handlePluginKeyDown = (e: React.KeyboardEvent, pluginName: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      togglePlugin(pluginName)
    }
  }

  const renderSections = (categorySections: DocSectionMeta[], category: 'core' | 'theme', pluginName?: string) => {
    return categorySections.map((section) => {
      // Auto-expand sections when searching
      const isExpanded = searchQuery.trim() ? true : expandedSections.has(section.slug)
      const isActive = activeElements.section === section.slug

      return (
        <div key={section.slug} className="space-y-1">
          <button
            onClick={() => toggleSection(section.slug)}
            onKeyDown={(e) => handleKeyDown(e, section.slug)}
            className={cn(
              "flex items-center w-full text-left px-2 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                : "hover:bg-accent"
            )}
            aria-expanded={isExpanded}
            aria-controls={`section-${section.slug}`}
            data-cy={`docs-section-toggle-${section.slug}`}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 mr-1 transition-transform",
                isExpanded && "rotate-90"
              )}
              aria-hidden="true"
            />
            <Folder className={cn(
              "h-4 w-4 mr-2",
              isActive && "text-primary"
            )} aria-hidden="true" />
            <span className="text-sm font-medium flex-1">{section.title}</span>
          </button>

          {isExpanded && (
            <div
              className="ml-6 space-y-0.5"
              id={`section-${section.slug}`}
              data-cy={`docs-section-pages-${section.slug}`}
            >
              {section.pages.map((page) => {
                const href = pluginName
                  ? `/docs/plugins/${pluginName}/${section.slug}/${page.slug}`
                  : `/docs/${category}/${section.slug}/${page.slug}`
                const isActive = pathname === href

                return (
                  <Link
                    key={page.slug}
                    href={href}
                    className={cn(
                      "flex items-center px-2 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-accent/50"
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    data-cy={`docs-page-link-${page.slug}`}
                  >
                    <FileText className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                    <span>{page.title}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    })
  }

  const renderPluginSections = (pluginName: string, pluginSections: DocSectionMeta[]) => {
    // Auto-expand plugins when searching
    const isPluginExpanded = searchQuery.trim() ? true : expandedPlugins.has(pluginName)
    const isPluginActive = activeElements.plugin === pluginName
    const pluginDisplayName = pluginName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    return (
      <div key={pluginName} className="mb-3">
        <button
          onClick={() => togglePlugin(pluginName)}
          onKeyDown={(e) => handlePluginKeyDown(e, pluginName)}
          className={cn(
            "flex items-center w-full text-left px-2 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPluginActive
              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold hover:bg-purple-500/15"
              : "hover:bg-accent"
          )}
          aria-expanded={isPluginExpanded}
          data-cy={`docs-plugin-toggle-${pluginName}`}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 mr-1 transition-transform",
              isPluginExpanded && "rotate-90"
            )}
            aria-hidden="true"
          />
          <Puzzle className={cn(
            "h-4 w-4 mr-2",
            isPluginActive
              ? "text-purple-700 dark:text-purple-400"
              : "text-purple-600 dark:text-purple-400"
          )} aria-hidden="true" />
          <span className="text-sm font-medium">{pluginDisplayName} Plugin</span>
        </button>

        {isPluginExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {renderSections(pluginSections, 'core', pluginName)}
          </div>
        )}
      </div>
    )
  }

  const renderCategory = (
    category: 'core' | 'theme' | 'plugins',
    categorySections: DocSectionMeta[],
    icon: React.ReactNode,
    label: string
  ) => {
    // Auto-expand categories when searching
    const isExpanded = searchQuery.trim() ? true : expandedCategories.has(category)
    const isCategoryActive = activeElements.category === category

    return (
      <div className="mb-6">
        <button
          onClick={() => toggleCategory(category)}
          onKeyDown={(e) => handleCategoryKeyDown(e, category)}
          className={cn(
            "flex items-center w-full text-left px-2 py-2 mb-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isCategoryActive
              ? "bg-accent text-accent-foreground hover:bg-accent"
              : "hover:bg-accent/50"
          )}
          aria-expanded={isExpanded}
          data-cy={`docs-category-toggle-${category}`}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 mr-2 transition-transform",
              isExpanded && "rotate-90"
            )}
            aria-hidden="true"
          />
          {icon}
          <span className={cn(
            "text-sm font-semibold",
            isCategoryActive && "font-bold"
          )}>{label}</span>
        </button>

        {isExpanded && (
          <div className="ml-2 space-y-1">
            {category === 'plugins' ? (
              Object.keys(pluginsByName).length > 0 ? (
                Object.entries(pluginsByName).map(([pluginName, pluginSections]) =>
                  renderPluginSections(pluginName, pluginSections)
                )
              ) : (
                <p className="px-2 py-2 text-sm text-muted-foreground italic">
                  No documentation available
                </p>
              )
            ) : categorySections.length > 0 ? (
              renderSections(categorySections, category)
            ) : (
              <p className="px-2 py-2 text-sm text-muted-foreground italic">
                No documentation available
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav
      className="h-full overflow-y-auto p-4"
      aria-label={t('sidebar.label')}
      data-cy="docs-sidebar-nav"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('description')}
        </p>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar en documentación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-cy="docs-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
              data-cy="docs-search-clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* No results message */}
      {searchQuery.trim() && visibleCoreSections.length === 0 && visibleThemeSections.length === 0 && visiblePluginSections.length === 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-muted-foreground">
            No se encontraron resultados para <span className="font-medium">"{searchQuery}"</span>
          </p>
        </div>
      )}

      {visibleThemeSections.length > 0 && renderCategory(
        'theme',
        visibleThemeSections,
        <Palette className="h-4 w-4 mr-2" aria-hidden="true" />,
        themeConfig.label
      )}

      {visiblePluginSections.length > 0 && renderCategory(
        'plugins',
        visiblePluginSections,
        <Puzzle className="h-4 w-4 mr-2" aria-hidden="true" />,
        pluginsConfig.label
      )}

      {visibleCoreSections.length > 0 && renderCategory(
        'core',
        visibleCoreSections,
        <BookOpen className="h-4 w-4 mr-2" aria-hidden="true" />,
        coreConfig.label
      )}
    </nav>
  )
}
