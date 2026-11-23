"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useTranslations } from 'next-intl';
import { Badge } from '../../ui/badge';
import { useRoleTranslations } from '../../../lib/role-helpers';
import { effectiveUserRole } from '../../../lib/auth/assignable-roles';
import type { UserRole } from '../../../types/user.types';

interface BadgeUser {
  role: UserRole;
  roleBeforeSuspension?: string | null;
  emailVerified?: boolean;
}

/**
 * The role of a user. A suspended user shows the role they come back with (the status says suspended), so the list
 * never replaces a role by "Suspended".
 */
export function UserRoleBadge({ user }: { user: BadgeUser }) {
  const getRoleName = useRoleTranslations();
  const t = useTranslations('superadmin.usersPage');
  const role = effectiveUserRole(user.role, user.roleBeforeSuspension) as UserRole;
  // The name the role filter of the list uses (#549), so the badge and the filter never differ; a role the list does
  // not name takes the configured name.
  const label = t.has(`roles.${role}`) ? t(`roles.${role}`) : getRoleName(role);
  return <Badge variant={role === 'developer' ? 'default' : role === 'member' ? 'secondary' : 'outline'}>{label}</Badge>;
}

/**
 * The status of a user: Active or Suspended (the account), and apart from it whether the email is verified.
 */
export function UserStatusBadges({ user }: { user: BadgeUser }) {
  const t = useTranslations('superadmin.users');
  const suspended = user.role === 'suspended';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended ? (
        <Badge variant="destructive">{t('table.suspended')}</Badge>
      ) : (
        <Badge variant="default" className="bg-green-100 text-green-800">{t('table.active')}</Badge>
      )}
      {user.emailVerified ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3" />
          {t('table.verified')}
        </span>
      ) : (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">{t('table.pending')}</Badge>
      )}
    </div>
  );
}

/**
 * The teams of a user in the list: the first two linked to their page, "+N" for the rest (linked to the user's page,
 * which lists them all), a dash when the user is in none.
 */
export function UserTeamLinks({ user }: { user: { id: string; teamCount?: number; teams?: { id: string; name: string }[] } }) {
  const t = useTranslations('superadmin.users');
  const shown = (user.teams ?? []).slice(0, 2);
  const more = (user.teamCount ?? shown.length) - shown.length;
  if (!shown.length) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-sm" data-cy={`superadmin-user-teams-${user.id}`}>
      {shown.map((team) => (
        <Link key={team.id} href={`/superadmin/teams/${team.id}`} className="max-w-[10rem] truncate hover:underline" title={team.name}>
          {team.name}
        </Link>
      ))}
      {more > 0 && (
        <Link href={`/superadmin/users/${user.id}`} className="text-xs text-muted-foreground hover:underline">
          {t('table.moreTeams', { count: more })}
        </Link>
      )}
    </div>
  );
}
