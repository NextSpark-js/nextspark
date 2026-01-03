'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  DragOverlay,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'
import { Plus, X } from 'lucide-react'
import { KanbanColumn, type ListData } from './KanbanColumn'
import { KanbanCard, type CardData } from './KanbanCard'
import { CardDetailModal } from './CardDetailModal'
import { SortableList } from './SortableList'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'

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

interface KanbanBoardProps {
  boardId: string
  /** Optional card ID to open modal on mount (for shareable URLs) */
  initialCardId?: string
}

/**
 * Custom collision detection that prioritizes columns over cards
 * This helps with dropping cards into empty columns or at the end of columns
 */
const customCollisionDetection: CollisionDetection = (args) => {
  // First, check for pointer collisions (most precise)
  const pointerCollisions = pointerWithin(args)

  // If we have a pointer collision, prioritize columns (droppable areas)
  if (pointerCollisions.length > 0) {
    // Sort to prioritize columns over cards
    const sortedCollisions = [...pointerCollisions].sort((a, b) => {
      const aType = a.data?.droppableContainer?.data?.current?.type
      const bType = b.data?.droppableContainer?.data?.current?.type

      // Columns should come first
      if (aType === 'column' && bType !== 'column') return -1
      if (bType === 'column' && aType !== 'column') return 1
      return 0
    })

    return sortedCollisions
  }

  // Fallback to rect intersection
  return rectIntersection(args)
}

export function KanbanBoard({ boardId, initialCardId }: KanbanBoardProps) {
  const [lists, setLists] = useState<ListData[]>([])
  const [cards, setCards] = useState<CardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCard, setActiveCard] = useState<CardData | null>(null)
  const [activeList, setActiveList] = useState<ListData | null>(null)
  const [isAddingList, setIsAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()

  // Track if we've processed the initial card ID to avoid opening multiple times
  const initialCardProcessed = useRef(false)

  // Permission checks
  const canMoveCards = usePermission('cards.move')
  const canCreateLists = usePermission('lists.create')
  const canReorderLists = usePermission('lists.reorder')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Fetch lists and cards
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const headers = getTeamHeaders()

      // Fetch lists for this board
      const listsRes = await fetch(`/api/v1/lists?boardId=${boardId}&limit=100`, { headers })
      const listsData = await listsRes.json()
      const fetchedLists = (listsData.data || []).sort(
        (a: ListData, b: ListData) => (a.position || 0) - (b.position || 0)
      )
      setLists(fetchedLists)

      // Fetch cards for all lists
      if (fetchedLists.length > 0) {
        const cardsRes = await fetch(`/api/v1/cards?boardId=${boardId}&limit=500`, { headers })
        const cardsData = await cardsRes.json()
        const fetchedCards = (cardsData.data || []).sort(
          (a: CardData, b: CardData) => (a.position || 0) - (b.position || 0)
        )
        setCards(fetchedCards)
      }
    } catch (error) {
      console.error('Error fetching board data:', error)
      toast({
        title: 'Error loading board',
        description: 'Could not load board data.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Open card modal when initialCardId is provided and cards are loaded
  useEffect(() => {
    if (
      initialCardId &&
      !initialCardProcessed.current &&
      cards.length > 0 &&
      !isLoading
    ) {
      const cardToOpen = cards.find((c) => c.id === initialCardId)
      if (cardToOpen) {
        setSelectedCard(cardToOpen)
        setIsModalOpen(true)
        initialCardProcessed.current = true
      } else {
        // Card not found - show a toast and update URL
        toast({
          title: 'Card not found',
          description: 'The requested card could not be found.',
          variant: 'destructive',
        })
        // Update URL without page reload
        window.history.replaceState(null, '', `/dashboard/boards/${boardId}`)
        initialCardProcessed.current = true
      }
    }
  }, [initialCardId, cards, isLoading, boardId, toast])

  // Get cards for a specific list
  const getCardsForList = (listId: string) => {
    return cards.filter((card) => card.listId === listId)
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const dragData = active.data.current

    if (dragData?.type === 'card') {
      // Don't allow card drag if user doesn't have move permission
      if (!canMoveCards) return
      setActiveCard(dragData.card)
    } else if (dragData?.type === 'list') {
      // Don't allow list drag if user doesn't have reorder permission
      if (!canReorderLists) return
      setActiveList(dragData.list)
    }
  }

  // Handle drag over (for moving between columns)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeData = active.data.current
    const overData = over.data.current

    // Only handle card movements
    if (activeData?.type !== 'card') return

    const activeCard = cards.find((c) => c.id === activeId)
    if (!activeCard) return

    // Determine target list
    let targetListId: string | null = null

    // Check for column/list (handles both 'column' from useDroppable and 'list' from useSortable)
    if (overData?.type === 'column' || overData?.type === 'list') {
      // Dropped on a column
      targetListId = overId
    } else if (overData?.type === 'card') {
      // Dropped on another card - get its list
      const overCard = cards.find((c) => c.id === overId)
      if (overCard) {
        targetListId = overCard.listId
      }
    }

    // If moving to a different list, update immediately for visual feedback
    if (targetListId && activeCard.listId !== targetListId) {
      setCards((prev) =>
        prev.map((card) =>
          card.id === activeId ? { ...card, listId: targetListId! } : card
        )
      )
    }
  }

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null)
    setActiveList(null)

    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeData = active.data.current
    const overData = over.data.current

    // Handle list reordering
    if (activeData?.type === 'list') {
      if (activeId !== overId) {
        const oldIndex = lists.findIndex((l) => l.id === activeId)
        const newIndex = lists.findIndex((l) => l.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedLists = arrayMove(lists, oldIndex, newIndex)
          setLists(reorderedLists)

          // Update positions on server
          try {
            await fetch(`/api/v1/lists/${activeId}`, {
              method: 'PATCH',
              headers: getTeamHeaders(),
              body: JSON.stringify({
                position: newIndex,
              }),
            })
          } catch (error) {
            console.error('Error reordering list:', error)
            fetchData()
          }
        }
      }
      return
    }

    if (activeData?.type !== 'card') return

    const activeCard = cards.find((c) => c.id === activeId)
    if (!activeCard) return

    // Determine final list and position
    let targetListId = activeCard.listId
    let newPosition = activeCard.position || 0

    // Check if dropped on a column/list (handles both 'column' from useDroppable and 'list' from useSortable)
    if (overData?.type === 'column' || overData?.type === 'list') {
      targetListId = overId
      // Add to end of list
      const listCards = cards.filter((c) => c.listId === overId)
      newPosition = listCards.length
    } else if (overData?.type === 'card') {
      const overCard = cards.find((c) => c.id === overId)
      if (overCard) {
        targetListId = overCard.listId
        
        // Reorder within list
        const listCards = cards.filter((c) => c.listId === targetListId)
        const oldIndex = listCards.findIndex((c) => c.id === activeId)
        const newIndex = listCards.findIndex((c) => c.id === overId)
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(listCards, oldIndex, newIndex)
          setCards((prev) => {
            const otherCards = prev.filter((c) => c.listId !== targetListId)
            return [...otherCards, ...reordered]
          })
        }
        
        newPosition = newIndex
      }
    }

    // Update on server
    try {
      await fetch(`/api/v1/cards/${activeId}`, {
        method: 'PATCH',
        headers: getTeamHeaders(),
        body: JSON.stringify({
          listId: targetListId,
          position: newPosition,
        }),
      })
    } catch (error) {
      console.error('Error moving card:', error)
      // Refetch to sync state
      fetchData()
    }
  }

  // Add new list
  const handleAddList = async () => {
    if (!newListName.trim()) return

    try {
      const response = await fetch('/api/v1/lists', {
        method: 'POST',
        headers: getTeamHeaders(),
        body: JSON.stringify({
          name: newListName.trim(),
          boardId,
          position: lists.length,
        }),
      })

      if (response.ok) {
        const newList = await response.json()
        setLists((prev) => [...prev, newList.data || newList])
        setNewListName('')
        setIsAddingList(false)
      }
    } catch (error) {
      console.error('Error creating list:', error)
      toast({
        title: 'Error',
        description: 'Could not create list.',
        variant: 'destructive',
      })
    }
  }

  // Add new card
  const handleAddCard = async (listId: string, title: string) => {
    try {
      const listCards = getCardsForList(listId)
      const response = await fetch('/api/v1/cards', {
        method: 'POST',
        headers: getTeamHeaders(),
        body: JSON.stringify({
          title,
          listId,
          boardId,
          position: listCards.length,
        }),
      })

      if (response.ok) {
        const newCard = await response.json()
        setCards((prev) => [...prev, newCard.data || newCard])
      }
    } catch (error) {
      console.error('Error creating card:', error)
      toast({
        title: 'Error',
        description: 'Could not create card.',
        variant: 'destructive',
      })
    }
  }

  // Handle card click to open modal and update URL
  const handleCardClick = (card: CardData) => {
    setSelectedCard(card)
    setIsModalOpen(true)
    // Update URL without page reload using History API
    window.history.pushState(null, '', `/dashboard/boards/${boardId}/${card.id}`)
  }

  // Handle modal close - update URL back to board
  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedCard(null)
    // Update URL without page reload using History API
    window.history.pushState(null, '', `/dashboard/boards/${boardId}`)
  }

  // Handle card update from modal
  const handleCardUpdate = async (updatedCard: CardData) => {
    try {
      const response = await fetch(`/api/v1/cards/${updatedCard.id}`, {
        method: 'PATCH',
        headers: getTeamHeaders(),
        body: JSON.stringify({
          title: updatedCard.title,
          description: updatedCard.description,
          priority: updatedCard.priority,
          dueDate: updatedCard.dueDate,
        }),
      })

      if (response.ok) {
        // Update local state
        setCards((prev) =>
          prev.map((card) => (card.id === updatedCard.id ? updatedCard : card))
        )
        toast({
          title: 'Card updated',
          description: 'Changes saved successfully.',
        })
      } else {
        throw new Error('Failed to update card')
      }
    } catch (error) {
      console.error('Error updating card:', error)
      toast({
        title: 'Error',
        description: 'Could not update card.',
        variant: 'destructive',
      })
      throw error
    }
  }

  // Handle card delete from modal
  const handleCardDelete = async (cardId: string) => {
    try {
      const response = await fetch(`/api/v1/cards/${cardId}`, {
        method: 'DELETE',
        headers: getTeamHeaders(),
      })

      if (response.ok) {
        // Remove from local state
        setCards((prev) => prev.filter((card) => card.id !== cardId))
        toast({
          title: 'Card deleted',
          description: 'Card has been removed.',
        })
      } else {
        throw new Error('Failed to delete card')
      }
    } catch (error) {
      console.error('Error deleting card:', error)
      toast({
        title: 'Error',
        description: 'Could not delete card.',
        variant: 'destructive',
      })
      throw error
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-72 flex-shrink-0">
            <Skeleton className="h-8 w-32 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-4 p-4 overflow-x-auto min-h-[calc(100vh-200px)]"
        data-cy="kanban-board"
      >
        {/* Columns with sortable context */}
        <SortableContext
          items={lists.map((l) => l.id)}
          strategy={horizontalListSortingStrategy}
        >
          {lists.map((list) => (
            <SortableList
              key={list.id}
              list={list}
              disabled={!canReorderLists}
            >
              {({ dragHandleProps }) => (
                <KanbanColumn
                  list={list}
                  cards={getCardsForList(list.id)}
                  onAddCard={handleAddCard}
                  onCardClick={handleCardClick}
                  dragHandleProps={canReorderLists ? dragHandleProps : undefined}
                />
              )}
            </SortableList>
          ))}
        </SortableContext>

        {/* Add List - Only shown if user has permission */}
        <PermissionGate permission="lists.create">
          <div className="w-72 flex-shrink-0">
            {isAddingList ? (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2" data-cy="lists-add-form">
                <Input
                  autoFocus
                  placeholder="Enter list name..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddList()
                    if (e.key === 'Escape') {
                      setIsAddingList(false)
                      setNewListName('')
                    }
                  }}
                  data-cy="lists-field-name"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleAddList} disabled={!newListName.trim()} data-cy="lists-form-submit">
                    Add List
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingList(false)
                      setNewListName('')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start bg-muted/30 hover:bg-muted/50"
                onClick={() => setIsAddingList(true)}
                data-cy="lists-add-column"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add another list
              </Button>
            )}
          </div>
        </PermissionGate>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeCard && (
          <div className="rotate-3 opacity-90">
            <KanbanCard card={activeCard} />
          </div>
        )}
        {activeList && (
          <div className="rotate-2 opacity-90">
            <KanbanColumn
              list={activeList}
              cards={getCardsForList(activeList.id)}
            />
          </div>
        )}
      </DragOverlay>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handleCardUpdate}
        onDelete={handleCardDelete}
      />
    </DndContext>
  )
}

