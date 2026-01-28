/**
 * Theme Provider for React Native
 * Allows apps to customize colors by wrapping their root with ThemeProvider
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultColors } from "./defaultColors";
import type { ThemeColors } from "./types";

interface ThemeContextValue {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  colors?: Partial<ThemeColors>;
  children: ReactNode;
}

/**
 * ThemeProvider - Wrap your app to customize component colors
 *
 * @example
 * ```tsx
 * import { ThemeProvider } from "@nextsparkjs/ui";
 *
 * const myColors = {
 *   primary: "#3B82F6",
 *   primaryForeground: "#FFFFFF",
 * };
 *
 * export default function RootLayout() {
 *   return (
 *     <ThemeProvider colors={myColors}>
 *       <Stack />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({ colors: customColors, children }: ThemeProviderProps) {
  const value = useMemo(
    () => ({
      colors: { ...defaultColors, ...customColors },
    }),
    [customColors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme - Access theme colors in components
 * Falls back to defaultColors if no ThemeProvider is present
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  // Graceful fallback if no provider - components work without wrapping
  if (!context) {
    return { colors: defaultColors };
  }
  return context;
}
