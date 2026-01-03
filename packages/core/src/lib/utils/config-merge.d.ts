/**
 * Configuration Deep Merge Utility
 *
 * Provides utilities to deeply merge configuration objects, allowing themes
 * to override only specific properties while keeping the rest of the defaults.
 *
 * Example:
 * ```typescript
 * const defaultConfig = { a: 1, b: { c: 2, d: 3 } }
 * const themeConfig = { b: { d: 99 } }
 * const result = deepMerge(defaultConfig, themeConfig)
 * // Result: { a: 1, b: { c: 2, d: 99 } }
 * ```
 */
/**
 * Deep merge two objects recursively
 *
 * @param target - The target object (defaults)
 * @param source - The source object (overrides)
 * @returns A new object with merged values
 *
 * Rules:
 * - Plain objects are merged recursively
 * - Arrays are replaced entirely (not merged)
 * - Functions are replaced entirely
 * - Primitives are replaced entirely
 * - null/undefined in source replaces target value
 */
export declare function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
/**
 * Merge multiple configuration objects
 *
 * @param configs - Array of configuration objects to merge (priority: last wins)
 * @returns Merged configuration object
 *
 * Example:
 * ```typescript
 * const result = mergeConfigs(defaultConfig, pluginConfig, themeConfig)
 * // themeConfig has highest priority
 * ```
 */
export declare function mergeConfigs<T extends Record<string, any>>(...configs: Array<T | Partial<T> | null | undefined>): T;
/**
 * Validate that a config merge doesn't lose required properties
 *
 * @param merged - The merged configuration
 * @param required - List of required property paths (dot notation)
 * @throws Error if any required property is missing
 *
 * Example:
 * ```typescript
 * validateRequiredProperties(config, [
 *   'topbar.search.enabled',
 *   'settings.pages',
 * ])
 * ```
 */
export declare function validateRequiredProperties(merged: Record<string, any>, required: string[]): void;
/**
 * Get a nested property from a configuration object using dot notation
 *
 * @param config - The configuration object
 * @param path - The property path (dot notation)
 * @param defaultValue - Default value if property doesn't exist
 * @returns The property value or default
 *
 * Example:
 * ```typescript
 * const searchEnabled = getConfigProperty(config, 'topbar.search.enabled', true)
 * ```
 */
export declare function getConfigProperty<T = any>(config: Record<string, any>, path: string, defaultValue?: T): T | undefined;
/**
 * Set a nested property in a configuration object using dot notation
 *
 * @param config - The configuration object (will be mutated)
 * @param path - The property path (dot notation)
 * @param value - The value to set
 *
 * Example:
 * ```typescript
 * setConfigProperty(config, 'topbar.search.enabled', false)
 * ```
 */
export declare function setConfigProperty(config: Record<string, any>, path: string, value: any): void;
//# sourceMappingURL=config-merge.d.ts.map