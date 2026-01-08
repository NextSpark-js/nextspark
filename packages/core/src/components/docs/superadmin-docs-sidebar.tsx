'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { ChevronRight, FileText, Folder, Shield } from 'lucide-react'
import { useState } from 'react'
import type { DocSectionMeta } from '@nextsparkjs/registries/docs-registry'

interface SuperadminDocsSidebarProps {
  sections: DocSectionMeta[]
}

export function SuperadminDocsSidebar({ sections }: SuperadminDocsSidebarProps) {
  const pathname = usePathname()

  // Get active section from pathname
  const getActiveSection = () => {
    const parts = pathname.split('/').filter(Boolean)
    // Path: /superadmin/docs/[section]/[page]
    if (parts[0] === 'superadmin' && parts[1] === 'docs' && parts.length >= 3) {
      return parts[2]
    }
    return null
  }

  const activeSection = getActiveSection()

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return activeSection ? new Set([activeSection]) : new Set()
  })

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

  return (
    <nav
      className="h-full overflow-y-auto p-4"
      aria-label="Admin documentation navigation"
      data-cy="superadmin-docs-sidebar"
    >
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold">Admin Docs</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Documentation for administrators
        </p>
      </div>

      <div className="space-y-2">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.slug)
          const isActive = activeSection === section.slug

          return (
            <div key={section.slug} className="space-y-1">
              <button
                onClick={() => toggleSection(section.slug)}
                onKeyDown={(e) => handleKeyDown(e, section.slug)}
                className={cn(
                  "flex items-center w-full text-left px-2 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-red-500/10 text-red-700 dark:text-red-400 font-semibold hover:bg-red-500/15"
                    : "hover:bg-accent"
                )}
                aria-expanded={isExpanded}
                aria-controls={`section-${section.slug}`}
                data-cy={`superadmin-docs-section-${section.slug}`}
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
                  isActive ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )} aria-hidden="true" />
                <span className="text-sm font-medium flex-1">{section.title}</span>
              </button>

              {isExpanded && (
                <div
                  className="ml-6 space-y-0.5"
                  id={`section-${section.slug}`}
                  data-cy={`superadmin-docs-pages-${section.slug}`}
                >
                  {section.pages.map((page) => {
                    const href = `/superadmin/docs/${section.slug}/${page.slug}`
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
                        data-cy={`superadmin-docs-page-${page.slug}`}
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
