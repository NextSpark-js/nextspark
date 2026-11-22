"use client"

import * as React from "react"
import { ThemeContext } from "./theme-provider"

/**
 * Wraps an area with a session (dashboard, devtools, superadmin): inside it `useTheme()` answers without the public
 * theme, and while it is mounted the provider applies the visitor's theme (#510). Only the layouts of the areas import
 * it, so public pages do not load it (#546).
 */
export function ThemeArea({ children }: React.PropsWithChildren) {
  const theme = React.useContext(ThemeContext)
  const area = theme?.area
  const value = React.useMemo(() => theme && area && { ...theme, forcedTheme: area[0] }, [theme, area])
  React.useLayoutEffect(() => {
    area?.[1](true)
    return () => area?.[1](false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the setter is stable; the value changes with the theme
  }, [])
  return value ? <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider> : children
}
