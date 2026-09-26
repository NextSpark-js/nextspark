import {getRequestConfig} from 'next-intl/server';
import {I18N_CONFIG} from './lib/config';
import { loadMergedTranslations } from './lib/translations/registry';
import { getUserLocale } from './lib/locale';
import type { SupportedLocale } from './lib/entities/types';
import { APP_CONFIG_MERGED } from './lib/config/config-client';
import { getConfiguredClientNamespaces, NAMESPACE_GROUPS } from './lib/i18n/client-messages';
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry';

// Debug flag - only log if explicitly enabled
const DEBUG_I18N = process.env.NEXTSPARK_DEBUG_I18N === 'true';

function getPageNamespaces(pathname: string): string[] {
  const group = pathname.startsWith('/dashboard') ? 'dashboard'
    : pathname.startsWith('/superadmin') ? 'superadmin'
    : pathname.startsWith('/devtools') ? 'devtools'
    : pathname.startsWith('/auth') || /\/(login|signup|forgot-password|reset-password|verify-email)$/.test(pathname) ? 'auth'
    : 'public'

  if (DEBUG_I18N) console.log(`[i18n] ${pathname || '/'} → ${group}`)
  const configuredNamespaces = getConfiguredClientNamespaces({
    entityRegistry: ENTITY_REGISTRY,
    appConfig: APP_CONFIG_MERGED,
  })
  return [...new Set([
    ...NAMESPACE_GROUPS[group],
    ...(group === 'dashboard' || group === 'superadmin' ? configuredNamespaces[group] : []),
  ])]
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

/**
 * The request config next-intl builds translations from. It reads nothing from
 * the request itself: a page rendered with request data is dynamic, and the
 * locale already comes from getUserLocale, resolved once per request.
 */
export default getRequestConfig(async ({ locale: requestedLocale }) => {
  // A caller that already resolved the locale (getMessages({ locale }), the root
  // layout) passes it; anything else resolves it here.
  const locale: string = I18N_CONFIG.supportedLocales.includes(requestedLocale as SupportedLocale)
    ? (requestedLocale as string)
    : await getServerLocale();

  try {
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
