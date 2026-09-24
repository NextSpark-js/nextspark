'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@nextsparkjs/core/components/ui/dialog'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import { Label } from '@nextsparkjs/core/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Calendar } from '@nextsparkjs/core/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@nextsparkjs/core/components/ui/popover'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { Calendar as CalendarIcon, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { format } from 'date-fns'
import type { CardData } from './KanbanCard'

interface CardDetailModalProps {
  card: CardData | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (card: CardData) => Promise<void>
  onDelete?: (cardId: string) => Promise<void>
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
]

export function CardDetailModal({
  card,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: CardDetailModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setPriority(card.priority || '')
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined)
      setHasChanges(false)
    }
  }, [card])

  // Track changes
  useEffect(() => {
    if (!card) return
    const changed =
      title !== card.title ||
      description !== (card.description || '') ||
      priority !== (card.priority || '') ||
      (dueDate?.toISOString().split('T')[0] || '') !== (card.dueDate || '')
    setHasChanges(changed)
  }, [card, title, description, priority, dueDate])

  const handleSave = useCallback(async () => {
    if (!card || !title.trim()) return

    setIsSaving(true)
    try {
      await onUpdate({
        ...card,
        title: title.trim(),
        description: description.trim() || null,
        priority: (priority as CardData['priority']) || null,
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : null,
      })
      onClose()
    } catch (error) {
      console.error('Error saving card:', error)
    } finally {
      setIsSaving(false)
    }
  }, [card, title, description, priority, dueDate, onUpdate, onClose])

  const handleDelete = useCallback(async () => {
    if (!card || !onDelete) return
    if (!confirm('Are you sure you want to delete this card?')) return

    setIsDeleting(true)
    try {
      await onDelete(card.id)
      onClose()
    } catch (error) {
      console.error('Error deleting card:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [card, onDelete, onClose])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      // Escape to close (if no changes)
      if (e.key === 'Escape' && !hasChanges) {
        onClose()
      }

      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && hasChanges) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasChanges, onClose, handleSave])

  if (!card) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]" data-cy="cards-modal">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <PermissionGate permission="cards.update" fallback={
            <div>
              <Label className="text-muted-foreground text-xs">Title</Label>
              <p className="font-medium mt-1">{card.title}</p>
            </div>
          }>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title..."
                className="mt-1"
                autoFocus
                data-cy="cards-modal-title"
              />
            </div>
          </PermissionGate>

          {/* Description */}
          <PermissionGate permission="cards.update" fallback={
            <div>
              <Label className="text-muted-foreground text-xs">Description</Label>
              <p className="text-sm mt-1 text-muted-foreground">
                {card.description || 'No description'}
              </p>
            </div>
          }>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                className="mt-1 min-h-[100px]"
                data-cy="cards-modal-description"
              />
            </div>
          </PermissionGate>

          {/* Priority and Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <PermissionGate permission="cards.update" fallback={
              <div>
                <Label className="text-muted-foreground text-xs">Priority</Label>
                <p className="text-sm mt-1">{card.priority || 'None'}</p>
              </div>
            }>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1" data-cy="cards-modal-priority">
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={cn('px-2 py-0.5 rounded text-xs', opt.color)}>
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PermissionGate>

            {/* Due Date */}
            <PermissionGate permission="cards.update" fallback={
              <div>
                <Label className="text-muted-foreground text-xs">Due Date</Label>
                <p className="text-sm mt-1">
                  {card.dueDate ? format(new Date(card.dueDate), 'PPP') : 'None'}
                </p>
              </div>
            }>
              <div>
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full mt-1 justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                      data-cy="cards-modal-due-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                    {dueDate && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setDueDate(undefined)}
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </PermissionGate>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <PermissionGate permission="cards.delete">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                data-cy="cards-modal-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </PermissionGate>

            <div className="flex items-center gap-2 ml-auto">
              {hasChanges && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
              <Button variant="outline" onClick={onClose} disabled={isSaving} data-cy="cards-modal-cancel">
                Cancel
              </Button>
              <PermissionGate permission="cards.update">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving || !title.trim()}
                  data-cy="cards-modal-save"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘ Enter</kbd> to save
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
