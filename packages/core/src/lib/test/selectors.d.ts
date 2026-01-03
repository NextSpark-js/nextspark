/**
 * Centralized Selector System
 *
 * Single source of truth for data-cy selectors.
 * Components consume selectors from this module, ensuring consistency
 * between UI components, POM classes, and tests.
 *
 * Architecture:
 * - `core-selectors.ts` - CORE_SELECTORS object (selector definitions)
 * - `selector-factory.ts` - createSelectorHelpers() factory function
 * - `selectors.ts` (this file) - Pre-bound exports for core usage
 *
 * @example Component usage:
 * ```tsx
 * import { sel } from './'
 *
 * <nav data-cy={sel('dashboard.navigation.main')}>
 *   <Link data-cy={sel('dashboard.navigation.entityLink', { slug: 'customers' })}>
 * ```
 *
 * @example Test/POM usage:
 * ```ts
 * import { cySelector } from './'
 *
 * cy.get(cySelector('dashboard.navigation.main'))
 * ```
 *
 * @example Theme extension:
 * ```ts
 * // In theme's selectors.ts
 * import { createSelectorHelpers } from './selector-factory'
 * import { CORE_SELECTORS } from './core-selectors'
 *
 * const THEME_SELECTORS = { ...CORE_SELECTORS, myFeature: { ... } }
 * export const { sel, cySelector } = createSelectorHelpers(THEME_SELECTORS)
 * ```
 */
import { type CoreSelectorsType } from './core-selectors';
/**
 * Main selector object - single source of truth
 */
export declare const SELECTORS: {
    readonly auth: {
        readonly login: {
            readonly card: "login-form-card";
            readonly header: "login-header";
            readonly footer: "login-footer";
            readonly form: "login-form";
            readonly options: "login-options";
            readonly emailInput: "login-email-input";
            readonly passwordInput: "login-password-input";
            readonly emailError: "login-email-error";
            readonly passwordError: "login-password-error";
            readonly submit: "login-submit";
            readonly googleSignin: "login-google-signin";
            readonly showEmail: "login-show-email";
            readonly hideEmail: "login-hide-email";
            readonly forgotPassword: "login-forgot-password";
            readonly signupLink: "login-signup-link";
            readonly inviteBanner: "login-invite-banner";
            readonly errorAlert: "login-error-alert";
            readonly rememberCheckbox: "login-remember-checkbox";
        };
        readonly signup: {
            readonly form: "signup-form";
            readonly firstName: "signup-first-name";
            readonly lastName: "signup-last-name";
            readonly email: "signup-email";
            readonly password: "signup-password";
            readonly confirmPassword: "signup-confirm-password";
            readonly submitButton: "signup-submit";
            readonly googleButton: "signup-google";
            readonly loginLink: "signup-login-link";
            readonly inviteBanner: "signup-invite-banner";
            readonly error: "signup-error";
        };
        readonly forgotPassword: {
            readonly form: "forgot-password-form";
            readonly email: "forgot-password-email";
            readonly submitButton: "forgot-password-submit";
            readonly backToLogin: "forgot-password-back";
            readonly successMessage: "forgot-password-success";
            readonly successBack: "forgot-password-success-back";
            readonly retryButton: "forgot-password-retry";
            readonly error: "forgot-password-error";
        };
        readonly resetPassword: {
            readonly form: "reset-password-form";
            readonly password: "reset-password-password";
            readonly confirmPassword: "reset-password-confirm";
            readonly submitButton: "reset-password-submit";
            readonly error: "reset-password-error";
        };
        readonly verifyEmail: {
            readonly container: "verify-email-container";
            readonly resendButton: "verify-email-resend";
            readonly successMessage: "verify-email-success";
            readonly error: "verify-email-error";
        };
        readonly devKeyring: {
            readonly container: "devkeyring-container";
            readonly trigger: "devkeyring-trigger";
            readonly content: "devkeyring-content";
            readonly user: "devkeyring-user-{index}";
        };
    };
    readonly dashboard: {
        readonly shell: {
            readonly container: "dashboard-container";
            readonly quickCreateButton: "topnav-quick-create-button";
            readonly quickCreateDropdown: "topnav-quick-create-dropdown";
            readonly quickCreateLink: "quick-create-{slug}-link";
        };
        readonly topnav: {
            readonly sidebarToggle: "topnav-sidebar-toggle";
            readonly header: "topnav-header";
            readonly logo: "topnav-logo";
            readonly searchSection: "topnav-search-section";
            readonly actions: "topnav-actions";
            readonly notifications: "topnav-notifications";
            readonly help: "topnav-help";
            readonly themeToggle: "topnav-theme-toggle";
            readonly superadmin: "topnav-superadmin";
            readonly devtools: "topnav-devtools";
            readonly userMenuTrigger: "topnav-user-menu-trigger";
            readonly userMenu: "topnav-user-menu";
            readonly menuItem: "topnav-menu-{icon}";
            readonly menuAction: "topnav-menu-{action}";
            readonly userLoading: "topnav-user-loading";
            readonly signin: "topnav-signin";
            readonly signup: "topnav-signup";
            readonly mobileActions: "topnav-mobile-actions";
            readonly mobileMenuToggle: "topnav-mobile-menu-toggle";
            readonly mobileMenu: "topnav-mobile-menu";
            readonly mobileUserInfo: "topnav-mobile-user-info";
            readonly mobileLinkProfile: "topnav-mobile-link-profile";
            readonly mobileLinkSettings: "topnav-mobile-link-settings";
            readonly mobileLinkBilling: "topnav-mobile-link-billing";
            readonly mobileSignout: "topnav-mobile-signout";
            readonly mobileNavSuperadmin: "topnav-mobile-nav-superadmin";
            readonly mobileNavDevtools: "topnav-mobile-nav-devtools";
        };
        readonly sidebar: {
            readonly main: "sidebar-main";
            readonly header: "sidebar-header";
            readonly content: "sidebar-content";
            readonly footer: "sidebar-footer";
        };
        readonly navigation: {
            readonly main: "nav-main";
            readonly dashboardLink: "nav-link-dashboard";
            readonly entityLink: "nav-link-entity-{slug}";
            readonly section: "nav-section-{id}";
            readonly sectionLabel: "nav-section-label-{id}";
            readonly sectionItem: "nav-section-item-{sectionId}-{itemId}";
        };
        readonly mobile: {
            readonly topbar: {
                readonly header: "mobile-topbar-header";
                readonly userProfile: "mobile-topbar-user-profile";
                readonly notifications: "mobile-topbar-notifications";
                readonly themeToggle: "mobile-topbar-theme-toggle";
            };
            readonly bottomNav: {
                readonly nav: "mobile-bottomnav-nav";
                readonly item: "mobile-bottomnav-item-{id}";
            };
            readonly moreSheet: {
                readonly content: "mobile-more-sheet-content";
                readonly item: "mobile-more-sheet-item-{id}";
                readonly superadminLink: "mobile-more-sheet-superadmin-link";
                readonly teamSwitcher: "mobile-more-sheet-team-switcher";
                readonly signoutButton: "mobile-more-sheet-signout-button";
            };
            readonly quickCreateSheet: {
                readonly content: "mobile-quick-create-sheet-content";
                readonly item: "mobile-quick-create-sheet-item-{slug}";
            };
        };
    };
    readonly entities: {
        readonly page: {
            readonly container: "{slug}-page";
            readonly title: "{slug}-title";
        };
        readonly list: {
            readonly container: "{slug}-list";
        };
        readonly table: {
            readonly container: "{slug}-table-container";
            readonly element: "{slug}-table";
            readonly search: "{slug}-search";
            readonly addButton: "{slug}-add";
            readonly selectionCount: "{slug}-selection-count";
            readonly selectAll: "{slug}-select-all";
            readonly row: "{slug}-row-{id}";
            readonly rowSelect: "{slug}-select-{id}";
            readonly cell: "{slug}-cell-{field}-{id}";
            readonly rowMenu: "{slug}-menu-{id}";
            readonly rowActionsMenu: "{slug}-actions-{id}";
            readonly rowAction: "{slug}-menu-{action}-{id}";
            readonly quickAction: "{slug}-quick-{action}-{id}";
        };
        readonly pagination: {
            readonly container: "{slug}-pagination";
            readonly pageSize: "{slug}-page-size";
            readonly pageSizeOption: "{slug}-page-size-{size}";
            readonly pageInfo: "{slug}-page-info";
            readonly first: "{slug}-page-first";
            readonly prev: "{slug}-page-prev";
            readonly next: "{slug}-page-next";
            readonly last: "{slug}-page-last";
        };
        readonly bulk: {
            readonly bar: "{slug}-bulk-bar";
            readonly count: "{slug}-bulk-count";
            readonly selectAll: "{slug}-bulk-select-all";
            readonly statusButton: "{slug}-bulk-status";
            readonly deleteButton: "{slug}-bulk-delete";
            readonly clearButton: "{slug}-bulk-clear";
            readonly statusDialog: "{slug}-bulk-status-dialog";
            readonly statusSelect: "{slug}-bulk-status-select";
            readonly statusOption: "{slug}-bulk-status-option-{value}";
            readonly statusCancel: "{slug}-bulk-status-cancel";
            readonly statusConfirm: "{slug}-bulk-status-confirm";
            readonly deleteDialog: "{slug}-bulk-delete-dialog";
            readonly deleteCancel: "{slug}-bulk-delete-cancel";
            readonly deleteConfirm: "{slug}-bulk-delete-confirm";
        };
        readonly header: {
            readonly container: "{slug}-{mode}-header";
            readonly backButton: "{slug}-back-btn";
            readonly title: "{slug}-title";
            readonly copyId: "{slug}-copy-id";
            readonly editButton: "{slug}-edit-btn";
            readonly deleteButton: "{slug}-delete-btn";
            readonly deleteDialog: "{slug}-delete-dialog";
            readonly deleteCancel: "{slug}-delete-cancel";
            readonly deleteConfirm: "{slug}-delete-confirm";
        };
        readonly detail: {
            readonly container: "{slug}-detail";
        };
        readonly form: {
            readonly container: "{slug}-form";
            readonly field: "{slug}-field-{name}";
            readonly submitButton: "{slug}-form-submit";
            readonly cancelButton: "{slug}-form-cancel";
        };
        readonly filter: {
            readonly container: "{slug}-filter-{field}";
            readonly trigger: "{slug}-filter-{field}-trigger";
            readonly content: "{slug}-filter-{field}-content";
            readonly option: "{slug}-filter-{field}-option-{value}";
            readonly badge: "{slug}-filter-{field}-badge-{value}";
            readonly removeBadge: "{slug}-filter-{field}-remove-{value}";
            readonly clearAll: "{slug}-filter-{field}-clear-all";
        };
        readonly search: {
            readonly container: "{slug}-search";
            readonly icon: "{slug}-search-icon";
            readonly input: "{slug}-search-input";
            readonly clear: "{slug}-search-clear";
        };
        readonly confirm: {
            readonly dialog: "{slug}-confirm-dialog";
            readonly cancel: "{slug}-confirm-cancel";
            readonly action: "{slug}-confirm-action";
        };
        readonly childEntity: {
            readonly container: "{parentSlug}-{childName}-container";
            readonly addButton: "{parentSlug}-{childName}-add-button";
        };
    };
    readonly globalSearch: {
        readonly modal: "search-modal";
        readonly trigger: "search-trigger";
        readonly input: "search-input";
        readonly results: "search-results";
        readonly result: "search-result";
    };
    readonly taxonomies: {
        readonly list: {
            readonly container: "taxonomies-list-table";
            readonly createButton: "taxonomies-create-button";
            readonly row: "taxonomy-row-{id}";
            readonly editButton: "taxonomies-edit-{id}";
            readonly deleteButton: "taxonomies-delete-{id}";
        };
        readonly form: {
            readonly dialog: "taxonomy-form-dialog";
            readonly nameInput: "taxonomy-name-input";
            readonly slugInput: "taxonomy-slug-input";
            readonly descriptionInput: "taxonomy-description-input";
            readonly iconInput: "taxonomy-icon-input";
            readonly colorInput: "taxonomy-color-input";
            readonly parentSelect: "taxonomy-parent-select";
            readonly orderInput: "taxonomy-order-input";
            readonly saveButton: "taxonomy-save-button";
            readonly cancelButton: "taxonomy-cancel-button";
        };
        readonly confirmDelete: {
            readonly dialog: "taxonomy-delete-dialog";
            readonly confirmButton: "taxonomy-delete-confirm";
            readonly cancelButton: "taxonomy-delete-cancel";
        };
    };
    readonly teams: {
        readonly switcher: {
            readonly compact: "team-switcher-compact";
            readonly full: "team-switcher";
            readonly dropdown: "team-switcher-dropdown";
            readonly option: "team-option-{slug}";
            readonly manageLink: "manage-teams-link";
            readonly createButton: "create-team-button";
        };
        readonly switchModal: {
            readonly container: "team-switch-modal";
        };
        readonly create: {
            readonly dialog: "create-team-dialog";
            readonly button: "create-team-button";
            readonly nameInput: "team-name-input";
            readonly slugInput: "team-slug-input";
            readonly descriptionInput: "team-description-input";
            readonly cancel: "cancel-create-team";
            readonly submit: "submit-create-team";
        };
        readonly members: {
            readonly section: "team-members-section";
            readonly row: "member-row-{id}";
            readonly actions: "member-actions-{id}";
            readonly makeRole: "make-{role}-action";
            readonly remove: "remove-member-action";
        };
        readonly invite: {
            readonly button: "invite-member-button";
            readonly buttonDisabled: "invite-member-button-disabled";
            readonly dialog: "invite-member-dialog";
            readonly emailInput: "member-email-input";
            readonly roleSelect: "member-role-select";
            readonly roleOption: "role-option-{role}";
            readonly cancel: "cancel-invite-member";
            readonly submit: "submit-invite-member";
        };
        readonly invitations: {
            readonly row: "invitation-row-{id}";
            readonly cancel: "cancel-invitation-{id}";
        };
    };
    readonly blockEditor: {
        readonly container: "builder-editor";
        readonly titleInput: "editor-title-input";
        readonly slugInput: "editor-slug-input";
        readonly saveButton: "save-btn";
        readonly statusBadge: "status-badge";
        readonly leftSidebarToggle: "left-sidebar-toggle";
        readonly viewModeToggle: "view-mode-toggle";
        readonly blockPicker: {
            readonly container: "block-picker";
            readonly searchInput: "block-search-input";
            readonly categoryAll: "category-all";
            readonly category: "category-{category}";
            readonly blockItem: "block-item-{slug}";
            readonly addBlock: "add-block-{slug}";
        };
        readonly blockCanvas: {
            readonly container: "block-preview-canvas";
            readonly empty: "block-preview-canvas-empty";
        };
        readonly previewCanvas: {
            readonly container: "block-preview-canvas";
            readonly empty: "block-preview-canvas-empty";
            readonly block: "preview-block-{id}";
            readonly moveUp: "preview-block-{id}-move-up";
            readonly moveDown: "preview-block-{id}-move-down";
        };
        readonly sortableBlock: {
            readonly container: "sortable-block-{id}";
            readonly dragHandle: "drag-handle-{id}";
            readonly duplicate: "duplicate-block-{id}";
            readonly remove: "remove-block-{id}";
            readonly error: "block-error-{id}";
        };
        readonly settingsPanel: {
            readonly container: "block-settings-panel";
            readonly empty: "settings-panel-empty";
            readonly error: "settings-panel-error";
            readonly resetProps: "reset-block-props";
            readonly removeBlock: "remove-block-settings";
            readonly tabContent: "tab-content";
            readonly tabDesign: "tab-design";
            readonly tabAdvanced: "tab-advanced";
        };
        readonly pageSettings: {
            readonly container: "page-settings-panel";
            readonly seoTrigger: "seo-settings-trigger";
            readonly metaTitle: "seo-meta-title";
            readonly metaDescription: "seo-meta-description";
            readonly metaKeywords: "seo-meta-keywords";
            readonly ogImage: "seo-og-image";
            readonly customFieldsTrigger: "custom-fields-trigger";
            readonly customFieldKey: "custom-field-key-{index}";
            readonly customFieldValue: "custom-field-value-{index}";
            readonly customFieldRemove: "custom-field-remove-{index}";
            readonly addCustomField: "add-custom-field";
        };
        readonly statusSelector: {
            readonly trigger: "status-selector";
            readonly option: "status-option-{value}";
        };
        readonly dynamicForm: {
            readonly container: "dynamic-form";
            readonly field: "field-{name}";
            readonly fieldGroup: "field-group-{id}";
            readonly arrayGroup: "array-group-{name}";
        };
        readonly arrayField: {
            readonly container: "array-field-{name}";
            readonly item: "array-field-{name}-{index}-{field}";
            readonly moveUp: "array-field-{name}-{index}-move-up";
            readonly moveDown: "array-field-{name}-{index}-move-down";
            readonly remove: "array-field-{name}-{index}-remove";
            readonly add: "array-field-{name}-add";
        };
        readonly entityFieldsSidebar: {
            readonly container: "entity-fields-sidebar";
            readonly field: "field-{name}";
            readonly category: "category-{slug}";
        };
        readonly postFields: {
            readonly excerpt: "field-excerpt";
            readonly featuredImage: "field-featuredImage";
            readonly featuredImageUpload: "field-featuredImage-upload";
            readonly categories: "field-categories";
            readonly categoryOption: "category-option-{id}";
            readonly categoryBadge: "category-badge-{id}";
            readonly categoryRemove: "category-remove-{id}";
        };
        readonly localeField: {
            readonly select: "field-locale";
            readonly option: "locale-option-{locale}";
        };
    };
    readonly settings: {
        readonly layout: {
            readonly main: "settings-layout-main";
            readonly nav: "settings-layout-nav";
            readonly backToDashboard: "settings-layout-back-to-dashboard";
            readonly header: "settings-layout-header";
            readonly contentArea: "settings-layout-content-area";
            readonly sidebar: "settings-layout-sidebar";
            readonly pageContent: "settings-layout-page-content";
        };
        readonly sidebar: {
            readonly main: "settings-sidebar-main";
            readonly header: "settings-sidebar-header";
            readonly navItems: "settings-sidebar-nav-items";
            readonly navItem: "settings-sidebar-nav-{section}";
        };
        readonly overview: {
            readonly container: "settings-overview";
            readonly item: "settings-overview-{key}";
        };
        readonly profile: {
            readonly container: "settings-profile";
            readonly form: "profile-form";
            readonly avatar: "profile-avatar";
            readonly avatarUpload: "profile-avatar-upload";
            readonly firstName: "profile-first-name";
            readonly lastName: "profile-last-name";
            readonly email: "profile-email";
            readonly submitButton: "profile-submit";
            readonly successMessage: "profile-success";
        };
        readonly password: {
            readonly container: "settings-password";
            readonly form: "password-form";
            readonly currentPassword: "password-current";
            readonly newPassword: "password-new";
            readonly confirmPassword: "password-confirm";
            readonly submitButton: "password-submit";
            readonly successMessage: "password-success";
        };
        readonly team: {
            readonly container: "settings-team";
            readonly name: "team-name";
            readonly slug: "team-slug";
            readonly description: "team-description";
            readonly avatar: "team-avatar";
            readonly avatarUpload: "team-avatar-upload";
            readonly submitButton: "team-submit";
            readonly deleteButton: "team-delete";
            readonly deleteDialog: "team-delete-dialog";
            readonly deleteConfirm: "team-delete-confirm";
        };
        readonly members: {
            readonly container: "settings-members";
            readonly inviteButton: "members-invite";
            readonly inviteDialog: "members-invite-dialog";
            readonly inviteEmail: "members-invite-email";
            readonly inviteRole: "members-invite-role";
            readonly inviteSubmit: "members-invite-submit";
            readonly memberRow: "member-row-{id}";
            readonly memberRole: "member-role-{id}";
            readonly memberRemove: "member-remove-{id}";
            readonly pendingInvites: "members-pending-invites";
            readonly pendingInvite: "pending-invite-{id}";
            readonly cancelInvite: "cancel-invite-{id}";
        };
        readonly billing: {
            readonly container: "settings-billing";
            readonly main: "billing-main";
            readonly header: "billing-header";
            readonly currentPlan: "billing-current-plan";
            readonly upgradeButton: "billing-upgrade";
            readonly upgradePlan: "billing-upgrade-plan";
            readonly cancelButton: "billing-cancel";
            readonly addPayment: "billing-add-payment";
            readonly invoicesTable: "billing-invoices";
            readonly invoicesTableAlt: "invoices-table";
            readonly invoiceRow: "invoice-row-{id}";
            readonly invoicesRow: "invoices-row";
            readonly invoiceDownload: "invoice-download-{id}";
            readonly invoicesLoadMore: "invoices-load-more";
            readonly invoiceStatusBadge: "invoice-status-badge";
            readonly paymentMethod: "billing-payment-method";
            readonly paymentMethodAlt: "payment-method";
            readonly updatePayment: "billing-update-payment";
            readonly usage: "billing-usage";
            readonly usageDashboard: "usage-dashboard";
        };
        readonly pricing: {
            readonly table: "pricing-table";
            readonly settingsTable: "pricing-settings-table";
        };
        readonly features: {
            readonly placeholder: "feature-placeholder-{feature}";
            readonly content: "{feature}-content";
            readonly placeholderUpgradeBtn: "placeholder-upgrade-btn";
        };
        readonly apiKeys: {
            readonly page: "api-keys-page";
            readonly title: "api-keys-title";
            readonly container: "settings-api-keys";
            readonly createButton: "api-keys-create-button";
            readonly createDialog: "api-keys-create-dialog";
            readonly list: "api-keys-list";
            readonly skeleton: "api-keys-skeleton";
            readonly empty: "api-keys-empty";
            readonly emptyCreateButton: "api-keys-empty-create-button";
            readonly keyName: "api-key-name";
            readonly keyScopes: "api-key-scopes";
            readonly scopeOption: "api-key-scope-{scope}";
            readonly createSubmit: "api-key-create-submit";
            readonly keyRow: "api-key-row-{id}";
            readonly keyName_: "api-keys-name-{id}";
            readonly keyPrefix: "api-keys-prefix-{id}";
            readonly copyPrefix: "api-keys-copy-prefix-{id}";
            readonly keyStatus: "api-keys-status-{id}";
            readonly statusBadge: "api-keys-status-badge-{id}";
            readonly menuTrigger: "api-keys-menu-trigger-{id}";
            readonly menu: "api-keys-menu-{id}";
            readonly viewDetails: "api-keys-view-details-{id}";
            readonly toggle: "api-keys-toggle-{id}";
            readonly revoke: "api-keys-revoke-{id}";
            readonly scopes: "api-keys-scopes-{id}";
            readonly scope: "api-keys-scope-{id}-{scope}";
            readonly stats: "api-keys-stats-{id}";
            readonly totalRequests: "api-keys-total-requests-{id}";
            readonly last24h: "api-keys-last-24h-{id}";
            readonly avgTime: "api-keys-avg-time-{id}";
            readonly metadata: "api-keys-metadata-{id}";
            readonly createdAt: "api-keys-created-at-{id}";
            readonly lastUsed: "api-keys-last-used-{id}";
            readonly expiresAt: "api-keys-expires-at-{id}";
            readonly detailsDialog: "api-keys-details-dialog";
            readonly detailsTitle: "api-keys-details-title";
            readonly detailsLoading: "api-keys-details-loading";
            readonly detailsContent: "api-keys-details-content";
            readonly detailsBasicInfo: "api-keys-details-basic-info";
            readonly detailsName: "api-keys-details-name";
            readonly detailsStatus: "api-keys-details-status";
            readonly detailsStats: "api-keys-details-stats";
            readonly detailsTotalRequests: "api-keys-details-total-requests";
            readonly detailsLast24h: "api-keys-details-last-24h";
            readonly detailsLast7d: "api-keys-details-last-7d";
            readonly detailsLast30d: "api-keys-details-last-30d";
            readonly detailsAvgTime: "api-keys-details-avg-time";
            readonly detailsSuccessRate: "api-keys-details-success-rate";
            readonly keyReveal: "api-key-reveal-{id}";
            readonly keyRevoke: "api-key-revoke-{id}";
            readonly revokeDialog: "api-key-revoke-dialog";
            readonly revokeConfirm: "api-key-revoke-confirm";
            readonly newKeyDisplay: "api-key-new-display";
            readonly copyKey: "api-key-copy";
            readonly dialogFooter: "api-keys-dialog-footer";
        };
        readonly notifications: {
            readonly container: "settings-notifications";
            readonly emailToggle: "notifications-email";
            readonly pushToggle: "notifications-push";
            readonly category: "notifications-{category}";
            readonly submitButton: "notifications-submit";
        };
        readonly teams: {
            readonly main: "teams-settings-main";
            readonly header: "teams-settings-header";
            readonly loading: "teams-settings-loading";
            readonly singleUser: "teams-settings-single-user";
            readonly teamsList: "teams-settings-teams-list";
            readonly teamDetails: "teams-settings-team-details";
        };
        readonly plans: {
            readonly main: "plans-settings-main";
            readonly header: "plans-settings-header";
            readonly table: "plans-settings-table";
        };
    };
    readonly superadmin: {
        readonly container: "superadmin-container";
        readonly navigation: {
            readonly dashboard: "superadmin-nav-dashboard";
            readonly users: "superadmin-nav-users";
            readonly teams: "superadmin-nav-teams";
            readonly teamRoles: "superadmin-nav-team-roles";
            readonly subscriptions: "superadmin-nav-subscriptions";
            readonly exitToDashboard: "superadmin-sidebar-exit-to-dashboard";
        };
        readonly dashboard: {
            readonly container: "superadmin-dashboard";
        };
        readonly users: {
            readonly container: "superadmin-users-container";
            readonly table: "superadmin-users-table";
            readonly search: "superadmin-users-search";
            readonly row: "superadmin-user-row-{id}";
            readonly viewButton: "superadmin-user-view-{id}";
            readonly editButton: "superadmin-user-edit-{id}";
            readonly banButton: "superadmin-user-ban-{id}";
            readonly deleteButton: "superadmin-user-delete-{id}";
            readonly impersonateButton: "superadmin-user-impersonate-{id}";
        };
        readonly userDetail: {
            readonly container: "superadmin-user-detail";
            readonly email: "superadmin-user-email";
            readonly role: "superadmin-user-role";
            readonly status: "superadmin-user-status";
            readonly teams: "superadmin-user-teams";
            readonly activity: "superadmin-user-activity";
            readonly actions: "superadmin-user-actions";
            readonly metas: "superadmin-user-metas";
            readonly metasTitle: "superadmin-user-metas-title";
            readonly metasTable: "superadmin-user-metas-table";
            readonly metasEmpty: "superadmin-user-metas-empty";
            readonly metaRow: "superadmin-user-meta-row-{key}";
            readonly metaKey: "superadmin-user-meta-key-{key}";
            readonly metaValue: "superadmin-user-meta-value-{key}";
            readonly metaType: "superadmin-user-meta-type-{key}";
            readonly metaPublic: "superadmin-user-meta-public-{key}";
            readonly metaSearchable: "superadmin-user-meta-searchable-{key}";
        };
        readonly teams: {
            readonly container: "superadmin-teams-container";
            readonly table: "superadmin-teams-table";
            readonly search: "superadmin-teams-search";
            readonly row: "superadmin-team-row-{id}";
            readonly actionsButton: "superadmin-team-actions-{id}";
            readonly viewButton: "superadmin-team-view-{id}";
            readonly editButton: "superadmin-team-edit-{id}";
            readonly deleteButton: "superadmin-team-delete-{id}";
        };
        readonly teamDetail: {
            readonly container: "superadmin-team-detail";
            readonly name: "superadmin-team-name";
            readonly owner: "superadmin-team-owner";
            readonly members: "superadmin-team-members";
            readonly plan: "superadmin-team-plan";
            readonly usage: "superadmin-team-usage";
        };
        readonly subscriptions: {
            readonly container: "superadmin-subscriptions-container";
            readonly mrr: "superadmin-subscriptions-mrr";
            readonly planDistribution: "superadmin-subscriptions-plan-distribution";
            readonly planCount: "superadmin-subscriptions-plan-count-{plan}";
            readonly activeCount: "superadmin-subscriptions-active-count";
        };
        readonly pagination: {
            readonly pageSize: "superadmin-page-size-select";
            readonly first: "superadmin-pagination-first";
            readonly prev: "superadmin-pagination-prev";
            readonly next: "superadmin-pagination-next";
            readonly last: "superadmin-pagination-last";
        };
        readonly filters: {
            readonly search: "superadmin-search-{context}";
            readonly dropdown: "superadmin-filter-{context}";
        };
        readonly permissions: {
            readonly row: "superadmin-permission-row-{permission}";
        };
        readonly teamRoles: {
            readonly backButton: "back-to-superadmin";
            readonly roleCard: "role-card-{role}";
            readonly permissionRow: "permission-row-{permission}";
        };
        readonly planFeatures: {
            readonly featureRow: "superadmin-feature-row-{slug}";
            readonly limitRow: "superadmin-limit-row-{slug}";
        };
    };
    readonly devtools: {
        readonly navigation: {
            readonly sidebar: "devtools-sidebar";
            readonly collapseToggle: "devtools-sidebar-collapse-toggle";
            readonly navItem: "devtools-nav-{section}";
            readonly exitToDashboard: "devtools-sidebar-exit-to-dashboard";
            readonly goToSuperadmin: "devtools-sidebar-go-to-superadmin";
            readonly mobileHeader: "devtools-mobile-header";
        };
        readonly home: {
            readonly page: "devtools-home-page";
            readonly styleLink: "devtools-home-style-link";
            readonly testsLink: "devtools-home-tests-link";
            readonly configLink: "devtools-home-config-link";
        };
        readonly style: {
            readonly page: "devtools-style-page";
            readonly tabComponents: "devtools-style-tab-components";
            readonly tabFieldTypes: "devtools-style-tab-field-types";
            readonly tabTheme: "devtools-style-tab-theme";
            readonly tabGuidelines: "devtools-style-tab-guidelines";
            readonly componentGallery: "devtools-style-component-gallery";
            readonly fieldTypes: "devtools-style-field-types";
            readonly themePreview: "devtools-style-theme-preview";
        };
        readonly config: {
            readonly page: "devtools-config-page";
            readonly viewer: "devtools-config-viewer";
            readonly tabTheme: "devtools-config-tab-theme";
            readonly tabEntities: "devtools-config-tab-entities";
            readonly themeContent: "devtools-config-theme-content";
            readonly entitiesContent: "devtools-config-entities-content";
            readonly copyTheme: "devtools-config-copy-theme";
            readonly copyEntities: "devtools-config-copy-entities";
        };
        readonly tests: {
            readonly page: "devtools-tests-page";
            readonly viewer: "devtools-tests-viewer";
            readonly loading: "devtools-tests-loading";
            readonly tree: "devtools-tests-tree";
            readonly folder: "devtools-tests-folder-{name}";
            readonly file: "devtools-tests-file-{name}";
            readonly content: "devtools-tests-content";
            readonly markdownContent: "devtools-tests-markdown-content";
            readonly notFound: "devtools-tests-not-found";
            readonly backToList: "devtools-tests-back-to-list";
            readonly emptyState: "devtools-tests-empty-state";
            readonly fileLoading: "devtools-tests-file-loading";
            readonly error: "devtools-tests-error";
        };
        readonly features: {
            readonly page: "devtools-features-page";
            readonly viewer: "devtools-features-viewer";
            readonly search: "devtools-features-search";
            readonly filterAll: "devtools-features-filter-all";
            readonly filterCategory: "devtools-features-filter-{category}";
            readonly coverageAll: "devtools-features-coverage-all";
            readonly coverageCovered: "devtools-features-coverage-covered";
            readonly coverageUncovered: "devtools-features-coverage-uncovered";
            readonly card: "devtools-features-card-{slug}";
            readonly copyTag: "devtools-features-copy-{slug}";
        };
        readonly flows: {
            readonly page: "devtools-flows-page";
            readonly viewer: "devtools-flows-viewer";
            readonly search: "devtools-flows-search";
            readonly filterAll: "devtools-flows-filter-all";
            readonly filterCategory: "devtools-flows-filter-{category}";
            readonly coverageAll: "devtools-flows-coverage-all";
            readonly coverageCovered: "devtools-flows-coverage-covered";
            readonly coverageUncovered: "devtools-flows-coverage-uncovered";
            readonly card: "devtools-flows-card-{slug}";
            readonly copyTag: "devtools-flows-copy-{slug}";
        };
        readonly blocks: {
            readonly page: "devtools-blocks-page";
            readonly viewer: "devtools-blocks-viewer";
            readonly search: "devtools-blocks-search";
            readonly filterAll: "devtools-blocks-filter-all";
            readonly filterCategory: "devtools-blocks-filter-{category}";
            readonly coverageAll: "devtools-blocks-coverage-all";
            readonly coverageCovered: "devtools-blocks-coverage-covered";
            readonly coverageUncovered: "devtools-blocks-coverage-uncovered";
            readonly card: "devtools-blocks-card-{slug}";
            readonly copyTag: "devtools-blocks-copy-{slug}";
            readonly viewDetails: "devtools-blocks-view-{slug}";
            readonly detail: {
                readonly page: "devtools-block-detail-{slug}";
                readonly back: "devtools-block-detail-back";
                readonly tabPreview: "devtools-block-detail-tab-preview";
                readonly tabFields: "devtools-block-detail-tab-fields";
                readonly tabOverview: "devtools-block-detail-tab-overview";
                readonly preview: "devtools-block-detail-preview-{slug}";
                readonly exampleSelector: "devtools-block-example-selector";
                readonly exampleBtn: "devtools-block-example-btn-{index}";
                readonly exampleName: "devtools-block-example-name";
                readonly exampleDescription: "devtools-block-example-description";
            };
        };
        readonly tags: {
            readonly page: "devtools-tags-page";
            readonly viewer: "devtools-tags-viewer";
            readonly search: "devtools-tags-search";
            readonly category: "devtools-tags-category-{category}";
            readonly tag: "devtools-tags-tag-{tag}";
            readonly tagLink: "devtools-tags-link-{tag}";
            readonly filesPanel: "devtools-tags-files-panel-{tag}";
        };
        readonly scheduledActions: {
            readonly page: "devtools-scheduled-actions-page";
            readonly filterStatus: "scheduled-actions-filter-status";
            readonly filterType: "scheduled-actions-filter-type";
            readonly filterApply: "scheduled-actions-filter-apply";
            readonly filterReset: "scheduled-actions-filter-reset";
            readonly table: "scheduled-actions-table";
            readonly row: "scheduled-actions-row-{id}";
            readonly cellType: "scheduled-actions-cell-type";
            readonly cellStatus: "scheduled-actions-cell-status";
            readonly cellScheduledAt: "scheduled-actions-cell-scheduled-at";
            readonly cellTeam: "scheduled-actions-cell-team";
            readonly cellPayload: "scheduled-actions-cell-payload";
            readonly cellError: "scheduled-actions-cell-error";
            readonly statusPending: "scheduled-actions-status-pending";
            readonly statusRunning: "scheduled-actions-status-running";
            readonly statusCompleted: "scheduled-actions-status-completed";
            readonly statusFailed: "scheduled-actions-status-failed";
            readonly pagination: "scheduled-actions-pagination";
            readonly paginationPrev: "scheduled-actions-pagination-prev";
            readonly paginationNext: "scheduled-actions-pagination-next";
            readonly emptyState: "scheduled-actions-empty-state";
        };
    };
    readonly public: {
        readonly navbar: {
            readonly container: "public-navbar";
            readonly logo: "navbar-logo";
            readonly loginButton: "navbar-login";
            readonly signupButton: "navbar-signup";
        };
        readonly footer: {
            readonly container: "public-footer";
            readonly logo: "footer-logo";
        };
        readonly page: {
            readonly container: "public-page-{slug}";
            readonly title: "page-title";
            readonly content: "page-content";
        };
        readonly blog: {
            readonly listContainer: "blog-list";
            readonly postCard: "blog-post-{slug}";
        };
    };
    readonly common: {
        readonly permissionDenied: "permission-denied";
        readonly loading: "loading-spinner";
        readonly error: "error-message";
        readonly toast: "toast-{type}";
        readonly modal: {
            readonly overlay: "modal-overlay";
            readonly container: "modal-container";
            readonly title: "modal-title";
            readonly close: "modal-close";
            readonly content: "modal-content";
            readonly footer: "modal-footer";
        };
    };
};
/**
 * Get a selector value by path with optional placeholder replacements.
 * @see selector-factory.ts for full documentation
 */
export declare const sel: (path: string, replacements?: import("./selector-factory").Replacements) => string;
/**
 * Alias for sel
 */
export declare const s: (path: string, replacements?: import("./selector-factory").Replacements) => string;
/**
 * Get selector only in dev/test environments
 */
export declare const selDev: (path: string, replacements?: import("./selector-factory").Replacements) => string | undefined;
/**
 * Get Cypress selector string [data-cy="..."]
 */
export declare const cySelector: (path: string, replacements?: import("./selector-factory").Replacements) => string;
/**
 * Create entity-specific selector helpers
 */
export declare const entitySelectors: (slug: string) => import("./selector-factory").EntitySelectorHelpers;
/**
 * Type for the SELECTORS object
 */
export type SelectorsType = CoreSelectorsType;
/**
 * Re-export Replacements type
 */
export type { Replacements } from './selector-factory';
/**
 * Helper type to extract leaf paths from nested object
 */
type PathImpl<T, K extends keyof T> = K extends string ? T[K] extends Record<string, unknown> ? T[K] extends ArrayLike<unknown> ? K : `${K}.${PathImpl<T[K], keyof T[K]>}` : K : never;
type Path<T> = PathImpl<T, keyof T>;
/**
 * All valid selector paths
 */
export type SelectorPath = Path<SelectorsType>;
declare const _default: {
    SELECTORS: {
        readonly auth: {
            readonly login: {
                readonly card: "login-form-card";
                readonly header: "login-header";
                readonly footer: "login-footer";
                readonly form: "login-form";
                readonly options: "login-options";
                readonly emailInput: "login-email-input";
                readonly passwordInput: "login-password-input";
                readonly emailError: "login-email-error";
                readonly passwordError: "login-password-error";
                readonly submit: "login-submit";
                readonly googleSignin: "login-google-signin";
                readonly showEmail: "login-show-email";
                readonly hideEmail: "login-hide-email";
                readonly forgotPassword: "login-forgot-password";
                readonly signupLink: "login-signup-link";
                readonly inviteBanner: "login-invite-banner";
                readonly errorAlert: "login-error-alert";
                readonly rememberCheckbox: "login-remember-checkbox";
            };
            readonly signup: {
                readonly form: "signup-form";
                readonly firstName: "signup-first-name";
                readonly lastName: "signup-last-name";
                readonly email: "signup-email";
                readonly password: "signup-password";
                readonly confirmPassword: "signup-confirm-password";
                readonly submitButton: "signup-submit";
                readonly googleButton: "signup-google";
                readonly loginLink: "signup-login-link";
                readonly inviteBanner: "signup-invite-banner";
                readonly error: "signup-error";
            };
            readonly forgotPassword: {
                readonly form: "forgot-password-form";
                readonly email: "forgot-password-email";
                readonly submitButton: "forgot-password-submit";
                readonly backToLogin: "forgot-password-back";
                readonly successMessage: "forgot-password-success";
                readonly successBack: "forgot-password-success-back";
                readonly retryButton: "forgot-password-retry";
                readonly error: "forgot-password-error";
            };
            readonly resetPassword: {
                readonly form: "reset-password-form";
                readonly password: "reset-password-password";
                readonly confirmPassword: "reset-password-confirm";
                readonly submitButton: "reset-password-submit";
                readonly error: "reset-password-error";
            };
            readonly verifyEmail: {
                readonly container: "verify-email-container";
                readonly resendButton: "verify-email-resend";
                readonly successMessage: "verify-email-success";
                readonly error: "verify-email-error";
            };
            readonly devKeyring: {
                readonly container: "devkeyring-container";
                readonly trigger: "devkeyring-trigger";
                readonly content: "devkeyring-content";
                readonly user: "devkeyring-user-{index}";
            };
        };
        readonly dashboard: {
            readonly shell: {
                readonly container: "dashboard-container";
                readonly quickCreateButton: "topnav-quick-create-button";
                readonly quickCreateDropdown: "topnav-quick-create-dropdown";
                readonly quickCreateLink: "quick-create-{slug}-link";
            };
            readonly topnav: {
                readonly sidebarToggle: "topnav-sidebar-toggle";
                readonly header: "topnav-header";
                readonly logo: "topnav-logo";
                readonly searchSection: "topnav-search-section";
                readonly actions: "topnav-actions";
                readonly notifications: "topnav-notifications";
                readonly help: "topnav-help";
                readonly themeToggle: "topnav-theme-toggle";
                readonly superadmin: "topnav-superadmin";
                readonly devtools: "topnav-devtools";
                readonly userMenuTrigger: "topnav-user-menu-trigger";
                readonly userMenu: "topnav-user-menu";
                readonly menuItem: "topnav-menu-{icon}";
                readonly menuAction: "topnav-menu-{action}";
                readonly userLoading: "topnav-user-loading";
                readonly signin: "topnav-signin";
                readonly signup: "topnav-signup";
                readonly mobileActions: "topnav-mobile-actions";
                readonly mobileMenuToggle: "topnav-mobile-menu-toggle";
                readonly mobileMenu: "topnav-mobile-menu";
                readonly mobileUserInfo: "topnav-mobile-user-info";
                readonly mobileLinkProfile: "topnav-mobile-link-profile";
                readonly mobileLinkSettings: "topnav-mobile-link-settings";
                readonly mobileLinkBilling: "topnav-mobile-link-billing";
                readonly mobileSignout: "topnav-mobile-signout";
                readonly mobileNavSuperadmin: "topnav-mobile-nav-superadmin";
                readonly mobileNavDevtools: "topnav-mobile-nav-devtools";
            };
            readonly sidebar: {
                readonly main: "sidebar-main";
                readonly header: "sidebar-header";
                readonly content: "sidebar-content";
                readonly footer: "sidebar-footer";
            };
            readonly navigation: {
                readonly main: "nav-main";
                readonly dashboardLink: "nav-link-dashboard";
                readonly entityLink: "nav-link-entity-{slug}";
                readonly section: "nav-section-{id}";
                readonly sectionLabel: "nav-section-label-{id}";
                readonly sectionItem: "nav-section-item-{sectionId}-{itemId}";
            };
            readonly mobile: {
                readonly topbar: {
                    readonly header: "mobile-topbar-header";
                    readonly userProfile: "mobile-topbar-user-profile";
                    readonly notifications: "mobile-topbar-notifications";
                    readonly themeToggle: "mobile-topbar-theme-toggle";
                };
                readonly bottomNav: {
                    readonly nav: "mobile-bottomnav-nav";
                    readonly item: "mobile-bottomnav-item-{id}";
                };
                readonly moreSheet: {
                    readonly content: "mobile-more-sheet-content";
                    readonly item: "mobile-more-sheet-item-{id}";
                    readonly superadminLink: "mobile-more-sheet-superadmin-link";
                    readonly teamSwitcher: "mobile-more-sheet-team-switcher";
                    readonly signoutButton: "mobile-more-sheet-signout-button";
                };
                readonly quickCreateSheet: {
                    readonly content: "mobile-quick-create-sheet-content";
                    readonly item: "mobile-quick-create-sheet-item-{slug}";
                };
            };
        };
        readonly entities: {
            readonly page: {
                readonly container: "{slug}-page";
                readonly title: "{slug}-title";
            };
            readonly list: {
                readonly container: "{slug}-list";
            };
            readonly table: {
                readonly container: "{slug}-table-container";
                readonly element: "{slug}-table";
                readonly search: "{slug}-search";
                readonly addButton: "{slug}-add";
                readonly selectionCount: "{slug}-selection-count";
                readonly selectAll: "{slug}-select-all";
                readonly row: "{slug}-row-{id}";
                readonly rowSelect: "{slug}-select-{id}";
                readonly cell: "{slug}-cell-{field}-{id}";
                readonly rowMenu: "{slug}-menu-{id}";
                readonly rowActionsMenu: "{slug}-actions-{id}";
                readonly rowAction: "{slug}-menu-{action}-{id}";
                readonly quickAction: "{slug}-quick-{action}-{id}";
            };
            readonly pagination: {
                readonly container: "{slug}-pagination";
                readonly pageSize: "{slug}-page-size";
                readonly pageSizeOption: "{slug}-page-size-{size}";
                readonly pageInfo: "{slug}-page-info";
                readonly first: "{slug}-page-first";
                readonly prev: "{slug}-page-prev";
                readonly next: "{slug}-page-next";
                readonly last: "{slug}-page-last";
            };
            readonly bulk: {
                readonly bar: "{slug}-bulk-bar";
                readonly count: "{slug}-bulk-count";
                readonly selectAll: "{slug}-bulk-select-all";
                readonly statusButton: "{slug}-bulk-status";
                readonly deleteButton: "{slug}-bulk-delete";
                readonly clearButton: "{slug}-bulk-clear";
                readonly statusDialog: "{slug}-bulk-status-dialog";
                readonly statusSelect: "{slug}-bulk-status-select";
                readonly statusOption: "{slug}-bulk-status-option-{value}";
                readonly statusCancel: "{slug}-bulk-status-cancel";
                readonly statusConfirm: "{slug}-bulk-status-confirm";
                readonly deleteDialog: "{slug}-bulk-delete-dialog";
                readonly deleteCancel: "{slug}-bulk-delete-cancel";
                readonly deleteConfirm: "{slug}-bulk-delete-confirm";
            };
            readonly header: {
                readonly container: "{slug}-{mode}-header";
                readonly backButton: "{slug}-back-btn";
                readonly title: "{slug}-title";
                readonly copyId: "{slug}-copy-id";
                readonly editButton: "{slug}-edit-btn";
                readonly deleteButton: "{slug}-delete-btn";
                readonly deleteDialog: "{slug}-delete-dialog";
                readonly deleteCancel: "{slug}-delete-cancel";
                readonly deleteConfirm: "{slug}-delete-confirm";
            };
            readonly detail: {
                readonly container: "{slug}-detail";
            };
            readonly form: {
                readonly container: "{slug}-form";
                readonly field: "{slug}-field-{name}";
                readonly submitButton: "{slug}-form-submit";
                readonly cancelButton: "{slug}-form-cancel";
            };
            readonly filter: {
                readonly container: "{slug}-filter-{field}";
                readonly trigger: "{slug}-filter-{field}-trigger";
                readonly content: "{slug}-filter-{field}-content";
                readonly option: "{slug}-filter-{field}-option-{value}";
                readonly badge: "{slug}-filter-{field}-badge-{value}";
                readonly removeBadge: "{slug}-filter-{field}-remove-{value}";
                readonly clearAll: "{slug}-filter-{field}-clear-all";
            };
            readonly search: {
                readonly container: "{slug}-search";
                readonly icon: "{slug}-search-icon";
                readonly input: "{slug}-search-input";
                readonly clear: "{slug}-search-clear";
            };
            readonly confirm: {
                readonly dialog: "{slug}-confirm-dialog";
                readonly cancel: "{slug}-confirm-cancel";
                readonly action: "{slug}-confirm-action";
            };
            readonly childEntity: {
                readonly container: "{parentSlug}-{childName}-container";
                readonly addButton: "{parentSlug}-{childName}-add-button";
            };
        };
        readonly globalSearch: {
            readonly modal: "search-modal";
            readonly trigger: "search-trigger";
            readonly input: "search-input";
            readonly results: "search-results";
            readonly result: "search-result";
        };
        readonly taxonomies: {
            readonly list: {
                readonly container: "taxonomies-list-table";
                readonly createButton: "taxonomies-create-button";
                readonly row: "taxonomy-row-{id}";
                readonly editButton: "taxonomies-edit-{id}";
                readonly deleteButton: "taxonomies-delete-{id}";
            };
            readonly form: {
                readonly dialog: "taxonomy-form-dialog";
                readonly nameInput: "taxonomy-name-input";
                readonly slugInput: "taxonomy-slug-input";
                readonly descriptionInput: "taxonomy-description-input";
                readonly iconInput: "taxonomy-icon-input";
                readonly colorInput: "taxonomy-color-input";
                readonly parentSelect: "taxonomy-parent-select";
                readonly orderInput: "taxonomy-order-input";
                readonly saveButton: "taxonomy-save-button";
                readonly cancelButton: "taxonomy-cancel-button";
            };
            readonly confirmDelete: {
                readonly dialog: "taxonomy-delete-dialog";
                readonly confirmButton: "taxonomy-delete-confirm";
                readonly cancelButton: "taxonomy-delete-cancel";
            };
        };
        readonly teams: {
            readonly switcher: {
                readonly compact: "team-switcher-compact";
                readonly full: "team-switcher";
                readonly dropdown: "team-switcher-dropdown";
                readonly option: "team-option-{slug}";
                readonly manageLink: "manage-teams-link";
                readonly createButton: "create-team-button";
            };
            readonly switchModal: {
                readonly container: "team-switch-modal";
            };
            readonly create: {
                readonly dialog: "create-team-dialog";
                readonly button: "create-team-button";
                readonly nameInput: "team-name-input";
                readonly slugInput: "team-slug-input";
                readonly descriptionInput: "team-description-input";
                readonly cancel: "cancel-create-team";
                readonly submit: "submit-create-team";
            };
            readonly members: {
                readonly section: "team-members-section";
                readonly row: "member-row-{id}";
                readonly actions: "member-actions-{id}";
                readonly makeRole: "make-{role}-action";
                readonly remove: "remove-member-action";
            };
            readonly invite: {
                readonly button: "invite-member-button";
                readonly buttonDisabled: "invite-member-button-disabled";
                readonly dialog: "invite-member-dialog";
                readonly emailInput: "member-email-input";
                readonly roleSelect: "member-role-select";
                readonly roleOption: "role-option-{role}";
                readonly cancel: "cancel-invite-member";
                readonly submit: "submit-invite-member";
            };
            readonly invitations: {
                readonly row: "invitation-row-{id}";
                readonly cancel: "cancel-invitation-{id}";
            };
        };
        readonly blockEditor: {
            readonly container: "builder-editor";
            readonly titleInput: "editor-title-input";
            readonly slugInput: "editor-slug-input";
            readonly saveButton: "save-btn";
            readonly statusBadge: "status-badge";
            readonly leftSidebarToggle: "left-sidebar-toggle";
            readonly viewModeToggle: "view-mode-toggle";
            readonly blockPicker: {
                readonly container: "block-picker";
                readonly searchInput: "block-search-input";
                readonly categoryAll: "category-all";
                readonly category: "category-{category}";
                readonly blockItem: "block-item-{slug}";
                readonly addBlock: "add-block-{slug}";
            };
            readonly blockCanvas: {
                readonly container: "block-preview-canvas";
                readonly empty: "block-preview-canvas-empty";
            };
            readonly previewCanvas: {
                readonly container: "block-preview-canvas";
                readonly empty: "block-preview-canvas-empty";
                readonly block: "preview-block-{id}";
                readonly moveUp: "preview-block-{id}-move-up";
                readonly moveDown: "preview-block-{id}-move-down";
            };
            readonly sortableBlock: {
                readonly container: "sortable-block-{id}";
                readonly dragHandle: "drag-handle-{id}";
                readonly duplicate: "duplicate-block-{id}";
                readonly remove: "remove-block-{id}";
                readonly error: "block-error-{id}";
            };
            readonly settingsPanel: {
                readonly container: "block-settings-panel";
                readonly empty: "settings-panel-empty";
                readonly error: "settings-panel-error";
                readonly resetProps: "reset-block-props";
                readonly removeBlock: "remove-block-settings";
                readonly tabContent: "tab-content";
                readonly tabDesign: "tab-design";
                readonly tabAdvanced: "tab-advanced";
            };
            readonly pageSettings: {
                readonly container: "page-settings-panel";
                readonly seoTrigger: "seo-settings-trigger";
                readonly metaTitle: "seo-meta-title";
                readonly metaDescription: "seo-meta-description";
                readonly metaKeywords: "seo-meta-keywords";
                readonly ogImage: "seo-og-image";
                readonly customFieldsTrigger: "custom-fields-trigger";
                readonly customFieldKey: "custom-field-key-{index}";
                readonly customFieldValue: "custom-field-value-{index}";
                readonly customFieldRemove: "custom-field-remove-{index}";
                readonly addCustomField: "add-custom-field";
            };
            readonly statusSelector: {
                readonly trigger: "status-selector";
                readonly option: "status-option-{value}";
            };
            readonly dynamicForm: {
                readonly container: "dynamic-form";
                readonly field: "field-{name}";
                readonly fieldGroup: "field-group-{id}";
                readonly arrayGroup: "array-group-{name}";
            };
            readonly arrayField: {
                readonly container: "array-field-{name}";
                readonly item: "array-field-{name}-{index}-{field}";
                readonly moveUp: "array-field-{name}-{index}-move-up";
                readonly moveDown: "array-field-{name}-{index}-move-down";
                readonly remove: "array-field-{name}-{index}-remove";
                readonly add: "array-field-{name}-add";
            };
            readonly entityFieldsSidebar: {
                readonly container: "entity-fields-sidebar";
                readonly field: "field-{name}";
                readonly category: "category-{slug}";
            };
            readonly postFields: {
                readonly excerpt: "field-excerpt";
                readonly featuredImage: "field-featuredImage";
                readonly featuredImageUpload: "field-featuredImage-upload";
                readonly categories: "field-categories";
                readonly categoryOption: "category-option-{id}";
                readonly categoryBadge: "category-badge-{id}";
                readonly categoryRemove: "category-remove-{id}";
            };
            readonly localeField: {
                readonly select: "field-locale";
                readonly option: "locale-option-{locale}";
            };
        };
        readonly settings: {
            readonly layout: {
                readonly main: "settings-layout-main";
                readonly nav: "settings-layout-nav";
                readonly backToDashboard: "settings-layout-back-to-dashboard";
                readonly header: "settings-layout-header";
                readonly contentArea: "settings-layout-content-area";
                readonly sidebar: "settings-layout-sidebar";
                readonly pageContent: "settings-layout-page-content";
            };
            readonly sidebar: {
                readonly main: "settings-sidebar-main";
                readonly header: "settings-sidebar-header";
                readonly navItems: "settings-sidebar-nav-items";
                readonly navItem: "settings-sidebar-nav-{section}";
            };
            readonly overview: {
                readonly container: "settings-overview";
                readonly item: "settings-overview-{key}";
            };
            readonly profile: {
                readonly container: "settings-profile";
                readonly form: "profile-form";
                readonly avatar: "profile-avatar";
                readonly avatarUpload: "profile-avatar-upload";
                readonly firstName: "profile-first-name";
                readonly lastName: "profile-last-name";
                readonly email: "profile-email";
                readonly submitButton: "profile-submit";
                readonly successMessage: "profile-success";
            };
            readonly password: {
                readonly container: "settings-password";
                readonly form: "password-form";
                readonly currentPassword: "password-current";
                readonly newPassword: "password-new";
                readonly confirmPassword: "password-confirm";
                readonly submitButton: "password-submit";
                readonly successMessage: "password-success";
            };
            readonly team: {
                readonly container: "settings-team";
                readonly name: "team-name";
                readonly slug: "team-slug";
                readonly description: "team-description";
                readonly avatar: "team-avatar";
                readonly avatarUpload: "team-avatar-upload";
                readonly submitButton: "team-submit";
                readonly deleteButton: "team-delete";
                readonly deleteDialog: "team-delete-dialog";
                readonly deleteConfirm: "team-delete-confirm";
            };
            readonly members: {
                readonly container: "settings-members";
                readonly inviteButton: "members-invite";
                readonly inviteDialog: "members-invite-dialog";
                readonly inviteEmail: "members-invite-email";
                readonly inviteRole: "members-invite-role";
                readonly inviteSubmit: "members-invite-submit";
                readonly memberRow: "member-row-{id}";
                readonly memberRole: "member-role-{id}";
                readonly memberRemove: "member-remove-{id}";
                readonly pendingInvites: "members-pending-invites";
                readonly pendingInvite: "pending-invite-{id}";
                readonly cancelInvite: "cancel-invite-{id}";
            };
            readonly billing: {
                readonly container: "settings-billing";
                readonly main: "billing-main";
                readonly header: "billing-header";
                readonly currentPlan: "billing-current-plan";
                readonly upgradeButton: "billing-upgrade";
                readonly upgradePlan: "billing-upgrade-plan";
                readonly cancelButton: "billing-cancel";
                readonly addPayment: "billing-add-payment";
                readonly invoicesTable: "billing-invoices";
                readonly invoicesTableAlt: "invoices-table";
                readonly invoiceRow: "invoice-row-{id}";
                readonly invoicesRow: "invoices-row";
                readonly invoiceDownload: "invoice-download-{id}";
                readonly invoicesLoadMore: "invoices-load-more";
                readonly invoiceStatusBadge: "invoice-status-badge";
                readonly paymentMethod: "billing-payment-method";
                readonly paymentMethodAlt: "payment-method";
                readonly updatePayment: "billing-update-payment";
                readonly usage: "billing-usage";
                readonly usageDashboard: "usage-dashboard";
            };
            readonly pricing: {
                readonly table: "pricing-table";
                readonly settingsTable: "pricing-settings-table";
            };
            readonly features: {
                readonly placeholder: "feature-placeholder-{feature}";
                readonly content: "{feature}-content";
                readonly placeholderUpgradeBtn: "placeholder-upgrade-btn";
            };
            readonly apiKeys: {
                readonly page: "api-keys-page";
                readonly title: "api-keys-title";
                readonly container: "settings-api-keys";
                readonly createButton: "api-keys-create-button";
                readonly createDialog: "api-keys-create-dialog";
                readonly list: "api-keys-list";
                readonly skeleton: "api-keys-skeleton";
                readonly empty: "api-keys-empty";
                readonly emptyCreateButton: "api-keys-empty-create-button";
                readonly keyName: "api-key-name";
                readonly keyScopes: "api-key-scopes";
                readonly scopeOption: "api-key-scope-{scope}";
                readonly createSubmit: "api-key-create-submit";
                readonly keyRow: "api-key-row-{id}";
                readonly keyName_: "api-keys-name-{id}";
                readonly keyPrefix: "api-keys-prefix-{id}";
                readonly copyPrefix: "api-keys-copy-prefix-{id}";
                readonly keyStatus: "api-keys-status-{id}";
                readonly statusBadge: "api-keys-status-badge-{id}";
                readonly menuTrigger: "api-keys-menu-trigger-{id}";
                readonly menu: "api-keys-menu-{id}";
                readonly viewDetails: "api-keys-view-details-{id}";
                readonly toggle: "api-keys-toggle-{id}";
                readonly revoke: "api-keys-revoke-{id}";
                readonly scopes: "api-keys-scopes-{id}";
                readonly scope: "api-keys-scope-{id}-{scope}";
                readonly stats: "api-keys-stats-{id}";
                readonly totalRequests: "api-keys-total-requests-{id}";
                readonly last24h: "api-keys-last-24h-{id}";
                readonly avgTime: "api-keys-avg-time-{id}";
                readonly metadata: "api-keys-metadata-{id}";
                readonly createdAt: "api-keys-created-at-{id}";
                readonly lastUsed: "api-keys-last-used-{id}";
                readonly expiresAt: "api-keys-expires-at-{id}";
                readonly detailsDialog: "api-keys-details-dialog";
                readonly detailsTitle: "api-keys-details-title";
                readonly detailsLoading: "api-keys-details-loading";
                readonly detailsContent: "api-keys-details-content";
                readonly detailsBasicInfo: "api-keys-details-basic-info";
                readonly detailsName: "api-keys-details-name";
                readonly detailsStatus: "api-keys-details-status";
                readonly detailsStats: "api-keys-details-stats";
                readonly detailsTotalRequests: "api-keys-details-total-requests";
                readonly detailsLast24h: "api-keys-details-last-24h";
                readonly detailsLast7d: "api-keys-details-last-7d";
                readonly detailsLast30d: "api-keys-details-last-30d";
                readonly detailsAvgTime: "api-keys-details-avg-time";
                readonly detailsSuccessRate: "api-keys-details-success-rate";
                readonly keyReveal: "api-key-reveal-{id}";
                readonly keyRevoke: "api-key-revoke-{id}";
                readonly revokeDialog: "api-key-revoke-dialog";
                readonly revokeConfirm: "api-key-revoke-confirm";
                readonly newKeyDisplay: "api-key-new-display";
                readonly copyKey: "api-key-copy";
                readonly dialogFooter: "api-keys-dialog-footer";
            };
            readonly notifications: {
                readonly container: "settings-notifications";
                readonly emailToggle: "notifications-email";
                readonly pushToggle: "notifications-push";
                readonly category: "notifications-{category}";
                readonly submitButton: "notifications-submit";
            };
            readonly teams: {
                readonly main: "teams-settings-main";
                readonly header: "teams-settings-header";
                readonly loading: "teams-settings-loading";
                readonly singleUser: "teams-settings-single-user";
                readonly teamsList: "teams-settings-teams-list";
                readonly teamDetails: "teams-settings-team-details";
            };
            readonly plans: {
                readonly main: "plans-settings-main";
                readonly header: "plans-settings-header";
                readonly table: "plans-settings-table";
            };
        };
        readonly superadmin: {
            readonly container: "superadmin-container";
            readonly navigation: {
                readonly dashboard: "superadmin-nav-dashboard";
                readonly users: "superadmin-nav-users";
                readonly teams: "superadmin-nav-teams";
                readonly teamRoles: "superadmin-nav-team-roles";
                readonly subscriptions: "superadmin-nav-subscriptions";
                readonly exitToDashboard: "superadmin-sidebar-exit-to-dashboard";
            };
            readonly dashboard: {
                readonly container: "superadmin-dashboard";
            };
            readonly users: {
                readonly container: "superadmin-users-container";
                readonly table: "superadmin-users-table";
                readonly search: "superadmin-users-search";
                readonly row: "superadmin-user-row-{id}";
                readonly viewButton: "superadmin-user-view-{id}";
                readonly editButton: "superadmin-user-edit-{id}";
                readonly banButton: "superadmin-user-ban-{id}";
                readonly deleteButton: "superadmin-user-delete-{id}";
                readonly impersonateButton: "superadmin-user-impersonate-{id}";
            };
            readonly userDetail: {
                readonly container: "superadmin-user-detail";
                readonly email: "superadmin-user-email";
                readonly role: "superadmin-user-role";
                readonly status: "superadmin-user-status";
                readonly teams: "superadmin-user-teams";
                readonly activity: "superadmin-user-activity";
                readonly actions: "superadmin-user-actions";
                readonly metas: "superadmin-user-metas";
                readonly metasTitle: "superadmin-user-metas-title";
                readonly metasTable: "superadmin-user-metas-table";
                readonly metasEmpty: "superadmin-user-metas-empty";
                readonly metaRow: "superadmin-user-meta-row-{key}";
                readonly metaKey: "superadmin-user-meta-key-{key}";
                readonly metaValue: "superadmin-user-meta-value-{key}";
                readonly metaType: "superadmin-user-meta-type-{key}";
                readonly metaPublic: "superadmin-user-meta-public-{key}";
                readonly metaSearchable: "superadmin-user-meta-searchable-{key}";
            };
            readonly teams: {
                readonly container: "superadmin-teams-container";
                readonly table: "superadmin-teams-table";
                readonly search: "superadmin-teams-search";
                readonly row: "superadmin-team-row-{id}";
                readonly actionsButton: "superadmin-team-actions-{id}";
                readonly viewButton: "superadmin-team-view-{id}";
                readonly editButton: "superadmin-team-edit-{id}";
                readonly deleteButton: "superadmin-team-delete-{id}";
            };
            readonly teamDetail: {
                readonly container: "superadmin-team-detail";
                readonly name: "superadmin-team-name";
                readonly owner: "superadmin-team-owner";
                readonly members: "superadmin-team-members";
                readonly plan: "superadmin-team-plan";
                readonly usage: "superadmin-team-usage";
            };
            readonly subscriptions: {
                readonly container: "superadmin-subscriptions-container";
                readonly mrr: "superadmin-subscriptions-mrr";
                readonly planDistribution: "superadmin-subscriptions-plan-distribution";
                readonly planCount: "superadmin-subscriptions-plan-count-{plan}";
                readonly activeCount: "superadmin-subscriptions-active-count";
            };
            readonly pagination: {
                readonly pageSize: "superadmin-page-size-select";
                readonly first: "superadmin-pagination-first";
                readonly prev: "superadmin-pagination-prev";
                readonly next: "superadmin-pagination-next";
                readonly last: "superadmin-pagination-last";
            };
            readonly filters: {
                readonly search: "superadmin-search-{context}";
                readonly dropdown: "superadmin-filter-{context}";
            };
            readonly permissions: {
                readonly row: "superadmin-permission-row-{permission}";
            };
            readonly teamRoles: {
                readonly backButton: "back-to-superadmin";
                readonly roleCard: "role-card-{role}";
                readonly permissionRow: "permission-row-{permission}";
            };
            readonly planFeatures: {
                readonly featureRow: "superadmin-feature-row-{slug}";
                readonly limitRow: "superadmin-limit-row-{slug}";
            };
        };
        readonly devtools: {
            readonly navigation: {
                readonly sidebar: "devtools-sidebar";
                readonly collapseToggle: "devtools-sidebar-collapse-toggle";
                readonly navItem: "devtools-nav-{section}";
                readonly exitToDashboard: "devtools-sidebar-exit-to-dashboard";
                readonly goToSuperadmin: "devtools-sidebar-go-to-superadmin";
                readonly mobileHeader: "devtools-mobile-header";
            };
            readonly home: {
                readonly page: "devtools-home-page";
                readonly styleLink: "devtools-home-style-link";
                readonly testsLink: "devtools-home-tests-link";
                readonly configLink: "devtools-home-config-link";
            };
            readonly style: {
                readonly page: "devtools-style-page";
                readonly tabComponents: "devtools-style-tab-components";
                readonly tabFieldTypes: "devtools-style-tab-field-types";
                readonly tabTheme: "devtools-style-tab-theme";
                readonly tabGuidelines: "devtools-style-tab-guidelines";
                readonly componentGallery: "devtools-style-component-gallery";
                readonly fieldTypes: "devtools-style-field-types";
                readonly themePreview: "devtools-style-theme-preview";
            };
            readonly config: {
                readonly page: "devtools-config-page";
                readonly viewer: "devtools-config-viewer";
                readonly tabTheme: "devtools-config-tab-theme";
                readonly tabEntities: "devtools-config-tab-entities";
                readonly themeContent: "devtools-config-theme-content";
                readonly entitiesContent: "devtools-config-entities-content";
                readonly copyTheme: "devtools-config-copy-theme";
                readonly copyEntities: "devtools-config-copy-entities";
            };
            readonly tests: {
                readonly page: "devtools-tests-page";
                readonly viewer: "devtools-tests-viewer";
                readonly loading: "devtools-tests-loading";
                readonly tree: "devtools-tests-tree";
                readonly folder: "devtools-tests-folder-{name}";
                readonly file: "devtools-tests-file-{name}";
                readonly content: "devtools-tests-content";
                readonly markdownContent: "devtools-tests-markdown-content";
                readonly notFound: "devtools-tests-not-found";
                readonly backToList: "devtools-tests-back-to-list";
                readonly emptyState: "devtools-tests-empty-state";
                readonly fileLoading: "devtools-tests-file-loading";
                readonly error: "devtools-tests-error";
            };
            readonly features: {
                readonly page: "devtools-features-page";
                readonly viewer: "devtools-features-viewer";
                readonly search: "devtools-features-search";
                readonly filterAll: "devtools-features-filter-all";
                readonly filterCategory: "devtools-features-filter-{category}";
                readonly coverageAll: "devtools-features-coverage-all";
                readonly coverageCovered: "devtools-features-coverage-covered";
                readonly coverageUncovered: "devtools-features-coverage-uncovered";
                readonly card: "devtools-features-card-{slug}";
                readonly copyTag: "devtools-features-copy-{slug}";
            };
            readonly flows: {
                readonly page: "devtools-flows-page";
                readonly viewer: "devtools-flows-viewer";
                readonly search: "devtools-flows-search";
                readonly filterAll: "devtools-flows-filter-all";
                readonly filterCategory: "devtools-flows-filter-{category}";
                readonly coverageAll: "devtools-flows-coverage-all";
                readonly coverageCovered: "devtools-flows-coverage-covered";
                readonly coverageUncovered: "devtools-flows-coverage-uncovered";
                readonly card: "devtools-flows-card-{slug}";
                readonly copyTag: "devtools-flows-copy-{slug}";
            };
            readonly blocks: {
                readonly page: "devtools-blocks-page";
                readonly viewer: "devtools-blocks-viewer";
                readonly search: "devtools-blocks-search";
                readonly filterAll: "devtools-blocks-filter-all";
                readonly filterCategory: "devtools-blocks-filter-{category}";
                readonly coverageAll: "devtools-blocks-coverage-all";
                readonly coverageCovered: "devtools-blocks-coverage-covered";
                readonly coverageUncovered: "devtools-blocks-coverage-uncovered";
                readonly card: "devtools-blocks-card-{slug}";
                readonly copyTag: "devtools-blocks-copy-{slug}";
                readonly viewDetails: "devtools-blocks-view-{slug}";
                readonly detail: {
                    readonly page: "devtools-block-detail-{slug}";
                    readonly back: "devtools-block-detail-back";
                    readonly tabPreview: "devtools-block-detail-tab-preview";
                    readonly tabFields: "devtools-block-detail-tab-fields";
                    readonly tabOverview: "devtools-block-detail-tab-overview";
                    readonly preview: "devtools-block-detail-preview-{slug}";
                    readonly exampleSelector: "devtools-block-example-selector";
                    readonly exampleBtn: "devtools-block-example-btn-{index}";
                    readonly exampleName: "devtools-block-example-name";
                    readonly exampleDescription: "devtools-block-example-description";
                };
            };
            readonly tags: {
                readonly page: "devtools-tags-page";
                readonly viewer: "devtools-tags-viewer";
                readonly search: "devtools-tags-search";
                readonly category: "devtools-tags-category-{category}";
                readonly tag: "devtools-tags-tag-{tag}";
                readonly tagLink: "devtools-tags-link-{tag}";
                readonly filesPanel: "devtools-tags-files-panel-{tag}";
            };
            readonly scheduledActions: {
                readonly page: "devtools-scheduled-actions-page";
                readonly filterStatus: "scheduled-actions-filter-status";
                readonly filterType: "scheduled-actions-filter-type";
                readonly filterApply: "scheduled-actions-filter-apply";
                readonly filterReset: "scheduled-actions-filter-reset";
                readonly table: "scheduled-actions-table";
                readonly row: "scheduled-actions-row-{id}";
                readonly cellType: "scheduled-actions-cell-type";
                readonly cellStatus: "scheduled-actions-cell-status";
                readonly cellScheduledAt: "scheduled-actions-cell-scheduled-at";
                readonly cellTeam: "scheduled-actions-cell-team";
                readonly cellPayload: "scheduled-actions-cell-payload";
                readonly cellError: "scheduled-actions-cell-error";
                readonly statusPending: "scheduled-actions-status-pending";
                readonly statusRunning: "scheduled-actions-status-running";
                readonly statusCompleted: "scheduled-actions-status-completed";
                readonly statusFailed: "scheduled-actions-status-failed";
                readonly pagination: "scheduled-actions-pagination";
                readonly paginationPrev: "scheduled-actions-pagination-prev";
                readonly paginationNext: "scheduled-actions-pagination-next";
                readonly emptyState: "scheduled-actions-empty-state";
            };
        };
        readonly public: {
            readonly navbar: {
                readonly container: "public-navbar";
                readonly logo: "navbar-logo";
                readonly loginButton: "navbar-login";
                readonly signupButton: "navbar-signup";
            };
            readonly footer: {
                readonly container: "public-footer";
                readonly logo: "footer-logo";
            };
            readonly page: {
                readonly container: "public-page-{slug}";
                readonly title: "page-title";
                readonly content: "page-content";
            };
            readonly blog: {
                readonly listContainer: "blog-list";
                readonly postCard: "blog-post-{slug}";
            };
        };
        readonly common: {
            readonly permissionDenied: "permission-denied";
            readonly loading: "loading-spinner";
            readonly error: "error-message";
            readonly toast: "toast-{type}";
            readonly modal: {
                readonly overlay: "modal-overlay";
                readonly container: "modal-container";
                readonly title: "modal-title";
                readonly close: "modal-close";
                readonly content: "modal-content";
                readonly footer: "modal-footer";
            };
        };
    };
    sel: (path: string, replacements?: import("./selector-factory").Replacements) => string;
    s: (path: string, replacements?: import("./selector-factory").Replacements) => string;
    selDev: (path: string, replacements?: import("./selector-factory").Replacements) => string | undefined;
    cySelector: (path: string, replacements?: import("./selector-factory").Replacements) => string;
    entitySelectors: (slug: string) => import("./selector-factory").EntitySelectorHelpers;
};
export default _default;
//# sourceMappingURL=selectors.d.ts.map