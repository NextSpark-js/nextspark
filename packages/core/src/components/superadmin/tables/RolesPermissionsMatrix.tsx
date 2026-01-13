"use client";

import { Fragment } from "react";
import { Check, X } from "lucide-react";
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { cn } from '../../../lib/utils';
import { sel } from '../../../lib/test';

interface PermissionData {
  id: string;
  label: string;
  description?: string;
  category: string;
  dangerous?: boolean;
}

interface RolesPermissionsMatrixProps {
  roles: readonly string[];
  hierarchy: Record<string, number>;
  permissions: Record<string, string[]>;
  allPermissions: string[];
  /** Full permission data with categories for grouping */
  permissionsData?: PermissionData[];
}

/**
 * Roles Permissions Matrix Component
 *
 * Displays a consolidated matrix showing which permissions each team role has.
 * Roles are sorted by hierarchy (highest to lowest).
 * Permissions are grouped by category.
 */
export function RolesPermissionsMatrix({
  roles,
  hierarchy,
  permissions,
  allPermissions,
  permissionsData,
}: RolesPermissionsMatrixProps) {
  // Sort roles by hierarchy (highest to lowest)
  const sortedRoles = [...roles].sort(
    (a, b) => (hierarchy[b] ?? 0) - (hierarchy[a] ?? 0)
  );

  // Check if a role has a specific permission
  const hasPermission = (role: string, permission: string): boolean => {
    return permissions[role]?.includes(permission) ?? false;
  };

  // Get role badge color based on hierarchy
  const getRoleBadgeVariant = (role: string) => {
    const h = hierarchy[role] ?? 0;
    if (h >= 100) return "destructive"; // owner
    if (h >= 50) return "default"; // admin
    if (h >= 10) return "secondary"; // member
    return "outline"; // viewer
  };

  // Build category map from permissionsData
  const permissionCategoryMap = new Map<string, string>();
  const permissionLabelMap = new Map<string, string>();
  const permissionDangerousMap = new Map<string, boolean>();

  if (permissionsData) {
    permissionsData.forEach(p => {
      permissionCategoryMap.set(p.id, p.category);
      permissionLabelMap.set(p.id, p.label);
      permissionDangerousMap.set(p.id, p.dangerous ?? false);
    });
  }

  // Extract category from permission ID (fallback if no permissionsData)
  const getPermissionCategory = (permissionId: string): string => {
    // First check if we have category from permissionsData
    if (permissionCategoryMap.has(permissionId)) {
      return permissionCategoryMap.get(permissionId)!;
    }
    // Fallback: extract from permission ID prefix (e.g., "teams.invite" -> "teams")
    const parts = permissionId.split(".");
    return parts[0] || "general";
  };

  // Group permissions by category
  const permissionsByCategory = allPermissions.reduce(
    (acc, permission) => {
      const category = getPermissionCategory(permission);
      if (!acc[category]) acc[category] = [];
      acc[category].push(permission);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // Define category order (core first, then theme features, then entities alphabetically)
  const categoryOrder: Record<string, number> = {
    // Core system permissions
    "Team": 1,
    "Settings": 2,
    // Theme features
    "Page Builder": 10,
    "Blog": 11,
    "Media": 12,
    // Entities come after (alphabetically)
  };

  // Sort categories
  const sortedCategories = Object.keys(permissionsByCategory).sort((a, b) => {
    const orderA = categoryOrder[a] ?? 100;
    const orderB = categoryOrder[b] ?? 100;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  // Format category label for display
  const formatCategoryLabel = (category: string): string => {
    // Already formatted categories
    if (category.includes(" ") || category.includes("-")) {
      return category
        .split(/[-\s]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    // Capitalize first letter
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Permission</TableHead>
            {sortedRoles.map((role) => (
              <TableHead key={role} className="text-center min-w-[100px]">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="capitalize font-semibold">{role}</span>
                  <Badge
                    variant={getRoleBadgeVariant(role)}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {hierarchy[role] ?? 0}
                  </Badge>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCategories.map((category) => (
            <Fragment key={category}>
              {/* Category header row */}
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell
                  colSpan={sortedRoles.length + 1}
                  className="font-semibold text-sm py-3"
                >
                  {formatCategoryLabel(category)}
                </TableCell>
              </TableRow>

              {/* Permission rows in this category */}
              {permissionsByCategory[category].map((permission) => (
                <TableRow
                  key={permission}
                  data-cy={sel('superadmin.teamRoles.rbac.matrix.permissionRow', { permission: permission.replace(/\./g, '-') })}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="font-mono text-sm text-muted-foreground pl-6">
                    <span className={cn(
                      permissionDangerousMap.get(permission) && "text-red-600"
                    )}>
                      {permission}
                    </span>
                    {permissionDangerousMap.get(permission) && (
                      <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">
                        dangerous
                      </Badge>
                    )}
                  </TableCell>
                  {sortedRoles.map((role) => (
                    <TableCell
                      key={`${role}-${permission}`}
                      className="text-center"
                    >
                      {hasPermission(role, permission) ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-400/60 mx-auto" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
