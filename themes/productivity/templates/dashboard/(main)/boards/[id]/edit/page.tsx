'use client'

/**
 * Productivity Theme - Edit Board Page
 *
 * Form for editing an existing board.
 */

import { useState, useEffect, use, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import { Label } from '@nextsparkjs/core/components/ui/label'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import { NoPermission } from '@nextsparkjs/core/components/permissions/NoPermission'

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

const colorOptions = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-500' },
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditBoardPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const boardId = resolvedParams.id

  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
    archived: false,
  })

  // Permission check for boards.update
  const hasUpdatePermission = usePermission('boards.update')

  // Use refs for toast and router to avoid useEffect dependency issues
  const toastRef = useRef(toast)
  const routerRef = useRef(router)
  const hasFetchedRef = useRef(false)

  // Keep refs updated
  toastRef.current = toast
  routerRef.current = router

  const fetchBoard = useCallback(async () => {
    // Prevent duplicate fetches
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    try {
      setIsLoading(true)
      const response = await fetch(`/api/v1/boards/${boardId}`, {
        headers: getTeamHeaders(),
      })
      if (!response.ok) {
        throw new Error('Board not found')
      }
      const data = await response.json()
      const board = data.data || data
      setFormData({
        name: board.name || '',
        description: board.description || '',
        color: board.color || 'blue',
        archived: board.archived || board.status === 'archived' || false,
      })
    } catch (error) {
      console.error('Error fetching board:', error)
      toastRef.current({
        title: 'Error',
        description: 'Could not load board.',
        variant: 'destructive',
      })
      routerRef.current.push('/dashboard/boards')
    } finally {
      setIsLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Board name is required.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/v1/boards/${boardId}`, {
        method: 'PATCH',
        headers: getTeamHeaders(),
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          status: formData.archived ? 'archived' : 'active',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update board')
      }

      toast({ title: 'Board updated successfully!' })
      router.push(`/dashboard/boards/${boardId}`)
    } catch (error) {
      console.error('Error updating board:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update board.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this board? All lists and cards will be deleted.')) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/v1/boards/${boardId}`, {
        method: 'DELETE',
        headers: getTeamHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete board')
      }

      toast({ title: 'Board deleted' })
      router.push('/dashboard/boards')
    } catch (error) {
      console.error('Error deleting board:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not delete board.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // If user doesn't have permission, show NoPermission component
  if (hasUpdatePermission === false) {
    return (
      <NoPermission
        entityName="Board"
        action="update"
      />
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto" data-cy="boards-edit-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/boards/${boardId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Board</h1>
          <p className="text-muted-foreground text-sm">
            Update board settings and details
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Board Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" data-cy="boards-form">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter board name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
                data-cy="boards-field-name"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this board is for..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={3}
                data-cy="boards-field-description"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="color" data-cy="boards-field-color">
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${color.class}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Archived */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="archived">Archive Board</Label>
                <p className="text-sm text-muted-foreground">
                  Archived boards are hidden from the main view
                </p>
              </div>
              <Switch
                id="archived"
                checked={formData.archived}
                onCheckedChange={(checked) => setFormData({ ...formData, archived: checked })}
                disabled={isSubmitting}
                data-cy="boards-field-archived"
              />
            </div>

            {/* Color Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                <div
                  className={`h-2 ${colorOptions.find(c => c.value === formData.color)?.class || 'bg-blue-500'}`}
                />
                <div className="p-4 bg-muted/30">
                  <p className="font-medium">{formData.name || 'Board Name'}</p>
                  {formData.description && (
                    <p className="text-sm text-muted-foreground mt-1">{formData.description}</p>
                  )}
                  {formData.archived && (
                    <span className="inline-block mt-2 text-xs bg-muted px-2 py-1 rounded">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSubmitting} data-cy="boards-form-submit">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Link href={`/dashboard/boards/${boardId}`}>
                  <Button type="button" variant="outline" disabled={isSubmitting} data-cy="boards-form-cancel">
                    Cancel
                  </Button>
                </Link>
              </div>

              {/* Delete - Only shown if user has permission */}
              <PermissionGate permission="boards.delete">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  data-cy="boards-form-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Board
                </Button>
              </PermissionGate>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
