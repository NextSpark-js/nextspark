import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Video Hero Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, content (subtitle), cta (from base) + videoUrl, videoThumbnail
 * - Design: backgroundColor (from base) + layout, autoplay, overlayOpacity
 * - Advanced: className, id (from base)
 */

// Video Hero-specific content fields
const videoHeroContentFields: FieldDefinition[] = [
  {
    name: 'videoUrl',
    label: 'Video URL',
    type: 'url',
    tab: 'content',
    required: true,
    placeholder: 'https://www.youtube.com/watch?v=... or https://vimeo.com/...',
    helpText: 'YouTube or Vimeo video URL',
  },
  {
    name: 'videoThumbnail',
    label: 'Custom Thumbnail',
    type: 'media-library',
    tab: 'content',
    required: false,
    helpText: 'Optional custom thumbnail shown before video plays (recommended: 1920x1080px)',
  },
]

// Video Hero-specific design fields
const videoHeroDesignFields: FieldDefinition[] = [
  {
    name: 'layout',
    label: 'Video Layout',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'inline',
    helpText: 'How the video is displayed',
    options: [
      { label: 'Inline (video centered with text above)', value: 'inline' },
      { label: 'Background (video as fullscreen background)', value: 'background' },
      { label: 'Side by Side (text left, video right)', value: 'side-by-side' },
    ],
  },
  {
    name: 'autoplay',
    label: 'Autoplay Video',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: false,
    checkboxLabel: 'Automatically play video when loaded (muted)',
    helpText: 'Note: Most browsers require videos to be muted for autoplay',
  },
  {
    name: 'overlayOpacity',
    label: 'Overlay Opacity',
    type: 'select',
    tab: 'design',
    required: false,
    default: '40',
    helpText: 'Darkness of overlay for background layout (helps text readability)',
    options: [
      { label: 'None (0%)', value: '0' },
      { label: 'Light (20%)', value: '20' },
      { label: 'Medium (40%)', value: '40' },
      { label: 'Dark (60%)', value: '60' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + video-specific
  ...baseContentFields,
  ...videoHeroContentFields,

  // Design tab: base fields + video-specific
  ...baseDesignFields,
  ...videoHeroDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
