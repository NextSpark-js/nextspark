/**
 * Core Configuration Loader
 *
 * This module provides async access to the merged application configuration.
 * The actual merge logic is in config-sync.ts (synchronous).
 *
 * @deprecated Most code should import directly from config-sync.ts for synchronous access.
 * This async loader is maintained for backward compatibility with code that expects async config loading.
 */
import type { ApplicationConfig } from './config-types';
/**
 * Load application configuration (async wrapper for compatibility)
 *
 * @deprecated Import APP_CONFIG_MERGED from config-sync.ts instead for synchronous access
 */
export declare function loadApplicationConfig(): Promise<ApplicationConfig>;
/**
 * Get application configuration (cached)
 * This ensures configuration is only loaded once per application lifecycle
 */
export declare function getApplicationConfig(): Promise<ApplicationConfig>;
/**
 * Clear configuration cache (useful for testing)
 */
export declare function clearConfigCache(): void;
//# sourceMappingURL=config-loader.d.ts.map