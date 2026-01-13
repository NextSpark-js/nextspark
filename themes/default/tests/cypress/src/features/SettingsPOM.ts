/**
 * SettingsPOM - Page Object Model for Settings Area
 *
 * Handles navigation and interactions for all 9 settings sections:
 * 1. Sidebar       - Navigation and layout structure
 * 2. Overview      - Settings home with quick links
 * 3. Profile       - User profile editing
 * 4. Password      - Password change
 * 5. Security      - 2FA, login alerts, active sessions
 * 6. Notifications - Notification preferences
 * 7. API Keys      - API key management
 * 8. Billing       - Plans, invoices, payment methods
 * 9. Teams         - Team config, members, team switching
 *
 * Uses selectors from centralized selectors.ts via cySelector()
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class SettingsPOM extends BasePOM {
  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): SettingsPOM {
    return new SettingsPOM()
  }

  // ============================================
  // SELECTORS
  // ============================================

  get selectors() {
    return {
      // ============================================
      // 1. SIDEBAR (11 selectors)
      // ============================================
      sidebarContainer: cySelector('settings.sidebar.container'),
      sidebarHeader: cySelector('settings.sidebar.header'),
      sidebarBackButton: cySelector('settings.sidebar.backButton'),
      sidebarNavContainer: cySelector('settings.sidebar.nav.container'),
      sidebarNavItems: cySelector('settings.sidebar.nav.items'),
      sidebarNavItem: (section: string) => cySelector('settings.sidebar.nav.item', { section }),
      // Layout elements (absorbed from layout.*)
      layoutMain: cySelector('settings.sidebar.layout.main'),
      layoutHeader: cySelector('settings.sidebar.layout.header'),
      layoutContentArea: cySelector('settings.sidebar.layout.contentArea'),
      layoutPageContent: cySelector('settings.sidebar.layout.pageContent'),

      // ============================================
      // 2. OVERVIEW (2 selectors)
      // ============================================
      overviewContainer: cySelector('settings.overview.container'),
      overviewCard: (key: string) => cySelector('settings.overview.card', { key }),

      // ============================================
      // 3. PROFILE (11 selectors)
      // ============================================
      profileContainer: cySelector('settings.profile.container'),
      profileForm: cySelector('settings.profile.form'),
      profileAvatarContainer: cySelector('settings.profile.avatar.container'),
      profileAvatarUpload: cySelector('settings.profile.avatar.upload'),
      profileFirstName: cySelector('settings.profile.firstName'),
      profileLastName: cySelector('settings.profile.lastName'),
      profileEmail: cySelector('settings.profile.email'),
      profileCountry: cySelector('settings.profile.country'),
      profileTimezone: cySelector('settings.profile.timezone'),
      profileLocale: cySelector('settings.profile.locale'),
      profileSubmit: cySelector('settings.profile.submitButton'),
      profileSuccess: cySelector('settings.profile.successMessage'),
      profileDeleteAccountButton: cySelector('settings.profile.deleteAccount.button'),
      profileDeleteAccountDialog: cySelector('settings.profile.deleteAccount.dialog'),
      profileDeleteAccountConfirm: cySelector('settings.profile.deleteAccount.confirm'),

      // ============================================
      // 4. PASSWORD (8 selectors)
      // ============================================
      passwordContainer: cySelector('settings.password.container'),
      passwordForm: cySelector('settings.password.form'),
      passwordCurrent: cySelector('settings.password.currentPassword'),
      passwordNew: cySelector('settings.password.newPassword'),
      passwordConfirm: cySelector('settings.password.confirmPassword'),
      passwordRevokeOtherSessions: cySelector('settings.password.revokeOtherSessions'),
      passwordSubmit: cySelector('settings.password.submitButton'),
      passwordSuccess: cySelector('settings.password.successMessage'),

      // ============================================
      // 5. SECURITY (25 selectors)
      // ============================================
      securityContainer: cySelector('settings.security.container'),
      securityHeader: cySelector('settings.security.header'),
      // Two-Factor Authentication
      security2faContainer: cySelector('settings.security.twoFactor.container'),
      security2faToggle: cySelector('settings.security.twoFactor.toggle'),
      security2faStatus: cySelector('settings.security.twoFactor.status'),
      security2faSetupButton: cySelector('settings.security.twoFactor.setupButton'),
      security2faDisableButton: cySelector('settings.security.twoFactor.disableButton'),
      security2faDialogContainer: cySelector('settings.security.twoFactor.setupDialog.container'),
      security2faQrCode: cySelector('settings.security.twoFactor.setupDialog.qrCode'),
      security2faSecretKey: cySelector('settings.security.twoFactor.setupDialog.secretKey'),
      security2faVerifyInput: cySelector('settings.security.twoFactor.setupDialog.verifyInput'),
      security2faConfirmButton: cySelector('settings.security.twoFactor.setupDialog.confirmButton'),
      // Login Alerts
      securityLoginAlertsToggle: cySelector('settings.security.loginAlerts.toggle'),
      securityLoginAlertsStatus: cySelector('settings.security.loginAlerts.status'),
      // Active Sessions
      securitySessionsContainer: cySelector('settings.security.sessions.container'),
      securitySessionsList: cySelector('settings.security.sessions.list'),
      securitySessionRow: (id: string) => cySelector('settings.security.sessions.row.container', { id }),
      securitySessionDevice: (id: string) => cySelector('settings.security.sessions.row.device', { id }),
      securitySessionBrowser: (id: string) => cySelector('settings.security.sessions.row.browser', { id }),
      securitySessionLocation: (id: string) => cySelector('settings.security.sessions.row.location', { id }),
      securitySessionLastActive: (id: string) => cySelector('settings.security.sessions.row.lastActive', { id }),
      securitySessionCurrentBadge: (id: string) => cySelector('settings.security.sessions.row.currentBadge', { id }),
      securitySessionRevokeButton: (id: string) => cySelector('settings.security.sessions.row.revokeButton', { id }),
      securitySessionsRevokeAll: cySelector('settings.security.sessions.revokeAllButton'),
      securitySuccess: cySelector('settings.security.successMessage'),

      // ============================================
      // TEAM INLINE EDIT (14 selectors)
      // ============================================
      teamEditNameValue: cySelector('teams.edit.name.value'),
      teamEditNameEditIcon: cySelector('teams.edit.name.editIcon'),
      teamEditNameInput: cySelector('teams.edit.name.input'),
      teamEditNameSaveIcon: cySelector('teams.edit.name.saveIcon'),
      teamEditNameCancelIcon: cySelector('teams.edit.name.cancelIcon'),
      teamEditNameError: cySelector('teams.edit.name.error'),
      teamEditNameSuccess: cySelector('teams.edit.name.success'),
      teamEditDescriptionValue: cySelector('teams.edit.description.value'),
      teamEditDescriptionEditIcon: cySelector('teams.edit.description.editIcon'),
      teamEditDescriptionTextarea: cySelector('teams.edit.description.textarea'),
      teamEditDescriptionSaveIcon: cySelector('teams.edit.description.saveIcon'),
      teamEditDescriptionCancelIcon: cySelector('teams.edit.description.cancelIcon'),
      teamEditDescriptionError: cySelector('teams.edit.description.error'),
      teamEditDescriptionSuccess: cySelector('teams.edit.description.success'),

      // ============================================
      // 6. NOTIFICATIONS (7 selectors)
      // ============================================
      notificationsContainer: cySelector('settings.notifications.container'),
      notificationsMasterToggle: cySelector('settings.notifications.masterToggle'),
      notificationsCategoryContainer: (category: string) => cySelector('settings.notifications.category.container', { category }),
      notificationsCategoryEmail: (category: string) => cySelector('settings.notifications.category.emailToggle', { category }),
      notificationsCategoryPush: (category: string) => cySelector('settings.notifications.category.pushToggle', { category }),
      notificationsSubmit: cySelector('settings.notifications.submitButton'),
      notificationsSuccess: cySelector('settings.notifications.successMessage'),

      // ============================================
      // 7. API KEYS (40 selectors)
      // ============================================
      apiKeysContainer: cySelector('settings.apiKeys.container'),
      apiKeysHeader: cySelector('settings.apiKeys.header'),
      apiKeysCreateButton: cySelector('settings.apiKeys.createButton'),
      // List
      apiKeysListContainer: cySelector('settings.apiKeys.list.container'),
      apiKeysListEmpty: cySelector('settings.apiKeys.list.empty'),
      apiKeysListSkeleton: cySelector('settings.apiKeys.list.skeleton'),
      // Row (parametric)
      apiKeyRowContainer: (id: string) => cySelector('settings.apiKeys.row.container', { id }),
      apiKeyRowGeneric: '[data-cy^="api-key-row-"]',
      apiKeyRowName: (id: string) => cySelector('settings.apiKeys.row.name', { id }),
      apiKeyRowPrefix: (id: string) => cySelector('settings.apiKeys.row.prefix', { id }),
      apiKeyRowCopyPrefix: (id: string) => cySelector('settings.apiKeys.row.copyPrefix', { id }),
      apiKeyRowStatus: (id: string) => cySelector('settings.apiKeys.row.status', { id }),
      apiKeyRowScopes: (id: string) => cySelector('settings.apiKeys.row.scopes', { id }),
      apiKeyRowScope: (id: string, scope: string) => cySelector('settings.apiKeys.row.scope', { id, scope }),
      // Row Stats
      apiKeyRowStatsContainer: (id: string) => cySelector('settings.apiKeys.row.stats.container', { id }),
      apiKeyRowStatsTotalRequests: (id: string) => cySelector('settings.apiKeys.row.stats.totalRequests', { id }),
      apiKeyRowStatsLast24h: (id: string) => cySelector('settings.apiKeys.row.stats.last24h', { id }),
      apiKeyRowStatsAvgTime: (id: string) => cySelector('settings.apiKeys.row.stats.avgTime', { id }),
      // Row Metadata
      apiKeyRowMetadataContainer: (id: string) => cySelector('settings.apiKeys.row.metadata.container', { id }),
      apiKeyRowMetadataCreatedAt: (id: string) => cySelector('settings.apiKeys.row.metadata.createdAt', { id }),
      apiKeyRowMetadataLastUsed: (id: string) => cySelector('settings.apiKeys.row.metadata.lastUsed', { id }),
      apiKeyRowMetadataExpiresAt: (id: string) => cySelector('settings.apiKeys.row.metadata.expiresAt', { id }),
      // Row Menu
      apiKeyRowMenuTrigger: (id: string) => cySelector('settings.apiKeys.row.menu.trigger', { id }),
      apiKeyRowMenuContent: (id: string) => cySelector('settings.apiKeys.row.menu.content', { id }),
      apiKeyRowMenuViewDetails: (id: string) => cySelector('settings.apiKeys.row.menu.viewDetails', { id }),
      apiKeyRowMenuToggle: (id: string) => cySelector('settings.apiKeys.row.menu.toggle', { id }),
      apiKeyRowMenuRevoke: (id: string) => cySelector('settings.apiKeys.row.menu.revoke', { id }),
      // Create Dialog
      apiKeysCreateDialogContainer: cySelector('settings.apiKeys.createDialog.container'),
      apiKeysCreateDialogNameInput: cySelector('settings.apiKeys.createDialog.nameInput'),
      apiKeysCreateDialogScopesContainer: cySelector('settings.apiKeys.createDialog.scopesContainer'),
      apiKeysCreateDialogScopeOption: (scope: string) => cySelector('settings.apiKeys.createDialog.scopeOption', { scope }),
      apiKeysCreateDialogSubmit: cySelector('settings.apiKeys.createDialog.submitButton'),
      apiKeysCreateDialogFooter: cySelector('settings.apiKeys.createDialog.footer'),
      // Details Dialog
      apiKeysDetailsDialogContainer: cySelector('settings.apiKeys.detailsDialog.container'),
      apiKeysDetailsDialogTitle: cySelector('settings.apiKeys.detailsDialog.title'),
      apiKeysDetailsDialogLoading: cySelector('settings.apiKeys.detailsDialog.loading'),
      apiKeysDetailsDialogContent: cySelector('settings.apiKeys.detailsDialog.content'),
      apiKeysDetailsDialogBasicInfo: cySelector('settings.apiKeys.detailsDialog.basicInfo'),
      apiKeysDetailsDialogStats: cySelector('settings.apiKeys.detailsDialog.stats'),
      // New Key Display
      apiKeysNewKeyDisplayContainer: cySelector('settings.apiKeys.newKeyDisplay.container'),
      apiKeysNewKeyDisplayCopyButton: cySelector('settings.apiKeys.newKeyDisplay.copyButton'),
      // Revoke Dialog
      apiKeysRevokeDialogContainer: cySelector('settings.apiKeys.revokeDialog.container'),
      apiKeysRevokeDialogConfirm: cySelector('settings.apiKeys.revokeDialog.confirmButton'),

      // ============================================
      // 8. BILLING (15 selectors)
      // ============================================
      billingContainer: cySelector('settings.billing.container'),
      billingHeader: cySelector('settings.billing.header'),
      // Current Plan
      billingCurrentPlanContainer: cySelector('settings.billing.currentPlan.container'),
      billingCurrentPlanName: cySelector('settings.billing.currentPlan.name'),
      billingCurrentPlanPrice: cySelector('settings.billing.currentPlan.price'),
      billingCurrentPlanFeatures: cySelector('settings.billing.currentPlan.features'),
      billingCurrentPlanUpgrade: cySelector('settings.billing.currentPlan.upgradeButton'),
      billingCurrentPlanCancel: cySelector('settings.billing.currentPlan.cancelButton'),
      // Invoices
      billingInvoicesContainer: cySelector('settings.billing.invoices.container'),
      billingInvoicesTable: cySelector('settings.billing.invoices.table'),
      billingInvoicesRow: (id: string) => cySelector('settings.billing.invoices.row', { id }),
      billingInvoicesStatusBadge: (id: string) => cySelector('settings.billing.invoices.statusBadge', { id }),
      billingInvoicesDownload: (id: string) => cySelector('settings.billing.invoices.downloadButton', { id }),
      billingInvoicesLoadMore: cySelector('settings.billing.invoices.loadMoreButton'),
      // Payment Method
      billingPaymentMethodContainer: cySelector('settings.billing.paymentMethod.container'),
      billingPaymentMethodCard: cySelector('settings.billing.paymentMethod.card'),
      billingPaymentMethodAdd: cySelector('settings.billing.paymentMethod.addButton'),
      billingPaymentMethodUpdate: cySelector('settings.billing.paymentMethod.updateButton'),
      // Usage
      billingUsageContainer: cySelector('settings.billing.usage.container'),
      billingUsageDashboard: cySelector('settings.billing.usage.dashboard'),
      billingUsageMetric: (slug: string) => cySelector('settings.billing.usage.metric', { slug }),
      // Pricing
      billingPricingTable: cySelector('settings.billing.pricing.table'),
      billingPricingPlan: (slug: string) => cySelector('settings.billing.pricing.plan', { slug }),
      billingPricingSelect: (slug: string) => cySelector('settings.billing.pricing.selectButton', { slug }),
      // Features
      billingFeaturesPlaceholder: (feature: string) => cySelector('settings.billing.features.placeholder', { feature }),
      billingFeaturesContent: (feature: string) => cySelector('settings.billing.features.content', { feature }),
      billingFeaturesUpgrade: cySelector('settings.billing.features.upgradeButton'),

      // ============================================
      // 9. TEAMS (25 selectors)
      // ============================================
      teamsContainer: cySelector('settings.teams.container'),
      teamsHeader: cySelector('settings.teams.header'),
      teamsLoading: cySelector('settings.teams.loading'),
      teamsSingleUserMode: cySelector('settings.teams.singleUserMode'),
      // Current Team (ex team.*)
      teamsCurrentContainer: cySelector('settings.teams.current.container'),
      teamsCurrentForm: cySelector('settings.teams.current.form'),
      teamsCurrentName: cySelector('settings.teams.current.name'),
      teamsCurrentSlug: cySelector('settings.teams.current.slug'),
      teamsCurrentDescription: cySelector('settings.teams.current.description'),
      teamsCurrentAvatarContainer: cySelector('settings.teams.current.avatar.container'),
      teamsCurrentAvatarUpload: cySelector('settings.teams.current.avatar.upload'),
      teamsCurrentSubmit: cySelector('settings.teams.current.submitButton'),
      teamsCurrentDelete: cySelector('settings.teams.current.deleteButton'),
      teamsCurrentDeleteDialogContainer: cySelector('settings.teams.current.deleteDialog.container'),
      teamsCurrentDeleteDialogConfirm: cySelector('settings.teams.current.deleteDialog.confirmButton'),
      // Members (ex members.*)
      teamsMembersContainer: cySelector('settings.teams.members.container'),
      teamsMembersList: cySelector('settings.teams.members.list'),
      teamsMembersRowContainer: (id: string) => cySelector('settings.teams.members.row.container', { id }),
      teamsMembersRowGeneric: '[data-cy^="member-row-"]',
      teamsMembersRowAvatar: (id: string) => cySelector('settings.teams.members.row.avatar', { id }),
      teamsMembersRowName: (id: string) => cySelector('settings.teams.members.row.name', { id }),
      teamsMembersRowEmail: (id: string) => cySelector('settings.teams.members.row.email', { id }),
      teamsMembersRowRole: (id: string) => cySelector('settings.teams.members.row.role', { id }),
      teamsMembersRowRemove: (id: string) => cySelector('settings.teams.members.row.removeButton', { id }),
      teamsMembersInviteButton: cySelector('settings.teams.members.inviteButton'),
      teamsMembersInviteDialogContainer: cySelector('settings.teams.members.inviteDialog.container'),
      teamsMembersInviteDialogEmail: cySelector('settings.teams.members.inviteDialog.emailInput'),
      teamsMembersInviteDialogRole: cySelector('settings.teams.members.inviteDialog.roleSelect'),
      teamsMembersInviteDialogSubmit: cySelector('settings.teams.members.inviteDialog.submitButton'),
      teamsMembersPendingContainer: cySelector('settings.teams.members.pendingInvites.container'),
      teamsMembersPendingRow: (id: string) => cySelector('settings.teams.members.pendingInvites.row', { id }),
      teamsMembersPendingCancel: (id: string) => cySelector('settings.teams.members.pendingInvites.cancelButton', { id }),
      // Teams List (ex teams.*)
      teamsListContainer: cySelector('settings.teams.list.container'),
      teamsListTeamCard: (id: string) => cySelector('settings.teams.list.teamCard', { id }),
      teamsListCreateButton: cySelector('settings.teams.list.createButton'),
      teamsListDetails: (id: string) => cySelector('settings.teams.list.details', { id }),
    }
  }

  // ============================================
  // NAVIGATION (9 methods - 1 per section)
  // ============================================

  /**
   * Navigate to settings overview (home)
   */
  visitSettings() {
    cy.visit('/dashboard/settings', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to profile settings
   */
  visitProfile() {
    cy.visit('/dashboard/settings/profile', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to password settings
   */
  visitPassword() {
    cy.visit('/dashboard/settings/password', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to security settings (2FA, sessions)
   */
  visitSecurity() {
    cy.visit('/dashboard/settings/security', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to notifications settings
   */
  visitNotifications() {
    cy.visit('/dashboard/settings/notifications', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to API keys settings
   */
  visitApiKeys() {
    cy.visit('/dashboard/settings/api-keys', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to billing settings
   */
  visitBilling() {
    cy.visit('/dashboard/settings/billing', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to teams settings
   */
  visitTeams() {
    cy.visit('/dashboard/settings/teams', { timeout: 60000 })
    return this
  }

  /**
   * Click on a settings nav item
   */
  clickNavItem(section: string) {
    cy.get(this.selectors.sidebarNavItem(section)).click()
    return this
  }

  // ============================================
  // ASSERTIONS (12 methods)
  // ============================================

  /**
   * Assert settings page is visible (any settings page)
   */
  assertSettingsVisible() {
    cy.url().should('include', '/settings')
    return this
  }

  /**
   * Assert overview page is visible
   */
  assertOverviewVisible() {
    cy.get(this.selectors.overviewContainer).should('be.visible')
    return this
  }

  /**
   * Assert profile settings is visible
   */
  assertProfileVisible() {
    cy.get(this.selectors.profileContainer).should('be.visible')
    return this
  }

  /**
   * Assert password settings is visible
   */
  assertPasswordVisible() {
    cy.get(this.selectors.passwordContainer).should('be.visible')
    return this
  }

  /**
   * Assert security settings is visible
   */
  assertSecurityVisible() {
    cy.get(this.selectors.securityContainer).should('be.visible')
    return this
  }

  /**
   * Assert notifications settings is visible
   */
  assertNotificationsVisible() {
    cy.get(this.selectors.notificationsContainer).should('be.visible')
    return this
  }

  /**
   * Assert API keys settings is visible
   */
  assertApiKeysVisible() {
    cy.get(this.selectors.apiKeysContainer).should('be.visible')
    return this
  }

  /**
   * Assert billing settings is visible
   */
  assertBillingVisible() {
    cy.get(this.selectors.billingContainer).should('be.visible')
    return this
  }

  /**
   * Assert teams settings is visible
   */
  assertTeamsVisible() {
    cy.get(this.selectors.teamsContainer).should('be.visible')
    return this
  }

  /**
   * Assert nav item is visible
   */
  assertNavItemVisible(section: string) {
    cy.get(this.selectors.sidebarNavItem(section)).should('be.visible')
    return this
  }

  /**
   * Assert nav item is NOT visible (restricted)
   */
  assertNavItemNotVisible(section: string) {
    cy.get(this.selectors.sidebarNavItem(section)).should('not.exist')
    return this
  }

  // ============================================
  // WAITS (9 methods - 1 per section)
  // ============================================

  /**
   * Wait for settings page to load (sidebar visible)
   */
  waitForSettings() {
    cy.url().should('include', '/settings')
    cy.get(this.selectors.sidebarContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for overview page to load
   */
  waitForOverview() {
    cy.url().should('match', /\/settings\/?$/)
    cy.get(this.selectors.overviewContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for profile page to load
   */
  waitForProfile() {
    cy.url().should('include', '/settings/profile')
    cy.get(this.selectors.profileContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for password page to load
   */
  waitForPassword() {
    cy.url().should('include', '/settings/password')
    cy.get(this.selectors.passwordContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for security page to load
   */
  waitForSecurity() {
    cy.url().should('include', '/settings/security')
    cy.get(this.selectors.securityContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for notifications page to load
   */
  waitForNotifications() {
    cy.url().should('include', '/settings/notifications')
    cy.get(this.selectors.notificationsContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for API keys page to load
   */
  waitForApiKeys() {
    cy.url().should('include', '/settings/api-keys')
    cy.get(this.selectors.apiKeysContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for billing page to load
   */
  waitForBilling() {
    cy.url().should('include', '/settings/billing')
    cy.get(this.selectors.billingContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for teams page to load
   */
  waitForTeams() {
    cy.url().should('include', '/settings/teams')
    cy.get(this.selectors.teamsContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // TEAM INLINE EDIT METHODS
  // ============================================

  /**
   * Click edit icon for team name
   */
  editTeamName() {
    cy.get(this.selectors.teamEditNameEditIcon).click()
    return this
  }

  /**
   * Type into team name input field
   */
  typeTeamName(name: string) {
    cy.get(this.selectors.teamEditNameInput).clear().type(name)
    return this
  }

  /**
   * Click save icon for team name
   */
  saveTeamName() {
    cy.get(this.selectors.teamEditNameSaveIcon).click()
    return this
  }

  /**
   * Click cancel icon for team name
   */
  cancelTeamName() {
    cy.get(this.selectors.teamEditNameCancelIcon).click()
    return this
  }

  /**
   * Get the current team name text value
   */
  getTeamNameText() {
    return cy.get(this.selectors.teamEditNameValue).invoke('text')
  }

  /**
   * Click edit icon for team description
   */
  editTeamDescription() {
    cy.get(this.selectors.teamEditDescriptionEditIcon).click()
    return this
  }

  /**
   * Type into team description textarea field
   */
  typeTeamDescription(description: string) {
    cy.get(this.selectors.teamEditDescriptionTextarea).clear().type(description)
    return this
  }

  /**
   * Click save icon for team description
   */
  saveTeamDescription() {
    cy.get(this.selectors.teamEditDescriptionSaveIcon).click()
    return this
  }

  /**
   * Click cancel icon for team description
   */
  cancelTeamDescription() {
    cy.get(this.selectors.teamEditDescriptionCancelIcon).click()
    return this
  }

  /**
   * Get the current team description text value
   */
  getTeamDescriptionText() {
    return cy.get(this.selectors.teamEditDescriptionValue).invoke('text')
  }

  /**
   * Assert team name edit button is visible (owner only)
   */
  assertTeamNameEditable() {
    cy.get(this.selectors.teamEditNameEditIcon).should('be.visible')
    return this
  }

  /**
   * Assert team name edit button is NOT visible (non-owner)
   */
  assertTeamNameNotEditable() {
    cy.get(this.selectors.teamEditNameEditIcon).should('not.exist')
    return this
  }

  /**
   * Assert team description edit button is visible (owner only)
   */
  assertTeamDescriptionEditable() {
    cy.get(this.selectors.teamEditDescriptionEditIcon).should('be.visible')
    return this
  }

  /**
   * Assert team description edit button is NOT visible (non-owner)
   */
  assertTeamDescriptionNotEditable() {
    cy.get(this.selectors.teamEditDescriptionEditIcon).should('not.exist')
    return this
  }

  /**
   * Edit and save team name (complete flow)
   */
  editAndSaveTeamName(newName: string) {
    this.editTeamName()
    this.typeTeamName(newName)
    this.saveTeamName()
    return this
  }

  /**
   * Edit and save team description (complete flow)
   */
  editAndSaveTeamDescription(newDescription: string) {
    this.editTeamDescription()
    this.typeTeamDescription(newDescription)
    this.saveTeamDescription()
    return this
  }

  /**
   * Assert team name error message is visible
   */
  assertTeamNameError() {
    cy.get(this.selectors.teamEditNameError).should('be.visible')
    return this
  }

  /**
   * Assert team name success message is visible
   */
  assertTeamNameSuccess() {
    cy.get(this.selectors.teamEditNameSuccess).should('be.visible')
    return this
  }

  /**
   * Assert team description error message is visible
   */
  assertTeamDescriptionError() {
    cy.get(this.selectors.teamEditDescriptionError).should('be.visible')
    return this
  }

  /**
   * Assert team description success message is visible
   */
  assertTeamDescriptionSuccess() {
    cy.get(this.selectors.teamEditDescriptionSuccess).should('be.visible')
    return this
  }
}

export default SettingsPOM
