'use client'

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

// Extender Window para incluir requestIdleCallback
interface WindowWithIdleCallback extends Window {
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
}

// Define namespaces localmente para evitar importaciones problemáticas
// Actualizados para la nueva estrategia optimizada
const DASHBOARD_NAMESPACES = ['common', 'dashboard', 'settings', 'public', 'teams', 'admin'];
const AUTH_NAMESPACES = ['common', 'auth', 'validation'];
const PUBLIC_NAMESPACES = ['common', 'public', 'auth'];

/**
 * Hook para precargar traducciones en el cliente y mejorar la UX de navegación
 * Este hook carga proactivamente namespaces según el contexto de la página actual
 */
export function useTranslationPreload(context: 'dashboard' | 'auth' | 'auto' = 'auto') {
  const locale = useLocale();

  useEffect(() => {
    // Función para precargar namespaces específicos
    const preloadNamespaces = async (namespaces: string[], contextName: string) => {
      console.log(`[TranslationPreload] 🚀 Iniciando precarga ${contextName} para ${locale}:`, namespaces);
      
      const promises = namespaces.map(async (namespace) => {
        try {
          // Usar dynamic import para precargar sin bloquear
          await import(`../messages/${locale}/${namespace}.json`);
          console.log(`[TranslationPreload] ✓ Precargado: ${namespace}`);
          return { namespace, success: true };
        } catch (error) {
          console.warn(`[TranslationPreload] ⚠️ Error precargando ${namespace}:`, error);
          return { namespace, success: false, error };
        }
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      console.log(`[TranslationPreload] ✅ Precarga ${contextName} completa: ${successful}/${namespaces.length} namespaces`);
    };

    // Estrategia de precarga inteligente por contexto
    const schedulePreload = () => {
      let namespacesToLoad: string[] = [];
      let contextName = '';

      if (context === 'dashboard') {
        namespacesToLoad = DASHBOARD_NAMESPACES;
        contextName = 'dashboard';
      } else if (context === 'auth') {
        namespacesToLoad = AUTH_NAMESPACES;
        contextName = 'auth';
      } else {
        // Auto-detect basado en la URL actual
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          
          if (currentPath.startsWith('/dashboard')) {
            namespacesToLoad = DASHBOARD_NAMESPACES;
            contextName = 'dashboard (auto-detected)';
          } else if (currentPath.includes('login') || currentPath.includes('signup') || currentPath.includes('auth')) {
            namespacesToLoad = AUTH_NAMESPACES;
            contextName = 'auth (auto-detected)';
          } else {
            namespacesToLoad = PUBLIC_NAMESPACES;
            contextName = 'public (auto-detected)';
          }
        } else {
          // Server-side fallback
          namespacesToLoad = [...DASHBOARD_NAMESPACES, ...AUTH_NAMESPACES];
          contextName = 'mixed (server-side)';
        }
      }

      // Usar requestIdleCallback si está disponible, o setTimeout como fallback
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as WindowWithIdleCallback).requestIdleCallback(() => {
          preloadNamespaces(namespacesToLoad, contextName);
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          preloadNamespaces(namespacesToLoad, contextName);
        }, 1000);
      }
    };

    // Iniciar precarga después de que la página inicial esté lista
    schedulePreload();
  }, [locale, context]);
}

/**
 * Hook para precargar traducciones cuando el usuario está a punto de navegar
 * Se puede usar en componentes de navegación para mejorar la UX
 */
export function useNavigationPreload() {
  const locale = useLocale();

  const preloadForRoute = async (pathname: string) => {
    let namespacesToLoad: string[] = [];

    if (pathname.startsWith('/dashboard')) {
      namespacesToLoad = DASHBOARD_NAMESPACES;
    } else if (pathname.startsWith('/auth')) {
      namespacesToLoad = AUTH_NAMESPACES;
    } else {
      namespacesToLoad = PUBLIC_NAMESPACES;
    }

    console.log(`[NavigationPreload] Precargando para ${pathname}:`, namespacesToLoad);

    const promises = namespacesToLoad.map(namespace =>
      import(`../messages/${locale}/${namespace}.json`).catch(error => {
        console.warn(`[NavigationPreload] Error: ${namespace}`, error);
        return null;
      })
    );

    await Promise.all(promises);
    console.log(`[NavigationPreload] ✅ Listo para navegar a ${pathname}`);
  };

  return { preloadForRoute };
}
