'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

export interface UseTreeNavigationOptions {
  /** Base path that precedes the dynamic segments (e.g., '/dev/tests') */
  basePath: string
  /** Whether to auto-expand folders leading to selected path (default: true) */
  autoExpandPath?: boolean
  /** Optional callback when path changes */
  onPathChange?: (path: string | null) => void
}

export interface UseTreeNavigationReturn {
  /** Currently selected path (relative, without basePath) */
  selectedPath: string | null
  /** Set of expanded folder paths */
  expandedFolders: Set<string>
  /** Navigate to a file path */
  navigateToFile: (path: string) => void
  /** Toggle folder expansion */
  toggleFolder: (path: string) => void
  /** Expand a folder without navigation */
  expandFolder: (path: string) => void
  /** Collapse a folder */
  collapseFolder: (path: string) => void
  /** Check if path is within current selection */
  isPathInSelection: (path: string) => boolean
  /** Clear selection (navigate to base) */
  clearSelection: () => void
}

/**
 * Hook for tree navigation with URL synchronization
 *
 * Provides bidirectional sync between URL pathname and tree selection state.
 * Auto-expands folders leading to the selected file.
 *
 * @example
 * ```tsx
 * const {
 *   selectedPath,
 *   expandedFolders,
 *   navigateToFile,
 *   toggleFolder,
 * } = useTreeNavigation({ basePath: '/dev/tests' })
 *
 * // URL: /dev/tests/auth/login.bdd.md
 * // selectedPath: 'auth/login.bdd.md'
 * // expandedFolders: Set(['auth'])
 * ```
 */
export function useTreeNavigation(options: UseTreeNavigationOptions): UseTreeNavigationReturn {
  const { basePath, autoExpandPath = true, onPathChange } = options

  const pathname = usePathname()
  const router = useRouter()
  const prevPathnameRef = useRef(pathname)

  // Parse selected path from URL
  const selectedPath = useMemo(() => {
    if (!pathname.startsWith(basePath)) return null
    const relativePath = pathname.slice(basePath.length)
    // Remove leading slash and return, or null if empty
    const cleaned = relativePath.replace(/^\//, '')
    return cleaned || null
  }, [pathname, basePath])

  // Compute auto-expanded folders from selected path
  const autoExpandedFolders = useMemo(() => {
    if (!selectedPath || !autoExpandPath) return new Set<string>()

    const folders = new Set<string>()
    const segments = selectedPath.split('/')

    // Build folder paths: auth, auth/admin, etc. (not including file itself)
    for (let i = 1; i < segments.length; i++) {
      folders.add(segments.slice(0, i).join('/'))
    }

    return folders
  }, [selectedPath, autoExpandPath])

  // Manual expansions (folders user clicked that aren't in auto-expanded)
  const [manualExpansions, setManualExpansions] = useState<Set<string>>(new Set())

  // Track collapsed folders (user explicitly collapsed an auto-expanded folder)
  const [manualCollapses, setManualCollapses] = useState<Set<string>>(new Set())

  // Combined expanded folders: auto-expanded minus manual collapses plus manual expansions
  const expandedFolders = useMemo(() => {
    const result = new Set<string>()

    // Add auto-expanded folders (unless manually collapsed)
    for (const folder of autoExpandedFolders) {
      if (!manualCollapses.has(folder)) {
        result.add(folder)
      }
    }

    // Add manual expansions
    for (const folder of manualExpansions) {
      result.add(folder)
    }

    return result
  }, [autoExpandedFolders, manualExpansions, manualCollapses])

  // Handle URL changes (browser back/forward)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      // Reset manual collapses when URL changes (new path should show its ancestors)
      setManualCollapses(new Set())
      onPathChange?.(selectedPath)
    }
  }, [pathname, selectedPath, onPathChange])

  // Navigate to file
  const navigateToFile = useCallback((path: string) => {
    const newUrl = `${basePath}/${path}`
    router.push(newUrl)
  }, [basePath, router])

  // Clear selection
  const clearSelection = useCallback(() => {
    router.push(basePath)
  }, [basePath, router])

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    const isCurrentlyExpanded = expandedFolders.has(path)

    if (isCurrentlyExpanded) {
      // Collapse: if auto-expanded, add to collapses; if manual, remove from expansions
      if (autoExpandedFolders.has(path)) {
        setManualCollapses(prev => new Set([...prev, path]))
      } else {
        setManualExpansions(prev => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    } else {
      // Expand: remove from collapses (if was auto-expanded), add to expansions
      setManualCollapses(prev => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
      if (!autoExpandedFolders.has(path)) {
        setManualExpansions(prev => new Set([...prev, path]))
      }
    }
  }, [expandedFolders, autoExpandedFolders])

  // Expand folder
  const expandFolder = useCallback((path: string) => {
    setManualCollapses(prev => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
    if (!autoExpandedFolders.has(path)) {
      setManualExpansions(prev => new Set([...prev, path]))
    }
  }, [autoExpandedFolders])

  // Collapse folder
  const collapseFolder = useCallback((path: string) => {
    if (autoExpandedFolders.has(path)) {
      setManualCollapses(prev => new Set([...prev, path]))
    } else {
      setManualExpansions(prev => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
    }
  }, [autoExpandedFolders])

  // Check if path is in current selection tree
  const isPathInSelection = useCallback((path: string) => {
    if (!selectedPath) return false
    return selectedPath === path || selectedPath.startsWith(path + '/')
  }, [selectedPath])

  return {
    selectedPath,
    expandedFolders,
    navigateToFile,
    toggleFolder,
    expandFolder,
    collapseFolder,
    isPathInSelection,
    clearSelection,
  }
}
