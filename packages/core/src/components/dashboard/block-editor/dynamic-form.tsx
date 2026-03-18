'use client'

import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
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
import { ChevronDown, ChevronRight, CalendarIcon, ImageIcon, X, Loader2, Check } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { Switch } from '../../ui/switch'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { Calendar } from '../../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Button } from '../../ui/button'
import { format } from 'date-fns'
import { ArrayField } from './array-field'
import { fetchWithTeam } from '../../../lib/api/entities'
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
 * Evaluate whether a field should be visible based on its condition
 */
function evaluateCondition(
  condition: FieldDefinition['condition'],
  values: Record<string, unknown>
): boolean {
  if (!condition) return true
  const fieldValue = values[condition.field]
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value
    case 'notEquals':
      return fieldValue !== condition.value
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value))
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value)
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value)
    default:
      return true
  }
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

/**
 * RelationshipField - Fetches an entity list and renders a select (manyToOne)
 * or a multi-select checklist (manyToMany) to pick related records.
 * Stores the `valueField` (default: 'id') for single, or an array of IDs for multi.
 */
function RelationshipField({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition
  value: string | string[]
  onChange: (value: string | string[]) => void
}) {
  const t = useTranslations('admin.blockEditor.form')
  const displayField = field.displayField || 'name'
  const valueField = field.valueField || 'id'
  const isMulti = field.relationshipType === 'manyToMany'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['relationship-field', field.targetEntity],
    queryFn: async () => {
      const url = `/api/v1/${field.targetEntity}?limit=100`
      const response = await fetchWithTeam(url)
      if (!response.ok) return []
      const json = await response.json()
      return (json.items || json.data || []) as Record<string, unknown>[]
    },
    enabled: !!field.targetEntity,
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground h-9">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('loadingEntity', { entity: field.targetEntity })}</span>
      </div>
    )
  }

  if (isError || !field.targetEntity) {
    return (
      <div className="text-sm text-destructive h-9 flex items-center">
        {t('failedToLoad', { entity: field.targetEntity })}
      </div>
    )
  }

  const items = data || []

  // ── manyToMany: scrollable checklist ─────────────────────────────────────
  if (isMulti) {
    const selectedIds = Array.isArray(value) ? value : []

    const toggleItem = (itemId: string) => {
      const next = selectedIds.includes(itemId)
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId]
      onChange(next)
    }

    return (
      <div className="space-y-1">
        {selectedIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('selectedCount', { count: selectedIds.length })}
          </p>
        )}
        <div
          className="border rounded-md max-h-48 overflow-y-auto divide-y"
          data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
        >
          {items.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {t('noEntityFound', { entity: field.targetEntity })}
            </div>
          )}
          {items.map((item) => {
            const itemValue = String(item[valueField] ?? '')
            const itemLabel = String(
              item[displayField] ?? item['title'] ?? item['name'] ?? itemValue
            )
            const isChecked = selectedIds.includes(itemValue)

            return (
              <button
                key={itemValue}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 text-left"
                onClick={() => toggleItem(itemValue)}
              >
                <div
                  className={cn(
                    'w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center',
                    isChecked ? 'bg-primary border-primary' : 'border-input'
                  )}
                >
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-sm truncate">{itemLabel}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── manyToOne: single select ──────────────────────────────────────────────
  return (
    <Select
      value={String(value || '')}
      onValueChange={(v) => onChange(v)}
    >
      <SelectTrigger
        data-cy={sel('blockEditor.blockPropertiesPanel.form.field', { name: field.name })}
      >
        <SelectValue placeholder={field.placeholder || t('selectEntity', { entity: field.targetEntity })} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => {
          const itemValue = String(item[valueField] ?? '')
          const itemLabel = String(
            item[displayField] ?? item['title'] ?? item['name'] ?? itemValue
          )
          return (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          )
        })}
        {items.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            {t('noEntityFound', { entity: field.targetEntity })}
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

/**
 * DynamicForm - Main form component for block property editing.
 *
 * Renders a collection of fields defined by `fieldDefinitions`, supporting
 * grouping, conditional visibility, debounced updates, and all field types
 * (text, select, media, relationship, date, array, etc.).
 *
 * Updates are debounced (500ms) to avoid excessive re-renders while the user types.
 */
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

  /** Updates a single field value in local form state. Memoized to avoid re-creating child components. */
  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }, [])

  /** Toggles the collapsed state of a field group or array field by its ID. */
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

  /**
   * Renders the input control for a single field based on its `type`.
   * @param compact - When true, renders a smaller variant used inside collapsible groups.
   */
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
                {value ? format(new Date(String(value)), "PPP") : t('pickDate')}
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

      case 'relationship': {
        const isMulti = field.relationshipType === 'manyToMany'
        const relationValue = isMulti
          ? (Array.isArray(value) ? value as string[] : [])
          : String(value || '')
        return (
          <RelationshipField
            field={field}
            value={relationValue}
            onChange={(newValue) => handleFieldChange(field.name, newValue)}
          />
        )
      }

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

  /**
   * Wraps a field control with its label, required indicator, and optional help text.
   * @param compact - When true, reduces spacing and font size for use inside groups.
   */
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

  /**
   * Renders an `array` type field as a collapsible section with a header showing
   * the item count. Keeps the form compact when the user has many array fields.
   */
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
              {t('arrayItemsCount', { count: items.length })}
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

  /**
   * Renders a named field group as a collapsible section.
   * Shows a "configured" badge in the header when any field in the group has a value.
   */
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
            <span className="text-xs text-primary font-normal">{t('configured')}</span>
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
      {ungrouped
        .filter(field => evaluateCondition(field.condition, formValues))
        .map(field =>
          field.type === 'array'
            ? renderArrayFieldAsGroup(field)
            : renderFieldWithLabel(field)
        )}

      {/* Render groups */}
      {groups.map(group => renderGroup(group))}
    </div>
  )
}
