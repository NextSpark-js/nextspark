'use client'

import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Label } from '../../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { ImageUpload } from '../../ui/image-upload'
import { RichTextEditor } from '../../ui/rich-text-editor'
import { MediaLibrary } from '../../media/MediaLibrary'
import { ChevronDown, ChevronRight, CalendarIcon, ImageIcon, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { Switch } from '../../ui/switch'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { Calendar } from '../../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Button } from '../../ui/button'
import { format } from 'date-fns'
import { ArrayField } from './array-field'
import type { FieldDefinition } from '../../../types/blocks'
import type { Media } from '../../../lib/media/types'

interface DynamicFormProps {
  fieldDefinitions: FieldDefinition[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}

interface FieldGroup {
  id: string
  label: string
  fields: FieldDefinition[]
}

/**
 * Group fields by their 'group' property
 * Returns array of groups and ungrouped fields
 */
function organizeFields(fields: FieldDefinition[]): {
  ungrouped: FieldDefinition[]
  groups: FieldGroup[]
} {
  const ungrouped: FieldDefinition[] = []
  const groupMap = new Map<string, FieldGroup>()

  for (const field of fields) {
    if (field.group) {
      if (!groupMap.has(field.group)) {
        groupMap.set(field.group, {
          id: field.group,
          label: field.groupLabel || field.group,
          fields: [],
        })
      }
      groupMap.get(field.group)!.fields.push(field)
    } else {
      ungrouped.push(field)
    }
  }

  return {
    ungrouped,
    groups: Array.from(groupMap.values()),
  }
}

/**
 * MediaLibraryField - Opens the Media Library modal for image selection
 * Stores the URL string (not media ID) for backward compatibility with block schemas
 */
function MediaLibraryField({
  value,
  onChange,
  fieldName,
}: {
  value: string
  onChange: (url: string) => void
  fieldName: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations('admin.blockEditor.form')

  const handleSelect = (media: Media | Media[]) => {
    if (Array.isArray(media)) return
    onChange(media.url)
    setIsOpen(false)
  }

  return (
    <>
      {value ? (
        <div
          className="relative group rounded-md overflow-hidden"
          data-cy={sel('blockEditor.blockPropertiesPanel.form.mediaField.preview', { name: fieldName })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsOpen(true)}
              data-cy={sel('blockEditor.blockPropertiesPanel.form.mediaField.changeBtn', { name: fieldName })}
            >
              {t('changeImage')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onChange('')}
              data-cy={sel('blockEditor.blockPropertiesPanel.form.mediaField.removeBtn', { name: fieldName })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsOpen(true)}
          className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          data-cy={sel('blockEditor.blockPropertiesPanel.form.mediaField.empty', { name: fieldName })}
        >
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('browseMedia')}</p>
        </div>
      )}

      <MediaLibrary
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
        mode="single"
        allowedTypes={['image']}
      />
    </>
  )
}

export function DynamicForm({ fieldDefinitions, values, onChange }: DynamicFormProps) {
  const t = useTranslations('admin.blockEditor.form')
  const [formValues, setFormValues] = useState(values)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Track if we're syncing from parent to prevent feedback loop
  const isSyncingFromParent = useRef(false)
  // Track the debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Organize fields into groups and ungrouped
  const { ungrouped, groups } = useMemo(
    () => organizeFields(fieldDefinitions),
    [fieldDefinitions]
  )

  // Sync formValues when parent values change (e.g., when switching blocks)
  useEffect(() => {
    // Clear any pending debounced update when values change from parent
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }

    isSyncingFromParent.current = true
    setFormValues(values)

    // Reset the flag after state update
    requestAnimationFrame(() => {
      isSyncingFromParent.current = false
    })
  }, [values])

  // Debounced update to parent - only when user makes changes
  useEffect(() => {
    // Don't trigger parent update when syncing from parent
    if (isSyncingFromParent.current) {
      return
    }

    debounceTimer.current = setTimeout(() => {
      onChange(formValues)
    }, 500)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [formValues, onChange])

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }, [])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const renderField = (field: FieldDefinition, compact = false) => {
    const value = formValues[field.name] ?? field.default ?? ''

    switch (field.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'textarea':
        return (
          <Textarea
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={field.rows || 4}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'rich-text':
        return (
          <RichTextEditor
            value={String(value)}
            onChange={(newValue) => handleFieldChange(field.name, newValue)}
            placeholder={field.placeholder}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'url':
        return (
          <Input
            type="url"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || 'https://example.com'}
            required={field.required}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={Number(value)}
            onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
            placeholder={field.placeholder}
            required={field.required}
            min={field.min}
            max={field.max}
            step={field.step}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'select':
        return (
          <Select
            value={String(value)}
            onValueChange={(newValue: string) => handleFieldChange(field.name, newValue)}
          >
            <SelectTrigger data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}>
              <SelectValue placeholder={field.placeholder || t('selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'image':
        return (
          <ImageUpload
            value={Array.isArray(value) ? value : []}
            onChange={(newValue) => handleFieldChange(field.name, newValue)}
            maxImages={1}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'media-library':
        return (
          <MediaLibraryField
            value={String(value || '')}
            onChange={(url) => handleFieldChange(field.name, url)}
            fieldName={field.name}
          />
        )

      case 'array':
        return (
          <ArrayField
            field={field}
            value={Array.isArray(value) ? value : []}
            onChange={(newValue) => handleFieldChange(field.name, newValue)}
          />
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked: boolean | 'indeterminate') => handleFieldChange(field.name, checked)}
              data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
            />
            <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
              {field.checkboxLabel || field.label}
            </Label>
          </div>
        )

      case 'radio':
        return (
          <RadioGroup
            value={String(value || '')}
            onValueChange={(newValue: string) => handleFieldChange(field.name, newValue)}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          >
            {field.options?.map((option) => (
              <div key={String(option.value)} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={String(option.value)}
                  id={`${field.name}-${option.value}`}
                />
                <Label
                  htmlFor={`${field.name}-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded border cursor-pointer relative overflow-hidden"
              style={{ backgroundColor: String(value || '#000000') }}
            >
              <Input
                type="color"
                value={String(value || '#000000')}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
              />
            </div>
            <Input
              type="text"
              value={String(value || '#000000')}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder="#000000"
              className="flex-1 font-mono text-sm"
            />
          </div>
        )

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground"
                )}
                data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(String(value)), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(String(value)) : undefined}
                onSelect={(date: Date | undefined) => handleFieldChange(field.name, date?.toISOString().split('T')[0])}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )

      case 'time':
        return (
          <Input
            type="time"
            value={String(value || '')}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => {
              const dateValue = e.target.value ? new Date(e.target.value).toISOString() : ''
              handleFieldChange(field.name, dateValue)
            }}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )

      default:
        return (
          <Input
            type="text"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
          />
        )
    }
  }

  const renderFieldWithLabel = (field: FieldDefinition, compact = false) => (
    <div key={field.name} className={cn('space-y-1.5', compact && 'space-y-1')}>
      <Label htmlFor={field.name} className={cn(compact && 'text-xs')}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField(field, compact)}
      {field.helpText && !compact && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )

  // Render array fields as collapsible groups
  const renderArrayFieldAsGroup = (field: FieldDefinition) => {
    const isCollapsed = collapsedGroups.has(field.name)
    const value = formValues[field.name]
    const items = Array.isArray(value) ? value : []
    const hasValue = items.length > 0

    return (
      <div
        key={field.name}
        className="border rounded-lg overflow-hidden"
        data-cy={sel('blockEditor.blockPropertiesPanel.form.arrayField.container', { name: field.name })}
      >
        {/* Array Field Header */}
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 text-sm font-medium',
            'bg-muted/50 hover:bg-muted/70 transition-colors text-left',
            hasValue && 'bg-primary/5'
          )}
          onClick={() => toggleGroup(field.name)}
        >
          <span className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </span>
          {hasValue && (
            <span className="text-xs text-primary font-normal">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </button>

        {/* Array Field Content */}
        {!isCollapsed && (
          <div className="p-3 bg-card">
            {renderField(field)}
            {field.helpText && (
              <p className="text-xs text-muted-foreground mt-2">{field.helpText}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderGroup = (group: FieldGroup) => {
    const isCollapsed = collapsedGroups.has(group.id)

    // Check if any field in group has a value
    const hasValue = group.fields.some(field => {
      const value = formValues[field.name]
      return value !== undefined && value !== '' && value !== null
    })

    return (
      <div
        key={group.id}
        className="border rounded-lg overflow-hidden"
        data-cy={sel('blockEditor.blockPropertiesPanel.form.fieldGroup', { id: group.id })}
      >
        {/* Group Header */}
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 text-sm font-medium',
            'bg-muted/50 hover:bg-muted/70 transition-colors text-left',
            hasValue && 'bg-primary/5'
          )}
          onClick={() => toggleGroup(group.id)}
        >
          <span className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {group.label}
          </span>
          {hasValue && (
            <span className="text-xs text-primary font-normal">configured</span>
          )}
        </button>

        {/* Group Content */}
        {!isCollapsed && (
          <div className="p-3 space-y-3 bg-card">
            {group.fields.map(field => renderFieldWithLabel(field, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-cy={sel('blockEditor.blockPropertiesPanel.form.container')}>
      {/* Render ungrouped fields first - array fields get special collapsible treatment */}
      {ungrouped.map(field =>
        field.type === 'array'
          ? renderArrayFieldAsGroup(field)
          : renderFieldWithLabel(field)
      )}

      {/* Render groups */}
      {groups.map(group => renderGroup(group))}
    </div>
  )
}
