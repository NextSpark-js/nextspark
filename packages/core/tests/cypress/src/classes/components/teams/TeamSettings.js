/**
 * TeamSettings - Page Object Model Class
 *
 * POM for the team settings page.
 */
export class TeamSettings {
  static selectors = {
    page: '[data-cy="teams-settings-page"]',
    teamName: '[data-cy="teams-name"]',
    teamSlug: '[data-cy="teams-slug"]',
    saveButton: '[data-cy="teams-save"]',
    deleteButton: '[data-cy="teams-delete"]',
    membersList: '[data-cy="teams-members-list"]',
    inviteButton: '[data-cy="teams-invite-button"]',
    pendingInvitations: '[data-cy="teams-pending-invitations"]',
    memberRow: '[data-cy^="teams-member-"]',
    memberRole: '[data-cy^="teams-member-role-"]',
    memberRemove: '[data-cy^="teams-member-remove-"]',
  }

  /**
   * Validate settings page is visible
   */
  validatePageVisible() {
    cy.get(TeamSettings.selectors.page).should('be.visible')
    return this
  }

  /**
   * Update team name
   * @param {string} name - New team name
   */
  updateTeamName(name) {
    cy.get(TeamSettings.selectors.teamName).clear().type(name)
    return this
  }

  /**
   * Update team slug
   * @param {string} slug - New team slug
   */
  updateTeamSlug(slug) {
    cy.get(TeamSettings.selectors.teamSlug).clear().type(slug)
    return this
  }

  /**
   * Save team settings
   */
  save() {
    cy.get(TeamSettings.selectors.saveButton).click()
    return this
  }

  /**
   * Delete team
   */
  deleteTeam() {
    cy.get(TeamSettings.selectors.deleteButton).click()
    return this
  }

  /**
   * Open invite member dialog
   */
  openInviteDialog() {
    cy.get(TeamSettings.selectors.inviteButton).click()
    return this
  }

  /**
   * Validate member is visible in list
   * @param {string} email - Member email
   */
  validateMemberVisible(email) {
    cy.get(TeamSettings.selectors.membersList).should('contain', email)
    return this
  }

  /**
   * Validate member count
   * @param {number} count - Expected member count
   */
  validateMemberCount(count) {
    cy.get(TeamSettings.selectors.memberRow).should('have.length', count)
    return this
  }

  /**
   * Change member role
   * @param {string} memberId - Member ID
   * @param {string} newRole - New role
   */
  changeMemberRole(memberId, newRole) {
    cy.get(`[data-cy="teams-member-role-${memberId}"]`).click()
    cy.get(`[data-cy="teams-role-option-${newRole}"]`).click()
    return this
  }

  /**
   * Remove member
   * @param {string} memberId - Member ID
   */
  removeMember(memberId) {
    cy.get(`[data-cy="teams-member-remove-${memberId}"]`).click()
    return this
  }

  /**
   * Validate pending invitations visible
   */
  validatePendingInvitationsVisible() {
    cy.get(TeamSettings.selectors.pendingInvitations).should('be.visible')
    return this
  }

  /**
   * Get team name value
   */
  getTeamName() {
    return cy.get(TeamSettings.selectors.teamName).invoke('val')
  }

  /**
   * Get team slug value
   */
  getTeamSlug() {
    return cy.get(TeamSettings.selectors.teamSlug).invoke('val')
  }
}
