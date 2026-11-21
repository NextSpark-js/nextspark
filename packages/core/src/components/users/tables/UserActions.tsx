"use client";

import { useRef, useState, type ReactNode } from "react";
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

interface ActionRequest {
  userId: string;
  type: UserActionType;
  role?: string;
}

/** What the PATCH answers besides `success`: the suspend counts and the role an unsuspend gave back. */
interface ActionResponse {
  role?: string;
  revoked?: { sessions: number; apiKeys: number };
}

/**
 * The request that takes an action back, for the toast's Undo: only what the API can reverse. A suspension stores the
 * role it replaces, so unsuspending gives it back; verifying an email and deleting a user have no way back.
 */
export function undoRequest({ type, user }: { type: UserActionType; user: ActionUser }): ActionRequest | null {
  if (type === 'suspend') return { userId: user.id, type: 'unsuspend' };
  if (type === 'unsuspend') return { userId: user.id, type: 'suspend' };
  if (type === 'change-role') return { userId: user.id, type: 'change-role', role: user.role };
  return null;
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
  // The error of the request the open dialog sent: it shows in the dialog it belongs to
  const [error, setError] = useState<string | null>(null);

  const perform = async ({ userId, type, role }: ActionRequest): Promise<ActionResponse> => {
    const isDelete = type === 'delete';
    const init: RequestInit = isDelete
      ? { method: 'DELETE' }
      : { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: type, role }) };
    const response = await fetch(withBasePath(`/api/superadmin/users/${userId}`), init);
    if (!response.ok) throw new Error(await actionErrorMessage(response, t, t(isDelete ? 'toast.deleteFailed' : 'confirm.failed')));
    return response.json();
  };
  const mutation = useMutation({ mutationFn: perform });

  const refresh = () => {
    for (const key of ["admin-users", "superadmin-users", "superadmin-user"]) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const request = (type: UserActionType, user: ActionUser, role?: string) => {
    if (type === 'change-role' && role === user.role) return;
    setError(null);
    setPendingAction({ type, user, role });
  };

  const announce = (done: PendingAction, data: ActionResponse) => {
    const { type, user, role } = done;
    const name = user.fullName || user.email;
    const texts = {
      suspend: { title: t('toast.suspended', { name }), description: t('toast.suspendedDescription', { sessions: data.revoked?.sessions ?? 0, apiKeys: data.revoked?.apiKeys ?? 0 }) },
      unsuspend: { title: t('toast.unsuspended', { name }), description: t('toast.unsuspendedDescription', { role: getRoleName((data.role ?? effectiveUserRole(user.role, user.roleBeforeSuspension)) as UserRole) }) },
      'verify-email': { title: t('toast.verified', { name }), description: t('toast.verifiedDescription', { email: user.email }) },
      delete: { title: t('toast.deletedNamed', { name }), description: t('toast.deletedNamedDescription') },
      'change-role': { title: t('toast.roleChanged', { from: getRoleName(user.role), to: getRoleName(role as UserRole) }), description: name },
    }[type];
    const back = undoRequest(done);
    toast({
      ...texts,
      ...(back && {
        action: {
          label: t('toast.undo'),
          onClick: () => {
            perform(back).then(
              () => { toast({ title: t('toast.undone'), description: name }); refresh(); },
              (e: Error) => toast({ title: t('toast.error'), description: e.message, variant: "destructive" }),
            );
          },
        },
      }),
    });
  };

  // The dialog stays open, with its buttons disabled, until the API answers: a failure shows in it, a success closes it
  const confirm = () => {
    if (!pendingAction) return;
    const done = pendingAction;
    setError(null);
    mutation.mutate({ userId: done.user.id, type: done.type, role: done.role }, {
      onSuccess: (data) => {
        setPendingAction(null);
        announce(done, data);
        refresh();
        onDone?.(done.type, done.user);
      },
      onError: (e: Error) => setError(e.message),
    });
  };

  // The dialog keeps the text of the action it closes on, so it does not empty while it fades out
  const lastAction = useRef<PendingAction | null>(null);
  if (pendingAction) lastAction.current = pendingAction;
  const shown = pendingAction ?? lastAction.current;

  const dialogText = () => {
    if (!shown) return { title: "", description: "", action: "" };
    const { type, user, role } = shown;
    const name = user.fullName || user.email;
    switch (type) {
      case "suspend":
        return { title: t('confirm.suspendTitle'), description: t('confirm.suspendDescription', { name }), action: t('confirm.suspendAction') };
      case "unsuspend":
        return {
          title: t('confirm.unsuspendTitle'),
          description: t('confirm.unsuspendDescription', { name, role: getRoleName(effectiveUserRole(user.role, user.roleBeforeSuspension) as UserRole) }),
          action: t('confirm.unsuspendAction'),
        };
      case "verify-email":
        return { title: t('confirm.verifyEmailTitle'), description: t('confirm.verifyEmailDescription', { name }), action: t('confirm.verifyEmailAction') };
      case "delete":
        return { title: t('confirm.deleteTitle'), description: t('confirm.deleteDescription', { name }), action: t('confirm.deleteAction') };
      case "change-role":
        return {
          title: t('confirm.changeRoleTitle'),
          description: t(isDestructiveRoleChange(role) ? 'confirm.changeRoleDeveloperDescription' : 'confirm.changeRoleDescription', {
            name,
            from: getRoleName(user.role),
            to: getRoleName(role as UserRole),
          }),
          action: t('confirm.changeRoleAction', { role: getRoleName(role as UserRole) }),
        };
    }
  };

  const destructive = shown?.type === "delete" || (shown?.type === "change-role" && isDestructiveRoleChange(shown.role));
  const text = dialogText();

  const saving = mutation.isPending;
  const dialog = (
    <Dialog open={!!pendingAction} onOpenChange={(open) => { if (!open && !saving) setPendingAction(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setPendingAction(null)}>
            {t('confirm.cancel')}
          </Button>
          <Button onClick={confirm} disabled={saving} variant={destructive ? "destructive" : "default"}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {text.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { dialog, isMutating: saving, canAct, canGrantDeveloper, restrictedKey, request };
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
