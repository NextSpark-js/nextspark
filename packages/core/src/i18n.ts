import {getRequestConfig} from 'next-intl/server';
import {I18N_CONFIG} from './lib/config';
import {headers} from 'next/headers';
import { loadMergedTranslations } from './lib/translations/registry';
import { getUserLocale } from './lib/locale';
import type { SupportedLocale } from './lib/entities/types';

// Debug flag - only log if explicitly enabled
const DEBUG_I18N = process.env.NEXTSPARK_DEBUG_I18N === 'true';

// Configuración de grupos de namespaces optimizada por contexto de usuario
// Estrategia: carga inteligente según el estado y navegación del usuario
const NAMESPACE_GROUPS = {
  // Páginas públicas iniciales: incluye auth para login/signup
  PUBLIC_INITIAL: ['common', 'public', 'auth'],
  
  // Dashboard: incluye public para navegación pero no auth (ya autenticado)
  DASHBOARD_AUTHENTICATED: ['common', 'dashboard', 'settings', 'public', 'teams'],
  
  // Solo autenticación: para páginas específicas de auth
  AUTH_ONLY: ['common', 'auth', 'validation'],
  
  // Fallback completo para casos edge
  ALL: ['common', 'dashboard', 'settings', 'auth', 'public', 'validation', 'teams']
};

// Estrategia de namespaces optimizada por contexto de usuario
function getPageNamespaces(pathname: string): string[] {
  if (DEBUG_I18N) {
    console.log(`[i18n] Analyzing pathname: "${pathname}"`);
  }

  // Strategy 1: Dashboard pages - usuario autenticado
  if (pathname.startsWith('/dashboard')) {
    if (DEBUG_I18N) {
      console.log(`[i18n] Dashboard detected → Loading authenticated user namespaces`);
    }
    return NAMESPACE_GROUPS.DASHBOARD_AUTHENTICATED;
  }

  // Strategy 2: Auth pages específicas (solo auth, sin public para optimizar)
  const isAuthPage = pathname.startsWith('/auth') ||
                     pathname === '/login' ||
                     pathname === '/signup' ||
                     pathname === '/forgot-password' ||
                     pathname === '/reset-password' ||
                     pathname === '/verify-email' ||
                     pathname.includes('login') ||
                     pathname.includes('signup') ||
                     pathname.includes('auth');

  if (isAuthPage) {
    if (DEBUG_I18N) {
      console.log(`[i18n] Auth page detected → Loading auth-only namespaces`);
    }
    return NAMESPACE_GROUPS.AUTH_ONLY;
  }

  // Strategy 3: Páginas públicas (incluye auth para botones login/signup)
  if (pathname === '/' || pathname.startsWith('/pricing') || pathname.startsWith('/docs') ||
      pathname.startsWith('/support') || pathname.startsWith('/features')) {
    if (DEBUG_I18N) {
      console.log(`[i18n] Public page detected → Loading public + auth namespaces`);
    }
    return NAMESPACE_GROUPS.PUBLIC_INITIAL;
  }

  // Strategy 4: Pathname vacío - estrategia inteligente según contexto
  if (!pathname || pathname === '') {
    if (DEBUG_I18N) {
      console.log(`[i18n] Empty pathname → Using context-aware fallback`);
    }

    // Intentar inferir desde window.location (cliente)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (DEBUG_I18N) {
        console.log(`[i18n] Client-side pathname detected: "${currentPath}"`);
      }

      if (currentPath.startsWith('/dashboard')) {
        return NAMESPACE_GROUPS.DASHBOARD_AUTHENTICATED;
      }
      if (currentPath.includes('login') || currentPath.includes('signup') || currentPath.includes('auth')) {
        return NAMESPACE_GROUPS.AUTH_ONLY;
      }
      if (currentPath === '/' || currentPath.startsWith('/pricing') || currentPath.startsWith('/features')) {
        return NAMESPACE_GROUPS.PUBLIC_INITIAL;
      }
    }

    // Para server-side, defaultear a público (más común en primera carga)
    return NAMESPACE_GROUPS.PUBLIC_INITIAL;
  }

  // Strategy 5: Rutas desconocidas - cargar públicas por defecto
  return NAMESPACE_GROUPS.PUBLIC_INITIAL;
}

// Server-side locale detection (safe for server-only contexts)
async function getServerLocale() {
  try {
    return await getUserLocale();
  } catch {
    // Fallback si falla la detección (ej: contexto de cliente)
    return I18N_CONFIG.defaultLocale;
  }
}

export default getRequestConfig(async () => {
  // Safe locale detection que no rompe en el cliente
  let locale: string;

  try {
    // Intentar obtener locale del servidor
    locale = await getServerLocale();
  } catch {
    // Fallback para contextos de cliente
    locale = I18N_CONFIG.defaultLocale;
  }

  try {
    // Get current pathname for optimized loading
    let pathname = '';
    try {
      const headersList = await headers();
      pathname = headersList.get('x-pathname') || headersList.get('x-url') || '';

      // If still empty, try to extract from referrer or other headers
      if (!pathname) {
        const referer = headersList.get('referer') || '';
        if (referer) {
          try {
            const url = new URL(referer);
            pathname = url.pathname;
            if (DEBUG_I18N) {
              console.log(`[i18n] Extracted pathname from referer: "${pathname}"`);
            }
          } catch {
            // Ignore URL parsing errors
          }
        }
      }
    } catch {
      // Headers might not be available in all contexts, fallback gracefully
    }

    // Load translations using registry-based system with built-in fallback chain
    // Note: loadMergedTranslations already handles Core -> Theme -> Entity merge
    // and has internal locale fallback (es-MX -> es -> en)
    const messages = await loadMergedTranslations(locale as SupportedLocale);

    if (DEBUG_I18N) {
      console.log(`[i18n] Loaded merged translations for ${locale} with ${Object.keys(messages).length} namespaces`);
    }

    return {
      locale,
      messages
    };
  } catch (error) {
    // Single fallback: loadMergedTranslations already handles locale chain internally
    // If it fails completely, gracefully degrade to empty messages
    console.error(`[i18n] Failed to load translations for ${locale}:`, error);
    return {
      locale: I18N_CONFIG.defaultLocale,
      messages: {}
    };
  }
});

// Export utility functions for client-side preloading
export { getPageNamespaces, NAMESPACE_GROUPS };
export { loadOptimizedTranslations } from './lib/translations/i18n-integration';