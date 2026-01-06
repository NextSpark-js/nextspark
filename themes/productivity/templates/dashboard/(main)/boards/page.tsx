'use client'

/**
 * Productivity Theme - Boards List Page Override
 *
 * Shows boards as visual cards with color preview and stats.
 * Modern Trello-like grid design.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Kanban, Archive, Trash2, Edit, List, CreditCard, Clock } from 'lucide-react'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
import { cn } from '@nextsparkjs/core/lib/utils'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

interface Board {
  id: string
  name: string
  description?: string | null
  color?: string | null
  status?: string | null
  createdAt: string
  updatedAt?: string
  listsCount?: number
  cardsCount?: number
}

// Board color classes using CSS variables
const boardColorClasses: Record<string, string> = {
  blue: 'bg-[var(--board-blue)]',
  green: 'bg-[var(--board-green)]',
  purple: 'bg-[var(--board-purple)]',
  orange: 'bg-[var(--board-orange)]',
  red: 'bg-[var(--board-red)]',
  pink: 'bg-[var(--board-pink)]',
  gray: 'bg-[var(--board-gray)]',
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { currentTeam } = useTeamContext()
  const hasFetchedRef = useRef(false)
  const toastRef = useRef(toast)

  // Keep toast ref updated
  toastRef.current = toast

  const fetchBoards = useCallback(async (teamId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/v1/boards?limit=50', {
        headers: {
          'Content-Type': 'application/json',
          'x-team-id': teamId,
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setBoards(data.data || [])
    } catch (error) {
      console.error('Error fetching boards:', error)
      // Only show toast once
      if (!hasFetchedRef.current) {
        toastRef.current({
          title: 'Error',
          description: 'Could not load boards.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
      hasFetchedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!currentTeam?.id) {
      setIsLoading(false)
      return
    }
    hasFetchedRef.current = false
    fetchBoards(currentTeam.id)
  }, [currentTeam?.id, fetchBoards])

  const handleArchive = async (boardId: string) => {
    if (!currentTeam?.id) return
    try {
      await fetch(`/api/v1/boards/${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-team-id': currentTeam.id,
        },
        body: JSON.stringify({ status: 'archived' }),
      })
      toast({ title: 'Board archived' })
      fetchBoards(currentTeam.id)
    } catch {
      toast({
        title: 'Error',
        description: 'Could not archive board.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (boardId: string) => {
    if (!currentTeam?.id) return
    if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) return

    try {
      await fetch(`/api/v1/boards/${boardId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-team-id': currentTeam.id,
        },
      })
      toast({ title: 'Board deleted' })
      fetchBoards(currentTeam.id)
    } catch {
      toast({
        title: 'Error',
        description: 'Could not delete board.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" data-cy="boards-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Boards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {boards.length === 0
              ? 'Create your first board to get started'
              : `${boards.length} board${boards.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <PermissionGate permission="boards.create">
          <Button asChild className="gap-2" data-cy="boards-create-btn">
            <Link href="/dashboard/boards/create">
              <Plus className="h-4 w-4" />
              New Board
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {/* Boards Grid */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Kanban className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No boards yet</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Boards help you organize your work into manageable projects.
            Create your first board to start tracking tasks.
          </p>
          <PermissionGate permission="boards.create">
            <Button asChild size="lg" className="gap-2">
              <Link href="/dashboard/boards/create">
                <Plus className="h-5 w-5" />
                Create Your First Board
              </Link>
            </Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* New Board Card */}
          <PermissionGate permission="boards.create">
            <Link
              href="/dashboard/boards/create"
              className="group flex flex-col items-center justify-center h-44 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all"
              data-cy="boards-create-card"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Create new board
              </span>
            </Link>
          </PermissionGate>

          {/* Board Cards */}
          {boards.map((board) => {
            const colorClass = boardColorClasses[board.color || 'blue'] || boardColorClasses.blue

            return (
              <div
                key={board.id}
                className="group relative rounded-xl overflow-hidden border border-border/50 bg-card hover:shadow-lg hover:border-border transition-all duration-200"
                data-cy={`boards-card-${board.id}`}
              >
                {/* Color header */}
                <div className={cn('h-24 relative', colorClass)}>
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                  {/* Menu button */}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          data-cy={`boards-card-menu-${board.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild data-cy={`boards-card-edit-${board.id}`}>
                          <Link href={`/dashboard/boards/${board.id}/edit`} className="flex items-center">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit board
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <PermissionGate permission="boards.archive">
                          <DropdownMenuItem onClick={() => handleArchive(board.id)} data-cy={`boards-card-archive-${board.id}`}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </PermissionGate>
                        <PermissionGate permission="boards.delete">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(board.id)}
                            data-cy={`boards-card-delete-${board.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Board info */}
                <Link href={`/dashboard/boards/${board.id}`} className="block p-4">
                  <h3 className="font-semibold text-foreground truncate mb-1 group-hover:text-primary transition-colors">
                    {board.name}
                  </h3>
                  {board.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                      {board.description}
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {board.listsCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <List className="h-3 w-3" />
                        <span>{board.listsCount} lists</span>
                      </div>
                    )}
                    {board.cardsCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        <span>{board.cardsCount} cards</span>
                      </div>
                    )}
                    {board.updatedAt && (
                      <div className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(board.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

