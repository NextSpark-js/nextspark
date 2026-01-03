/**
 * Block Loader Utility
 *
 * Provides access to lazy-loaded block components from the generated registry.
 * Components are pre-loaded as React.lazy by the registry generator.
 *
 * @module core/lib/blocks/loader
 */

import { ComponentType } from 'react'
import { BLOCK_COMPONENTS } from '@nextsparkjs/registries/block-registry'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockComponent = ComponentType<any>

/**
 * Get all block components from the generated registry
 * Components are pre-loaded as React.lazy by the registry generator
 *
 * @returns Record of slug -> lazy component mappings
 */
export function getBlockComponents(): Record<string, BlockComponent> {
  return BLOCK_COMPONENTS
}

/**
 * Get a specific block component by slug
 *
 * @param slug - Block slug (e.g., 'hero', 'features-grid')
 * @returns The block component or undefined if not found
 */
export function getBlockComponent(slug: string): BlockComponent | undefined {
  return BLOCK_COMPONENTS[slug]
}

/**
 * Check if a block exists in the registry
 *
 * @param slug - Block slug to check
 * @returns true if block exists
 */
export function hasBlock(slug: string): boolean {
  return slug in BLOCK_COMPONENTS
}

/**
 * Convert flat dot-notation props to nested objects
 *
 * Transforms: { "cta.text": "Hello", "cta.link": "/path" }
 * Into: { cta: { text: "Hello", link: "/path" } }
 *
 * Special handling for CTA-like objects:
 * - Only includes if both text AND link are present and non-empty
 * - Adds default target="_self" if not specified
 *
 * @param props - Flat props object with possible dot notation keys
 * @returns Normalized props with nested objects
 */
export function normalizeBlockProps(props: Record<string, unknown>): Record<string, unknown> {
  // Defensive: handle null/undefined/non-object input gracefully
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return {}
  }

  const result: Record<string, unknown> = {}
  const nestedObjects: Record<string, Record<string, unknown>> = {}

  for (const [key, value] of Object.entries(props)) {
    if (key.includes('.')) {
      // Split the key by dot notation
      const [parentKey, childKey] = key.split('.')
      if (!nestedObjects[parentKey]) {
        nestedObjects[parentKey] = {}
      }
      nestedObjects[parentKey][childKey] = value
    } else {
      result[key] = value
    }
  }

  // Merge nested objects into result, with special handling for CTA-like objects
  for (const [parentKey, childObj] of Object.entries(nestedObjects)) {
    // For CTA-like objects, only include if both text and link are present and non-empty
    if (parentKey === 'cta' || parentKey === 'secondaryButton') {
      const text = childObj.text as string | undefined
      const link = childObj.link as string | undefined

      if (text && text.trim() && link && link.trim()) {
        const ctaObj: Record<string, unknown> = {
          text: text.trim(),
          link: link.trim(),
          target: childObj.target || '_self',
        }
        if (childObj.variant) {
          ctaObj.variant = childObj.variant
        }
        result[parentKey] = ctaObj
      }
      // If text or link is missing/empty, don't include the CTA
    } else {
      // For other nested objects, include as-is
      result[parentKey] = childObj
    }
  }

  return result
}
