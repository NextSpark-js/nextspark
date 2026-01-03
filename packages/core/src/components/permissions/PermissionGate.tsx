'use client'

import { ReactNode } from 'react'
import { usePermission, usePermissions } from '../../lib/permissions/hooks'
import type { Permission } from '../../lib/permissions/types'

interface PermissionGateProps {
  /** Required permission (if single) */
  permission?: Permission

  /** Multiple required permissions (AND - all must be true) */
  permissions?: Permission[]

  /** Multiple permissions where any is sufficient (OR - at least one must be true) */
  anyPermission?: Permission[]

  /** Content to show if has permission */
  children: ReactNode

  /** Alternative content if NO permission */
  fallback?: ReactNode

  /** If true, shows fallback instead of null when no permission */
  showFallback?: boolean
}

/**
 * Component for conditional rendering based on permissions
 *
 * USAGE PATTERNS:
 *
 * @example
 * // Single permission check
 * <PermissionGate permission="customers.create">
 *   <CreateCustomerButton />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions required (AND logic)
 * <PermissionGate permissions={['customers.create', 'customers.update']}>
 *   <FullEditPanel />
 * </PermissionGate>
 *
 * @example
 * // Any permission sufficient (OR logic)
 * <PermissionGate anyPermission={['customers.update', 'customers.delete']}>
 *   <ActionsMenu />
 * </PermissionGate>
 *
 * @example
 * // With fallback content
 * <PermissionGate
 *   permission="customers.delete"
 *   fallback={<DisabledButton tooltip="No permission to delete" />}
 *   showFallback={true}
 * >
 *   <DeleteButton />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  anyPermission,
  children,
  fallback = null,
  showFallback = true,
}: PermissionGateProps) {
  // Build permissions map for usePermissions hook
  const permissionsToCheck: Record<string, Permission> = {}

  if (permission) {
    permissionsToCheck['single'] = permission
  }

  if (permissions) {
    permissions.forEach((p, i) => {
      permissionsToCheck[`and_${i}`] = p
    })
  }

  if (anyPermission) {
    anyPermission.forEach((p, i) => {
      permissionsToCheck[`or_${i}`] = p
    })
  }

  const results = usePermissions(permissionsToCheck)

  // Evaluate result based on logic mode
  let hasAccess = false

  if (permission) {
    // Single permission
    hasAccess = results['single']
  } else if (permissions) {
    // AND logic: all must be true
    hasAccess = permissions.every((_, i) => results[`and_${i}`])
  } else if (anyPermission) {
    // OR logic: at least one must be true
    hasAccess = anyPermission.some((_, i) => results[`or_${i}`])
  }

  // Render children if has access
  if (hasAccess) {
    return <>{children}</>
  }

  // Render fallback if no access
  if (showFallback && fallback) {
    return <>{fallback}</>
  }

  // Render nothing
  return null
}

/**
 * Higher-Order Component to wrap components with permission check
 *
 * @param WrappedComponent - Component to wrap
 * @param permission - Permission required to render the component
 * @param FallbackComponent - Optional component to show when no permission
 * @returns Wrapped component with permission check
 *
 * @example
 * ```tsx
 * const ProtectedCustomerForm = withPermission(
 *   CustomerForm,
 *   'customers.create',
 *   NoPermissionMessage
 * )
 *
 * // Usage
 * <ProtectedCustomerForm {...props} />
 * ```
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: Permission,
  FallbackComponent?: React.ComponentType
) {
  return function WithPermissionWrapper(props: P) {
    return (
      <PermissionGate
        permission={permission}
        fallback={FallbackComponent ? <FallbackComponent /> : null}
      >
        <WrappedComponent {...props} />
      </PermissionGate>
    )
  }
}
