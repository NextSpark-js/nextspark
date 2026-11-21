"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Search, X } from "lucide-react";
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
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
 * The permissions the matrix shows for a search text and the "differences only" switch (#535): the text matches the id,
 * the label and the description, ignoring case; a difference is a permission that some of the roles have and others do not.
 */
export function filterMatrixPermissions(
  allPermissions: string[],
  permissionsData: PermissionData[] | undefined,
  roles: readonly string[],
  rolePermissions: Record<string, string[]>,
  query: string,
  differencesOnly: boolean,
): string[] {
  const info = new Map((permissionsData ?? []).map(p => [p.id, p]));
  const text = query.trim().toLowerCase();
  return allPermissions.filter(id => {
    if (text) {
      const p = info.get(id);
      if (![id, p?.label, p?.description].some(v => v?.toLowerCase().includes(text))) return false;
    }
    if (differencesOnly) {
      const having = roles.filter(r => rolePermissions[r]?.includes(id)).length;
      if (having === 0 || having === roles.length) return false;
    }
    return true;
  });
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
  const t = useTranslations('superadmin.rolesMatrix');
  const tTeams = useTranslations('teams');
  const [query, setQuery] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
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
  const permissionDescriptionMap = new Map<string, string>();

  if (permissionsData) {
    permissionsData.forEach(p => {
      permissionCategoryMap.set(p.id, p.category);
      permissionLabelMap.set(p.id, p.label);
      permissionDangerousMap.set(p.id, p.dangerous ?? false);
      if (p.description) permissionDescriptionMap.set(p.id, p.description);
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
  const visiblePermissions = filterMatrixPermissions(allPermissions, permissionsData, roles, permissions, query, differencesOnly);
  const permissionsByCategory = visiblePermissions.reduce(
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
    <div className="space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-10"
          data-cy="permissions-search"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={differencesOnly} onCheckedChange={setDifferencesOnly} data-cy="permissions-differences-only" />
        {t('differencesOnly')}
      </label>
      <span className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
        {t('showing', { shown: visiblePermissions.length, total: allPermissions.length })}
      </span>
    </div>
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">{t('permission')}</TableHead>
            {sortedRoles.map((role) => (
              <TableHead key={role} className="text-center min-w-[100px]">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="capitalize font-semibold">{tTeams.has(`roles.${role}`) ? tTeams(`roles.${role}`) : role}</span>
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
          {sortedCategories.length === 0 && (
            <TableRow>
              <TableCell colSpan={sortedRoles.length + 1} className="text-center text-muted-foreground py-8">
                {t('noMatches')}
              </TableCell>
            </TableRow>
          )}
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
                        {t('dangerous')}
                      </Badge>
                    )}
                    {permissionDescriptionMap.get(permission) && (
                      <div className="font-sans text-xs text-muted-foreground/80 mt-0.5">
                        {permissionDescriptionMap.get(permission)}
                      </div>
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
    </div>
  );
}
