"use client"

/**
 * The light/dark mode of the app: the provider the root layouts render and the `useTheme` hook.
 *
 * Adapted from next-themes 0.4.6 (MIT, Copyright (c) 2022 Paco Coursey), with the same props, the same `useTheme`
 * value and the same blocking script, so the stored or forced mode is on `<html>` before the first paint. The one
 * difference: next-themes started its system-preference state from the stored theme and read
 * `prefers-color-scheme` in a mount effect, so on a device whose preference differed the context value changed right
 * after the root hydrated. A new context value above a Suspense boundary that has not hydrated yet (a lazily loaded
 * client component whose chunk is still downloading) makes React discard that boundary's server HTML and render it
 * again, losing what the visitor typed (#371). Here the preference is read at the first render in the browser, so the
 * mount effect finds nothing to change.
 */

import * as React from "react"
import { usePathname } from "next/navigation"
import { resolveForcedTheme, type ForcedThemeRoutes } from "../lib/theme/forced-theme"

type Attribute = `data-${string}` | "class"

export interface UseThemeProps {
  /** Every theme name, plus "system" when `enableSystem` */
  themes: string[]
  /** The theme forced on the current page */
  forcedTheme?: string | undefined
  setTheme: React.Dispatch<React.SetStateAction<string>>
  /** The active theme name, as chosen ("system" included) */
  theme?: string | undefined
  /** The active theme with "system" resolved to "dark" or "light" */
  resolvedTheme?: string | undefined
  /** With `enableSystem`, the browser's preference, whatever the active theme is */
  systemTheme?: "dark" | "light" | undefined
}

export interface ThemeProviderProps extends React.PropsWithChildren {
  themes?: string[] | undefined
  forcedTheme?: string | undefined
  /** Follow `prefers-color-scheme` when the theme is "system" */
  enableSystem?: boolean | undefined
  disableTransitionOnChange?: boolean | undefined
  /** Set `color-scheme` on `<html>` for the browser's own controls */
  enableColorScheme?: boolean | undefined
  /** localStorage key of the visitor's choice */
  storageKey?: string | undefined
  defaultTheme?: string | undefined
  /** The `<html>` attribute that carries the theme: `class`, a `data-*` attribute, or several */
  attribute?: Attribute | Attribute[] | undefined
  /** Theme name → attribute value */
  value?: Record<string, string> | undefined
  /** Nonce of the inline script and of the style that disables transitions */
  nonce?: string
  /**
   * Routes whose theme is forced regardless of user/system preference
   * (`theme.config.ts` → `forcedThemeRoutes`).
   *
   * Resolved here, on the client, against `usePathname()` instead of once in
   * the root layout from request headers: the root layout does not re-render
   * on client-side navigations, so a server-computed value would go stale as
   * soon as the user navigated into or out of a forced route. On the initial
   * request this component is still server-rendered, so the blocking script
   * receives the forced value and there is no flash.
   *
   * Takes precedence over the plain `forcedTheme` prop.
   */
  forcedThemeRoutes?: ForcedThemeRoutes
}

const COLOR_SCHEMES = ["light", "dark"]
const MEDIA = "(prefers-color-scheme: dark)"
const DEFAULT_THEMES = ["light", "dark"]
const isServer = typeof window === "undefined"

const ThemeContext = React.createContext<UseThemeProps | undefined>(undefined)
const defaultContext: UseThemeProps = { setTheme: () => {}, themes: [] }

export const useTheme = (): UseThemeProps => React.useContext(ThemeContext) ?? defaultContext

const getSystemTheme = (media?: MediaQueryList | MediaQueryListEvent): "dark" | "light" =>
  (media ?? window.matchMedia(MEDIA)).matches ? "dark" : "light"

function getStoredTheme(key: string, fallback?: string): string | undefined {
  if (isServer) return undefined
  let theme: string | undefined
  try {
    theme = localStorage.getItem(key) || undefined
  } catch {
    // localStorage can throw (blocked storage)
  }
  return theme || fallback
}

function disableAnimation(nonce?: string): () => void {
  const style = document.createElement("style")
  if (nonce) style.setAttribute("nonce", nonce)
  style.appendChild(document.createTextNode("*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"))
  document.head.appendChild(style)
  return () => {
    // Force a restyle before the transitions come back
    window.getComputedStyle(document.body)
    setTimeout(() => document.head.removeChild(style), 1)
  }
}

/** Runs inline before the page paints; serialized with toString, so it must not reference anything outside itself */
const script = (
  attribute: Attribute | Attribute[],
  storageKey: string,
  defaultTheme: string,
  forcedTheme: string | undefined,
  themes: string[],
  value: Record<string, string> | undefined,
  enableSystem: boolean,
  enableColorScheme: boolean,
) => {
  const el = document.documentElement
  const systemThemes = ["light", "dark"]
  function updateDOM(theme: string) {
    const attributes = Array.isArray(attribute) ? attribute : [attribute]
    attributes.forEach((attr) => {
      const isClass = attr === "class"
      const classes = isClass && value ? themes.map((t) => value[t] || t) : themes
      if (isClass) {
        el.classList.remove(...classes)
        el.classList.add(value && value[theme] ? value[theme] : theme)
      } else {
        el.setAttribute(attr, theme)
      }
    })
    if (enableColorScheme && systemThemes.includes(theme)) el.style.colorScheme = theme
  }
  if (forcedTheme) {
    updateDOM(forcedTheme)
  } else {
    try {
      const themeName = localStorage.getItem(storageKey) || defaultTheme
      const isSystem = enableSystem && themeName === "system"
      updateDOM(isSystem ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : themeName)
    } catch {
      // localStorage can throw (blocked storage)
    }
  }
}

type ScriptProps = Required<Pick<ThemeProviderProps, "attribute" | "storageKey" | "defaultTheme" | "themes" | "enableSystem" | "enableColorScheme">> &
  Pick<ThemeProviderProps, "forcedTheme" | "value" | "nonce">

const ThemeScript = React.memo(function ThemeScript({ forcedTheme, storageKey, attribute, enableSystem, enableColorScheme, defaultTheme, value, themes, nonce }: ScriptProps) {
  const args = JSON.stringify([attribute, storageKey, defaultTheme, forcedTheme, themes, value, enableSystem, enableColorScheme]).slice(1, -1)
  return (
    <script
      suppressHydrationWarning
      // The browser hides a nonce from the DOM after load, so the client renders it empty, as next-themes does
      nonce={isServer ? nonce : ""}
      dangerouslySetInnerHTML={{ __html: `(${script.toString()})(${args})` }}
    />
  )
})

function ColorModeProvider({
  forcedTheme,
  disableTransitionOnChange = false,
  enableSystem = true,
  enableColorScheme = true,
  storageKey = "theme",
  themes = DEFAULT_THEMES,
  defaultTheme = enableSystem ? "system" : "light",
  attribute = "data-theme",
  value,
  children,
  nonce,
}: Omit<ThemeProviderProps, "forcedThemeRoutes">) {
  const [theme, setThemeState] = React.useState(() => getStoredTheme(storageKey, defaultTheme))
  // Read at the first render in the browser, not first in the mount effect: the effect below then sets the same
  // value, React bails out, and the context does not change after hydration (#371). The server has no preference.
  const [systemTheme, setSystemTheme] = React.useState<"dark" | "light" | undefined>(() => (isServer ? undefined : getSystemTheme()))
  const attrs = value ? Object.values(value) : themes

  const applyTheme = React.useCallback((next: string | undefined) => {
    if (!next) return
    const resolved = next === "system" && enableSystem ? getSystemTheme() : next
    const name = value ? value[resolved] : resolved
    const enable = disableTransitionOnChange ? disableAnimation(nonce) : null
    const d = document.documentElement
    const handleAttribute = (attr: Attribute) => {
      if (attr === "class") {
        d.classList.remove(...attrs)
        if (name) d.classList.add(name)
      } else if (attr.startsWith("data-")) {
        if (name) d.setAttribute(attr, name)
        else d.removeAttribute(attr)
      }
    }
    if (Array.isArray(attribute)) attribute.forEach(handleAttribute)
    else handleAttribute(attribute)
    if (enableColorScheme) {
      const fallback = COLOR_SCHEMES.includes(defaultTheme) ? defaultTheme : null
      d.style.colorScheme = (COLOR_SCHEMES.includes(resolved) ? resolved : fallback) ?? ""
    }
    enable?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as next-themes: a DOM write, the props are fixed per layout
  }, [nonce])

  const setTheme = React.useCallback((next: React.SetStateAction<string>) => {
    const newTheme = typeof next === "function" ? next(theme ?? "") : next
    setThemeState(newTheme)
    try {
      localStorage.setItem(storageKey, newTheme)
    } catch {
      // localStorage can throw (blocked storage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey is fixed per layout
  }, [theme])

  const handleMediaQuery = React.useCallback((media: MediaQueryList | MediaQueryListEvent) => {
    setSystemTheme(getSystemTheme(media))
    if (theme === "system" && enableSystem && !forcedTheme) applyTheme("system")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enableSystem and applyTheme are fixed per layout
  }, [theme, forcedTheme])

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA)
    // addListener, not addEventListener: Safari before 14 has only the former
    media.addListener(handleMediaQuery)
    handleMediaQuery(media)
    return () => media.removeListener(handleMediaQuery)
  }, [handleMediaQuery])

  // Another tab changed the stored theme
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return
      if (e.newValue) setThemeState(e.newValue)
      else setTheme(defaultTheme)
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey and defaultTheme are fixed per layout
  }, [setTheme])

  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyTheme changes only with the nonce
  }, [forcedTheme, theme])

  const providerValue = React.useMemo<UseThemeProps>(() => ({
    theme,
    setTheme,
    forcedTheme,
    resolvedTheme: theme === "system" ? systemTheme : theme,
    themes: enableSystem ? [...themes, "system"] : themes,
    systemTheme: enableSystem ? systemTheme : undefined,
  }), [theme, setTheme, forcedTheme, systemTheme, enableSystem, themes])

  return (
    <ThemeContext.Provider value={providerValue}>
      <ThemeScript
        forcedTheme={forcedTheme}
        storageKey={storageKey}
        attribute={attribute}
        enableSystem={enableSystem}
        enableColorScheme={enableColorScheme}
        defaultTheme={defaultTheme}
        value={value}
        themes={themes}
        nonce={nonce}
      />
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Reads the pathname, so it is only rendered when the app declares forced routes. `usePathname()` is runtime data
 * for a route with dynamic segments: with Cache Components a component that reads it outside Suspense fails the
 * prerender, and this provider sits at the top of the root layout.
 */
function RouteForcedThemeProvider({ children, forcedThemeRoutes, forcedTheme, ...props }: ThemeProviderProps & { forcedThemeRoutes: ForcedThemeRoutes }) {
  const pathname = usePathname()
  const routeForcedTheme = resolveForcedTheme(pathname, forcedThemeRoutes)

  return (
    <ColorModeProvider {...props} forcedTheme={routeForcedTheme ?? forcedTheme}>
      {children}
    </ColorModeProvider>
  )
}

export function ThemeProvider({ children, forcedThemeRoutes, forcedTheme, ...props }: ThemeProviderProps) {
  if (forcedThemeRoutes && Object.keys(forcedThemeRoutes).length > 0) {
    return (
      <RouteForcedThemeProvider {...props} forcedTheme={forcedTheme} forcedThemeRoutes={forcedThemeRoutes}>
        {children}
      </RouteForcedThemeProvider>
    )
  }

  return (
    <ColorModeProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </ColorModeProvider>
  )
}
