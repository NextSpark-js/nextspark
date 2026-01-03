"use client";

import { useState } from "react";
import { format } from "date-fns";
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
import type { UserRole } from '../../../types/user.types';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sel } from '../../../lib/test';

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
  const getRoleName = useRoleTranslations();
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
      const response = await fetch(`/api/superadmin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Action failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Action completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting users
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/superadmin/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "User Deleted",
        description: data.message || "User has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
          title: "Suspend User",
          description: `Are you sure you want to suspend ${name}? They will no longer be able to access the application.`,
        };
      case "unsuspend":
        return {
          title: "Unsuspend User",
          description: `Are you sure you want to unsuspend ${name}? They will regain access to the application as a member.`,
        };
      case "verify-email":
        return {
          title: "Verify Email",
          description: `Are you sure you want to manually verify the email for ${name}?`,
        };
      case "delete":
        return {
          title: "Delete User",
          description: `Are you sure you want to permanently delete ${name}? This action cannot be undone. All their data, teams, and memberships will be removed.`,
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
      case 'admin':
        return 'destructive';
      case 'colaborator':
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
        <h3 className="mt-4 text-lg font-medium">No users found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no regular users in the system yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-cy={sel('superadmin.users.table')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              data-cy={sel('superadmin.users.row', { id: user.id })}
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
                      {user.fullName || 'No name'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ID: {user.id.slice(0, 8)}...
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
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      Pending
                    </Badge>
                  )}
                </div>
              </TableCell>

              {/* Join Date */}
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'Unknown'}
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
                      <span className="sr-only">Open menu</span>
                      {isMutating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/superadmin/users/${user.id}`} className="cursor-pointer">
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </Link>
                    </DropdownMenuItem>

                    {/* Role Change Submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Edit className="mr-2 h-4 w-4" />
                        Change Role
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={user.role}
                          onValueChange={(value: string) => handleRoleChange(user, value)}
                        >
                          <DropdownMenuRadioItem value="member">
                            Member
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="colaborator">
                            Colaborator
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="admin">
                            Admin
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Verify Email (only if not verified) */}
                    {!user.emailVerified && (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setPendingAction({ type: "verify-email", user })}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verify Email
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
                        Unsuspend User
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="cursor-pointer text-yellow-600"
                        onClick={() => setPendingAction({ type: "suspend", user })}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Suspend User
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      className="cursor-pointer text-destructive"
                      onClick={() => setPendingAction({ type: "delete", user })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
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
              Cancel
            </Button>
            <Button
              onClick={handleActionConfirm}
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
            >
              {pendingAction?.type === "delete" ? "Delete" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}