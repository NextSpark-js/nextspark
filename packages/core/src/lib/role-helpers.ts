/**
 * Role Helper Functions
 * Utilities for working with user roles and their translations
 */

import { useTranslations } from 'next-intl';
import { roleHelpers, type UserRole } from '../types/user.types';
import type { TranslationFunction } from '../messages/types';

/**
 * Hook para obtener nombres de roles traducidos
 * @returns Función para obtener el nombre traducido de un rol
 * 
 * @example
 * const getRoleName = useRoleTranslations();
 * const roleName = getRoleName('admin'); // "Administrador" en español
 */
export function useRoleTranslations() {
  const t = useTranslations();

  return (role: UserRole): string => translateRole(role, t as unknown as TranslationFunction);
}

/**
 * A role without a configured display name (a suspended user's role is `suspended`) never reaches `t()` with
 * `undefined`: `suspended` uses its catalog label, any other role shows its own name (#489).
 */
function translateRole(role: UserRole, t: TranslationFunction): string {
  const translationKey = roleHelpers.getRoleDisplayKey(role);
  if (translationKey) return t(translationKey);
  return role === 'suspended' ? t('superadmin.usersPage.roles.suspended') : String(role);
}

/**
 * Obtener todas las opciones de roles para formularios
 * @returns Array de objetos con value y label traducido
 * 
 * @example
 * const roleOptions = useRoleOptions();
 * // [{ value: 'member', label: 'Miembro' }, ...]
 */
export function useRoleOptions() {
  const getRoleName = useRoleTranslations();
  
  return roleHelpers.getAllRolesByHierarchy().map(role => ({
    value: role,
    label: getRoleName(role)
  }));
}

/**
 * Función para usar en server components (sin hooks)
 * @param role - El rol del usuario
 * @param t - Función de traducción de next-intl
 * @returns Nombre del rol traducido
 * 
 * @example
 * import { getTranslations } from 'next-intl/server';
 * 
 * const t = await getTranslations();
 * const roleName = getRoleDisplayName('admin', t);
 */
export function getRoleDisplayName(role: UserRole, t: TranslationFunction): string {
  return translateRole(role, t);
}
