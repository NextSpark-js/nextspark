/**
 * Admin Permission Helpers
 *
 * Centralized permission validation for admin-only endpoints.
 * Supports both API Key and Session authentication.
 */

import type { DualAuthResult } from './dual-auth'
import { hasRequiredScope } from './dual-auth'

/**
 * Verifica si el usuario autenticado es superadmin
 * Funciona tanto para sesiones como para API keys
 *
 * @param authResult - Resultado de autenticacion dual
 * @returns true si el usuario es superadmin
 */
export function isSuperAdmin(authResult: DualAuthResult): boolean {
  if (!authResult.success || !authResult.user) {
    return false
  }

  // Verificar rol en el usuario (funciona para session y api-key)
  return authResult.user.role === 'superadmin'
}

/**
 * Verifica si el usuario tiene permisos para operaciones administrativas
 * Combina validacion de superadmin + scopes de API key
 *
 * @param authResult - Resultado de autenticacion
 * @param requiredScope - Scope requerido para API keys (opcional)
 * @returns true si tiene permisos de admin
 */
export function hasAdminPermission(
  authResult: DualAuthResult,
  requiredScope?: string
): boolean {
  // Primero verificar que es superadmin
  if (!isSuperAdmin(authResult)) {
    return false
  }

  // Si es API key y se requiere scope, verificar scope
  if (authResult.type === 'api-key' && requiredScope) {
    return hasRequiredScope(authResult, requiredScope)
  }

  return true
}
