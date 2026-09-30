'use client'

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

// Definir tipos de contextos
type UserContext = 'public' | 'auth' | 'dashboard';

// Definir namespaces por contexto (sincronizado con i18n.ts)
const CONTEXT_NAMESPACES = {
  public: ['common', 'public', 'auth'],
  auth: ['common', 'auth', 'validation'],
  dashboard: ['common', 'dashboard', 'settings', 'public', 'teams', 'admin']
} as const;

/**
 * Hook para carga dinámica e inteligente de traducciones según contexto de navegación
 * Implementa la estrategia de carga optimizada:
 * - Público: public + auth (para login/signup)
 * - Auth: solo auth (optimizado)
 * - Dashboard: dashboard + public (para navegación de vuelta)
 */
export function useContextAwareTranslations() {
  const pathname = usePathname();
  const locale = useLocale();
  const previousContext = useRef<UserContext | null>(null);
  const loadedNamespaces = useRef<Set<string>>(new Set());

  // Determinar contexto actual basado en pathname
  const getCurrentContext = useCallback((path: string): UserContext => {
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.includes('login') || path.includes('signup') || path.includes('auth') || 
        path.includes('forgot-password') || path.includes('reset-password') || path.includes('verify-email')) {
      return 'auth';
    }
    return 'public';
  }, []);

  // Cargar namespaces dinámicamente
  const loadContextNamespaces = useCallback(async (context: UserContext) => {
    const requiredNamespaces = CONTEXT_NAMESPACES[context];
    const newNamespaces = requiredNamespaces.filter(ns => !loadedNamespaces.current.has(ns));
    
    if (newNamespaces.length === 0) {
      if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] ✓ All namespaces for ${context} already loaded`);
      return;
    }

    if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🔄 Loading namespaces for ${context}:`, newNamespaces);

    try {
      // Cargar namespaces usando dinámica imports
      const loadPromises = newNamespaces.map(async (namespace) => {
        try {
          const messages = await import(`../messages/${locale}/${namespace}.json`);
          loadedNamespaces.current.add(namespace);
          if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] ✓ Loaded ${namespace} for ${locale}`);
          return { namespace, messages: messages.default };
        } catch (error) {
          console.warn(`[useContextAwareTranslations] ⚠️ Failed to load ${namespace}:`, error);
          return null;
        }
      });

      await Promise.all(loadPromises);
      if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] ✅ Context ${context} loading complete`);
    } catch (error) {
      console.error(`[useContextAwareTranslations] ❌ Error loading namespaces for ${context}:`, error);
    }
  }, [locale]);

  // Detectar cambios de contexto
  useEffect(() => {
    const currentContext = getCurrentContext(pathname);
    
    // Si cambió el contexto, cargar nuevos namespaces
    if (previousContext.current !== currentContext) {
      if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 📍 Context change: ${previousContext.current} → ${currentContext}`);
      
      // Estrategias específicas según transición
      if (currentContext === 'dashboard' && previousContext.current === 'public') {
        if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🔑 User authenticated, loading dashboard namespaces`);
        loadContextNamespaces('dashboard');
      } else if (currentContext === 'public' && previousContext.current === 'dashboard') {
        if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🌐 Returning to public, ensuring public namespaces available`);
        loadContextNamespaces('public');
      } else if (currentContext === 'auth') {
        if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🔐 Auth context, loading auth-only namespaces`);
        loadContextNamespaces('auth');
      } else {
        // Cambio de contexto normal
        loadContextNamespaces(currentContext);
      }
      
      previousContext.current = currentContext;
    }
  }, [pathname, getCurrentContext, loadContextNamespaces]);

  // Precargar namespaces relacionados en idle time
  useEffect(() => {
    const currentContext = getCurrentContext(pathname);
    
    const preloadRelatedNamespaces = () => {
      // Si estamos en público, precargar auth para transiciones rápidas a login
      if (currentContext === 'public') {
        if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🔄 Preloading auth namespaces for potential login`);
        loadContextNamespaces('auth');
      }
      // Si estamos en dashboard, asegurar que public esté disponible
      else if (currentContext === 'dashboard') {
        if (process.env.NODE_ENV === 'development') console.log(`[useContextAwareTranslations] 🔄 Ensuring public namespaces available for navigation`);
        loadContextNamespaces('public');
      }
    };

    // Usar requestIdleCallback para precargar en tiempo libre
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        const idleCallback = window.requestIdleCallback(preloadRelatedNamespaces, { timeout: 5000 });
        return () => window.cancelIdleCallback(idleCallback);
      } else {
        // Fallback para navegadores que no soportan requestIdleCallback
        const timeout = setTimeout(preloadRelatedNamespaces, 2000);
        return () => clearTimeout(timeout);
      }
    }
  }, [pathname, getCurrentContext, loadContextNamespaces]);

  return {
    currentContext: getCurrentContext(pathname),
    loadedNamespaces: Array.from(loadedNamespaces.current),
    loadContextNamespaces
  };
}

