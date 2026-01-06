'use client'

import { useState } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { useToast } from '@nextsparkjs/core/hooks/useToast'

interface ExportPostsButtonProps {
  className?: string
}

export function ExportPostsButton({ className }: ExportPostsButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const response = await fetch('/api/v1/posts?limit=1000', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }

      const data = await response.json()
      const posts = data.data || []

      if (posts.length === 0) {
        toast({
          title: 'No posts to export',
          description: 'Create some posts first before exporting.',
          variant: 'default',
        })
        return
      }

      // Prepare export data (remove internal fields)
      const exportData = posts.map((post: Record<string, unknown>) => ({
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        status: post.status,
        publishedAt: post.publishedAt,
        category: post.category,
        tags: post.tags,
      }))

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `posts-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export successful',
        description: `${posts.length} posts exported to JSON.`,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export failed',
        description: 'Could not export posts. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export JSON
    </Button>
  )
}

