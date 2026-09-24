'use client'

/**
 * Blog Theme - Post View Page
 *
 * Redirects directly to the edit page since the blog theme
 * doesn't need a separate view page for posts.
 */

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PostViewPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    // Redirect to edit page
    router.replace(`/dashboard/posts/${id}/edit`)
  }, [id, router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
