'use client'

/**
 * WYSIWYG Editor Component
 *
 * A rich text editor built with native contentEditable.
 * Provides formatting, markdown shortcuts, and a clean interface.
 *
 * No external dependencies - uses document.execCommand for formatting.
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image,
  Minus,
  Undo,
  Redo,
  Eye,
  EyeOff
} from 'lucide-react'

interface WysiwygEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  autoFocus?: boolean
}

interface ToolbarButton {
  icon: React.ReactNode
  command: string
  value?: string
  title: string
}

const TOOLBAR_GROUPS: ToolbarButton[][] = [
  [
    { icon: <Undo className="h-4 w-4" />, command: 'undo', title: 'Undo' },
    { icon: <Redo className="h-4 w-4" />, command: 'redo', title: 'Redo' },
  ],
  [
    { icon: <Bold className="h-4 w-4" />, command: 'bold', title: 'Bold (Ctrl+B)' },
    { icon: <Italic className="h-4 w-4" />, command: 'italic', title: 'Italic (Ctrl+I)' },
    { icon: <Underline className="h-4 w-4" />, command: 'underline', title: 'Underline (Ctrl+U)' },
    { icon: <Strikethrough className="h-4 w-4" />, command: 'strikeThrough', title: 'Strikethrough' },
  ],
  [
    { icon: <Heading1 className="h-4 w-4" />, command: 'formatBlock', value: 'h1', title: 'Heading 1' },
    { icon: <Heading2 className="h-4 w-4" />, command: 'formatBlock', value: 'h2', title: 'Heading 2' },
    { icon: <Heading3 className="h-4 w-4" />, command: 'formatBlock', value: 'h3', title: 'Heading 3' },
  ],
  [
    { icon: <List className="h-4 w-4" />, command: 'insertUnorderedList', title: 'Bullet List' },
    { icon: <ListOrdered className="h-4 w-4" />, command: 'insertOrderedList', title: 'Numbered List' },
    { icon: <Quote className="h-4 w-4" />, command: 'formatBlock', value: 'blockquote', title: 'Quote' },
  ],
  [
    { icon: <Code className="h-4 w-4" />, command: 'formatBlock', value: 'pre', title: 'Code Block' },
    { icon: <LinkIcon className="h-4 w-4" />, command: 'createLink', title: 'Insert Link' },
    { icon: <Image className="h-4 w-4" />, command: 'insertImage', title: 'Insert Image' },
    { icon: <Minus className="h-4 w-4" />, command: 'insertHorizontalRule', title: 'Horizontal Line' },
  ],
]

export function WysiwygEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  className,
  minHeight = '400px',
  autoFocus = false
}: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const isComposing = useRef(false)

  // Initialize content
  useEffect(() => {
    if (editorRef.current && !isComposing.current) {
      const currentContent = editorRef.current.innerHTML
      if (currentContent !== value) {
        editorRef.current.innerHTML = value || ''
      }
    }
  }, [value])

  // Auto focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus()
    }
  }, [autoFocus])

  const handleInput = useCallback(() => {
    if (editorRef.current && !isComposing.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
    }
  }, [onChange])

  const execCommand = useCallback((command: string, value?: string) => {
    if (command === 'createLink') {
      const url = prompt('Enter URL:')
      if (url) {
        document.execCommand('createLink', false, url)
      }
    } else if (command === 'insertImage') {
      const url = prompt('Enter image URL:')
      if (url) {
        document.execCommand('insertImage', false, url)
      }
    } else if (command === 'formatBlock' && value) {
      document.execCommand('formatBlock', false, `<${value}>`)
    } else {
      document.execCommand(command, false, value)
    }

    // Update content after command
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }

    // Keep focus on editor
    editorRef.current?.focus()
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          execCommand('bold')
          break
        case 'i':
          e.preventDefault()
          execCommand('italic')
          break
        case 'u':
          e.preventDefault()
          execCommand('underline')
          break
        case 'z':
          if (e.shiftKey) {
            e.preventDefault()
            execCommand('redo')
          } else {
            e.preventDefault()
            execCommand('undo')
          }
          break
      }
    }

    // Markdown shortcuts on space
    if (e.key === ' ' && editorRef.current) {
      const selection = window.getSelection()
      if (selection && selection.anchorNode) {
        const text = selection.anchorNode.textContent || ''
        const offset = selection.anchorOffset

        // Check for markdown patterns at the beginning of line
        if (offset <= 3) {
          const line = text.substring(0, offset)

          if (line === '#') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(1)
            execCommand('formatBlock', 'h1')
          } else if (line === '##') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(2)
            execCommand('formatBlock', 'h2')
          } else if (line === '###') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(3)
            execCommand('formatBlock', 'h3')
          } else if (line === '-' || line === '*') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(1)
            execCommand('insertUnorderedList')
          } else if (line === '1.') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(2)
            execCommand('insertOrderedList')
          } else if (line === '>') {
            e.preventDefault()
            selection.anchorNode.textContent = text.substring(1)
            execCommand('formatBlock', 'blockquote')
          }
        }
      }
    }
  }, [execCommand])

  const handleCompositionStart = () => {
    isComposing.current = true
  }

  const handleCompositionEnd = () => {
    isComposing.current = false
    handleInput()
  }

  return (
    <div className={cn('rounded-lg border border-input bg-background', className)} data-cy="wysiwyg-container">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30" data-cy="wysiwyg-toolbar">
        {TOOLBAR_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center">
            {group.map((button) => (
              <Button
                key={button.command + (button.value || '')}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => execCommand(button.command, button.value)}
                title={button.title}
                data-cy={`wysiwyg-${button.command}${button.value ? `-${button.value}` : ''}`}
              >
                {button.icon}
              </Button>
            ))}
            {groupIndex < TOOLBAR_GROUPS.length - 1 && (
              <div className="w-px h-6 bg-border mx-1" />
            )}
          </div>
        ))}

        {/* Preview Toggle */}
        <div className="ml-auto">
          <Button
            type="button"
            variant={isPreview ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => setIsPreview(!isPreview)}
            data-cy="wysiwyg-preview-toggle"
          >
            {isPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {isPreview ? (
        <div
          className="flex-1 min-h-0 prose prose-sm max-w-none p-4 overflow-auto"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: value || '<p class="text-muted-foreground">Nothing to preview...</p>' }}
          data-cy="wysiwyg-preview"
        />
      ) : (
        <div className="flex-1 min-h-0 relative" data-cy="wysiwyg-editor-wrapper">
          <div
            ref={editorRef}
            contentEditable
            className={cn(
              'h-full prose prose-sm max-w-none p-4 outline-none overflow-auto',
              'focus:ring-0 focus:outline-none',
              '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4',
              '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3',
              '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2',
              '[&_p]:mb-4 [&_p]:last:mb-0',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4',
              '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4',
              '[&_li]:mb-1',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-4',
              '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:mb-4 [&_pre]:overflow-x-auto',
              '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
              '[&_a]:text-primary [&_a]:underline',
              '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-4',
              '[&_hr]:my-6 [&_hr]:border-border'
            )}
            style={{ minHeight }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            data-placeholder={placeholder}
            data-cy="wysiwyg-content"
          />

          {/* Placeholder */}
          {!value && !isFocused && (
            <div
              className="absolute top-4 left-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
              data-cy="wysiwyg-placeholder"
            >
              {placeholder}
            </div>
          )}
        </div>
      )}

      {/* Status Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground" data-cy="wysiwyg-statusbar">
        <span data-cy="wysiwyg-shortcuts">
          Shortcuts: # H1, ## H2, ### H3, - List, 1. Numbered, &gt; Quote
        </span>
        <span data-cy="wysiwyg-wordcount">
          {value.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length} words
        </span>
      </div>
    </div>
  )
}

export default WysiwygEditor
