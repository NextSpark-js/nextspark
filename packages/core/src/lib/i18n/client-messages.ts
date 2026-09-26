/**
 * Namespaces that cross an RSC boundary for each generated route group.
 *
 * Keep this list based on `useTranslations` calls in client components, not on
 * server components: server components read the complete request catalog via
 * `getTranslations` and do not serialize it to the browser.
 */
export const NAMESPACE_GROUPS = {
  // QueryProvider is mounted in the root layout on every route.
  root: ['permissions'],

  // PublicNavbar, PublicFooter and the public docs components.
  public: ['auth', 'common', 'docs', 'footer', 'home', 'navigation', 'public', 'validation', 'blog'],

  // Auth forms and validation hooks.
  auth: ['auth', 'common', 'validation'],

  // DashboardShell, settings, entity, media, billing and page-builder UI.
  dashboard: [
    'admin', 'aiUsage', 'auth', 'billing', 'buttons', 'common', 'dashboard',
    'entities', 'features', 'media', 'navigation',
    'permissions', 'public', 'settings', 'teams', 'validation',
  ],

  // Superadmin guards/pages plus the LangChain observability plugin page.
  superadmin: [
    'admin', 'auth', 'billing', 'common', 'dashboard', 'entities', 'navigation',
    'observability', 'permissions', 'settings', 'teams', 'users', 'validation',
  ],

  // DeveloperGuard and every devtools client view.
  devtools: ['common', 'dev', 'devtools', 'permissions'],
} as const

export type TranslationGroup = keyof typeof NAMESPACE_GROUPS
type Messages = Record<string, unknown>

type TranslationKeyConfig = {
  userRoles?: { displayNames?: Record<string, string> }
  mobileNav?: {
    items?: Array<{ labelKey?: string }>
    moreSheetItems?: Array<{ labelKey?: string }>
  }
}

export type ClientMessageRegistryInputs = {
  entityRegistry?: Record<string, unknown>
  appConfig?: TranslationKeyConfig
}

function topLevelNamespaces(keys: Iterable<string | undefined>): string[] {
  return [...new Set(
    [...keys]
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
      .map((key) => key.split('.', 1)[0]),
  )]
}

/**
 * Resolves namespaces that are configuration or registry driven rather than
 * visible as literal `useTranslations('namespace')` calls. Layouts pass the
 * generated registry/config so new project entities and keys cross the client
 * boundary without edits to this framework-owned list.
 */
export function getConfiguredClientNamespaces({
  entityRegistry = {},
  appConfig = {},
}: ClientMessageRegistryInputs = {}): Pick<Record<TranslationGroup, string[]>, 'dashboard' | 'superadmin'> {
  const mobileNavKeys = [
    ...(appConfig.mobileNav?.items ?? []).map(({ labelKey }) => labelKey),
    ...(appConfig.mobileNav?.moreSheetItems ?? []).map(({ labelKey }) => labelKey),
  ]

  return {
    // useContentTranslation(entityName) can resolve every entity's name.
    dashboard: [...new Set([
      ...Object.keys(entityRegistry),
      ...topLevelNamespaces(mobileNavKeys),
    ])],
    // useRoleTranslations() resolves the complete configured role key map.
    superadmin: topLevelNamespaces(Object.values(appConfig.userRoles?.displayNames ?? {})),
  }
}

/**
 * Selects top-level next-intl namespaces without changing their nested shape.
 * Extra namespaces are an explicit, local escape hatch for a project-owned
 * template; see docs/11-internationalization/02-setup-and-configuration.md.
 */
export function selectMessages(
  messages: Messages,
  group: TranslationGroup,
  extraNamespaces: readonly string[] = [],
): Messages {
  const namespaces = new Set<string>([...NAMESPACE_GROUPS[group], ...extraNamespaces])

  return Object.fromEntries(
    Object.entries(messages).filter(([namespace]) => namespaces.has(namespace)),
  )
}
