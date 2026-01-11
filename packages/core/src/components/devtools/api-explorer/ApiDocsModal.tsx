'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '../../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../ui/dialog'
import { ScrollArea } from '../../ui/scroll-area'
import { sel } from '../../../lib/test'

interface ApiDocsModalProps {
  /** File path to the documentation markdown */
  docPath: string | null
  /** Title to show in the modal header */
  title: string
}

export function ApiDocsModal({ docPath, title }: ApiDocsModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isOpen && docPath && !content) {
      setIsLoading(true)
      setError(null)

      // Fetch markdown content via API
      fetch(`/api/v1/devtools/docs?path=${encodeURIComponent(docPath)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load documentation')
          return res.json()
        })
        .then((data) => {
          setContent(data.content)
          setIsLoading(false)
        })
        .catch((err) => {
          setError(err.message || 'Error loading documentation')
          setIsLoading(false)
        })
    }
  }, [isOpen, docPath, content])

  // Reset content when path changes
  useEffect(() => {
    setContent(null)
    setError(null)
  }, [docPath])

  if (!docPath) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-cy={sel('devtools.apiExplorer.docsBtn')}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Docs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 overflow-auto">
          <div className="pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-destructive">
                <p>{error}</p>
              </div>
            ) : content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-muted-foreground p-4">No documentation available</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

interface MarkdownRendererProps {
  content: string
}

/**
 * Simple markdown renderer for documentation
 * Handles basic markdown syntax without external dependencies
 */
function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Simple markdown to HTML conversion
  const renderMarkdown = (md: string): string => {
    let html = md
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4 text-sm"><code>${code.trim()}</code></pre>`
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p class="my-3">')
      // Single newlines in paragraphs
      .replace(/\n/g, '<br />')

    // Wrap in paragraphs
    html = `<p class="my-3">${html}</p>`

    // Fix list items to be in ul
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul class="list-disc my-3">$&</ul>')

    return html
  }

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
