"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { 
  MoreHorizontal, 
  Shield, 
  Mail, 
  Calendar,
  Eye,
  Settings,
  AlertTriangle,
  Ban,
  Trash2,
  UserMinus
} from "lucide-react";
import { useRoleTranslations } from '../../../lib/role-helpers';
import { useSession, type ClientSession } from '../../../lib/auth-client';
import type { SessionUser } from '../../../lib/auth';
import { useToast } from '../../../hooks/useToast';
import { withBasePath } from '../../../lib/base-path';
import { canActOnUser } from '../../../lib/auth/assignable-roles';
import type { UserRole } from '../../../types/user.types';

interface SuperAdmin {
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

interface SuperAdminsTableProps {
  superadmins: SuperAdmin[];
  isLoading?: boolean;
  currentUserId?: string; // To identify current user
  onRefresh?: () => void;
}

type ActionType = 'demote' | 'suspend' | 'delete';

/**
 * SuperAdmins Table Component
 * 
 * Displays superadmin users with enhanced security context.
 * Shows special indicators and restricted actions for superadmin management.
 */
export function SuperAdminsTable({ 
  superadmins, 
  isLoading, 
  currentUserId,
  onRefresh
}: SuperAdminsTableProps) {

  const getRoleName = useRoleTranslations();
  const t = useTranslations('superadmin.users');
  const { toast } = useToast();
  const { data: session } = useSession();
  const viewerRole = ((session as ClientSession | null)?.user as SessionUser | undefined)?.role;
  const [pending, setPending] = useState<{ type: ActionType; admin: SuperAdmin } | null>(null);

  // The same routes the users table calls; the API accepts these only from a developer (canActOnUser)
  const actionMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ActionType; id: string }) => {
      const response = await fetch(withBasePath(`/api/superadmin/users/${id}`), type === 'delete'
        ? { method: 'DELETE' }
        : {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(type === 'demote' ? { action: 'change-role', role: 'member' } : { action: 'suspend' }),
          });
      if (!response.ok) throw new Error((await response.json()).error || t('confirm.failed'));
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('confirm.done') });
      onRefresh?.();
    },
    onError: (error: Error) => toast({ title: t('confirm.failed'), description: error.message, variant: 'destructive' }),
  });

  const confirmPending = () => {
    if (pending) actionMutation.mutate({ type: pending.type, id: pending.admin.id });
    setPending(null);
  };

  // Generate user initials for avatar
  const getUserInitials = (user: SuperAdmin) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <div className="w-10 h-10 bg-red-100 rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
            </div>
            <div className="w-20 h-6 bg-red-100 rounded animate-pulse" />
            <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (superadmins.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium">No superadmins found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This is unusual - there should be at least one superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200">
      <Table>
        <TableHeader className="bg-red-50">
          <TableRow>
            <TableHead>Administrator</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Since</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {superadmins.map((admin) => {
            const isCurrentUser = admin.id === currentUserId;
            
            return (
              <TableRow key={admin.id} className={isCurrentUser ? "bg-blue-50" : ""}>
                {/* Admin Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border-2 border-red-200">
                      <AvatarImage src="" alt={admin.fullName} />
                      <AvatarFallback className="text-xs bg-red-100 text-red-700">
                        {getUserInitials(admin)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {admin.fullName || 'No name'}
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID: {admin.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Email */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{admin.email}</span>
                  </div>
                </TableCell>

                {/* Role */}
                <TableCell>
                  <Badge variant="destructive" className="bg-red-600">
                    <Shield className="mr-1 h-3 w-3" />
                    {getRoleName(admin.role)}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {admin.emailVerified ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <Shield className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Creation Date */}
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {admin.createdAt ? format(new Date(admin.createdAt), 'MMM dd, yyyy') : 'Unknown'}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Admin Actions</DropdownMenuLabel>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Admin Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Mail className="mr-2 h-4 w-4" />
                        Send Message
                      </DropdownMenuItem>
                      
                      {/* Only a developer acts on a superadmin, and nobody on their own account */}
                      {!isCurrentUser && canActOnUser(viewerRole, admin.role) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-orange-600" onClick={() => setPending({ type: 'demote', admin })}>
                            <UserMinus className="mr-2 h-4 w-4" />
                            {t('actions.demoteToMember')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-yellow-600" onClick={() => setPending({ type: 'suspend', admin })}>
                            <Ban className="mr-2 h-4 w-4" />
                            {t('actions.suspendUser')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => setPending({ type: 'delete', admin })}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('actions.deleteUser')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!pending} onOpenChange={() => setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending && t(`confirm.${pending.type}Title`)}</DialogTitle>
            <DialogDescription>
              {pending && t(`confirm.${pending.type}Description`, { name: pending.admin.fullName || pending.admin.email })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>{t('confirm.cancel')}</Button>
            <Button variant={pending?.type === 'delete' ? 'destructive' : 'default'} onClick={confirmPending}>
              {t('confirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Notice */}
      <div className="bg-red-50 border-t border-red-200 p-3">
        <div className="flex items-center gap-2 text-red-700 text-sm">
          <Shield className="h-4 w-4" />
          <span className="font-medium">Security Notice:</span>
          <span>
            Superadmin access grants full system control. Handle with extreme caution.
          </span>
        </div>
      </div>
    </div>
  );
}