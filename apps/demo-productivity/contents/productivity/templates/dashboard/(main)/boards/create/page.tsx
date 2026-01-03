'use client'

/**
 * Productivity Theme - Create Board Page
 *
 * Form for creating a new board.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
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
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@nextsparkjs/core/hooks/useToast'
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

export default function CreateBoardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
  })

  // Permission check
  const hasCreatePermission = usePermission('boards.create')

  // If user doesn't have permission, show NoPermission component
  if (hasCreatePermission === false) {
    return (
      <NoPermission
        entityName="Board"
        action="create"
      />
    )
  }

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
      const response = await fetch('/api/v1/boards', {
        method: 'POST',
        headers: getTeamHeaders(),
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create board')
      }

      const data = await response.json()
      const boardId = data.data?.id || data.id

      toast({ title: 'Board created successfully!' })
      router.push(`/dashboard/boards/${boardId}`)
    } catch (error) {
      console.error('Error creating board:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not create board.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto" data-cy="boards-create-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/boards">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Board</h1>
          <p className="text-muted-foreground text-sm">
            Set up a new board to organize your work
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
                autoFocus
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
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} data-cy="boards-form-submit">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Board'
                )}
              </Button>
              <Link href="/dashboard/boards">
                <Button type="button" variant="outline" disabled={isSubmitting} data-cy="boards-form-cancel">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
