'use client'

/**
 * Productivity Theme - Board Detail Page with Card Modal Open
 *
 * This page renders the board with a specific card modal pre-opened.
 * URL pattern: /dashboard/boards/{boardId}/{cardId}
 *
 * This enables shareable URLs for cards within a board.
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import { ArrowLeft, MoreVertical, Settings, Archive, Trash2 } from 'lucide-react'
import { KanbanBoard } from '@/themes/productivity/components/KanbanBoard'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
import { useRouter } from 'next/navigation'

/**
 * Get headers with x-team-id for API calls
 */
function getTeamHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (typeof window !== 'undefined') {
    const teamId = localStorage.getItem('activeTeamId')
    if (teamId) {
      headers['x-team-id'] = teamId
    }
  }
  return headers
}

interface Board {
  id: string
  name: string
  description?: string | null
  color?: string | null
  status?: string | null
}

interface PageProps {
  params: Promise<{ id: string; cardId: string }>
}

export default function BoardDetailWithCardPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const boardId = resolvedParams.id
  const cardId = resolvedParams.cardId

  const [board, setBoard] = useState<Board | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/v1/boards/${boardId}`, {
          headers: getTeamHeaders(),
        })
        if (!response.ok) {
          throw new Error('Board not found')
        }
        const data = await response.json()
        setBoard(data.data || data)
      } catch (error) {
        console.error('Error fetching board:', error)
        toast({
          title: 'Error',
          description: 'Could not load board.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const handleArchive = async () => {
    try {
      await fetch(`/api/v1/boards/${boardId}`, {
        method: 'PATCH',
        headers: getTeamHeaders(),
        body: JSON.stringify({ status: 'archived' }),
      })
      toast({ title: 'Board archived' })
      router.push('/dashboard/boards')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not archive board.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this board? All lists and cards will be deleted.')) {
      return
    }

    try {
      await fetch(`/api/v1/boards/${boardId}`, {
        method: 'DELETE',
        headers: getTeamHeaders(),
      })
      toast({ title: 'Board deleted' })
      router.push('/dashboard/boards')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete board.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="flex-1 p-4">
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-72 h-96" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold mb-2">Board not found</h2>
        <p className="text-muted-foreground mb-4">
          This board may have been deleted or you don&apos;t have access.
        </p>
        <Link href="/dashboard/boards">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Boards
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/boards">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{board.name}</h1>
              {board.status && board.status !== 'active' && (
                <Badge variant="secondary">{board.status}</Badge>
              )}
            </div>
            {board.description && (
              <p className="text-sm text-muted-foreground">{board.description}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionGate permission="boards.update">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/boards/${boardId}/edit`}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </PermissionGate>
            <DropdownMenuSeparator />
            <PermissionGate permission="boards.archive">
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive Board
              </DropdownMenuItem>
            </PermissionGate>
            <PermissionGate permission="boards.delete">
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Board
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Kanban Board with initial card ID */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard boardId={boardId} initialCardId={cardId} />
      </div>
    </div>
  )
}
