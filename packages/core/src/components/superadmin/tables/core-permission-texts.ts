/**
 * The English text the core writes for its own permissions (`CORE_PERMISSIONS_CONFIG`), which the Team Roles matrix looks up in
 * the catalog (#549). A copy of the two fields, not an import of the config: the matrix is superadmin code, and importing the
 * whole config from it would change a module the dashboard bundle shares. A test keeps the copy equal to the config.
 */
export const CORE_PERMISSION_TEXTS: Record<string, { description: string; category: string }> = {
  'teams.invite': { description: 'Can send invitations to new team members', category: 'Team' },
  'teams.remove_member': { description: 'Can remove members from the team', category: 'Team' },
  'teams.change_roles': { description: 'Can change the role of other members', category: 'Team' },
  'teams.settings': { description: 'Can modify team name, slug and configuration', category: 'Team' },
  'teams.delete': { description: 'Can delete the entire team', category: 'Team' },
  'settings.billing': { description: 'Access to billing configuration and payments', category: 'Settings' },
  'settings.api_keys': { description: 'Can create and manage team API keys', category: 'Settings' },
  'settings.integrations': { description: 'Can connect and configure external integrations', category: 'Settings' },
  'media.read': { description: 'Can browse and view media files in the library', category: 'Media' },
  'media.upload': { description: 'Can upload images, videos, and other media files', category: 'Media' },
  'media.update': { description: 'Can edit media metadata, tags, and captions', category: 'Media' },
  'media.delete': { description: 'Can permanently delete media files', category: 'Media' },
}
