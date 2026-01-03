/**
 * Default Dashboard Configuration (Core)
 *
 * This file contains the default configuration values for the dashboard.
 * These values can be overridden by theme-specific dashboard.config.ts files.
 *
 * The merge system will combine this default config with theme-specific configs,
 * allowing themes to override only the values they need to change.
 */
export declare const DEFAULT_DASHBOARD_CONFIG: {
    topbar: {
        /**
         * Search functionality in the topbar
         */
        search: {
            enabled: boolean;
            placeholder: string;
            maxResults: number;
        };
        /**
         * Notifications dropdown
         */
        notifications: {
            enabled: boolean;
        };
        /**
         * Theme mode toggle
         */
        themeToggle: {
            enabled: boolean;
        };
        /**
         * Support/Help button
         */
        support: {
            enabled: boolean;
            type: "dropdown";
            links: ({
                label: string;
                url: string;
                icon: string;
                external: boolean;
                action?: undefined;
            } | {
                label: string;
                action: string;
                icon: string;
                url?: undefined;
                external?: undefined;
            })[];
        };
        /**
         * Quick create dropdown
         */
        quickCreate: {
            enabled: boolean;
        };
        /**
         * Superadmin access button (Super Admin area)
         * By default only visible to superadmins, but can be extended to developers
         */
        superadminAccess: {
            enabled: boolean;
            showToDevelopers: boolean;
        };
        /**
         * DevTools access button (Developer area)
         * Only visible to users with developer role
         */
        devtoolsAccess: {
            enabled: boolean;
        };
        /**
         * User menu dropdown
         */
        userMenu: {
            enabled: boolean;
            showAvatar: boolean;
            showEmail: boolean;
            showRole: boolean;
            items: ({
                type: string;
                label: string;
                href: string;
                icon: string;
                action?: undefined;
            } | {
                type: string;
                label?: undefined;
                href?: undefined;
                icon?: undefined;
                action?: undefined;
            } | {
                type: string;
                label: string;
                action: string;
                icon: string;
                href?: undefined;
            })[];
        };
    };
    sidebar: {
        /**
         * Default sidebar state
         */
        defaultCollapsed: boolean;
        rememberState: boolean;
        collapsedWidth: string;
        expandedWidth: string;
        /**
         * Sidebar toggle behavior
         */
        toggle: {
            enabled: boolean;
            showInTopbar: boolean;
            hideOnMobile: boolean;
        };
        /**
         * Navigation structure
         */
        navigation: {
            showEntityCounts: boolean;
            groupEntities: boolean;
            showRecents: boolean;
            maxRecents: number;
        };
    };
    settings: {
        /**
         * Available settings pages
         * Set enabled: false to hide a settings page
         */
        pages: {
            profile: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    avatarUpload: boolean;
                    nameChange: boolean;
                    emailChange: boolean;
                    localeChange: boolean;
                    timezoneChange: boolean;
                };
            };
            security: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    twoFactorAuth: boolean;
                    sessionManagement: boolean;
                    loginHistory: boolean;
                    securityQuestions: boolean;
                };
            };
            password: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    passwordChange: boolean;
                    passwordStrength: boolean;
                    passwordHistory: boolean;
                };
            };
            notifications: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    emailNotifications: boolean;
                    pushNotifications: boolean;
                    smsNotifications: boolean;
                    notificationCategories: boolean;
                };
            };
            'api-keys': {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    createKeys: boolean;
                    revokeKeys: boolean;
                    scopeManagement: boolean;
                    usageAnalytics: boolean;
                };
                requiredRole: string;
            };
            billing: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    subscriptionManagement: boolean;
                    paymentMethods: boolean;
                    invoiceHistory: boolean;
                    usageMetrics: boolean;
                };
                requiredRole: string;
            };
            teams: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    createTeams: boolean;
                    manageMembers: boolean;
                    inviteMembers: boolean;
                    teamSettings: boolean;
                };
            };
            plans: {
                enabled: boolean;
                label: string;
                description: string;
                icon: string;
                order: number;
                features: {
                    planComparison: boolean;
                    planSelection: boolean;
                };
            };
        };
        /**
         * Settings layout configuration
         */
        layout: {
            showDescription: boolean;
            showIcons: boolean;
            groupByCategory: boolean;
            enableSearch: boolean;
        };
    };
    entities: {
        /**
         * Default list view configuration for all entities
         */
        defaultListView: {
            pagination: {
                defaultPageSize: number;
                allowedPageSizes: number[];
                showSizeSelector: boolean;
            };
            sorting: {
                enabled: boolean;
                defaultSort: {
                    field: string;
                    direction: string;
                };
                rememberSort: boolean;
            };
            filtering: {
                enabled: boolean;
                quickFilters: boolean;
                advancedFilters: boolean;
                rememberFilters: boolean;
            };
            search: {
                enabled: boolean;
                placeholder: string;
                searchableFields: string[];
                instantSearch: boolean;
                debounceMs: number;
            };
        };
        /**
         * Default form behavior for all entities
         */
        defaultFormView: {
            validation: {
                validateOnBlur: boolean;
                validateOnChange: boolean;
                showFieldErrors: boolean;
                showFormErrors: boolean;
            };
            autosave: {
                enabled: boolean;
                intervalMs: number;
                showIndicator: boolean;
            };
            confirmation: {
                showOnCreate: boolean;
                showOnUpdate: boolean;
                showOnDelete: boolean;
            };
        };
        /**
         * Per-entity customizations
         * Override default settings for specific entities
         */
        customizations: {};
    };
    homepage: {
        /**
         * Widgets to show on dashboard homepage
         */
        widgets: {
            welcome: {
                enabled: boolean;
                showUserName: boolean;
                showLastLogin: boolean;
                showQuickActions: boolean;
            };
            stats: {
                enabled: boolean;
                entities: string[];
                timeframe: "30days";
                showTrends: boolean;
            };
            recentActivity: {
                enabled: boolean;
                maxItems: number;
                entities: string[];
                showTimestamps: boolean;
            };
            quickActions: {
                enabled: boolean;
                actions: {
                    entity: string;
                    action: string;
                    label: string;
                }[];
            };
        };
        /**
         * Layout configuration
         */
        layout: {
            columns: number;
            gutter: "medium";
            responsive: boolean;
        };
    };
    performance: {
        /**
         * Caching configuration
         */
        cache: {
            entityConfigs: {
                enabled: boolean;
                duration: number;
            };
            entityData: {
                enabled: boolean;
                duration: number;
            };
        };
        /**
         * Loading states
         */
        loading: {
            showSkeletons: boolean;
            showProgressBars: boolean;
            minimumLoadingTime: number;
        };
        /**
         * Error handling
         */
        errors: {
            showErrorBoundaries: boolean;
            logErrors: boolean;
            enableRetry: boolean;
            maxRetries: number;
        };
    };
    accessibility: {
        /**
         * Keyboard navigation
         * @todo Shortcuts are not implemented yet
         */
        keyboard: {
            enabled: boolean;
            showShortcuts: boolean;
            customShortcuts: {
                'Ctrl+K': string;
                'Ctrl+Shift+N': string;
                'Ctrl+B': string;
                Esc: string;
            };
        };
        /**
         * Screen reader support
         */
        screenReader: {
            announceNavigation: boolean;
            announceActions: boolean;
            announceErrors: boolean;
        };
        /**
         * Visual indicators
         */
        visual: {
            showFocusOutlines: boolean;
            highContrastMode: boolean;
            reducedMotion: boolean;
        };
    };
    /**
     * Check if a settings page is enabled
     */
    isSettingsPageEnabled(this: any, pageKey: string): boolean;
    /**
     * Get enabled settings pages sorted by order
     */
    getEnabledSettingsPages(this: any): {
        key: string;
        order: any;
        label: any;
    }[];
    /**
     * Check if a topbar feature is enabled
     */
    isTopbarFeatureEnabled(this: any, feature: string): boolean;
};
export type DashboardConfig = typeof DEFAULT_DASHBOARD_CONFIG;
export type TopbarConfig = typeof DEFAULT_DASHBOARD_CONFIG.topbar;
export type SidebarConfig = typeof DEFAULT_DASHBOARD_CONFIG.sidebar;
export type SettingsConfig = typeof DEFAULT_DASHBOARD_CONFIG.settings;
export type EntitiesConfig = typeof DEFAULT_DASHBOARD_CONFIG.entities;
export type HomepageConfig = typeof DEFAULT_DASHBOARD_CONFIG.homepage;
//# sourceMappingURL=dashboard.config.d.ts.map