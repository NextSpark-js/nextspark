'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Clock, MessageSquare, Paperclip, CheckSquare, AlertCircle } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

export interface CardData {
  id: string
  title: string
  description?: string | null
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
  status?: string | null
  dueDate?: string | null
  position?: number
  listId: string
  labels?: string[]
  assigneeId?: string | null
  commentsCount?: number
  attachmentsCount?: number
  checklistProgress?: { completed: number; total: number } | null
}

interface KanbanCardProps {
  card: CardData
  onClick?: () => void
}

// Priority color bar classes
const priorityBarColors: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

// Label color mapping
const labelColors: Record<string, { bg: string; text: string }> = {
  bug: { bg: 'bg-red-500', text: 'text-white' },
  feature: { bg: 'bg-blue-500', text: 'text-white' },
  enhancement: { bg: 'bg-green-500', text: 'text-white' },
  documentation: { bg: 'bg-purple-500', text: 'text-white' },
  urgent: { bg: 'bg-red-600', text: 'text-white' },
  important: { bg: 'bg-orange-500', text: 'text-white' },
  design: { bg: 'bg-pink-500', text: 'text-white' },
  backend: { bg: 'bg-indigo-500', text: 'text-white' },
  frontend: { bg: 'bg-cyan-500', text: 'text-white' },
}

export function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDueDateStatus = () => {
    if (!card.dueDate) return null
    const now = new Date()
    const dueDate = new Date(card.dueDate)
    const diffTime = dueDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return 'overdue'
    if (diffDays === 0) return 'today'
    if (diffDays <= 2) return 'soon'
    return 'normal'
  }

  const dueDateStatus = getDueDateStatus()
  const hasLabels = card.labels && card.labels.length > 0
  const hasMetadata = card.dueDate || card.commentsCount || card.attachmentsCount || card.checklistProgress

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-card rounded-lg border border-border/50 overflow-hidden',
        'cursor-pointer transition-all duration-200',
        'hover:border-border hover:shadow-md hover:-translate-y-0.5',
        isDragging && 'opacity-60 shadow-xl rotate-2 scale-105 z-50'
      )}
      onClick={onClick}
      data-cy={`cards-item-${card.id}`}
      {...attributes}
      {...listeners}
    >
      {/* Priority color bar at top */}
      {card.priority && (
        <div className={cn('h-1 w-full', priorityBarColors[card.priority])} />
      )}

      <div className="p-3 space-y-2">
        {/* Labels row */}
        {hasLabels && (
          <div className="flex flex-wrap gap-1">
            {card.labels!.slice(0, 4).map((label) => {
              const colors = labelColors[label.toLowerCase()] || { bg: 'bg-gray-500', text: 'text-white' }
              return (
                <span
                  key={label}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide',
                    colors.bg, colors.text
                  )}
                >
                  {label}
                </span>
              )
            })}
            {card.labels!.length > 4 && (
              <span className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted rounded-full">
                +{card.labels!.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h4 className="font-medium text-sm leading-snug text-card-foreground">
          {card.title}
        </h4>

        {/* Description preview */}
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}

        {/* Footer badges row */}
        {hasMetadata && (
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            {/* Due date badge */}
            {card.dueDate && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                  dueDateStatus === 'overdue' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                  dueDateStatus === 'today' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                  dueDateStatus === 'soon' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
                  dueDateStatus === 'normal' && 'text-muted-foreground'
                )}
              >
                {dueDateStatus === 'overdue' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                <span className="font-medium">{formatDate(card.dueDate)}</span>
              </div>
            )}

            {/* Checklist progress */}
            {card.checklistProgress && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckSquare className="h-3 w-3" />
                <span>{card.checklistProgress.completed}/{card.checklistProgress.total}</span>
              </div>
            )}

            {/* Comments count */}
            {card.commentsCount && card.commentsCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>{card.commentsCount}</span>
              </div>
            )}

            {/* Attachments count */}
            {card.attachmentsCount && card.attachmentsCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{card.attachmentsCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover overlay for quick actions hint */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}

