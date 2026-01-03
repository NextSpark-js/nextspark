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
 * Type guard to check if a value is a plain object
 */
function isPlainObject(item: unknown): item is Record<string, any> {
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    !(item instanceof Date) &&
    !(item instanceof RegExp) &&
    !(item instanceof Map) &&
    !(item instanceof Set)
  )
}

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
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const output: Record<string, any> = { ...target }

  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source as T
  }

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key]
    const targetValue = target[key]

    // If source value is undefined, skip it (keep target value)
    if (sourceValue === undefined) {
      return
    }

    // If source value is null, replace target value with null
    if (sourceValue === null) {
      output[key] = null
      return
    }

    // If both values are plain objects, merge them recursively
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      output[key] = deepMerge(targetValue, sourceValue)
      return
    }

    // For arrays, functions, primitives, and special objects: replace entirely
    output[key] = sourceValue
  })

  return output as T
}

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
export function mergeConfigs<T extends Record<string, any>>(
  ...configs: Array<T | Partial<T> | null | undefined>
): T {
  // Filter out null/undefined configs
  const validConfigs = configs.filter(
    (config): config is T | Partial<T> => config != null
  )

  if (validConfigs.length === 0) {
    throw new Error('At least one valid config must be provided')
  }

  // Start with the first config as the base
  let result = validConfigs[0] as T

  // Merge each subsequent config
  for (let i = 1; i < validConfigs.length; i++) {
    result = deepMerge(result, validConfigs[i] as Partial<T>)
  }

  return result
}

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
export function validateRequiredProperties(
  merged: Record<string, any>,
  required: string[]
): void {
  const missing: string[] = []

  for (const path of required) {
    const parts = path.split('.')
    let current: any = merged

    for (const part of parts) {
      if (current == null || !(part in current)) {
        missing.push(path)
        break
      }
      current = current[part]
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuration validation failed. Missing required properties:\n${missing.join('\n')}`
    )
  }
}

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
export function getConfigProperty<T = any>(
  config: Record<string, any>,
  path: string,
  defaultValue?: T
): T | undefined {
  const parts = path.split('.')
  let current: any = config

  for (const part of parts) {
    if (current == null || !(part in current)) {
      return defaultValue
    }
    current = current[part]
  }

  return current as T
}

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
export function setConfigProperty(
  config: Record<string, any>,
  path: string,
  value: any
): void {
  const parts = path.split('.')
  const lastPart = parts.pop()!
  let current: any = config

  for (const part of parts) {
    if (!(part in current) || !isPlainObject(current[part])) {
      current[part] = {}
    }
    current = current[part]
  }

  current[lastPart] = value
}