/**
 * Mock Theme Registry for Jest tests
 */

export interface ThemeEntity {
  name: string
  source: string
  config: any
}

export interface ThemeRouteFile {
  path: string
  type: 'api' | 'page'
  methods?: string[]
}

export interface ThemeRegistryEntry {
  name: string
  slug: string
  displayName: string
  description: string
  version: string
  entities: ThemeEntity[]
  routes: ThemeRouteFile[]
  middlewares: any[]
  plugins: string[]
  path: string
}

export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  default: {
    name: 'default',
    slug: 'default',
    displayName: 'Default Theme',
    description: 'Default theme for NextSpark',
    version: '1.0.0',
    entities: [
      { name: 'posts', source: 'default', config: { name: 'posts', label: 'Posts' } }
    ],
    routes: [
      { path: '/api/v1/posts', type: 'api', methods: ['GET', 'POST'] }
    ],
    middlewares: [],
    plugins: [],
    path: 'contents/themes/default',
  },
}

export type ThemeName = keyof typeof THEME_REGISTRY | string

export const THEME_METADATA = {
  generated: new Date().toISOString(),
  activeTheme: 'default',
  totalThemes: Object.keys(THEME_REGISTRY).length,
  totalThemeEntities: 1,
  totalThemeRoutes: 1,
  themes: Object.keys(THEME_REGISTRY),
}

// Helper function for getting active theme
export function getActiveTheme(): ThemeRegistryEntry | undefined {
  return THEME_REGISTRY[THEME_METADATA.activeTheme]
}

// Helper function for getting theme by name
export function getTheme(name: string): ThemeRegistryEntry | undefined {
  return THEME_REGISTRY[name]
}
