/**
 * Dashboard Selectors - 5 First-Level Components
 *
 * The dashboard has TWO distinct layouts: Desktop and Mobile.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DESKTOP LAYOUT (≥768px)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ TOPNAV: [≡] [+Create▼]  [🔍Search▼]  [🔔] [?] [☀] [👑SA] [🔧DT] [👤User▼]  │
 * ├───────────────┬─────────────────────────────────────────────────────────────┤
 * │  SIDEBAR      │                                                             │
 * │  ───────────  │                     CONTENT AREA                            │
 * │  [Logo]       │                                                             │
 * │               │              (Page-specific content)                        │
 * │  NAVIGATION   │                                                             │
 * │  ───────────  │                                                             │
 * │  • Dashboard  │                                                             │
 * │  ─ Entities ─ │                                                             │
 * │  • Posts      │                                                             │
 * │  • Products   │                                                             │
 * │  ─ Settings ─ │                                                             │
 * │  • Config     │                                                             │
 * │               │                                                             │
 * │  ───────────  │                                                             │
 * │  [TeamSwitch] │                                                             │
 * └───────────────┴─────────────────────────────────────────────────────────────┘
 *
 * Desktop Components:
 * 1. container      - Main wrapper (wraps sidebar + topnav + content)
 * 2. sidebar        - Left column, collapsible (w-64 expanded, w-16 collapsed)
 * 3. topnav         - Top bar with actions, search, notifications, user menu
 * 4. navigation     - Nav items inside sidebar (DynamicNavigation)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOBILE LAYOUT (<768px)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ MOBILE TOPBAR: [👤 User Name]                          [🔔] [☀]            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │                         CONTENT AREA                                        │
 * │                                                                             │
 * │                    (Page-specific content)                                  │
 * │                                                                             │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ MOBILE BOTTOMNAV: [🏠] [📝Posts] [➕Create] [📦Prods] [⋯More]               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 *         ┌─────────────────────────────────────────┐
 *         │      QUICK CREATE SHEET (Bottom)       │
 *         │      ─────────────────────────────     │
 *         │      • Create Post                     │
 *         │      • Create Product                  │
 *         │      • Create Category                 │
 *         └─────────────────────────────────────────┘
 *
 *         ┌─────────────────────────────────────────┐
 *         │        MORE SHEET (Bottom)             │
 *         │        ─────────────────────           │
 *         │        • Settings                      │
 *         │        • Profile                       │
 *         │        • Billing                       │
 *         │        ─────────────────────           │
 *         │        • Superadmin                    │
 *         │        [Team Switcher]                 │
 *         │        ─────────────────────           │
 *         │        [Sign Out]                      │
 *         └─────────────────────────────────────────┘
 *
 * Mobile Components:
 * 5. mobile.topbar         - Top bar (user profile, notifications, theme)
 * 6. mobile.bottomNav      - Bottom navigation with 5 items + central create
 * 7. mobile.moreSheet      - Bottom sheet for settings, team, signout
 * 8. mobile.quickCreateSheet - Bottom sheet for entity creation
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHARED DROPDOWNS (Inside topnav)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────┐
 * │      QUICK CREATE DROPDOWN              │
 * │      ─────────────────────              │
 * │      [+ Create ▼]                       │
 * │      ───────────────────────────────    │
 * │      • New Post                         │
 * │      • New Product                      │
 * │      • New Category                     │
 * └─────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────┐
 * │      NOTIFICATIONS DROPDOWN             │
 * │      ─────────────────────              │
 * │      [🔔 3]                             │
 * │      ───────────────────────────────    │
 * │      • New comment on post              │
 * │      • Order received                   │
 * │      • User registered                  │
 * │      ───────────────────────────────    │
 * │      [Mark all as read]                 │
 * └─────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────┐
 * │      USER MENU DROPDOWN                 │
 * │      ─────────────────────              │
 * │      [👤 User ▼]                        │
 * │      ───────────────────────────────    │
 * │      John Doe                           │
 * │      john@example.com                   │
 * │      ───────────────────────────────    │
 * │      • Profile                          │
 * │      • Settings                         │
 * │      • Billing                          │
 * │      ───────────────────────────────    │
 * │      [Sign Out]                         │
 * └─────────────────────────────────────────┘
 *
 * NOTE: Global Search (Cmd+K modal) is in globalSearch.selectors.ts
 */

export const DASHBOARD_SELECTORS = {
  // Main container (wraps everything)
  container: 'dashboard-container',

  // =========================================================================
  // 1. SIDEBAR - Left column (Desktop only, collapsible)
  // =========================================================================
  sidebar: {
    container: 'sidebar-main',
    header: 'sidebar-header',
    logo: 'sidebar-logo',
    content: 'sidebar-content',
    footer: 'sidebar-footer',
  },

  // =========================================================================
  // 2. TOPNAV - Top bar (Desktop)
  // =========================================================================
  topnav: {
    container: 'topnav-header',
    logo: 'topnav-logo',
    sidebarToggle: 'topnav-sidebar-toggle',

    // Search section (the Cmd+K modal is in globalSearch selectors)
    search: {
      container: 'topnav-search-section',
    },

    // Notifications Dropdown
    notifications: {
      trigger: 'topnav-notifications',
      // Future: content, badge, list, item, markAllRead, empty
    },

    // Quick Create Dropdown
    quickCreate: {
      trigger: 'topnav-quick-create-button',
      content: 'topnav-quick-create-dropdown',
      link: 'quick-create-{slug}-link',
    },

    // User Menu Dropdown
    userMenu: {
      trigger: 'topnav-user-menu-trigger',
      content: 'topnav-user-menu',
      item: 'topnav-menu-{icon}',
      action: 'topnav-menu-{action}',
    },

    // Container for right side actions
    actions: 'topnav-actions',

    // Settings Menu Dropdown
    settingsMenu: {
      trigger: 'topnav-settings-menu-trigger',
      content: 'topnav-settings-menu',
      item: 'topnav-settings-item-{index}',
    },

    // Single action buttons
    help: 'topnav-help',
    themeToggle: 'topnav-theme-toggle',
    superadmin: 'topnav-superadmin',
    devtools: 'topnav-devtools',
    userLoading: 'topnav-user-loading',
    signin: 'topnav-signin',
    signup: 'topnav-signup',

    // Mobile responsive menu (inside TopNavbar component)
    mobileMenu: {
      toggle: 'topnav-mobile-menu-toggle',
      container: 'topnav-mobile-menu',
      actions: 'topnav-mobile-actions',
      userInfo: 'topnav-mobile-user-info',
      linkProfile: 'topnav-mobile-link-profile',
      linkSettings: 'topnav-mobile-link-settings',
      linkBilling: 'topnav-mobile-link-billing',
      signout: 'topnav-mobile-signout',
      superadmin: 'topnav-mobile-nav-superadmin',
      devtools: 'topnav-mobile-nav-devtools',
    },
  },

  // =========================================================================
  // 3. NAVIGATION - Nav items inside sidebar (DynamicNavigation)
  // =========================================================================
  navigation: {
    container: 'nav-main',
    dashboardLink: 'nav-link-dashboard',
    entityLink: 'nav-link-entity-{slug}',
    section: 'nav-section-{id}',
    sectionLabel: 'nav-section-label-{id}',
    sectionItem: 'nav-section-item-{sectionId}-{itemId}',
  },

  // =========================================================================
  // 4. MOBILE - Components exclusive to mobile layout
  // =========================================================================
  mobile: {
    // Mobile Top Bar
    topbar: {
      container: 'mobile-topbar-header',
      userProfile: 'mobile-topbar-user-profile',
      notifications: 'mobile-topbar-notifications',
      themeToggle: 'mobile-topbar-theme-toggle',
    },

    // Mobile Bottom Navigation
    bottomNav: {
      container: 'mobile-bottomnav-nav',
      item: 'mobile-bottomnav-item-{id}',
    },

    // Mobile More Sheet (bottom sheet)
    moreSheet: {
      container: 'mobile-more-sheet-content',
      item: 'mobile-more-sheet-item-{id}',
      superadminLink: 'mobile-more-sheet-superadmin-link',
      teamSwitcher: 'mobile-more-sheet-team-switcher',
      signoutButton: 'mobile-more-sheet-signout-button',
    },

    // Mobile Quick Create Sheet (bottom sheet)
    quickCreateSheet: {
      container: 'mobile-quick-create-sheet-content',
      item: 'mobile-quick-create-sheet-item-{slug}',
    },
  },
} as const

export type DashboardSelectorsType = typeof DASHBOARD_SELECTORS
