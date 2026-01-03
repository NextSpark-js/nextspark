/**
 * Theme Service
 *
 * Service layer for theme registry operations.
 * Provides static methods for querying theme data.
 */
import { THEME_METADATA, type ThemeRegistryEntry, type ThemeEntity, type ThemeRouteFile, type ThemeName } from '@nextsparkjs/registries/theme-registry';
import type { ThemeConfig } from '../../types/theme';
import type { DevConfig } from '../config/types';
export type { ThemeRegistryEntry, ThemeEntity, ThemeRouteFile, ThemeName };
/**
 * ThemeService - Static service for theme operations
 */
export declare class ThemeService {
    /**
     * Get all registered themes
     * @returns Array of ThemeConfig
     * @complexity O(n) where n = number of themes
     */
    static getAll(): ThemeConfig[];
    /**
     * Get theme by name
     * @complexity O(1)
     */
    static getByName(name: string): ThemeConfig | undefined;
    /**
     * Get full registry entry by name
     * @complexity O(1)
     */
    static getEntry(name: string): ThemeRegistryEntry | undefined;
    /**
     * Get dashboard config for a theme
     * @complexity O(1)
     */
    static getDashboardConfig(name: string): any | undefined;
    /**
     * Get app config for a theme
     * @complexity O(1)
     */
    static getAppConfig(name: string): any | undefined;
    /**
     * Get dev config for a theme
     * Contains development-only settings like DevKeyring
     * @complexity O(1)
     */
    static getDevConfig(name: string): DevConfig | null;
    /**
     * Get themes with entities
     * @complexity O(n)
     */
    static getWithEntities(): ThemeRegistryEntry[];
    /**
     * Get themes with API routes
     * @complexity O(n)
     */
    static getWithRoutes(): ThemeRegistryEntry[];
    /**
     * Get themes using a specific plugin
     * @complexity O(n)
     */
    static getUsingPlugin(pluginName: string): ThemeRegistryEntry[];
    /**
     * Get plugin usage across all themes
     * @complexity O(n)
     */
    static getPluginUsage(pluginName: string): {
        theme: string;
        entities: number;
        routes: number;
    }[];
    /**
     * Check if theme exists
     * @complexity O(1)
     */
    static exists(name: string): boolean;
    /**
     * Get theme names
     * @complexity O(1) - uses pre-computed metadata
     */
    static getNames(): string[];
    /**
     * Get total theme count
     * @complexity O(1) - uses pre-computed metadata
     */
    static getCount(): number;
    /**
     * Get metadata
     * @complexity O(1)
     */
    static getMetadata(): typeof THEME_METADATA;
}
export declare const getRegisteredThemes: typeof ThemeService.getAll;
export declare const getTheme: typeof ThemeService.getByName;
export declare const getThemeDashboardConfig: typeof ThemeService.getDashboardConfig;
export declare const getThemeAppConfig: typeof ThemeService.getAppConfig;
export declare const getThemeDevConfig: typeof ThemeService.getDevConfig;
export declare const getThemesWithEntities: typeof ThemeService.getWithEntities;
export declare const getThemesWithRoutes: typeof ThemeService.getWithRoutes;
export declare const getThemesUsingPlugin: typeof ThemeService.getUsingPlugin;
export declare const getPluginUsage: typeof ThemeService.getPluginUsage;
//# sourceMappingURL=theme.service.d.ts.map