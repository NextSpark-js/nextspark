"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { useToast } from '../../../hooks/useToast';
import {
  MoreHorizontal,
  User,
  Mail,
  Calendar,
  Eye,
  Edit,
  Ban,
  Trash2,
  CheckCircle,
  UserCheck,
  Loader2,
} from "lucide-react";
import { useRoleTranslations } from '../../../lib/role-helpers';
import { useCommonText } from '../../../lib/i18n/common-text';
import { useSession, type ClientSession } from '../../../lib/auth-client';
import type { SessionUser } from '../../../lib/auth';
import { canActOnUser, canGrantUserRole } from '../../../lib/auth/assignable-roles';
import { useLocale, useTranslations } from 'next-intl';
import { formatLocaleDate } from '../../../lib/i18n/format';
import type { UserRole } from '../../../types/user.types';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sel } from '../../../lib/test';
import { withBasePath } from '../../../lib/base-path'

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
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

type ActionType = 'suspend' | 'unsuspend' | 'delete' | 'verify-email';

interface PendingAction {
  type: ActionType;
  user: User;
}

/**
 * Users Table Component
 *
 * Displays regular users (non-superadmin) in a comprehensive table format.
 * Includes role badges, verification status, and action menus.
 */
export function UsersTable({ users, isLoading, onRefresh }: UsersTableProps) {
  const openMenuText = useCommonText('a11y', 'openMenu', 'Open menu');
  const getRoleName = useRoleTranslations();
  const t = useTranslations('superadmin.users');
  const tPage = useTranslations('superadmin.usersPage');
  const tShared = useTranslations('superadmin.shared');
  const locale = useLocale();
  const { data: session } = useSession();
  const viewer = (session as ClientSession | null)?.user as SessionUser | undefined;
  const viewerRole = viewer?.role;
  const viewerId = viewer?.id;
  // The API answers 403 to anyone else: only a developer grants the developer role and acts on a developer, and
  // nobody acts on their own account
  const canGrantDeveloper = canGrantUserRole(viewerRole, 'developer');
  const restrictedKey = (user: User) => t(user.id === viewerId ? 'actions.ownAccount' : 'actions.restrictedTarget');
  const canAct = (user: User) => user.id !== viewerId && canActOnUser(viewerRole, user.role);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Navigate to user detail
  const handleRowClick = (userId: string) => {
    router.push(`/superadmin/users/${userId}`);
  };

  // State for confirmation dialogs
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Mutation for user actions (suspend, unsuspend, verify-email)
  const actionMutation = useMutation({
    mutationFn: async ({ userId, action, role }: { userId: string; action: string; role?: string }) => {
      const response = await fetch(withBasePath(`/api/superadmin/users/${userId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('confirm.failed'));
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('toast.success'),
        description: t('toast.actionCompleted'),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: t('toast.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting users
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(withBasePath(`/api/superadmin/users/${userId}`), {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('toast.deleteFailed'));
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('toast.deleted'),
        description: t('toast.deletedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: t('toast.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle role change
  const handleRoleChange = (user: User, newRole: string) => {
    if (newRole === user.role) return;
    actionMutation.mutate({ userId: user.id, action: "change-role", role: newRole });
  };

  // Handle action confirmation
  const handleActionConfirm = () => {
    if (!pendingAction) return;

    const { type, user } = pendingAction;

    switch (type) {
      case "suspend":
        actionMutation.mutate({ userId: user.id, action: "suspend" });
        break;
      case "unsuspend":
        actionMutation.mutate({ userId: user.id, action: "unsuspend" });
        break;
      case "verify-email":
        actionMutation.mutate({ userId: user.id, action: "verify-email" });
        break;
      case "delete":
        deleteMutation.mutate(user.id);
        break;
    }

    setPendingAction(null);
  };

  // Get action dialog content
  const getActionDialogContent = () => {
    if (!pendingAction) return { title: "", description: "" };

    const { type, user } = pendingAction;
    const name = user.fullName || user.email;

    switch (type) {
      case "suspend":
        return {
          title: t('confirm.suspendTitle'),
          description: t('confirm.suspendDescription', { name }),
        };
      case "unsuspend":
        return {
          title: t('confirm.unsuspendTitle'),
          description: t('confirm.unsuspendDescription', { name }),
        };
      case "verify-email":
        return {
          title: t('confirm.verifyEmailTitle'),
          description: t('confirm.verifyEmailDescription', { name }),
        };
      case "delete":
        return {
          title: t('confirm.deleteTitle'),
          description: t('confirm.deleteDescription', { name }),
        };
      default:
        return { title: "", description: "" };
    }
  };

  const isMutating = actionMutation.isPending || deleteMutation.isPending;

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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={isMutating}
                    >
                      <span className="sr-only">{openMenuText}</span>
                      {isMutating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('table.actions')}</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/superadmin/users/${user.id}`} className="cursor-pointer">
                        <Eye className="mr-2 h-4 w-4" />
                        {t('actions.viewProfile')}
                      </Link>
                    </DropdownMenuItem>

                    {canAct(user) ? (
                      <>
                      {/* Role Change Submenu: a suspended user comes back only through unsuspend (the API answers 400).
                          Without the developer role there is no other role to give (superadmin is never assigned through
                          the API): the row says so instead of a submenu with only the current role */}
                      {user.role !== "suspended" && !canGrantDeveloper && (
                        <DropdownMenuItem disabled title={t('actions.roleChangeDeveloperOnly')} data-cy={`superadmin-user-role-restricted-${user.id}`}>
                          {t('actions.roleChangeDeveloperOnly')}
                        </DropdownMenuItem>
                      )}
                      {user.role !== "suspended" && canGrantDeveloper && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Edit className="mr-2 h-4 w-4" />
                          {t('actions.changeRole')}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup
                            value={user.role}
                            onValueChange={(value: string) => handleRoleChange(user, value)}
                          >
                            <DropdownMenuRadioItem value="member">
                              {tPage('roles.member')}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="developer">
                              {tPage('roles.developer')}
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      )}

                      {/* Verify Email (only if not verified) */}
                      {!user.emailVerified && (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setPendingAction({ type: "verify-email", user })}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t('actions.verifyEmail')}
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {/* Suspend/Unsuspend based on current role */}
                      {user.role === "suspended" ? (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setPendingAction({ type: "unsuspend", user })}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          {t('actions.unsuspendUser')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="cursor-pointer text-yellow-600"
                          onClick={() => setPendingAction({ type: "suspend", user })}
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          {t('actions.suspendUser')}
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem
                        className="cursor-pointer text-destructive"
                        onClick={() => setPendingAction({ type: "delete", user })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('actions.deleteUser')}
                      </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem disabled title={restrictedKey(user)} data-cy={`superadmin-user-restricted-${user.id}`}>
                        {restrictedKey(user)}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Confirmation Dialog */}
      <Dialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionDialogContent().title}</DialogTitle>
            <DialogDescription>
              {getActionDialogContent().description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              {t('confirm.cancel')}
            </Button>
            <Button
              onClick={handleActionConfirm}
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
            >
              {pendingAction?.type === "delete" ? t('confirm.delete') : t('confirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}