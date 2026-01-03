'use client'

/**
 * Blog Theme - Editorial Dashboard Home
 *
 * Simplified dashboard focused on content creation with:
 * - Quick stats (total posts, drafts, published)
 * - Recent posts list
 * - Quick actions (write post, view blog)
 */

import { useUserProfile } from '@nextsparkjs/core/hooks/useUserProfile'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { cn } from '@nextsparkjs/core/lib/utils'
import {
  Loader2,
  FileText,
  FilePen,
  CheckCircle,
  Clock,
  Plus,
  ExternalLink,
  ArrowRight,
  PenLine,
  Eye,
  MoreHorizontal
} from 'lucide-react'

interface PostStats {
  total: number
  published: number
  drafts: number
}

interface RecentPost {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
}

function getActiveTeamId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('activeTeamId')
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const teamId = getActiveTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  return headers
}

async function fetchPosts(): Promise<{ stats: PostStats; recent: RecentPost[] }> {
  try {
    const headers = buildHeaders()

    // Fetch all posts to get stats
    const response = await fetch('/api/v1/posts?limit=100&sortBy=updatedAt&sortOrder=desc', {
      credentials: 'include',
      headers,
    })

    if (!response.ok) {
      throw new Error('Failed to fetch posts')
    }

    const result = await response.json()
    const posts = result.data || []

    const stats: PostStats = {
      total: posts.length,
      published: posts.filter((p: RecentPost) => p.status === 'published').length,
      drafts: posts.filter((p: RecentPost) => p.status === 'draft').length
    }

    const recent = posts.slice(0, 5).map((post: RecentPost) => ({
      id: post.id,
      title: post.title,
      status: post.status,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }))

    return { stats, recent }
  } catch (error) {
    console.error('Error fetching posts:', error)
    return {
      stats: { total: 0, published: 0, drafts: 0 },
      recent: []
    }
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} min ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

export default function BlogDashboardPage() {
  const { user, isLoading: userLoading } = useUserProfile()
  const router = useRouter()
  const [stats, setStats] = useState<PostStats>({ total: 0, published: 0, drafts: 0 })
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    async function loadData() {
      setDataLoading(true)
      const { stats, recent } = await fetchPosts()
      setStats(stats)
      setRecentPosts(recent)
      setDataLoading(false)
    }

    if (user) {
      loadData()
    }
  }, [user])

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {user.firstName || 'Writer'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Ready to write something amazing today?
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/" target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Blog
              </Button>
            </Link>
            <Link href="/dashboard/posts/create">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {dataLoading ? '-' : stats.total}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Published
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {dataLoading ? '-' : stats.published}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Live on blog
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Drafts
              </CardTitle>
              <FilePen className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {dataLoading ? '-' : stats.drafts}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                In progress
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Posts</CardTitle>
              <CardDescription>
                Your latest articles
              </CardDescription>
            </div>
            <Link href="/dashboard/posts">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="text-center py-8">
                <PenLine className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium mb-2">No posts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start writing your first blog post
                </p>
                <Link href="/dashboard/posts/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first post
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {post.title || 'Untitled'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                            post.status === 'published'
                              ? 'bg-green-500/15 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30'
                              : 'bg-amber-500/15 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
                          )}
                        >
                          {post.status === 'published' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Published
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Draft
                            </>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Updated {formatDate(post.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {post.status === 'published' && (
                        <Link
                          href={`/posts/${post.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/posts/create')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <PenLine className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Write a new post</h3>
                <p className="text-sm text-muted-foreground">
                  Start creating your next article
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/posts')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Manage posts</h3>
                <p className="text-sm text-muted-foreground">
                  Edit, publish, or delete posts
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
