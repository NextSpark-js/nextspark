'use client'

import { useCallback, useMemo, useState } from 'react'
import { JsonView, allExpanded, collapseAllNested, defaultStyles, darkStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { useTheme } from 'next-themes'
import { ChevronsDownUp, ChevronsUpDown, Copy } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'

type JsonValue = Record<string, unknown> | unknown[]
type ExpandState = 'all' | 'none' | number

interface JsonViewerProps {
  data: JsonValue
  className?: string
  /** Initial expansion: 'all' | 'none' | number (depth level) */
  initialExpanded?: ExpandState
}

/**
 * JSON Viewer component with collapsible tree structure
 *
 * Wraps react-json-view-lite with theme support and customizable expansion.
 * Uses dark/light styles based on the current theme.
 *
 * @example
 * ```tsx
 * <JsonViewer data={apiResponse} initialExpanded={2} />
 * ```
 */
export function JsonViewer({ data, className, initialExpanded = 2 }: JsonViewerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Memoised, and that is load-bearing rather than an optimisation: react-json-view-lite
  // re-applies this function to EVERY node whenever its identity changes
  // (`useEffect(..., [shouldExpandNode])` inside ExpandableObject). Rebuilt inline, any
  // re-render of a parent — a keystroke elsewhere, applying a preset — would throw away
  // whatever the reader had opened.
  const shouldExpandNode = useMemo(
    () =>
      initialExpanded === 'all'
        ? allExpanded
        : initialExpanded === 'none'
          ? collapseAllNested
          : (level: number) => level < (initialExpanded as number),
    [initialExpanded]
  )

  return (
    <div className={cn('font-mono text-sm', className)}>
      <JsonView
        data={data as object | unknown[]}
        shouldExpandNode={shouldExpandNode}
        style={isDark ? darkStyles : defaultStyles}
      />
    </div>
  )
}

interface JsonViewerWithControlsProps {
  data: JsonValue
  className?: string
  /** Initial expansion: 'all' | 'none' | number (depth level) */
  initialExpanded?: ExpandState
  /** Show expand/collapse buttons */
  showControls?: boolean
}

/**
 * JSON Viewer with Expand All / Collapse All controls
 *
 * @example
 * ```tsx
 * <JsonViewerWithControls data={apiResponse} showControls />
 * ```
 */
export function JsonViewerWithControls({
  data,
  className,
  initialExpanded = 2,
  showControls = true,
}: JsonViewerWithControlsProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [expandState, setExpandState] = useState<ExpandState>(initialExpanded)
  // Bumped by the buttons so pressing Expand twice still expands everything, even though the
  // state value did not change. It belongs in the dependency list below, NOT in a `key`:
  // remounting the tree also loses the scroll position.
  const [applyNonce, setApplyNonce] = useState(0)

  const handleExpandAll = useCallback(() => {
    setExpandState('all')
    setApplyNonce((n) => n + 1)
  }, [])

  const handleCollapseAll = useCallback(() => {
    setExpandState('none')
    setApplyNonce((n) => n + 1)
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }, [data])

  // See the note in JsonViewer above: a fresh function identity resets every node the reader
  // opened by hand. It may only change when they actually ask for it — a button press, or a
  // different initial depth.
  const shouldExpandNode = useMemo(
    () =>
      expandState === 'all'
        ? allExpanded
        : expandState === 'none'
          ? collapseAllNested
          : (level: number) => level < (expandState as number),
    [expandState, applyNonce]
  )

  return (
    <div className={cn('flex flex-col', className)}>
      {showControls && (
        <div className="flex items-center gap-1 mb-2" data-cy="json-viewer-controls">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="h-7 px-2 text-xs"
            data-cy="json-viewer-expand-all"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="h-7 px-2 text-xs"
            data-cy="json-viewer-collapse-all"
          >
            <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
            Collapse
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
            title="Copy to clipboard"
            data-cy="json-viewer-copy"
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy
          </Button>
        </div>
      )}
      <div className="font-mono text-sm flex-1 overflow-auto">
        <JsonView
          data={data as object | unknown[]}
          shouldExpandNode={shouldExpandNode}
          style={isDark ? darkStyles : defaultStyles}
        />
      </div>
    </div>
  )
}
