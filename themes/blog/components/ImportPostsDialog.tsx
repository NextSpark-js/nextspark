'use client'

import { useState, useRef } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nextsparkjs/core/components/ui/dialog'
import { Progress } from '@nextsparkjs/core/components/ui/progress'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { ScrollArea } from '@nextsparkjs/core/components/ui/scroll-area'
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@nextsparkjs/core/hooks/useToast'

interface PostImport {
  title: string
  slug?: string
  content?: string
  excerpt?: string
  featuredImage?: string
  status?: string
  publishedAt?: string
  category?: string
  tags?: string[]
}

interface ImportPostsDialogProps {
  className?: string
  onImportComplete?: () => void
}

export function ImportPostsDialog({ className, onImportComplete }: ImportPostsDialogProps) {
  const [open, setOpen] = useState(false)
  const [posts, setPosts] = useState<PostImport[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JSON file.',
        variant: 'destructive',
      })
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate structure
      const postsArray = Array.isArray(data) ? data : [data]
      const validPosts = postsArray.filter((p: unknown) => {
        if (typeof p !== 'object' || p === null) return false
        const post = p as Record<string, unknown>
        return typeof post.title === 'string' && post.title.length > 0
      })

      if (validPosts.length === 0) {
        toast({
          title: 'No valid posts found',
          description: 'The JSON file must contain posts with at least a title.',
          variant: 'destructive',
        })
        return
      }

      setPosts(validPosts)
      setImportResults({ success: 0, failed: 0 })
    } catch (error) {
      console.error('Parse error:', error)
      toast({
        title: 'Invalid JSON',
        description: 'Could not parse the JSON file.',
        variant: 'destructive',
      })
    }
  }

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleImport = async () => {
    if (posts.length === 0) return

    setIsImporting(true)
    setProgress(0)
    let success = 0
    let failed = 0

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      
      try {
        const response = await fetch('/api/v1/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: post.title,
            slug: post.slug || generateSlug(post.title),
            content: post.content || '',
            excerpt: post.excerpt || '',
            featuredImage: post.featuredImage || null,
            status: post.status || 'draft',
            publishedAt: post.publishedAt || null,
            category: post.category || null,
            tags: post.tags || [],
          }),
        })

        if (response.ok) {
          success++
        } else {
          failed++
        }
      } catch (error) {
        console.error('Import error for post:', post.title, error)
        failed++
      }

      setProgress(Math.round(((i + 1) / posts.length) * 100))
    }

    setImportResults({ success, failed })
    setIsImporting(false)

    if (success > 0) {
      toast({
        title: 'Import complete',
        description: `${success} posts imported successfully${failed > 0 ? `, ${failed} failed` : ''}.`,
      })
      onImportComplete?.()
    } else {
      toast({
        title: 'Import failed',
        description: 'No posts were imported.',
        variant: 'destructive',
      })
    }
  }

  const handleClose = () => {
    setOpen(false)
    setPosts([])
    setProgress(0)
    setImportResults({ success: 0, failed: 0 })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Upload className="h-4 w-4 mr-2" />
          Import JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Posts from JSON</DialogTitle>
          <DialogDescription>
            Upload a JSON file containing posts to import. Each post must have at least a title.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to select a JSON file
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or drag and drop
            </p>
          </div>

          {/* Preview */}
          {posts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {posts.length} posts found
                </span>
                {importResults.success > 0 && (
                  <div className="flex gap-2">
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {importResults.success}
                    </Badge>
                    {importResults.failed > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {importResults.failed}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <ScrollArea className="h-[150px] rounded-md border p-3">
                <div className="space-y-2">
                  {posts.map((post, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="truncate flex-1 mr-2">{post.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {post.status || 'draft'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Importing... {progress}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={posts.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {posts.length} Posts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

