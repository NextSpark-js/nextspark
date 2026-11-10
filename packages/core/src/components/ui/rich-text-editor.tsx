'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'
import { Bold, Italic, Link, List, ListOrdered } from 'lucide-react'
import { Button } from './button'
import { Textarea } from './textarea'
import { useSectionText } from '../../lib/i18n/common-text'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  'data-cy'?: string
}

/**
 * Simple Rich Text Editor component
 *
 * Currently uses a textarea with formatting toolbar hints.
 * Can be upgraded to TipTap or similar for full WYSIWYG support.
 *
 * Supports basic HTML formatting through markdown-like shortcuts:
 * - **bold** or <b>bold</b>
 * - *italic* or <i>italic</i>
 * - [link text](url) or <a href="url">link text</a>
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder: placeholderProp,
  className,
  disabled = false,
  'data-cy': dataCy,
}: RichTextEditorProps) {
  const text = useSectionText('entities.richTextEditor', {
    placeholder: 'Enter content...',
    bold: 'Bold',
    italic: 'Italic',
    insertLink: 'Insert Link',
    bulletList: 'Bullet List',
    numberedList: 'Numbered List',
    help: 'Supports HTML formatting. Use toolbar buttons or write HTML directly.',
  })
  const placeholder = placeholderProp ?? text.placeholder
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const insertTag = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const before = value.substring(0, start)
    const after = value.substring(end)

    const newValue = `${before}${openTag}${selectedText}${closeTag}${after}`
    onChange(newValue)

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + openTag.length + selectedText.length + closeTag.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleBold = () => insertTag('<strong>', '</strong>')
  const handleItalic = () => insertTag('<em>', '</em>')
  const handleLink = () => {
    const url = window.prompt('Enter URL:', 'https://')
    if (url) {
      insertTag(`<a href="${url}">`, '</a>')
    }
  }
  const handleList = () => insertTag('<ul>\n  <li>', '</li>\n</ul>')
  const handleOrderedList = () => insertTag('<ol>\n  <li>', '</li>\n</ol>')

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleBold}
          disabled={disabled}
          title={text.bold}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleItalic}
          disabled={disabled}
          title={text.italic}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleLink}
          disabled={disabled}
          title={text.insertLink}
        >
          <Link className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleList}
          disabled={disabled}
          title={text.bulletList}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleOrderedList}
          disabled={disabled}
          title={text.numberedList}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        className="font-mono text-sm"
        data-cy={dataCy}
      />

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        {text.help}
      </p>
    </div>
  )
}
