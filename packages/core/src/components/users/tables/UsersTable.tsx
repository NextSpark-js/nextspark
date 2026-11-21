"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { User, Mail, Calendar } from "lucide-react";
import { useRoleTranslations } from '../../../lib/role-helpers';
import { useLocale, useTranslations } from 'next-intl';
import { formatLocaleDate } from '../../../lib/i18n/format';
import type { UserRole } from '../../../types/user.types';
import { useRouter } from "next/navigation";
import { sel } from '../../../lib/test';
import { UserActionsMenu, useUserActions } from './UserActions';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  roleBeforeSuspension?: string | null;
  emailVerified?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  fullName: string;
}

interface UsersTableProps {
  users: User[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * Users Table Component
 *
 * Displays regular users (non-superadmin) in a comprehensive table format.
 * Includes role badges, verification status, and action menus.
 */
export function UsersTable({ users, isLoading, onRefresh }: UsersTableProps) {
  const getRoleName = useRoleTranslations();
  const t = useTranslations('superadmin.users');
  const tPage = useTranslations('superadmin.usersPage');
  const tShared = useTranslations('superadmin.shared');
  const locale = useLocale();
  const router = useRouter();
  const actions = useUserActions({ onDone: () => onRefresh?.() });

  // Navigate to user detail
  const handleRowClick = (userId: string) => {
    router.push(`/superadmin/users/${userId}`);
  };

  // Generate user initials for avatar
  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  // Get role badge variant
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'suspended':
        return 'destructive';
      case 'developer':
        return 'default';
      case 'member':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
            </div>
            <div className="w-20 h-6 bg-muted rounded animate-pulse" />
            <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">{t('table.noUsers')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('table.noUsersDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-cy={sel('superadmin.users.table.element')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.user')}</TableHead>
            <TableHead>{t('table.email')}</TableHead>
            <TableHead>{t('table.role')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.joined')}</TableHead>
            <TableHead className="text-right">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              data-cy={sel('superadmin.users.table.row', { id: user.id })}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(user.id)}
            >
              {/* User Info */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="" alt={user.fullName} />
                    <AvatarFallback className="text-xs">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.fullName || tPage('noName')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('table.id', { id: `${user.id.slice(0, 8)}...` })}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* Email */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{user.email}</span>
                </div>
              </TableCell>

              {/* Role */}
              <TableCell>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {getRoleName(user.role)}
                </Badge>
              </TableCell>

              {/* Status */}
              <TableCell>
                <div className="flex items-center gap-2">
                  {user.emailVerified ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {t('table.verified')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      {t('table.pending')}
                    </Badge>
                  )}
                </div>
              </TableCell>

              {/* Join Date */}
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {user.createdAt ? formatLocaleDate(user.createdAt, locale) : tShared('unknown')}
                </div>
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <UserActionsMenu user={user} actions={actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {actions.dialog}
    </div>
  );
}