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
