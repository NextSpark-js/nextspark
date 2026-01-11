'use client'

import { JsonEditor } from '../api-explorer/JsonEditor'

interface PayloadEditorProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Payload Editor for API request bodies
 *
 * Uses JsonEditor for a single editable JSON field with:
 * - Syntax highlighting
 * - Auto-format/prettify
 * - Copy to clipboard
 * - Fold/expand via gutter
 * - Invalid JSON indicator
 */
export function PayloadEditor({ value, onChange }: PayloadEditorProps) {
  return (
    <div data-cy="api-tester-payload">
      <JsonEditor value={value} onChange={onChange} minHeight="400px" />
    </div>
  )
}
