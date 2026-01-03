/**
 * Teams Mode Helper Functions
 *
 * Helpers para verificar capacidades segun el modo de teams configurado.
 * Estas funciones son puras y no tienen side effects.
 *
 * SIMPLIFIED: Only 3 modes (single-user, single-tenant, multi-tenant)
 * No team types (personal/work distinction removed)
 */

import type { TeamsMode, TeamsConfigOptions } from '../config/types'

/**
 * Determina si el modo permite invitar miembros al team
 *
 * @param mode - El modo de teams configurado
 * @returns true si el modo permite invitaciones
 *
 * @example
 * ```typescript
 * const canInvite = canInviteMembers('single-tenant') // true
 * const canInvite = canInviteMembers('single-user')   // false
 * ```
 */
export function canInviteMembers(mode: TeamsMode): boolean {
  return mode !== 'single-user'
}

/**
 * Determina si el modo permite cambiar entre teams
 *
 * @param mode - El modo de teams configurado
 * @returns true si el usuario puede tener multiples teams
 *
 * @example
 * ```typescript
 * const canSwitch = canSwitchTeams('multi-tenant') // true
 * const canSwitch = canSwitchTeams('single-tenant') // false
 * ```
 */
export function canSwitchTeams(mode: TeamsMode): boolean {
  return mode === 'multi-tenant'
}

/**
 * Determina si el modo permite crear nuevos teams
 *
 * @param mode - El modo de teams configurado
 * @returns true si el modo soporta creacion de teams
 *
 * Nota: Esto solo indica si el MODO permite crear teams.
 * Use canUserCreateTeam() para verificar si un USUARIO especifico puede crear.
 *
 * @example
 * ```typescript
 * const canCreate = canCreateTeams('multi-tenant') // true
 * const canCreate = canCreateTeams('single-tenant') // false
 * ```
 */
export function canCreateTeams(mode: TeamsMode): boolean {
  return mode === 'multi-tenant'
}

/**
 * Determina si se crea un team en signup
 *
 * @param mode - El modo de teams configurado
 * @returns true si el signup debe crear un team
 *
 * Nota: single-tenant retorna false porque:
 * - Primer usuario: crea team global (caso especial)
 * - Usuarios siguientes: solo pueden registrarse via invitacion
 *
 * @example
 * ```typescript
 * const creates = createsTeamOnSignup('multi-tenant') // true
 * const creates = createsTeamOnSignup('single-tenant') // false
 * ```
 */
export function createsTeamOnSignup(mode: TeamsMode): boolean {
  return mode !== 'single-tenant'
}

/**
 * Determina si el signup publico esta restringido
 *
 * En modo single-tenant, el signup publico solo esta permitido
 * para el primer usuario. Despues, solo se puede registrar via invitacion.
 *
 * @param mode - El modo de teams configurado
 * @returns true si el signup publico esta restringido (requiere verificacion adicional)
 *
 * @example
 * ```typescript
 * const restricted = isPublicSignupRestricted('single-tenant') // true
 * const restricted = isPublicSignupRestricted('multi-tenant') // false
 * ```
 */
export function isPublicSignupRestricted(mode: TeamsMode): boolean {
  return mode === 'single-tenant'
}

/**
 * NUEVA FUNCION: Determina si un usuario especifico puede crear un nuevo team
 *
 * Considera el modo, la configuracion allowCreateTeams, y el estado actual del usuario.
 *
 * @param mode - El modo de teams actual
 * @param options - Las opciones de configuracion de teams
 * @param userOwnedTeamsCount - Cuantos teams posee el usuario como owner
 * @returns true si el usuario puede crear un nuevo team
 *
 * Logica:
 * - single-user: NUNCA puede crear teams
 * - single-tenant: NUNCA puede crear teams
 * - multi-tenant + allowCreateTeams=true (default): SIEMPRE puede crear
 * - multi-tenant + allowCreateTeams=false: Solo si userOwnedTeamsCount === 0
 *
 * @example
 * ```typescript
 * canUserCreateTeam('single-user', {}, 0)                              // false
 * canUserCreateTeam('single-tenant', {}, 0)                            // false
 * canUserCreateTeam('multi-tenant', {}, 0)                             // true
 * canUserCreateTeam('multi-tenant', { allowCreateTeams: true }, 5)     // true
 * canUserCreateTeam('multi-tenant', { allowCreateTeams: false }, 0)    // true (first team)
 * canUserCreateTeam('multi-tenant', { allowCreateTeams: false }, 1)    // false (already has 1)
 * ```
 */
export function canUserCreateTeam(
  mode: TeamsMode,
  options: TeamsConfigOptions,
  userOwnedTeamsCount: number
): boolean {
  // single-user y single-tenant: nunca pueden crear teams
  if (mode !== 'multi-tenant') {
    return false
  }

  // Si allowCreateTeams no esta definido, default es true
  const allowCreateTeams = options.allowCreateTeams ?? true

  if (allowCreateTeams) {
    // Sin restriccion, puede crear multiples teams
    return true
  } else {
    // Solo puede crear si aun no es owner de ningun team
    return userOwnedTeamsCount === 0
  }
}
