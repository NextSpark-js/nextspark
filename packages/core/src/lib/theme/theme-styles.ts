/**
 * Browser-only application of the current project's theme variables.
 *
 * This module deliberately has no registry or service imports. ThemeProvider
 * is mounted in the root client boundary, so one server registry import here
 * would make dashboard and development configuration reachable from every
 * public route.
 */

import type { ThemeConfig } from '../../types/theme'

let darkModeObserver: MutationObserver | null = null

function isDarkMode(): boolean {
  return typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
}

function applyColorVariables(colors: Record<string, unknown>): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key}`, String(value))
    root.style.setProperty(`--theme-color-${key}`, String(value))
  }
}

function applyCurrentModeColors(theme: ThemeConfig): void {
  const colors = isDarkMode() && theme.config?.darkColors
    ? theme.config.darkColors
    : theme.config?.colors
  if (colors) applyColorVariables(colors)
}

function setupDarkModeObserver(theme: ThemeConfig): void {
  if (typeof window === 'undefined') return

  darkModeObserver?.disconnect()
  darkModeObserver = null

  if (!theme.config?.colors && !theme.config?.darkColors) return

  darkModeObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutation => mutation.attributeName === 'class')) {
      applyCurrentModeColors(theme)
    }
  })
  darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

export function applyThemeStyles(theme: ThemeConfig): void {
  if (typeof window === 'undefined') return

  try {
    const root = document.documentElement
    applyCurrentModeColors(theme)
    setupDarkModeObserver(theme)

    for (const [key, value] of Object.entries(theme.config?.fonts ?? {})) {
      root.style.setProperty(`--font-${key}`, String(value))
      root.style.setProperty(`--theme-font-${key}`, String(value))
    }
    for (const [key, value] of Object.entries(theme.config?.spacing ?? {})) {
      root.style.setProperty(`--${key}`, String(value))
    }
    for (const [key, value] of Object.entries(theme.config?.shadows ?? {})) {
      root.style.setProperty(`--${key}`, String(value))
    }
  } catch (error) {
    console.error('[Theme] Error applying theme styles:', error)
  }
}

export function cleanupThemeObserver(): void {
  darkModeObserver?.disconnect()
  darkModeObserver = null
}
