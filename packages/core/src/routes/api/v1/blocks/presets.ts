/**
 * API Presets for Blocks
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/blocks',
  summary: 'Access and validate page builder blocks',
  presets: [
    // List blocks
    {
      id: 'list-all',
      title: 'List All Blocks',
      description: 'Fetch all registered blocks with metadata',
      method: 'GET',
      tags: ['read', 'list']
    },
    {
      id: 'list-hero-blocks',
      title: 'List Hero Blocks',
      description: 'Filter blocks by hero category',
      method: 'GET',
      queryParams: {
        category: 'hero'
      },
      tags: ['read', 'list', 'filter']
    },
    {
      id: 'list-content-blocks',
      title: 'List Content Blocks',
      description: 'Filter blocks by content category',
      method: 'GET',
      queryParams: {
        category: 'content'
      },
      tags: ['read', 'list', 'filter']
    },
    {
      id: 'list-page-blocks',
      title: 'List Page Blocks',
      description: 'Filter blocks available for pages',
      method: 'GET',
      queryParams: {
        scope: 'pages'
      },
      tags: ['read', 'list', 'filter']
    },

    // Get specific block
    {
      id: 'get-hero-simple',
      title: 'Get Hero Simple',
      description: 'Fetch hero-simple block metadata',
      method: 'GET',
      path: '/hero-simple',
      tags: ['read', 'single']
    },
    {
      id: 'get-faq-accordion',
      title: 'Get FAQ Accordion',
      description: 'Fetch faq-accordion block metadata',
      method: 'GET',
      path: '/faq-accordion',
      tags: ['read', 'single']
    },

    // Validate
    {
      id: 'validate-hero',
      title: 'Validate Hero Props',
      description: 'Validate hero block properties',
      method: 'POST',
      path: '/validate',
      payload: {
        blockSlug: 'hero-simple',
        props: {
          title: 'Welcome to Our Site',
          subtitle: 'Discover amazing features'
        }
      },
      tags: ['write', 'validate']
    },
    {
      id: 'validate-faq',
      title: 'Validate FAQ Props',
      description: 'Validate FAQ block with items',
      method: 'POST',
      path: '/validate',
      payload: {
        blockSlug: 'faq-accordion',
        props: {
          title: 'Frequently Asked Questions',
          items: [
            {
              question: 'How does it work?',
              answer: 'It works seamlessly with your existing workflow.'
            }
          ]
        }
      },
      tags: ['write', 'validate']
    },
    {
      id: 'validate-invalid',
      title: 'Validate Invalid Props',
      description: 'Test validation error response (missing required field)',
      method: 'POST',
      path: '/validate',
      payload: {
        blockSlug: 'hero-simple',
        props: {
          subtitle: 'Missing required title field'
        }
      },
      tags: ['write', 'validate', 'error']
    }
  ]
})
