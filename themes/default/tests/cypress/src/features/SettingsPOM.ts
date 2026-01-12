/**
 * SettingsPOM - Page Object Model for Settings Area
 *
 * Handles settings pages navigation and basic visibility:
 * - Profile settings
 * - Team settings
 * - Billing settings (navigation only - use BillingPOM for detailed billing tests)
 * - API Keys settings
 * - Member management
 *
 * Uses selectors from centralized selectors.ts
 *
 * NOTE: For detailed billing tests (upgrade, invoices, payment methods),
 * use BillingPOM from features/BillingPOM.ts instead.
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
      // LAYOUT (7 selectors)
      // ============================================
      layoutMain: cySelector('settings.layout.main'),
      layoutNav: cySelector('settings.layout.nav'),
      layoutBackToDashboard: cySelector('settings.layout.backToDashboard'),
      layoutHeader: cySelector('settings.layout.header'),
      layoutContentArea: cySelector('settings.layout.contentArea'),
      layoutSidebar: cySelector('settings.layout.sidebar'),
      layoutPageContent: cySelector('settings.layout.pageContent'),

      // ============================================
      // SIDEBAR (4 selectors)
      // ============================================
      navContainer: cySelector('settings.sidebar.main'),
      sidebarHeader: cySelector('settings.sidebar.header'),
      sidebarNavItems: cySelector('settings.sidebar.navItems'),
      navItem: (section: string) => cySelector('settings.sidebar.navItem', { section }),

      // ============================================
      // PROFILE (9 selectors)
      // ============================================
      profileContainer: cySelector('settings.profile.container'),
      profileForm: cySelector('settings.profile.form'),
      profileAvatar: cySelector('settings.profile.avatar'),
      profileAvatarUpload: cySelector('settings.profile.avatarUpload'),
      profileFirstName: cySelector('settings.profile.firstName'),
      profileLastName: cySelector('settings.profile.lastName'),
      profileEmail: cySelector('settings.profile.email'),
      profileSubmit: cySelector('settings.profile.submitButton'),
      profileSuccess: cySelector('settings.profile.successMessage'),

      // ============================================
      // PASSWORD (7 selectors)
      // ============================================
      passwordContainer: cySelector('settings.password.container'),
      passwordForm: cySelector('settings.password.form'),
      passwordCurrent: cySelector('settings.password.currentPassword'),
      passwordNew: cySelector('settings.password.newPassword'),
      passwordConfirm: cySelector('settings.password.confirmPassword'),
      passwordSubmit: cySelector('settings.password.submitButton'),
      passwordSuccess: cySelector('settings.password.successMessage'),

      // ============================================
      // TEAM (10 selectors)
      // ============================================
      teamContainer: cySelector('settings.team.container'),
      teamName: cySelector('settings.team.name'),
      teamSlug: cySelector('settings.team.slug'),
      teamDescription: cySelector('settings.team.description'),
      teamAvatar: cySelector('settings.team.avatar'),
      teamAvatarUpload: cySelector('settings.team.avatarUpload'),
      teamSubmit: cySelector('settings.team.submitButton'),
      teamDelete: cySelector('settings.team.deleteButton'),
      teamDeleteDialog: cySelector('settings.team.deleteDialog'),
      teamDeleteConfirm: cySelector('settings.team.deleteConfirm'),

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
      // MEMBERS (12 selectors)
      // ============================================
      membersContainer: cySelector('settings.members.container'),
      membersInvite: cySelector('settings.members.inviteButton'),
      membersInviteDialog: cySelector('settings.members.inviteDialog'),
      membersInviteEmail: cySelector('settings.members.inviteEmail'),
      membersInviteRole: cySelector('settings.members.inviteRole'),
      membersInviteSubmit: cySelector('settings.members.inviteSubmit'),
      memberRow: (id: string) => cySelector('settings.members.memberRow', { id }),
      memberRowGeneric: '[data-cy^="member-row-"]',
      memberRole: (id: string) => cySelector('settings.members.memberRole', { id }),
      memberRemove: (id: string) => cySelector('settings.members.memberRemove', { id }),
      membersPendingInvites: cySelector('settings.members.pendingInvites'),
      membersPendingInvite: (id: string) => cySelector('settings.members.pendingInvite', { id }),
      membersCancelInvite: (id: string) => cySelector('settings.members.cancelInvite', { id }),

      // ============================================
      // BILLING (19 selectors)
      // ============================================
      billingContainer: cySelector('settings.billing.container'),
      billingMain: cySelector('settings.billing.main'),
      billingHeader: cySelector('settings.billing.header'),
      billingCurrentPlan: cySelector('settings.billing.currentPlan'),
      billingUpgrade: cySelector('settings.billing.upgradeButton'),
      billingUpgradePlan: cySelector('settings.billing.upgradePlan'),
      billingCancel: cySelector('settings.billing.cancelButton'),
      billingAddPayment: cySelector('settings.billing.addPayment'),
      billingInvoices: cySelector('settings.billing.invoicesTable'),
      billingInvoicesAlt: cySelector('settings.billing.invoicesTableAlt'),
      billingInvoiceRow: (id: string) => cySelector('settings.billing.invoiceRow', { id }),
      billingInvoicesRow: cySelector('settings.billing.invoicesRow'),
      billingInvoiceDownload: (id: string) => cySelector('settings.billing.invoiceDownload', { id }),
      billingInvoicesLoadMore: cySelector('settings.billing.invoicesLoadMore'),
      billingPaymentMethod: cySelector('settings.billing.paymentMethod'),
      billingPaymentMethodAlt: cySelector('settings.billing.paymentMethodAlt'),
      billingUpdatePayment: cySelector('settings.billing.updatePayment'),
      billingUsage: cySelector('settings.billing.usage'),
      billingUsageDashboard: cySelector('settings.billing.usageDashboard'),

      // ============================================
      // API KEYS (56 selectors)
      // ============================================
      apiKeysPage: cySelector('settings.apiKeys.page'),
      apiKeysTitle: cySelector('settings.apiKeys.title'),
      apiKeysContainer: cySelector('settings.apiKeys.container'),
      apiKeysCreate: cySelector('settings.apiKeys.createButton'),
      apiKeysCreateDialog: cySelector('settings.apiKeys.createDialog'),
      apiKeysList: cySelector('settings.apiKeys.list'),
      apiKeysSkeleton: cySelector('settings.apiKeys.skeleton'),
      apiKeysEmpty: cySelector('settings.apiKeys.empty'),
      apiKeysEmptyCreate: cySelector('settings.apiKeys.emptyCreateButton'),
      apiKeyName: cySelector('settings.apiKeys.keyName'),
      apiKeyScopes: cySelector('settings.apiKeys.keyScopes'),
      apiKeyScopeOption: (scope: string) => cySelector('settings.apiKeys.scopeOption', { scope }),
      apiKeyCreateSubmit: cySelector('settings.apiKeys.createSubmit'),
      apiKeyRow: (id: string) => cySelector('settings.apiKeys.keyRow', { id }),
      apiKeyRowGeneric: '[data-cy^="api-key-row-"]',
      apiKeyNameById: (id: string) => cySelector('settings.apiKeys.keyName_', { id }),
      apiKeyPrefix: (id: string) => cySelector('settings.apiKeys.keyPrefix', { id }),
      apiKeyCopyPrefix: (id: string) => cySelector('settings.apiKeys.copyPrefix', { id }),
      apiKeyStatus: (id: string) => cySelector('settings.apiKeys.keyStatus', { id }),
      apiKeyStatusBadge: (id: string) => cySelector('settings.apiKeys.statusBadge', { id }),
      apiKeyMenuTrigger: (id: string) => cySelector('settings.apiKeys.menuTrigger', { id }),
      apiKeyMenu: (id: string) => cySelector('settings.apiKeys.menu', { id }),
      apiKeyViewDetails: (id: string) => cySelector('settings.apiKeys.viewDetails', { id }),
      apiKeyToggle: (id: string) => cySelector('settings.apiKeys.toggle', { id }),
      apiKeyRevoke: (id: string) => cySelector('settings.apiKeys.revoke', { id }),
      apiKeyScopes: (id: string) => cySelector('settings.apiKeys.scopes', { id }),
      apiKeyScope: (id: string, scope: string) => cySelector('settings.apiKeys.scope', { id, scope }),
      apiKeyStats: (id: string) => cySelector('settings.apiKeys.stats', { id }),
      apiKeyTotalRequests: (id: string) => cySelector('settings.apiKeys.totalRequests', { id }),
      apiKeyLast24h: (id: string) => cySelector('settings.apiKeys.last24h', { id }),
      apiKeyAvgTime: (id: string) => cySelector('settings.apiKeys.avgTime', { id }),
      apiKeyMetadata: (id: string) => cySelector('settings.apiKeys.metadata', { id }),
      apiKeyCreatedAt: (id: string) => cySelector('settings.apiKeys.createdAt', { id }),
      apiKeyLastUsed: (id: string) => cySelector('settings.apiKeys.lastUsed', { id }),
      apiKeyExpiresAt: (id: string) => cySelector('settings.apiKeys.expiresAt', { id }),
      apiKeysDetailsDialog: cySelector('settings.apiKeys.detailsDialog'),
      apiKeysDetailsTitle: cySelector('settings.apiKeys.detailsTitle'),
      apiKeysDetailsLoading: cySelector('settings.apiKeys.detailsLoading'),
      apiKeysDetailsContent: cySelector('settings.apiKeys.detailsContent'),
      apiKeysDetailsBasicInfo: cySelector('settings.apiKeys.detailsBasicInfo'),
      apiKeysDetailsName: cySelector('settings.apiKeys.detailsName'),
      apiKeysDetailsStatus: cySelector('settings.apiKeys.detailsStatus'),
      apiKeysDetailsStats: cySelector('settings.apiKeys.detailsStats'),
      apiKeysDetailsTotalRequests: cySelector('settings.apiKeys.detailsTotalRequests'),
      apiKeysDetailsLast24h: cySelector('settings.apiKeys.detailsLast24h'),
      apiKeysDetailsLast7d: cySelector('settings.apiKeys.detailsLast7d'),
      apiKeysDetailsLast30d: cySelector('settings.apiKeys.detailsLast30d'),
      apiKeysDetailsAvgTime: cySelector('settings.apiKeys.detailsAvgTime'),
      apiKeysDetailsSuccessRate: cySelector('settings.apiKeys.detailsSuccessRate'),
      apiKeyReveal: (id: string) => cySelector('settings.apiKeys.keyReveal', { id }),
      apiKeyRevokeById: (id: string) => cySelector('settings.apiKeys.keyRevoke', { id }),
      apiKeyRevokeDialog: cySelector('settings.apiKeys.revokeDialog'),
      apiKeyRevokeConfirm: cySelector('settings.apiKeys.revokeConfirm'),
      apiKeyNewDisplay: cySelector('settings.apiKeys.newKeyDisplay'),
      apiKeyCopyKey: cySelector('settings.apiKeys.copyKey'),
      apiKeysDialogFooter: cySelector('settings.apiKeys.dialogFooter'),
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to settings home
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
   * Navigate to team settings
   */
  visitTeam() {
    cy.visit('/dashboard/settings/team', { timeout: 60000 })
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
   * Navigate to members settings
   */
  visitMembers() {
    cy.visit('/dashboard/settings/members', { timeout: 60000 })
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
   * Navigate to password settings
   */
  visitPassword() {
    cy.visit('/dashboard/settings/password', { timeout: 60000 })
    return this
  }

  /**
   * Click on a settings nav item
   */
  clickNavItem(section: string) {
    cy.get(this.selectors.navItem(section)).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert settings page is visible
   */
  assertSettingsVisible() {
    cy.url().should('include', '/settings')
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
   * Assert team settings is visible
   */
  assertTeamVisible() {
    cy.get(this.selectors.teamContainer).should('be.visible')
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
   * Assert nav item is visible
   */
  assertNavItemVisible(section: string) {
    cy.get(this.selectors.navItem(section)).should('be.visible')
    return this
  }

  /**
   * Assert nav item is NOT visible (restricted)
   */
  assertNavItemNotVisible(section: string) {
    cy.get(this.selectors.navItem(section)).should('not.exist')
    return this
  }

  /**
   * Assert members container is visible
   */
  assertMembersVisible() {
    cy.get(this.selectors.membersContainer).should('be.visible')
    return this
  }

  /**
   * Assert API keys container is visible
   */
  assertApiKeysVisible() {
    cy.get(this.selectors.apiKeysContainer).should('be.visible')
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for settings page to load
   */
  waitForSettings() {
    cy.url().should('include', '/settings')
    cy.get(this.selectors.navContainer, { timeout: 15000 }).should('be.visible')
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
   * Wait for team page to load
   */
  waitForTeam() {
    cy.url().should('include', '/settings/team')
    cy.get(this.selectors.teamContainer, { timeout: 15000 }).should('be.visible')
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
