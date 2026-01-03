// Type definitions for internationalization
export type Messages = typeof import('./es/index.ts').default;

// Available translation namespaces (inferred from actual message files)
export type TranslationNamespace = keyof Messages;

// Translation function types
export type TranslationFunction = (key: string, values?: Record<string, unknown>) => string;

// Namespace data types
export type NamespaceData<T extends TranslationNamespace = TranslationNamespace> = Messages[T];

// Cache and loader types
export type NamespaceCache = Map<string, NamespaceData>;
export type NamespacesMap = Record<TranslationNamespace, NamespaceData>;

// Debug types
export interface DebugNamespaceInfo {
  available: boolean;
  testKeys?: Record<string, boolean>;
  error?: string;
}

export interface TranslationDebugInfo {
  locale: string;
  timestamp: string;
  namespaces: Record<string, DebugNamespaceInfo>;
}

// Global declaration for next-intl
declare global {
  // Use type alias instead of empty interface to avoid ESLint error
  type IntlMessages = Messages;
}

// Namespace types for better organization (backward compatibility)
export type CommonMessages = Messages['common']
export type DashboardMessages = Messages['dashboard']
export type SettingsMessages = Messages['settings']
export type AuthMessages = Messages['auth']
export type PublicMessages = Messages['public']
export type ValidationMessages = Messages['validation']
export type SuperadminMessages = Messages['superadmin']
