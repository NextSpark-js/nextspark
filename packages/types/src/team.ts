/**
 * Base Team interface - Platform agnostic
 * Does NOT depend on app.config.ts or any runtime configuration
 */
export interface BaseTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaseTeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string; // Generic string, not config-dependent
  joinedAt: string;
}
