'use client'

import { useTranslationPreload } from '../../hooks/useTranslationPreload';

/**
 * Componente para precargar traducciones de auth
 * Se ejecuta cuando el usuario accede a cualquier página de auth (login, signup, etc.)
 * para garantizar que todas las traducciones estén disponibles inmediatamente
 */
export function AuthTranslationPreloader() {
  // Este hook se encarga de precargar automáticamente todos los namespaces de auth
  useTranslationPreload('auth');

  // Este componente no renderiza nada, solo ejecuta la lógica de precarga
  return null;
}
