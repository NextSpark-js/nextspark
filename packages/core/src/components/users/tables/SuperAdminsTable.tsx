"use client";


import { format } from "date-fns";
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
  AlertTriangle
} from "lucide-react";
import { useRoleTranslations } from '../../../lib/role-helpers';
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
}

/**
 * SuperAdmins Table Component
 * 
 * Displays superadmin users with enhanced security context.
 * Shows special indicators and restricted actions for superadmin management.
 */
export function SuperAdminsTable({ 
  superadmins, 
  isLoading, 
  currentUserId 
}: SuperAdminsTableProps) {

  const getRoleName = useRoleTranslations();

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
                      
                      {/* Only show dangerous actions for other admins */}
                      {!isCurrentUser && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-orange-600">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Revoke Admin
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