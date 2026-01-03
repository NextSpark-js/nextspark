'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { useTeams } from '../../hooks/useTeams'
import { useTeamContext } from '../../contexts/TeamContext'
import { toast } from 'sonner'

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTeamDialog({ open, onOpenChange }: CreateTeamDialogProps) {
  const t = useTranslations('teams')
  const { createTeamAsync, isCreating } = useTeams()
  const { refreshTeams } = useTeamContext()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createTeamAsync({
        name,
        slug,
        description: description || undefined
      })

      toast.success(t('messages.created'))
      await refreshTeams()
      onOpenChange(false)

      // Reset form
      setName('')
      setSlug('')
      setDescription('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.unauthorized'))
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="create-team-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('actions.create')}</DialogTitle>
            <DialogDescription>
              {t('entity.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="team-name">
                {t('fields.name')}
              </Label>
              <Input
                id="team-name"
                name="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('fields.name')}
                required
                data-cy="team-name-input"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="team-slug">
                {t('fields.slug')}
              </Label>
              <Input
                id="team-slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="team-url-slug"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                required
                data-cy="team-slug-input"
              />
              <p className="text-sm text-muted-foreground">
                {t('fields.slug')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="team-description">
                {t('fields.description')}
              </Label>
              <Textarea
                id="team-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('fields.description')}
                rows={3}
                data-cy="team-description-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              data-cy="cancel-create-team"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              data-cy="submit-create-team"
            >
              {isCreating ? t('actions.creating') : t('actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
