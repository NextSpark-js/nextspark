'use client'

import dynamic from 'next/dynamic'

// The editor (CodeMirror) is most of the API Explorer's JavaScript and nothing on the first paint needs it, so it
// loads after hydration. The placeholder has the editor's box (toolbar row + minHeight, one border around) so the
// page does not move when it arrives.
const JsonEditor = dynamic(() => import('../api-explorer/JsonEditor').then((m) => m.JsonEditor), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col border rounded-md overflow-hidden" aria-hidden="true">
      <div className="h-[37px] border-b bg-muted/30" />
      <div style={{ minHeight: '400px' }} />
    </div>
  ),
})

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
