/**
 * API Presets for Social Media Publish
 *
 * Publish content to Facebook Pages and Instagram Business
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/social-media-publisher/social/publish',
  summary: 'Publish photos, carousels, and text posts to social media',
  presets: [
    {
      id: 'instagram-photo',
      title: 'Instagram Photo',
      description: 'Publish single photo to Instagram',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}',
        platform: 'instagram_business',
        imageUrl: '{{imageUrl}}',
        caption: 'Check out our latest post!'
      },
      tags: ['write', 'instagram', 'photo']
    },
    {
      id: 'instagram-carousel',
      title: 'Instagram Carousel',
      description: 'Publish multi-image carousel to Instagram',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}',
        platform: 'instagram_business',
        imageUrls: ['{{imageUrl1}}', '{{imageUrl2}}', '{{imageUrl3}}'],
        caption: 'Swipe through our collection!'
      },
      tags: ['write', 'instagram', 'carousel']
    },
    {
      id: 'facebook-photo',
      title: 'Facebook Photo',
      description: 'Publish photo to Facebook Page',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}',
        platform: 'facebook_page',
        imageUrl: '{{imageUrl}}',
        caption: 'New post on our page!'
      },
      tags: ['write', 'facebook', 'photo']
    },
    {
      id: 'facebook-text',
      title: 'Facebook Text Post',
      description: 'Publish text-only post to Facebook Page',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}',
        platform: 'facebook_page',
        caption: 'Exciting news coming soon!'
      },
      tags: ['write', 'facebook', 'text']
    },
    {
      id: 'facebook-carousel',
      title: 'Facebook Carousel',
      description: 'Publish multi-image carousel to Facebook Page',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}',
        platform: 'facebook_page',
        imageUrls: ['{{imageUrl1}}', '{{imageUrl2}}'],
        caption: 'Check out our photo gallery!'
      },
      tags: ['write', 'facebook', 'carousel']
    }
  ]
})
