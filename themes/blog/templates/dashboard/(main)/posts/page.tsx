'use client'

/**
 * Blog Theme - Custom Posts List Page
 *
 * Modern, responsive posts management with:
 * - Grid/Table view toggle
 * - Status filters
 * - Bulk actions
 * - Inline actions (edit, view, publish, delete)
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Checkbox } from '@nextsparkjs/core/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nextsparkjs/core/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Card, CardContent } from '@nextsparkjs/core/components/ui/card'
import { cn } from '@nextsparkjs/core/lib/utils'
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  LayoutGrid,
  LayoutList,
  Filter,
  ArrowUpDown,
  Loader2,
  ExternalLink,
  Archive,
  Send,
  ImageIcon,
} from 'lucide-react'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  featuredImage: string | null
  status: 'draft' | 'published' | 'scheduled'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

type ViewMode = 'table' | 'grid'
type StatusFilter = 'all' | 'published' | 'draft' | 'scheduled'
type SortOption = 'updatedAt' | 'createdAt' | 'title' | 'publishedAt'

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

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      if (diffMins < 0) return 'Scheduled'
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-green-500/15 text-green-700 border border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30'
    case 'draft':
      return 'bg-amber-500/15 text-amber-700 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
    case 'scheduled':
      return 'bg-blue-500/15 text-blue-700 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'
    default:
      return 'bg-gray-500/15 text-gray-700 border border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'published':
      return <CheckCircle className="h-3 w-3" />
    case 'draft':
      return <Clock className="h-3 w-3" />
    case 'scheduled':
      return <Calendar className="h-3 w-3" />
    default:
      return <FileText className="h-3 w-3" />
  }
}

export default function PostsListPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<Post | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      const headers = buildHeaders()
      const params = new URLSearchParams({
        limit: '100',
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/v1/posts?${params}`, {
        credentials: 'include',
        headers,
      })

      if (!response.ok) throw new Error('Failed to fetch posts')

      const result = await response.json()
      setPosts(result.data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }, [sortBy, sortOrder])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Filter and search posts
  const filteredPosts = posts.filter((post) => {
    // Status filter
    if (statusFilter !== 'all' && post.status !== statusFilter) {
      return false
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        post.title.toLowerCase().includes(query) ||
        post.excerpt?.toLowerCase().includes(query) ||
        post.slug.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Post stats
  const stats = {
    total: posts.length,
    published: posts.filter((p) => p.status === 'published').length,
    draft: posts.filter((p) => p.status === 'draft').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
  }

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set())
    } else {
      setSelectedPosts(new Set(filteredPosts.map((p) => p.id)))
    }
  }

  const toggleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPosts)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedPosts(newSelected)
  }

  // Action handlers
  const handlePublish = async (post: Post) => {
    setActionLoading(post.id)
    try {
      const headers = buildHeaders()
      const response = await fetch(`/api/v1/posts/${post.id}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          status: 'published',
          publishedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) throw new Error('Failed to publish post')
      await fetchPosts()
    } catch (error) {
      console.error('Error publishing post:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnpublish = async (post: Post) => {
    setActionLoading(post.id)
    try {
      const headers = buildHeaders()
      const response = await fetch(`/api/v1/posts/${post.id}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ status: 'draft' }),
      })

      if (!response.ok) throw new Error('Failed to unpublish post')
      await fetchPosts()
    } catch (error) {
      console.error('Error unpublishing post:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!postToDelete) return

    setActionLoading(postToDelete.id)
    try {
      const headers = buildHeaders()
      const response = await fetch(`/api/v1/posts/${postToDelete.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to delete post')
      await fetchPosts()
      setDeleteDialogOpen(false)
      setPostToDelete(null)
    } catch (error) {
      console.error('Error deleting post:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const openDeleteDialog = (post: Post) => {
    setPostToDelete(post)
    setDeleteDialogOpen(true)
  }

  // Bulk actions
  const handleBulkDelete = async () => {
    // TODO: Implement bulk delete
    console.log('Bulk delete:', Array.from(selectedPosts))
  }

  const handleBulkPublish = async () => {
    // TODO: Implement bulk publish
    console.log('Bulk publish:', Array.from(selectedPosts))
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8" data-cy="posts-list-container">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-cy="posts-list-title">Posts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and organize your blog content
            </p>
          </div>
          <Link href="/dashboard/posts/create">
            <Button data-cy="posts-create-button">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter('all')}
            data-cy="posts-stat-all"
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              statusFilter === 'all'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">All Posts</div>
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            data-cy="posts-stat-published"
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              statusFilter === 'published'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
            <div className="text-sm text-muted-foreground">Published</div>
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            data-cy="posts-stat-draft"
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              statusFilter === 'draft'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="text-2xl font-bold text-amber-600">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">Drafts</div>
          </button>
          <button
            onClick={() => setStatusFilter('scheduled')}
            data-cy="posts-stat-scheduled"
            className={cn(
              'p-4 rounded-lg border text-left transition-colors',
              statusFilter === 'scheduled'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
            <div className="text-sm text-muted-foreground">Scheduled</div>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-cy="posts-toolbar">
          <div className="flex flex-1 gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-cy="posts-search-input"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px]" data-cy="posts-sort-select">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">Last Updated</SelectItem>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="publishedAt">Date Published</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {/* Bulk Actions */}
            {selectedPosts.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-cy="posts-bulk-actions">
                    {selectedPosts.size} selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleBulkPublish} data-cy="posts-bulk-publish">
                    <Send className="h-4 w-4 mr-2" />
                    Publish All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive" data-cy="posts-bulk-delete">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                data-cy="posts-view-table"
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                data-cy="posts-view-grid"
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12" data-cy="posts-loading">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card data-cy="posts-empty">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">No posts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first post'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/dashboard/posts/create">
                  <Button data-cy="posts-empty-create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first post
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="border rounded-lg overflow-hidden" data-cy="posts-table-container">
            <div className="overflow-x-auto">
              <table className="w-full" data-cy="posts-table">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={selectedPosts.size === filteredPosts.length && filteredPosts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                      Post
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
                      Status
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                      Published
                    </th>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">
                      Updated
                    </th>
                    <th className="p-3 text-right text-sm font-medium text-muted-foreground w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-muted/30 transition-colors group"
                      data-cy={`posts-row-${post.id}`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedPosts.has(post.id)}
                          onCheckedChange={() => toggleSelectPost(post.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="hidden sm:block flex-shrink-0 w-16 h-12 rounded overflow-hidden bg-muted">
                            {post.featuredImage ? (
                              <Image
                                src={post.featuredImage}
                                alt=""
                                width={64}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/posts/${post.id}/edit`}
                              className="font-medium hover:text-primary transition-colors line-clamp-1"
                              data-cy={`posts-title-${post.id}`}
                            >
                              {post.title || 'Untitled'}
                            </Link>
                            {post.excerpt && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                {post.excerpt}
                              </p>
                            )}
                            {/* Mobile Status Badge */}
                            <div className="mt-1 md:hidden">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                  getStatusColor(post.status)
                                )}
                              >
                                {getStatusIcon(post.status)}
                                {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                            getStatusColor(post.status)
                          )}
                          data-cy={`posts-status-${post.id}`}
                          data-cy-status={post.status}
                        >
                          {getStatusIcon(post.status)}
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {formatDate(post.publishedAt)}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell">
                        {formatDate(post.updatedAt)}
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={actionLoading === post.id}
                              data-cy={`posts-actions-${post.id}`}
                            >
                              {actionLoading === post.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                              data-cy={`posts-edit-${post.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {post.status === 'published' && (
                              <DropdownMenuItem asChild data-cy={`posts-view-live-${post.id}`}>
                                <Link href={`/posts/${post.slug || post.id}`} target="_blank">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Live
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {post.status === 'published' ? (
                              <DropdownMenuItem onClick={() => handleUnpublish(post)} data-cy={`posts-unpublish-${post.id}`}>
                                <Archive className="h-4 w-4 mr-2" />
                                Unpublish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handlePublish(post)} data-cy={`posts-publish-${post.id}`}>
                                <Send className="h-4 w-4 mr-2" />
                                Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(post)}
                              className="text-destructive focus:text-destructive"
                              data-cy={`posts-delete-${post.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-cy="posts-grid-container">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="group overflow-hidden hover:shadow-md transition-shadow"
                data-cy={`posts-card-${post.id}`}
              >
                {/* Featured Image */}
                <div className="aspect-video relative bg-muted">
                  {post.featuredImage ? (
                    <Image
                      src={post.featuredImage}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shadow-sm',
                        getStatusColor(post.status)
                      )}
                    >
                      {getStatusIcon(post.status)}
                      {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                  </div>
                  {/* Selection Checkbox */}
                  <div className="absolute top-2 right-2">
                    <Checkbox
                      checked={selectedPosts.has(post.id)}
                      onCheckedChange={() => toggleSelectPost(post.id)}
                      className="bg-background/80 backdrop-blur-sm"
                    />
                  </div>
                </div>

                <CardContent className="p-4">
                  <Link
                    href={`/dashboard/posts/${post.id}/edit`}
                    className="font-medium hover:text-primary transition-colors line-clamp-2"
                    data-cy={`posts-card-title-${post.id}`}
                  >
                    {post.title || 'Untitled'}
                  </Link>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(post.updatedAt)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {post.status === 'published' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/posts/${post.slug || post.id}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {post.status === 'published' ? (
                            <DropdownMenuItem onClick={() => handleUnpublish(post)}>
                              <Archive className="h-4 w-4 mr-2" />
                              Unpublish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handlePublish(post)}>
                              <Send className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(post)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && filteredPosts.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredPosts.length} of {posts.length} posts
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-cy="posts-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{postToDelete?.title}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-cy="posts-delete-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === postToDelete?.id}
              data-cy="posts-delete-confirm"
            >
              {actionLoading === postToDelete?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
