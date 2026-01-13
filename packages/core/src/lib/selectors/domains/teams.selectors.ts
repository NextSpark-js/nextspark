/**
 * Teams Selectors
 *
 * Selectors for team management:
 * - Team switcher
 * - Team creation
 * - Team members
 * - Invitations
 */

export const TEAMS_SELECTORS = {
  switcher: {
    compact: 'team-switcher-compact',
    full: 'team-switcher',
    dropdown: 'team-switcher-dropdown',
    option: 'team-option-{slug}',
    manageLink: 'manage-teams-link',
    createButton: 'create-team-button',
  },
  switchModal: {
    container: 'team-switch-modal',
  },
  create: {
    dialog: 'create-team-dialog',
    button: 'create-team-button',
    nameInput: 'team-name-input',
    slugInput: 'team-slug-input',
    descriptionInput: 'team-description-input',
    cancel: 'cancel-create-team',
    submit: 'submit-create-team',
  },
  members: {
    section: 'team-members-section',
    row: 'member-row-{id}',
    actions: 'member-actions-{id}',
    makeRole: 'make-{role}-action',
    remove: 'remove-member-action',
  },
  invite: {
    button: 'invite-member-button',
    buttonDisabled: 'invite-member-button-disabled',
    dialog: 'invite-member-dialog',
    emailInput: 'member-email-input',
    roleSelect: 'member-role-select',
    roleOption: 'role-option-{role}',
    cancel: 'cancel-invite-member',
    submit: 'submit-invite-member',
  },
  invitations: {
    row: 'invitation-row-{id}',
    cancel: 'cancel-invitation-{id}',
  },
  /**
   * Inline editing for team name and description
   *
   * Note on selector structure: The name and description fields have separate
   * selector definitions rather than using a dynamic pattern. This is an intentional
   * design decision because:
   * 1. There are only 2 fields (name and description), making duplication minimal
   * 2. Each field has different input types (Input vs Textarea) with distinct selectors
   * 3. Explicit definitions provide better clarity and type safety
   * 4. The small duplication cost is outweighed by improved readability
   *
   * Decision documented in PR #1 code review (Issue #9).
   */
  edit: {
    // Name field - inline (v1.1)
    name: {
      value: 'team-edit-name-value',
      editIcon: 'team-edit-name-edit-icon',
      input: 'team-edit-name-input',
      saveIcon: 'team-edit-name-save-icon',
      cancelIcon: 'team-edit-name-cancel-icon',
      error: 'team-edit-name-error',
      success: 'team-edit-name-success',
    },
    // Description field - inline (v1.1)
    description: {
      value: 'team-edit-description-value',
      editIcon: 'team-edit-description-edit-icon',
      textarea: 'team-edit-description-textarea',
      saveIcon: 'team-edit-description-save-icon',
      cancelIcon: 'team-edit-description-cancel-icon',
      error: 'team-edit-description-error',
      success: 'team-edit-description-success',
    },
    // Shared feedback (deprecated - use field-specific selectors)
    success: 'team-edit-success',
    error: 'team-edit-error',
  },
  acceptInvite: {
    loading: 'accept-invite-loading',
    container: 'accept-invite-container',
    info: 'accept-invite-info',
    teamName: 'accept-invite-team-name',
    requiresAuth: 'accept-invite-requires-auth',
    inviter: 'accept-invite-inviter',
    role: 'accept-invite-role',
    signin: 'accept-invite-signin',
    signup: 'accept-invite-signup',
    valid: 'accept-invite-valid',
    accept: 'accept-invite-accept',
    accepting: 'accept-invite-accepting',
    success: 'accept-invite-success',
    alreadyMember: 'accept-invite-already-member',
    emailMismatch: 'accept-invite-email-mismatch',
    notFound: 'accept-invite-not-found',
    expired: 'accept-invite-expired',
    error: 'accept-invite-error',
  },
} as const

export type TeamsSelectorsType = typeof TEAMS_SELECTORS
