'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
// Use PermissionService which reads from the build-time generated registry
import { PermissionService } from '../../lib/services/permission.service'
import { Badge } from '../ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from '../ui/tooltip'
import { Check, X, AlertTriangle } from 'lucide-react'
import type { TeamRole, ResolvedPermission } from '../../lib/permissions/types'

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
  admin: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  member: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
  viewer: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400',
}

interface PermissionsMatrixProps {
  /** Filter by specific category */
  category?: string

  /** Compact mode (hide owner column, useful when space is limited) */
  compact?: boolean

  /** Callback when a cell is clicked (for future editing functionality) */
  onCellClick?: (permission: string, role: TeamRole) => void
}

/**
 * Component that displays the permissions matrix by role
 *
 * Shows which permissions each team role has in a visual table format.
 * Permissions are grouped by category for better organization.
 *
 * USAGE:
 *
 * @example
 * // Full matrix with all permissions
 * <PermissionsMatrix />
 *
 * @example
 * // Filtered by category
 * <PermissionsMatrix category="Customers" />
 *
 * @example
 * // Compact mode (no owner column)
 * <PermissionsMatrix compact={true} />
 */
export function PermissionsMatrix({
  category,
  compact = false,
  onCellClick,
}: PermissionsMatrixProps) {
  const t = useTranslations('permissions')

  const { permissions, matrix } = useMemo(() => {
    const data = PermissionService.getMatrix()

    if (category) {
      return {
        permissions: data.permissions.filter(p => p.category === category),
        matrix: data.matrix,
      }
    }

    return data
  }, [category])

  // Roles to display (compact mode hides owner)
  const roles: TeamRole[] = compact
    ? ['admin', 'member', 'viewer']
    : ['owner', 'admin', 'member', 'viewer']

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, ResolvedPermission[]> = {}

    for (const perm of permissions) {
      if (!groups[perm.category]) {
        groups[perm.category] = []
      }
      groups[perm.category].push(perm)
    }

    return groups
  }, [permissions])

  return (
    <TooltipProvider>
      <div className="rounded-md border" data-cy="permissions-matrix">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                {t('permission')}
              </TableHead>
              {roles.map(role => (
                <TableHead key={role} className="text-center w-[100px]">
                  <Badge variant="outline" className={ROLE_COLORS[role]}>
                    {t(`roles.${role}.title`)}
                  </Badge>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedPermissions).map(([cat, perms]) => (
              <>
                {/* Category Header */}
                <TableRow key={`cat-${cat}`} className="bg-muted/50">
                  <TableCell colSpan={roles.length + 1} className="font-semibold">
                    {cat}
                  </TableCell>
                </TableRow>

                {/* Permissions in Category */}
                {perms.map(perm => (
                  <TableRow key={perm.id} data-cy={`permission-row-${perm.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{perm.label}</span>
                        {perm.dangerous && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('dangerousAction')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {perm.description && (
                        <p className="text-xs text-muted-foreground">
                          {perm.description}
                        </p>
                      )}
                    </TableCell>

                    {roles.map(role => (
                      <TableCell
                        key={role}
                        className="text-center cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onCellClick?.(perm.id, role)}
                        data-cy={`permission-cell-${perm.id}-${role}`}
                      >
                        {matrix[perm.id]?.[role] ? (
                          <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 dark:text-gray-600 mx-auto" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
