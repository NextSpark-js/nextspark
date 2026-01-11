/**
 * API Presets for Pages Entity
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * The endpoint is automatically derived from the entity name: /api/v1/pages
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage builder-enabled pages',
  presets: [
    {
      id: 'list-all',
      title: 'List All Pages',
      description: 'Fetch all pages with default pagination',
      method: 'GET',
      params: {
        limit: 10,
        offset: 0
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-published',
      title: 'List Published Pages',
      description: 'Fetch only published pages',
      method: 'GET',
      params: {
        status: 'published',
        limit: 20
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-locale',
      title: 'List Spanish Pages',
      description: 'Fetch pages in Spanish locale',
      method: 'GET',
      params: {
        locale: 'es',
        limit: 10
      },
      tags: ['read', 'filter', 'i18n']
    },
    {
      id: 'create-draft',
      title: 'Create Draft Page',
      description: 'Create a new page as draft',
      method: 'POST',
      payload: {
        title: 'New Page',
        slug: 'new-page',
        status: 'draft',
        locale: 'en',
        blocks: []
      },
      tags: ['write', 'create']
    },
    {
      id: 'search-title',
      title: 'Search by Title',
      description: 'Search pages by title',
      method: 'GET',
      params: {
        search: 'About',
        searchField: 'title'
      },
      tags: ['read', 'search']
    }
  ]
})
