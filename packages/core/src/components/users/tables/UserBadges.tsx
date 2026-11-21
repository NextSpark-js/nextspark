"use client";

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
  const role = effectiveUserRole(user.role, user.roleBeforeSuspension) as UserRole;
  return <Badge variant={role === 'developer' ? 'default' : role === 'member' ? 'secondary' : 'outline'}>{getRoleName(role)}</Badge>;
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
