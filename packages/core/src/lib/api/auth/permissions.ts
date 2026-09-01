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
 * Fail closed for API keys (#93): a key is only granted admin access when the
 * caller names the scope the operation needs and the key holds it. Omitting
 * `requiredScope` used to hand a narrowly-scoped key its superadmin owner's
 * full permissions; now it denies the key instead. Sessions are unaffected.
 *
 * @param authResult - Resultado de autenticacion
 * @param requiredScope - Scope requerido para API keys (obligatorio para que una API key pase)
 * @returns true si tiene permisos de admin
 */
export function hasAdminPermission(
  authResult: DualAuthResult,
  requiredScope?: string | string[]
): boolean {
  // Primero verificar que es superadmin
  if (!isSuperAdmin(authResult)) {
    return false
  }

  // Si es API key, exigir el scope: sin scope declarado, la key no pasa
  if (authResult.type === 'api-key') {
    return requiredScope !== undefined && hasRequiredScope(authResult, requiredScope)
  }

  return true
}
