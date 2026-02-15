/**
 * Tool: define_page
 *
 * Defines a page with blocks for the page builder.
 * Called for each page the AI wants to create (e.g., home, about, pricing).
 *
 * NextSpark renders pages using the page builder block system,
 * which supports 16 block types from the default theme.
 */

import { z } from 'zod'

const blockInstanceSchema = z.object({
  blockType: z.enum([
    'hero', 'hero-with-form', 'jumbotron', 'video-hero',
    'features-grid', 'benefits', 'split-content', 'text-content',
    'timeline', 'logo-cloud', 'post-content',
    'pricing-table', 'cta-section', 'testimonials',
    'stats-counter', 'faq-accordion',
  ]).describe(
    'Block type slug. Must match an available block from the theme.'
  ),
  props: z.record(z.unknown()).describe(
    'Block-specific props. Each block type has different props. Always include "title" for section blocks. Use "content" for subtitle/description text. Use "cta" object with {text, link} for buttons. Use "items" array for list-based blocks (features, testimonials, FAQ, pricing plans, etc.).'
  ),
  order: z.number().int().min(0).describe(
    'Display order on the page (0 = first block at top)'
  ),
})

export const definePageSchema = z.object({
  pageName: z.string().min(1).describe(
    'Page display name (e.g., "Home", "About Us", "Pricing")'
  ),
  route: z.string().regex(/^\//).describe(
    'URL route path starting with / (e.g., "/", "/about", "/pricing")'
  ),
  blocks: z.array(blockInstanceSchema).min(1).describe(
    'Ordered array of blocks that compose this page. Include 3-8 blocks per page for a complete layout. Start with a hero/jumbotron, add content sections, end with a CTA.'
  ),
})

export type DefinePageInput = z.infer<typeof definePageSchema>

export const DEFINE_PAGE_TOOL = {
  name: 'define_page' as const,
  description: 'Define a page with blocks for the visual page builder. Each page has a route and an ordered list of blocks. Call this AFTER configure_project and define_entity to create landing pages, about pages, pricing pages, etc. Use 3-8 blocks per page. Start with a hero block, add content sections in the middle, and end with a CTA. Always fill block props with realistic, business-appropriate content matching the project description.',
  schema: definePageSchema,
}
