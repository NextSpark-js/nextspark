'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Alert, AlertDescription } from '../ui/alert'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useTeamUpdate } from '../../hooks/useTeamUpdate'
import { sel } from '../../lib/test'
import { cn } from '../../lib/utils'

interface InlineEditableFieldProps {
  value: string | null
  fieldType: 'name' | 'description'
  teamId: string
  placeholder?: string
  multiline?: boolean
  disabled?: boolean // true = hide edit icons (non-owner)
  className?: string
  onSaveSuccess?: () => void
}

export function InlineEditableField({
  value,
  fieldType,
  teamId,
  placeholder,
  multiline = false,
  disabled = false,
  className,
  onSaveSuccess,
}: InlineEditableFieldProps) {
  const t = useTranslations('teams')
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const updateMutation = useTeamUpdate(teamId)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value || '')
    }
  }, [value, isEditing])

  const handleEdit = useCallback(() => {
    setEditValue(value || '')
    setValidationError(null)
    setIsEditing(true)
  }, [value])

  const handleCancel = useCallback(() => {
    setEditValue(value || '')
    setValidationError(null)
    setIsEditing(false)
  }, [value])

  const handleSave = useCallback(async () => {
    // Validate name field
    if (fieldType === 'name') {
      if (!editValue.trim()) {
        setValidationError(t('errors.nameRequired', { defaultValue: 'Team name is required' }))
        return
      }
      if (editValue.trim().length < 2) {
        setValidationError(
          t('validation.nameMinLength', {
            defaultValue: 'Name must be at least 2 characters',
          })
        )
        return
      }
      if (editValue.trim().length > 100) {
        setValidationError(
          t('validation.nameMaxLength', {
            defaultValue: 'Name must be at most 100 characters',
          })
        )
        return
      }
    }

    setValidationError(null)

    try {
      // Only send the field that changed
      await updateMutation.mutateAsync(
        fieldType === 'name'
          ? { name: editValue.trim() }
          : { description: editValue.trim() || null }
      )

      setIsEditing(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
      onSaveSuccess?.()
    } catch (error) {
      // Error handled by mutation - will show in UI via updateMutation.error
      const errorMessage =
        error instanceof Error ? error.message : t('editTeam.error')
      setValidationError(errorMessage)
    }
  }, [editValue, fieldType, updateMutation, onSaveSuccess, t, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        handleSave()
      }
      // For multiline, Ctrl+Enter or Cmd+Enter saves
      if (e.key === 'Enter' && multiline && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    },
    [handleCancel, handleSave, multiline]
  )

  const isPending = updateMutation.isPending

  // Selector paths based on field type
  const selectors = {
    value:
      fieldType === 'name'
        ? 'teams.edit.name.value'
        : 'teams.edit.description.value',
    editIcon:
      fieldType === 'name'
        ? 'teams.edit.name.editIcon'
        : 'teams.edit.description.editIcon',
    input:
      fieldType === 'name'
        ? 'teams.edit.name.input'
        : 'teams.edit.description.textarea',
    saveIcon:
      fieldType === 'name'
        ? 'teams.edit.name.saveIcon'
        : 'teams.edit.description.saveIcon',
    cancelIcon:
      fieldType === 'name'
        ? 'teams.edit.name.cancelIcon'
        : 'teams.edit.description.cancelIcon',
    error:
      fieldType === 'name'
        ? 'teams.edit.name.error'
        : 'teams.edit.description.error',
  }

  // Display mode
  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className={cn('group flex items-center gap-2', className)}>
          <span
            data-cy={sel(selectors.value)}
            className={cn('flex-1', !value && 'text-muted-foreground italic')}
          >
            {value ||
              placeholder ||
              t('editTeam.noValue', { defaultValue: 'Not set' })}
          </span>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleEdit}
              data-cy={sel(selectors.editIcon)}
              aria-label={t('editTeam.editField', {
                field: fieldType,
                defaultValue: `Edit ${fieldType}`,
              })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Success feedback */}
        {showSuccess && (
          <Alert
            className="bg-green-50 text-green-900 border-green-200"
            data-cy={sel('teams.edit.success')}
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{t('editTeam.success')}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // Edit mode
  const InputComponent = multiline ? Textarea : Input

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <InputComponent
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isPending}
          className={cn('flex-1', multiline && 'min-h-[60px]')}
          data-cy={sel(selectors.input)}
          aria-invalid={!!validationError}
          aria-describedby={
            validationError ? `${fieldType}-error` : undefined
          }
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={handleSave}
            disabled={isPending}
            data-cy={sel(selectors.saveIcon)}
            aria-label={t('editTeam.save', { defaultValue: 'Save' })}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
            disabled={isPending}
            data-cy={sel(selectors.cancelIcon)}
            aria-label={t('editTeam.cancel', { defaultValue: 'Cancel' })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <Alert variant="destructive" data-cy={sel('teams.edit.error')}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription
            id={`${fieldType}-error`}
            role="alert"
            data-cy={sel(selectors.error)}
          >
            {validationError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
