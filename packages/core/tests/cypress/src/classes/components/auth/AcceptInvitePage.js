/**
 * AcceptInvitePage - Page Object Model Class
 *
 * POM for the team invitation acceptance page.
 */
export class AcceptInvitePage {
  static selectors = {
    container: '[data-cy="accept-invite-container"]',
    loading: '[data-cy="accept-invite-loading"]',
    info: '[data-cy="accept-invite-info"]',
    inviterName: '[data-cy="accept-invite-inviter"]',
    teamName: '[data-cy="accept-invite-team-name"]',
    role: '[data-cy="accept-invite-role"]',
    requiresAuth: '[data-cy="accept-invite-requires-auth"]',
    valid: '[data-cy="accept-invite-valid"]',
    accepting: '[data-cy="accept-invite-accepting"]',
    signinButton: '[data-cy="accept-invite-signin"]',
    signupButton: '[data-cy="accept-invite-signup"]',
    acceptButton: '[data-cy="accept-invite-accept"]',
    successAlert: '[data-cy="accept-invite-success"]',
    alreadyMemberAlert: '[data-cy="accept-invite-already-member"]',
    emailMismatchAlert: '[data-cy="accept-invite-email-mismatch"]',
    notFoundAlert: '[data-cy="accept-invite-not-found"]',
    expiredAlert: '[data-cy="accept-invite-expired"]',
    errorAlert: '[data-cy="accept-invite-error"]',
  }

  /**
   * Visit the accept invite page with a token
   * @param {string} token - Invitation token
   */
  visit(token) {
    cy.visit(`/accept-invite/${token}`)
    return this
  }

  /**
   * Validate loading state is visible
   */
  validateLoading() {
    cy.get(AcceptInvitePage.selectors.loading).should('be.visible')
    return this
  }

  /**
   * Wait for loading to complete
   */
  waitForLoad() {
    cy.get(AcceptInvitePage.selectors.loading).should('not.exist')
    return this
  }

  /**
   * Validate invitation info is visible
   */
  validateInvitationInfo() {
    cy.get(AcceptInvitePage.selectors.info).should('be.visible')
    return this
  }

  /**
   * Validate team name
   * @param {string} name - Expected team name
   */
  validateTeamName(name) {
    cy.get(AcceptInvitePage.selectors.teamName).should('contain', name)
    return this
  }

  /**
   * Validate inviter name
   * @param {string} name - Expected inviter name
   */
  validateInviter(name) {
    cy.get(AcceptInvitePage.selectors.inviterName).should('contain', name)
    return this
  }

  /**
   * Validate role
   * @param {string} role - Expected role
   */
  validateRole(role) {
    cy.get(AcceptInvitePage.selectors.role).should('contain', role)
    return this
  }

  /**
   * Validate requires authentication state
   */
  validateRequiresAuth() {
    cy.get(AcceptInvitePage.selectors.requiresAuth).should('be.visible')
    return this
  }

  /**
   * Validate valid (ready to accept) state
   */
  validateValid() {
    cy.get(AcceptInvitePage.selectors.valid).should('be.visible')
    return this
  }

  /**
   * Validate accepting state
   */
  validateAccepting() {
    cy.get(AcceptInvitePage.selectors.accepting).should('be.visible')
    return this
  }

  /**
   * Click sign in button
   */
  clickSignIn() {
    cy.get(AcceptInvitePage.selectors.signinButton).click()
    return this
  }

  /**
   * Click sign up button
   */
  clickSignUp() {
    cy.get(AcceptInvitePage.selectors.signupButton).click()
    return this
  }

  /**
   * Click accept button
   */
  clickAccept() {
    cy.get(AcceptInvitePage.selectors.acceptButton).click()
    return this
  }

  /**
   * Validate success state
   */
  validateSuccess() {
    cy.get(AcceptInvitePage.selectors.successAlert).should('be.visible')
    return this
  }

  /**
   * Validate already member state
   */
  validateAlreadyMember() {
    cy.get(AcceptInvitePage.selectors.alreadyMemberAlert).should('be.visible')
    return this
  }

  /**
   * Validate email mismatch state
   */
  validateEmailMismatch() {
    cy.get(AcceptInvitePage.selectors.emailMismatchAlert).should('be.visible')
    return this
  }

  /**
   * Validate not found state
   */
  validateNotFound() {
    cy.get(AcceptInvitePage.selectors.notFoundAlert).should('be.visible')
    return this
  }

  /**
   * Validate expired state
   */
  validateExpired() {
    cy.get(AcceptInvitePage.selectors.expiredAlert).should('be.visible')
    return this
  }

  /**
   * Validate generic error state
   */
  validateError() {
    cy.get(AcceptInvitePage.selectors.errorAlert).should('be.visible')
    return this
  }

  /**
   * Accept invitation and expect success
   * @param {string} token - Invitation token
   */
  acceptInvitationSuccess(token) {
    this.visit(token)
    this.waitForLoad()
    this.validateSuccess()
    return this
  }

  /**
   * Verify invitation requires authentication
   * @param {string} token - Invitation token
   */
  verifyRequiresAuth(token) {
    this.visit(token)
    this.waitForLoad()
    this.validateRequiresAuth()
    return this
  }
}
