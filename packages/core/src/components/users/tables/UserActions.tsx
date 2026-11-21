"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from '../../../hooks/useToast';
import {
  MoreHorizontal,
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
import { canActOnUser, canGrantUserRole, effectiveUserRole } from '../../../lib/auth/assignable-roles';
import { actionErrorMessage } from './action-error';
import { useTranslations } from 'next-intl';
import type { UserRole } from '../../../types/user.types';
import Link from "next/link";
import { withBasePath } from '../../../lib/base-path'

/** The part of a user the actions need; the table and the detail page both pass theirs. */
export interface ActionUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  roleBeforeSuspension?: string | null;
  emailVerified?: boolean;
  fullName: string;
}

export type UserActionType = 'suspend' | 'unsuspend' | 'delete' | 'verify-email' | 'change-role';

interface PendingAction {
  type: UserActionType;
  user: ActionUser;
  /** The role a 'change-role' gives */
  role?: string;
}

/**
 * Whether granting `role` is confirmed with a destructive button: the developer role outranks superadmin, so
 * the change gives the user more power than anyone else in the list has.
 */
export function isDestructiveRoleChange(role: string | undefined): boolean {
  return role === 'developer';
}

export interface UserActions {
  /** The dialog every action asks its confirmation in; render it once next to the menus */
  dialog: ReactNode;
  isMutating: boolean;
  canAct: (user: ActionUser) => boolean;
  canGrantDeveloper: boolean;
  restrictedKey: (user: ActionUser) => string;
  request: (type: UserActionType, user: ActionUser, role?: string) => void;
}

/**
 * The actions an admin takes on a user (change role, verify email, suspend, unsuspend, delete) with their
 * confirmation dialog. One hook, one dialog: the users table and the user detail page share them.
 * `onDone` runs after an action went through (the page refetches).
 */
export function useUserActions({ onDone }: { onDone?: (type: UserActionType, user: ActionUser) => void } = {}): UserActions {
  const getRoleName = useRoleTranslations();
  const t = useTranslations('superadmin.users');
  const { data: session } = useSession();
  const viewer = (session as ClientSession | null)?.user as SessionUser | undefined;
  const viewerRole = viewer?.role;
  const viewerId = viewer?.id;
  // The API answers 403 to anyone else: only a developer grants the developer role and acts on a developer, and
  // nobody acts on their own account
  const canGrantDeveloper = canGrantUserRole(viewerRole, 'developer');
  const restrictedKey = (user: ActionUser) => t(user.id === viewerId ? 'actions.ownAccount' : 'actions.restrictedTarget');
  // A suspended user is acted on as the role they come back with (the API checks that one too)
  const canAct = (user: ActionUser) => user.id !== viewerId && canActOnUser(viewerRole, effectiveUserRole(user.role, user.roleBeforeSuspension));
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ userId, type, role }: { userId: string; type: UserActionType; role?: string }) => {
      const isDelete = type === 'delete';
      const response = await fetch(withBasePath(`/api/superadmin/users/${userId}`), {
        method: isDelete ? "DELETE" : "PATCH",
        ...(isDelete ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: type, role }) }),
      });
      if (!response.ok) throw new Error(await actionErrorMessage(response, t, t(isDelete ? 'toast.deleteFailed' : 'confirm.failed')));
      return response.json();
    },
    onSuccess: (_data, { type }) => {
      if (type === 'delete') {
        toast({ title: t('toast.deleted'), description: t('toast.deletedDescription') });
      } else {
        toast({ title: t('toast.success'), description: t('toast.actionCompleted') });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      const done = pendingAction;
      if (done) onDone?.(done.type, done.user);
    },
    onError: (error: Error) => {
      toast({ title: t('toast.error'), description: error.message, variant: "destructive" });
    },
  });

  const request = (type: UserActionType, user: ActionUser, role?: string) => {
    if (type === 'change-role' && role === user.role) return;
    setPendingAction({ type, user, role });
  };

  const confirm = () => {
    if (!pendingAction) return;
    const { type, user, role } = pendingAction;
    mutation.mutate({ userId: user.id, type, role });
    setPendingAction(null);
  };

  const dialogText = () => {
    if (!pendingAction) return { title: "", description: "" };
    const { type, user, role } = pendingAction;
    const name = user.fullName || user.email;
    switch (type) {
      case "suspend":
        return { title: t('confirm.suspendTitle'), description: t('confirm.suspendDescription', { name }) };
      case "unsuspend":
        return {
          title: t('confirm.unsuspendTitle'),
          description: t('confirm.unsuspendDescription', { name, role: getRoleName(effectiveUserRole(user.role, user.roleBeforeSuspension) as UserRole) }),
        };
      case "verify-email":
        return { title: t('confirm.verifyEmailTitle'), description: t('confirm.verifyEmailDescription', { name }) };
      case "delete":
        return { title: t('confirm.deleteTitle'), description: t('confirm.deleteDescription', { name }) };
      case "change-role":
        return {
          title: t('confirm.changeRoleTitle'),
          description: t(isDestructiveRoleChange(role) ? 'confirm.changeRoleDeveloperDescription' : 'confirm.changeRoleDescription', {
            name,
            from: getRoleName(user.role),
            to: getRoleName(role as UserRole),
          }),
        };
    }
  };

  const destructive = pendingAction?.type === "delete" || (pendingAction?.type === "change-role" && isDestructiveRoleChange(pendingAction.role));
  const text = dialogText();

  const dialog = (
    <Dialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingAction(null)}>
            {t('confirm.cancel')}
          </Button>
          <Button onClick={confirm} variant={destructive ? "destructive" : "default"}>
            {pendingAction?.type === "delete" ? t('confirm.delete') : t('confirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { dialog, isMutating: mutation.isPending, canAct, canGrantDeveloper, restrictedKey, request };
}

/** The row/header menu of a user: change role, verify email, suspend/unsuspend and delete, as the viewer may. */
export function UserActionsMenu({ user, actions, showViewProfile = true }: { user: ActionUser; actions: UserActions; showViewProfile?: boolean }) {
  const openMenuText = useCommonText('a11y', 'openMenu', 'Open menu');
  const t = useTranslations('superadmin.users');
  const tPage = useTranslations('superadmin.usersPage');
  const { canAct, canGrantDeveloper, restrictedKey, request, isMutating } = actions;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isMutating}>
          <span className="sr-only">{openMenuText}</span>
          {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('table.actions')}</DropdownMenuLabel>
        {showViewProfile && (
          <DropdownMenuItem asChild>
            <Link href={`/superadmin/users/${user.id}`} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              {t('actions.viewProfile')}
            </Link>
          </DropdownMenuItem>
        )}

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
                  <DropdownMenuRadioGroup value={user.role} onValueChange={(value: string) => request('change-role', user, value)}>
                    <DropdownMenuRadioItem value="member">{tPage('roles.member')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="developer">{tPage('roles.developer')}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {!user.emailVerified && (
              <DropdownMenuItem className="cursor-pointer" onClick={() => request('verify-email', user)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('actions.verifyEmail')}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {user.role === "suspended" ? (
              <DropdownMenuItem className="cursor-pointer" onClick={() => request('unsuspend', user)}>
                <UserCheck className="mr-2 h-4 w-4" />
                {t('actions.unsuspendUser')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="cursor-pointer text-yellow-600" onClick={() => request('suspend', user)}>
                <Ban className="mr-2 h-4 w-4" />
                {t('actions.suspendUser')}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => request('delete', user)}>
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
  );
}
