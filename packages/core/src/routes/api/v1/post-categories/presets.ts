/**
 * API Presets for Post Categories
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/post-categories',
  summary: 'Manage blog post categories (taxonomies)',
  presets: [
    // List
    {
      id: 'list-all',
      title: 'List All Categories',
      description: 'Fetch all active post categories',
      method: 'GET',
      tags: ['read', 'list']
    },

    // Create
    {
      id: 'create-category',
      title: 'Create Category',
      description: 'Create a new post category',
      method: 'POST',
      payload: {
        name: 'Technology',
        description: 'Tech news and tutorials',
        icon: 'Cpu',
        color: '#3b82f6',
        order: 1
      },
      tags: ['write', 'create']
    },
    {
      id: 'create-category-with-slug',
      title: 'Create with Custom Slug',
      description: 'Create category with explicit slug',
      method: 'POST',
      payload: {
        name: 'Web Development',
        slug: 'web-dev',
        description: 'Web development tutorials and tips',
        order: 2
      },
      tags: ['write', 'create']
    },
    {
      id: 'create-subcategory',
      title: 'Create Subcategory',
      description: 'Create child category with parent',
      method: 'POST',
      payload: {
        name: 'JavaScript',
        slug: 'javascript',
        parentId: 'parent_category_id_here',
        description: 'JavaScript tutorials',
        order: 1
      },
      tags: ['write', 'create', 'hierarchy']
    },
    {
      id: 'create-default-category',
      title: 'Create Default Category',
      description: 'Create category marked as default',
      method: 'POST',
      payload: {
        name: 'Uncategorized',
        slug: 'uncategorized',
        isDefault: true,
        order: 999
      },
      tags: ['write', 'create']
    }
  ]
})
