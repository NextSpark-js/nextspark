'use client'

import { useState, useCallback } from 'react'
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

  // Determine expansion function based on prop
  const shouldExpandNode =
    initialExpanded === 'all'
      ? allExpanded
      : initialExpanded === 'none'
        ? collapseAllNested
        : (level: number) => level < (initialExpanded as number)

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

  // State to control expansion - using a key to force re-render
  const [expandState, setExpandState] = useState<ExpandState>(initialExpanded)
  const [viewKey, setViewKey] = useState(0)

  // Handlers for expand/collapse all
  const handleExpandAll = useCallback(() => {
    setExpandState('all')
    setViewKey((k) => k + 1) // Force re-render
  }, [])

  const handleCollapseAll = useCallback(() => {
    setExpandState('none')
    setViewKey((k) => k + 1) // Force re-render
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }, [data])

  // Determine expansion function based on state
  const shouldExpandNode =
    expandState === 'all'
      ? allExpanded
      : expandState === 'none'
        ? collapseAllNested
        : (level: number) => level < (expandState as number)

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
          key={viewKey}
          data={data as object | unknown[]}
          shouldExpandNode={shouldExpandNode}
          style={isDark ? darkStyles : defaultStyles}
        />
      </div>
    </div>
  )
}
