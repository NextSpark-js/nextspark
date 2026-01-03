/**
 * Synchronous Configuration Access
 *
 * For cases where we need synchronous access to configuration values,
 * we directly import the project config. This is primarily for types and
 * constants that need to be available at build time.
 *
 * Configuration Merge System:
 * 1. Loads default configs from core (app.config + dashboard.config)
 * 2. Loads theme-specific config overrides (if exists)
 * 3. Validates theme config (development only)
 * 4. Merges theme config over defaults (theme overrides)
 * 5. Provides unified configuration for the application
 */
export declare const APP_CONFIG_MERGED: any;
export declare const DASHBOARD_CONFIG: any;
export declare const DEV_CONFIG: import("./types").DevConfig;
export declare const SUPPORTED_LOCALES: any;
export declare const DEFAULT_LOCALE: any;
export declare const AVAILABLE_ROLES: any;
export declare const DEFAULT_ROLE: any;
export declare const APP_NAME: any;
export declare const APP_VERSION: any;
export declare const I18N_CONFIG: any;
export declare const APP_CONFIG: any;
export declare const USER_ROLES_CONFIG: any;
export declare const API_CONFIG: any;
export declare const MOBILE_NAV_CONFIG: any;
export declare const TEAMS_CONFIG: any;
export declare const TOPBAR_CONFIG: any;
export declare const SIDEBAR_CONFIG: any;
export declare const SETTINGS_CONFIG: any;
export declare const ENTITIES_CONFIG: any;
export declare const HOMEPAGE_CONFIG: any;
export declare const PERFORMANCE_CONFIG: any;
export declare const ACCESSIBILITY_CONFIG: any;
export declare const isSettingsPageEnabled: (pageName: string) => boolean;
export interface EnabledSettingsPage {
    key: string;
    order: number;
    label: string;
}
export declare const getEnabledSettingsPages: () => EnabledSettingsPage[];
export declare const isTopbarFeatureEnabled: (feature: string) => boolean;
export declare const getTopbarFeatureConfig: <T = Record<string, unknown>>(feature: string) => T;
export type SupportedLocale = typeof APP_CONFIG_MERGED.i18n.supportedLocales[number];
export type TranslationNamespace = typeof APP_CONFIG_MERGED.i18n.namespaces[number];
export type UserRole = typeof APP_CONFIG_MERGED.userRoles.availableRoles[number];
//# sourceMappingURL=config-sync.d.ts.map