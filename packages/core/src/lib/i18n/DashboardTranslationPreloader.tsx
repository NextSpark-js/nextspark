'use client'

import { useTranslationPreload } from '../../hooks/useTranslationPreload';

/**
 * Componente para precargar traducciones del dashboard
 * Se ejecuta cuando el usuario accede a cualquier página del dashboard
 * para garantizar que todas las traducciones estén disponibles durante la navegación
 */
export function DashboardTranslationPreloader() {
  // Este hook se encarga de precargar automáticamente todos los namespaces del dashboard
  useTranslationPreload('dashboard');

  // Este componente no renderiza nada, solo ejecuta la lógica de precarga
  return null;
}
