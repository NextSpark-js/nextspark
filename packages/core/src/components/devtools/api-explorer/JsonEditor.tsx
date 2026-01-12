'use client'

import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { useTheme } from 'next-themes'
import { Copy, Wand2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
  minHeight?: string
}

/**
 * JSON Editor component with syntax highlighting and formatting
 *
 * Uses CodeMirror 6 for editing with:
 * - JSON syntax highlighting
 * - Auto-format/prettify button
 * - Copy to clipboard button
 * - Built-in fold/expand via gutter
 * - Line numbers
 * - Dark/light theme support
 *
 * @example
 * ```tsx
 * <JsonEditor
 *   value={jsonString}
 *   onChange={setJsonString}
 *   minHeight="200px"
 * />
 * ```
 */
export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  className,
  minHeight = '150px',
}: JsonEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Format/Prettify JSON
  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(value)
      const formatted = JSON.stringify(parsed, null, 2)
      onChange?.(formatted)
    } catch {
      // Invalid JSON, do nothing
    }
  }, [value, onChange])

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value)
  }, [value])

  // Check if JSON is valid
  const isValidJson = useMemo(() => {
    if (!value.trim()) return true
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }, [value])

  return (
    <div
      className={cn('flex flex-col border rounded-md overflow-hidden', className)}
      data-cy="json-editor"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-7 px-2 text-xs"
            disabled={!isValidJson}
            title="Format JSON"
            data-cy="json-editor-format"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            Format
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs"
          title="Copy to clipboard"
          data-cy="json-editor-copy"
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          Copy
        </Button>
        <div className="flex-1" />
        {!isValidJson && (
          <span className="text-xs text-destructive" data-cy="json-editor-error">
            Invalid JSON
          </span>
        )}
      </div>

      {/* Editor */}
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[json()]}
        theme={isDark ? githubDark : githubLight}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true, // Expand/collapse for objects/arrays
          bracketMatching: true,
          autocompletion: true,
        }}
        style={{ minHeight }}
        data-cy="json-editor-codemirror"
      />
    </div>
  )
}
