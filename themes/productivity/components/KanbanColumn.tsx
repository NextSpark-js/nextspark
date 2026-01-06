'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { GripVertical, Plus, X, MoreHorizontal } from 'lucide-react'
import { KanbanCard, type CardData } from './KanbanCard'
import { cn } from '@nextsparkjs/core/lib/utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import type { DragHandleProps } from './SortableList'

export interface ListData {
  id: string
  name: string
  position: number
  boardId: string
}

interface KanbanColumnProps {
  list: ListData
  cards: CardData[]
  onAddCard?: (listId: string, title: string) => void
  onCardClick?: (card: CardData) => void
  dragHandleProps?: DragHandleProps
  onDeleteList?: (listId: string) => void
  onRenameList?: (listId: string, newName: string) => void
}

export function KanbanColumn({
  list,
  cards,
  onAddCard,
  onCardClick,
  dragHandleProps,
  onDeleteList,
  onRenameList,
}: KanbanColumnProps) {
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(list.name)

  // Permission check for list editing
  const canUpdateList = usePermission('lists.update')

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
      type: 'column',
      list,
    },
  })

  const handleAddCard = () => {
    if (newCardTitle.trim() && onAddCard) {
      onAddCard(list.id, newCardTitle.trim())
      setNewCardTitle('')
      setIsAddingCard(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCard()
    } else if (e.key === 'Escape') {
      setIsAddingCard(false)
      setNewCardTitle('')
    }
  }

  const handleRename = () => {
    if (editedName.trim() && editedName !== list.name && onRenameList) {
      onRenameList(list.id, editedName.trim())
    }
    setIsEditing(false)
  }

  const cardIds = cards.map((c) => c.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-[280px] flex-shrink-0 rounded-xl transition-all duration-200',
        'bg-muted/40 dark:bg-muted/20 backdrop-blur-sm',
        'border border-border/30',
        isOver && 'ring-2 ring-primary/50 bg-primary/5'
      )}
      style={{
        maxHeight: 'calc(100vh - 180px)',
      }}
      data-cy={`lists-column-${list.id}`}
    >
      {/* Column Header */}
      <div className="px-3 pt-3 pb-2" data-cy={`lists-column-header-${list.id}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {dragHandleProps && (
              <button
                {...dragHandleProps}
                className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-background/80 shrink-0"
                aria-label="Drag to reorder list"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            {isEditing ? (
              <Input
                autoFocus
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') {
                    setEditedName(list.name)
                    setIsEditing(false)
                  }
                }}
                className="h-7 text-sm font-semibold px-1.5 bg-background"
              />
            ) : (
              <h3
                className={cn(
                  "font-semibold text-sm text-foreground truncate transition-colors",
                  canUpdateList && "cursor-pointer hover:text-primary"
                )}
                onClick={canUpdateList ? () => setIsEditing(true) : undefined}
                data-cy={`lists-column-title-${list.id}`}
              >
                {list.name}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-0.5 rounded-md">
              {cards.length}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" data-cy={`lists-column-menu-trigger-${list.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" data-cy={`lists-column-menu-${list.id}`}>
                <PermissionGate permission="lists.update">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    Rename list
                  </DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission="cards.create">
                  <DropdownMenuItem onClick={() => setIsAddingCard(true)}>
                    Add card
                  </DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission="lists.delete">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteList?.(list.id)}
                  >
                    Delete list
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Cards Container with custom scrollbar */}
      <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
        <div className="min-h-[60px] pb-2 px-1">
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cards.length === 0 && !isAddingCard && (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No cards yet
                </div>
              )}
              {cards.map((card) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick?.(card)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* Add Card Section - Fixed at bottom */}
      <PermissionGate permission="cards.create">
        <div className="px-3 py-2 border-t border-border/30">
          {isAddingCard ? (
            <div className="space-y-2" data-cy={`cards-add-form-${list.id}`}>
              <textarea
                autoFocus
                placeholder="Enter a title for this card..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddCard()
                  }
                  if (e.key === 'Escape') {
                    setIsAddingCard(false)
                    setNewCardTitle('')
                  }
                }}
                className="w-full min-h-[60px] p-2 text-sm bg-card border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-cy={`cards-field-title-${list.id}`}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAddCard} disabled={!newCardTitle.trim()} data-cy={`cards-form-submit-${list.id}`}>
                  Add Card
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingCard(false)
                    setNewCardTitle('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg"
              onClick={() => setIsAddingCard(true)}
              data-cy={`lists-add-card-${list.id}`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add a card
            </Button>
          )}
        </div>
      </PermissionGate>

      {/* Drop indicator line when dragging over */}
      {isOver && (
        <div className="absolute inset-x-2 bottom-14 h-0.5 bg-primary rounded-full animate-pulse" />
      )}
    </div>
  )
}

