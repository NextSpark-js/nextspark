/**
 * Block Loader Utility
 *
 * Provides access to lazy-loaded block components from the generated registry.
 * Components are pre-loaded as React.lazy by the registry generator.
 *
 * @module core/lib/blocks/loader
 */
import { ComponentType } from 'react';
type BlockComponent = ComponentType<any>;
/**
 * Get all block components from the generated registry
 * Components are pre-loaded as React.lazy by the registry generator
 *
 * @returns Record of slug -> lazy component mappings
 */
export declare function getBlockComponents(): Record<string, BlockComponent>;
/**
 * Get a specific block component by slug
 *
 * @param slug - Block slug (e.g., 'hero', 'features-grid')
 * @returns The block component or undefined if not found
 */
export declare function getBlockComponent(slug: string): BlockComponent | undefined;
/**
 * Check if a block exists in the registry
 *
 * @param slug - Block slug to check
 * @returns true if block exists
 */
export declare function hasBlock(slug: string): boolean;
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
export declare function normalizeBlockProps(props: Record<string, unknown>): Record<string, unknown>;
export {};
//# sourceMappingURL=loader.d.ts.map
