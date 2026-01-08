/**
 * Mock Documentation Registry for Jest Tests
 *
 * Provides a mock implementation of the auto-generated docs registry
 * for unit testing purposes.
 */

import type { DocPageMeta, DocSectionMeta, DocsRegistryStructure } from '@/core/types/docs'

// Re-export types for external use
export type { DocPageMeta, DocSectionMeta, DocsRegistryStructure }

// Mock public section with pages
const mockPublicSection1: DocSectionMeta = {
  title: 'Getting Started',
  slug: 'getting-started',
  order: 1,
  source: 'public',
  pages: [
    {
      slug: 'introduction',
      title: 'Introduction',
      order: 1,
      path: '../../themes/default/docs/public/01-getting-started/01-introduction.md',
      source: 'public',
    },
    {
      slug: 'installation',
      title: 'Installation',
      order: 2,
      path: '../../themes/default/docs/public/01-getting-started/02-installation.md',
      source: 'public',
    },
  ],
}

const mockPublicSection2: DocSectionMeta = {
  title: 'Features',
  slug: 'features',
  order: 2,
  source: 'public',
  pages: [
    {
      slug: 'components',
      title: 'Components',
      order: 1,
      path: '../../themes/default/docs/public/02-features/01-components.md',
      source: 'public',
    },
    {
      slug: 'styling',
      title: 'Styling',
      order: 2,
      path: '../../themes/default/docs/public/02-features/02-styling.md',
      source: 'public',
    },
  ],
}

// Mock superadmin section with pages
const mockSuperadminSection1: DocSectionMeta = {
  title: 'Setup',
  slug: 'setup',
  order: 1,
  source: 'superadmin',
  pages: [
    {
      slug: 'configuration',
      title: 'Configuration',
      order: 1,
      path: '../../themes/default/docs/superadmin/01-setup/01-configuration.md',
      source: 'superadmin',
    },
    {
      slug: 'deployment',
      title: 'Deployment',
      order: 2,
      path: '../../themes/default/docs/superadmin/01-setup/02-deployment.md',
      source: 'superadmin',
    },
  ],
}

const mockSuperadminSection2: DocSectionMeta = {
  title: 'Management',
  slug: 'management',
  order: 2,
  source: 'superadmin',
  pages: [
    {
      slug: 'users',
      title: 'User Management',
      order: 1,
      path: '../../themes/default/docs/superadmin/02-management/01-users.md',
      source: 'superadmin',
    },
  ],
}

// Mock registry
export const DOCS_REGISTRY: DocsRegistryStructure = {
  public: [mockPublicSection1, mockPublicSection2],
  superadmin: [mockSuperadminSection1, mockSuperadminSection2],
  all: [
    mockPublicSection1,
    mockSuperadminSection1,
    mockPublicSection2,
    mockSuperadminSection2,
  ].sort((a, b) => a.order - b.order),
}

export type DocsRegistry = typeof DOCS_REGISTRY

/**
 * Get all documentation sections (public + superadmin)
 */
export function getAllDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.all
}

/**
 * Get public documentation sections only (for /docs)
 */
export function getPublicDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.public
}

/**
 * Get superadmin documentation sections only (for /superadmin/docs)
 */
export function getSuperadminDocSections(): DocSectionMeta[] {
  return DOCS_REGISTRY.superadmin
}

/**
 * Find a section by slug
 */
export function findDocSection(slug: string): DocSectionMeta | undefined {
  return DOCS_REGISTRY.all.find((section) => section.slug === slug)
}

/**
 * Find a section by slug in a specific category
 */
export function findDocSectionInCategory(
  slug: string,
  category: 'public' | 'superadmin'
): DocSectionMeta | undefined {
  return DOCS_REGISTRY[category].find((section) => section.slug === slug)
}

/**
 * Find a page within a section
 */
export function findDocPage(
  sectionSlug: string,
  pageSlug: string
): DocPageMeta | undefined {
  const section = findDocSection(sectionSlug)
  return section?.pages.find((page) => page.slug === pageSlug)
}
