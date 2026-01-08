'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { ChevronRight, FileText, Folder, BookOpen, Search, X } from 'lucide-react'
import { useState } from 'react'
import type { DocSectionMeta } from '@nextsparkjs/registries/docs-registry'
import { useTranslations } from 'next-intl'
import { Input } from '../ui/input'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry'

interface DocsSidebarProps {
  sections: DocSectionMeta[]
}

/**
 * Simplified Docs Sidebar
 *
 * Only shows public documentation (no plugins, no categories).
 * Structure: /docs/[section]/[page]
 */
export function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('docs')

  // Get active section from pathname
  const getActiveSection = () => {
    const parts = pathname.split('/').filter(Boolean)
    // Path: /docs/[section]/[page]
    if (parts[0] === 'docs' && parts.length >= 2) {
      return parts[1]
    }
    return null
  }

  const activeSection = getActiveSection()

  // Extract theme configuration
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  const themeAppConfig = THEME_REGISTRY[activeTheme]?.appConfig
  const publicConfig = themeAppConfig?.docs?.public ?? { enabled: true, open: true, label: 'Documentation' }

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Expand active section by default
    return activeSection ? new Set([activeSection]) : new Set()
  })

  const [searchQuery, setSearchQuery] = useState('')

  // Filter sections based on search query
  const filterSections = (sections: DocSectionMeta[]): DocSectionMeta[] => {
    if (!searchQuery.trim()) return sections

    const query = searchQuery.toLowerCase().trim()

    return sections
      .map(section => {
        const sectionMatches = section.title.toLowerCase().includes(query)
        const matchingPages = section.pages.filter(page =>
          page.title.toLowerCase().includes(query)
        )

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

  const handleKeyDown = (e: React.KeyboardEvent, slug: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSection(slug)
    }
  }

  // Apply search filter to sections (already filtered to public by caller)
  const publicSections = filterSections(sections)

  // Check visibility
  if (!publicConfig.enabled) {
    return null
  }

  return (
    <nav
      className="h-full overflow-y-auto p-4"
      aria-label={t('sidebar.label')}
      data-cy="docs-sidebar-nav"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{publicConfig.label}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('description')}
        </p>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-cy="docs-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('search.clear')}
              data-cy="docs-search-clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* No results message */}
      {searchQuery.trim() && publicSections.length === 0 && (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-muted-foreground">
            {t('search.noResults', { query: searchQuery })}
          </p>
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-2">
        {publicSections.map((section) => {
          const isExpanded = searchQuery.trim() ? true : expandedSections.has(section.slug)
          const isActive = activeSection === section.slug

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
                    const href = `/docs/${section.slug}/${page.slug}`
                    const isPageActive = pathname === href

                    return (
                      <Link
                        key={page.slug}
                        href={href}
                        className={cn(
                          "flex items-center px-2 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isPageActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "hover:bg-accent/50"
                        )}
                        aria-current={isPageActive ? 'page' : undefined}
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
        })}
      </div>
    </nav>
  )
}
