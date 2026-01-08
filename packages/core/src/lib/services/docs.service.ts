/**
 * Documentation Service
 *
 * Service layer for documentation operations following the project's
 * service pattern. Provides a consistent API for docs operations.
 *
 * NOTE: This service wraps the auto-generated registry functions
 * and adds additional utility methods.
 */

import {
  DOCS_REGISTRY,
  getAllDocSections,
  getPublicDocSections,
  getSuperadminDocSections,
  findDocSection,
  findDocSectionInCategory,
  findDocPage,
} from '@nextsparkjs/registries/docs-registry'
import type {
  DocPageMeta,
  DocSectionMeta,
  DocsRegistryStructure,
} from '../../types/docs'

/**
 * Documentation Service
 *
 * Static service class for documentation operations
 */
export class DocsService {
  // ============================================================================
  // Registry Access
  // ============================================================================

  /**
   * Get the full documentation registry
   */
  static getRegistry(): DocsRegistryStructure {
    return DOCS_REGISTRY
  }

  /**
   * Get all documentation sections (public + superadmin)
   */
  static getAll(): DocSectionMeta[] {
    return getAllDocSections()
  }

  /**
   * Get public documentation sections (for /docs)
   */
  static getPublic(): DocSectionMeta[] {
    return getPublicDocSections()
  }

  /**
   * Get superadmin documentation sections (for /superadmin/docs)
   */
  static getSuperadmin(): DocSectionMeta[] {
    return getSuperadminDocSections()
  }

  // ============================================================================
  // Section Operations
  // ============================================================================

  /**
   * Find a section by slug across all categories
   */
  static findSection(slug: string): DocSectionMeta | undefined {
    return findDocSection(slug)
  }

  /**
   * Find a section by slug in a specific category
   */
  static findSectionInCategory(
    slug: string,
    category: 'public' | 'superadmin'
  ): DocSectionMeta | undefined {
    return findDocSectionInCategory(slug, category)
  }

  /**
   * Check if a section exists
   */
  static sectionExists(slug: string): boolean {
    return findDocSection(slug) !== undefined
  }

  /**
   * Get all section slugs
   */
  static getSectionSlugs(): string[] {
    return getAllDocSections().map((section) => section.slug)
  }

  /**
   * Get section count
   */
  static getSectionCount(): number {
    return getAllDocSections().length
  }

  // ============================================================================
  // Page Operations
  // ============================================================================

  /**
   * Find a page within a section
   */
  static findPage(sectionSlug: string, pageSlug: string): DocPageMeta | undefined {
    return findDocPage(sectionSlug, pageSlug)
  }

  /**
   * Check if a page exists
   */
  static pageExists(sectionSlug: string, pageSlug: string): boolean {
    return findDocPage(sectionSlug, pageSlug) !== undefined
  }

  /**
   * Get all pages in a section
   */
  static getPages(sectionSlug: string): DocPageMeta[] {
    const section = findDocSection(sectionSlug)
    return section?.pages ?? []
  }

  /**
   * Get total page count across all sections
   */
  static getPageCount(): number {
    return getAllDocSections().reduce(
      (total, section) => total + section.pages.length,
      0
    )
  }

  /**
   * Get all pages as a flat array
   */
  static getAllPages(): DocPageMeta[] {
    return getAllDocSections().flatMap((section) => section.pages)
  }

  // ============================================================================
  // Path Resolution
  // ============================================================================

  /**
   * Build the URL path for a page
   *
   * @param category - 'public' or 'superadmin'
   * @param sectionSlug - Section slug
   * @param pageSlug - Page slug
   * @returns URL path string
   */
  static buildPageUrl(
    category: 'public' | 'superadmin',
    sectionSlug: string,
    pageSlug: string
  ): string {
    if (category === 'superadmin') {
      return `/superadmin/docs/${sectionSlug}/${pageSlug}`
    }
    return `/docs/${sectionSlug}/${pageSlug}`
  }

  /**
   * Build the URL path for a section
   *
   * @param category - 'public' or 'superadmin'
   * @param sectionSlug - Section slug
   * @returns URL path string
   */
  static buildSectionUrl(
    category: 'public' | 'superadmin',
    sectionSlug: string
  ): string {
    if (category === 'superadmin') {
      return `/superadmin/docs/${sectionSlug}`
    }
    return `/docs/${sectionSlug}`
  }

  /**
   * Parse a URL path to extract category, section, and page
   *
   * @param pathname - URL pathname (e.g., '/docs/getting-started/intro')
   * @returns Parsed path info or null if invalid
   */
  static parsePath(pathname: string): {
    category: 'public' | 'superadmin'
    sectionSlug: string | null
    pageSlug: string | null
  } | null {
    const parts = pathname.split('/').filter(Boolean)

    // Public docs: /docs/[section]/[page]
    if (parts[0] === 'docs') {
      return {
        category: 'public',
        sectionSlug: parts[1] ?? null,
        pageSlug: parts[2] ?? null,
      }
    }

    // Superadmin docs: /superadmin/docs/[section]/[page]
    if (parts[0] === 'superadmin' && parts[1] === 'docs') {
      return {
        category: 'superadmin',
        sectionSlug: parts[2] ?? null,
        pageSlug: parts[3] ?? null,
      }
    }

    return null
  }

  // ============================================================================
  // Search & Filter
  // ============================================================================

  /**
   * Search across all documentation
   *
   * @param query - Search query string
   * @param category - Optional category filter
   * @returns Filtered sections with matching pages
   */
  static search(
    query: string,
    category?: 'public' | 'superadmin'
  ): DocSectionMeta[] {
    const trimmedQuery = query.trim().toLowerCase()

    if (!trimmedQuery) {
      return category ? DOCS_REGISTRY[category] : getAllDocSections()
    }

    const sections = category ? DOCS_REGISTRY[category] : getAllDocSections()

    return sections
      .map((section) => {
        const sectionMatches = section.title.toLowerCase().includes(trimmedQuery)
        const matchingPages = section.pages.filter((page) =>
          page.title.toLowerCase().includes(trimmedQuery)
        )

        if (sectionMatches || matchingPages.length > 0) {
          return {
            ...section,
            pages: sectionMatches ? section.pages : matchingPages,
          }
        }

        return null
      })
      .filter((section): section is DocSectionMeta => section !== null)
  }

  // ============================================================================
  // Navigation Helpers
  // ============================================================================

  /**
   * Get the first page of the first section (landing page)
   *
   * @param category - 'public' or 'superadmin'
   * @returns First page or undefined
   */
  static getFirstPage(category: 'public' | 'superadmin'): DocPageMeta | undefined {
    const sections = DOCS_REGISTRY[category]
    return sections[0]?.pages[0]
  }

  /**
   * Get previous and next pages for navigation
   *
   * @param category - 'public' or 'superadmin'
   * @param sectionSlug - Current section slug
   * @param pageSlug - Current page slug
   * @returns Previous and next page info
   */
  static getNavigation(
    category: 'public' | 'superadmin',
    sectionSlug: string,
    pageSlug: string
  ): {
    prev: { section: DocSectionMeta; page: DocPageMeta } | null
    next: { section: DocSectionMeta; page: DocPageMeta } | null
  } {
    const sections = DOCS_REGISTRY[category]
    const allPages: { section: DocSectionMeta; page: DocPageMeta }[] = []

    // Flatten all pages with their sections
    sections.forEach((section) => {
      section.pages.forEach((page) => {
        allPages.push({ section, page })
      })
    })

    // Find current page index
    const currentIndex = allPages.findIndex(
      (item) =>
        item.section.slug === sectionSlug && item.page.slug === pageSlug
    )

    if (currentIndex === -1) {
      return { prev: null, next: null }
    }

    return {
      prev: currentIndex > 0 ? allPages[currentIndex - 1] : null,
      next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null,
    }
  }

  // ============================================================================
  // Metadata
  // ============================================================================

  /**
   * Get documentation metadata/stats
   */
  static getMetadata(): {
    publicSections: number
    superadminSections: number
    totalSections: number
    publicPages: number
    superadminPages: number
    totalPages: number
    sectionSlugs: string[]
  } {
    const publicSections = DOCS_REGISTRY.public.length
    const superadminSections = DOCS_REGISTRY.superadmin.length
    const publicPages = DOCS_REGISTRY.public.reduce(
      (sum, s) => sum + s.pages.length,
      0
    )
    const superadminPages = DOCS_REGISTRY.superadmin.reduce(
      (sum, s) => sum + s.pages.length,
      0
    )

    return {
      publicSections,
      superadminSections,
      totalSections: publicSections + superadminSections,
      publicPages,
      superadminPages,
      totalPages: publicPages + superadminPages,
      sectionSlugs: getAllDocSections().map((s) => s.slug),
    }
  }
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

export const getDocsRegistry = () => DocsService.getRegistry()
export const getAllDocs = () => DocsService.getAll()
export const getPublicDocs = () => DocsService.getPublic()
export const getSuperadminDocs = () => DocsService.getSuperadmin()
export const findDocsSection = (slug: string) => DocsService.findSection(slug)
export const findDocsPage = (sectionSlug: string, pageSlug: string) =>
  DocsService.findPage(sectionSlug, pageSlug)
export const searchDocs = (query: string, category?: 'public' | 'superadmin') =>
  DocsService.search(query, category)
