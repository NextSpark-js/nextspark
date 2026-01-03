/**
 * Universal Entity Field Renderer
 * 
 * Dynamically renders form fields, display fields, and list columns
 * based on entity field configuration.
 */

'use client'

import React from 'react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { Slider } from '../ui/slider'

// Import new components
import { MultiSelect } from '../ui/multi-select'
import { TagsInput } from '../ui/tags-input'
import { Combobox } from '../ui/combobox'
import { Rating } from '../ui/rating'
import { PhoneInput } from '../ui/phone-input'
import { FileUpload } from '../ui/file-upload'
import { ImageUpload } from '../ui/image-upload'
import { VideoUpload } from '../ui/video-upload'
import { AudioUpload } from '../ui/audio-upload'
import { TimezoneSelect } from '../ui/timezone-select'
import { CurrencySelect } from '../ui/currency-select'
import { CountrySelect } from '../ui/country-select'
import { AddressInput } from '../ui/address-input'
import { SimpleRelationSelect } from '../ui/simple-relation-select'
import { RelationDisplay } from '../ui/relation-display'
import { RichTextEditor } from '../ui/rich-text-editor'
import { UserDisplay } from '../ui/user-display'

interface EntityFieldContext {
  parentId?: string
  entityType?: string
  formData?: Record<string, unknown>
  [key: string]: unknown
}
import { UserSelect } from '../ui/user-select'
import { ButtonGroup } from '../ui/button-group'
import { DoubleRange } from '../ui/double-range'

import type { EntityField } from '../../lib/entities/types'
import type { Address } from '../ui/address-input'

export interface EntityFieldRendererProps {
  field: EntityField
  value: unknown
  onChange?: (value: unknown) => void
  mode: 'form' | 'display' | 'list'
  error?: string
  disabled?: boolean
  required?: boolean
  className?: string
  testId?: string
  context?: {
    parentId?: string
    entityType?: string
    teamId?: string
    [key: string]: unknown
  }
}

/**
 * Format value for display mode
 */
function formatDisplayValue(value: unknown, field: EntityField): string {
  if (value === null || value === undefined) {
    return '-'
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'phone':
    case 'timezone':
    case 'currency':
    case 'country':
      return String(value || '')

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value || '')

    case 'boolean':
      return value ? 'Sí' : 'No'

    case 'date':
      return value ? new Date(value as string).toLocaleDateString() : ''

    case 'datetime':
      return value ? new Date(value as string).toLocaleString() : ''

    case 'json':
      return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')

    case 'select':
    case 'radio':
    case 'buttongroup':
    case 'combobox':
      if (field.options) {
        const option = field.options.find(opt => opt.value === value)
        return option ? option.label : String(value || '')
      }
      return String(value || '')

    case 'multiselect':
      if (Array.isArray(value) && field.options) {
        return value
          .map(v => field.options?.find(opt => opt.value === v)?.label || v)
          .join(', ')
      }
      return String(value || '')

    case 'tags':
      return Array.isArray(value) ? value.join(', ') : String(value || '')

    case 'rating':
      return typeof value === 'number' ? `${value}/5 ⭐` : String(value || '')

    case 'range':
      return typeof value === 'number' ? String(value) : String(value || '')

    case 'doublerange':
      if (Array.isArray(value) && value.length === 2) {
        return `${value[0]} - ${value[1]}`
      }
      return String(value || '')

    case 'address':
      if (typeof value === 'object' && value !== null) {
        const addr = value as { fullAddress?: string; street?: string; city?: string; state?: string; country?: string }
        return addr.fullAddress || [addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ')
      }
      return String(value || '')

    case 'file':
    case 'image':
    case 'video':
    case 'audio':
      if (Array.isArray(value)) {
        return `${value.length} archivo${value.length !== 1 ? 's' : ''}`
      }
      return String(value || '')

    case 'relation':
    case 'relation-multi':
      // Fallback to showing raw value if no relation config
      return String(value || '-')

    case 'user':
      if (Array.isArray(value)) {
        return value.map((user: { firstName: string; lastName?: string }) => 
          `${user.firstName} ${user.lastName || ''}`.trim()
        ).join(', ')
      }
      return String(value || '')

    case 'markdown':
    case 'richtext':
    case 'code':
      return String(value || '')

    default:
      return String(value || '')
  }
}

/**
 * Render form input based on field type
 */
function renderFormField(
  field: EntityField,
  value: unknown,
  onChange: (value: unknown) => void,
  error?: string,
  disabled?: boolean,
  required?: boolean,
  testId?: string,
  context?: {
    parentId?: string
    entityType?: string
    [key: string]: unknown
  }
) {
  
  // Debug log for field type
  if (field.name === 'language') {
  }
  const baseProps = {
    id: `field-${field.name}`,
    disabled,
    'data-testid': testId,
    'aria-describedby': error ? `${field.name}-error` : undefined,
    'aria-invalid': !!error,
  }

  switch (field.type) {
    // Basic text inputs
    case 'text':
    case 'email':
    case 'url':
      return (
        <Input
          {...baseProps}
          type={field.type === 'email' ? 'email' : 'text'}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.display.placeholder}
          required={required}
        />
      )

    case 'textarea':
      return (
        <Textarea
          {...baseProps}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.display.placeholder}
          required={required}
          className="min-h-[100px]"
        />
      )

    case 'number':
      return (
        <Input
          {...baseProps}
          type="number"
          value={String(value || '')}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.display.placeholder}
          required={required}
        />
      )

    case 'boolean':
      return (
        <div className="space-y-2">
          <Label htmlFor={`field-${field.name}`} className="text-sm font-medium">
            {field.display.label}
          </Label>
          <div className="flex justify-start">
            <Switch
              {...baseProps}
              checked={Boolean(value)}
              onCheckedChange={(checked: boolean | 'indeterminate') => onChange(checked)}
            />
          </div>
        </div>
      )

    case 'date':
      return (
        <Input
          {...baseProps}
          type="date"
          value={value ? new Date(value as string).toISOString().split('T')[0] : ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )

    case 'datetime':
      return (
        <Input
          {...baseProps}
          type="datetime-local"
          value={value ? new Date(value as string).toISOString().slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )

    case 'json':
      return (
        <Textarea
          {...baseProps}
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onChange(parsed)
            } catch {
              onChange(e.target.value)
            }
          }}
          placeholder={field.display.placeholder || 'Enter valid JSON...'}
          required={required}
          className="min-h-[120px] font-mono text-sm"
        />
      )

    // Selection types
    case 'select':
      return (
        <Select
          value={String(value || '')}
          onValueChange={(newValue: string) => onChange(newValue)}
          disabled={disabled}
          required={required}
        >
          <SelectTrigger {...baseProps}>
            <SelectValue placeholder={field.display.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem
                key={String(option.value)}
                value={String(option.value)}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'multiselect':
      return (
        <MultiSelect
          options={field.options || []}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'radio':
      return (
        <RadioGroup
          value={String(value || '')}
          onValueChange={onChange}
          disabled={disabled}
        >
          {field.options?.map((option) => (
            <div key={String(option.value)} className="flex items-center space-x-2">
              <RadioGroupItem
                value={String(option.value)}
                disabled={option.disabled}
              />
              <Label className="text-sm">{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      )

    case 'buttongroup':
      return (
        <ButtonGroup
          options={field.options || []}
          value={value as string | number | undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case 'tags':
      return (
        <TagsInput
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'combobox':
      return (
        <Combobox
          options={field.options || []}
          value={value as string | number | undefined}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
          clearable={!required}
        />
      )

    // Specialized inputs
    case 'phone':
      return (
        <PhoneInput
          value={String(value || '')}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'rating':
      return (
        <Rating
          value={typeof value === 'number' ? value : 0}
          onChange={onChange}
          readonly={disabled}
          showValue={true}
        />
      )

    case 'range':
      return (
        <div className="space-y-2">
          <Slider
            value={[typeof value === 'number' ? value : 0]}
            onValueChange={(values: number[]) => onChange(values[0])}
            disabled={disabled}
            max={100}
            step={1}
          />
          <div className="text-xs text-muted-foreground text-center">
            Valor: {typeof value === 'number' ? value : 0}
          </div>
        </div>
      )

    case 'doublerange':
      return (
        <DoubleRange
          value={Array.isArray(value) && value.length === 2 ? value as [number, number] : undefined}
          onChange={onChange}
          disabled={disabled}
          min={0}
          max={100}
          step={1}
        />
      )

    // Location & data selectors
    case 'timezone':
      return (
        <TimezoneSelect
          value={value as string | undefined}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'currency':
      return (
        <CurrencySelect
          value={value as string | undefined}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'country':
      return (
        <CountrySelect
          value={value as string | undefined}
          onChange={onChange}
          placeholder={field.display.placeholder}
          disabled={disabled}
        />
      )

    case 'address':
      return (
        <AddressInput
          value={(value as Address) || { street: '', city: '', state: '', zipCode: '', country: '' }}
          onChange={onChange}
          disabled={disabled}
          layout="stacked"
        />
      )

    // Media types
    case 'file':
      return (
        <FileUpload
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          disabled={disabled}
          multiple={true}
        />
      )

    case 'image':
      return (
        <ImageUpload
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          disabled={disabled}
          multiple={true}
        />
      )

    case 'video':
      return (
        <VideoUpload
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          disabled={disabled}
          multiple={true}
        />
      )

    case 'audio':
      return (
        <AudioUpload
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          disabled={disabled}
          multiple={true}
        />
      )

    // Relationship types
    case 'relation':
    case 'relation-multi':
      // Use new relation config structure
      const relationConfig = field.relation
      if (!relationConfig?.entity) {
        console.error('Relation field missing entity configuration:', field.name)
        return <div>Error: Relation configuration missing</div>
      }
      
      const relationEntityType = relationConfig.entity
      const titleField = relationConfig.titleField
      
      // Determine if this is multiple based on field type
      const isMultiple = field.type === 'relation-multi'
      
      // Get form data for parent dependency logic
      const formData = context?.formData as Record<string, unknown>
      
      // Determine parent dependency configuration
      const dependsOnParent = Boolean(relationConfig.parentId)
      const parentFieldName = relationConfig.parentId
      const parentValue = parentFieldName ? formData?.[parentFieldName] as string : undefined
      
      // Use parentValue as parentId for API calls when available
      const parentIdForRelation = parentValue
      
      // Process value based on field type
      let processedValue: string | string[] | null = null
      
      if (isMultiple) {
        // For relation-multi fields, parse JSON string to array
        if (typeof value === 'string' && value) {
          try {
            processedValue = JSON.parse(value)
          } catch {
            processedValue = []
          }
        } else if (Array.isArray(value)) {
          processedValue = value
        } else {
          processedValue = []
        }
      } else {
        // For single relation fields, ensure string value
        processedValue = typeof value === 'string' ? value : (value ? String(value) : null)
      }

      return (
        <SimpleRelationSelect
          value={processedValue || undefined}
          onChange={(newValue) => {
            if (isMultiple) {
              // For multi-select, pass array directly (schema will handle conversion)
              onChange(newValue)
            } else {
              // For single select, onChange expects the string ID
              onChange(newValue)
            }
          }}
          entityType={relationEntityType}
          titleField={titleField}
          multiple={isMultiple}
          disabled={disabled || (dependsOnParent && !parentValue)}
          placeholder={
            dependsOnParent && !parentValue
              ? `Selecciona ${parentFieldName?.replace('Id', '').toLowerCase()} primero`
              : field.display.placeholder || `Seleccionar ${field.display.label?.toLowerCase() || relationEntityType}...`
          }
          parentId={parentIdForRelation}
          userFiltered={relationConfig.userFiltered}
          teamId={context?.teamId as string | undefined}
        />
      )

    // Property-based relationship types
    case 'relation-prop':
    case 'relation-prop-multi':
      // Use relation config structure for property-based relations
      const propRelationConfig = field.relation
      if (!propRelationConfig?.entity || !propRelationConfig?.prop) {
        console.error('Property relation field missing entity or prop configuration:', field.name)
        return <div>Error: Property relation configuration missing</div>
      }
      
      const propEntityType = propRelationConfig.entity
      const propField = propRelationConfig.prop
      const propIsMultiple = field.type === 'relation-prop-multi'
      
      // Get form data for parent dependency logic
      const propFormData = context?.formData as Record<string, unknown>
      
      // Determine parent dependency configuration
      const propDependsOnParent = Boolean(propRelationConfig.parentId)
      const propParentFieldName = propRelationConfig.parentId
      const propParentValue = propParentFieldName ? propFormData?.[propParentFieldName] as string : undefined
      
      // Use parentValue as parentId for API calls when available
      const propParentIdForRelation = propParentValue
      
      // Process value based on field type (for property relations, we store the actual property values)
      let propProcessedValue: string | string[] | null = null
      
      if (propIsMultiple) {
        // For relation-prop-multi fields, parse JSON string to array
        if (typeof value === 'string' && value) {
          try {
            propProcessedValue = JSON.parse(value)
          } catch {
            propProcessedValue = []
          }
        } else if (Array.isArray(value)) {
          propProcessedValue = value
        } else {
          propProcessedValue = []
        }
      } else {
        // For single relation-prop fields, ensure string value
        propProcessedValue = typeof value === 'string' ? value : (value ? String(value) : null)
      }

      return (
        <SimpleRelationSelect
          value={propProcessedValue || undefined}
          onChange={(newValue) => {
            if (propIsMultiple) {
              // For multi-select, pass array directly (schema will handle conversion)
              onChange(newValue)
            } else {
              // For single select, onChange expects the property value
              onChange(newValue)
            }
          }}
          entityType={propEntityType}
          propField={propField}
          usePropertyMode={true}
          propertyOptions={(propRelationConfig.options || []).map(opt => ({
            value: String(opt.value),
            label: opt.label
          }))}
          multiple={propIsMultiple}
          disabled={disabled || (propDependsOnParent && !propParentValue)}
          placeholder={
            propDependsOnParent && !propParentValue
              ? `Selecciona ${propParentFieldName?.replace('Id', '').toLowerCase()} primero`
              : field.display.placeholder || `Seleccionar ${field.display.label?.toLowerCase()}...`
          }
          parentId={propParentIdForRelation}
          userFiltered={propRelationConfig.userFiltered}
          teamId={context?.teamId as string | undefined}
        />
      )

    case 'user':
      // Handle value that can be: string (user ID), array of user objects, or empty
      // The database stores just the user ID as a string
      const userValue = (() => {
        if (!value) return []
        if (Array.isArray(value)) return value
        // If it's a string (user ID), wrap it in an object with just the id
        if (typeof value === 'string') {
          return [{ id: value, firstName: '', email: '' }]
        }
        return []
      })()

      return (
        <UserSelect
          value={userValue}
          onChange={onChange}
          disabled={disabled}
          multiple={false}
          placeholder={field.display.placeholder}
          teamId={context?.teamId as string | undefined}
        />
      )

    // Rich text editor with WYSIWYG toolbar
    case 'richtext':
      return (
        <RichTextEditor
          value={String(value || '')}
          onChange={onChange}
          placeholder={field.display.placeholder || 'Enter rich text content...'}
          disabled={disabled}
          data-cy={testId}
        />
      )

    // Text editors (simplified for now)
    case 'markdown':
    case 'code':
      return (
        <Textarea
          {...baseProps}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.display.placeholder || `Ingresa ${field.type}...`}
          required={required}
          className={field.type === 'code' ? "min-h-[150px] font-mono text-sm" : "min-h-[150px]"}
        />
      )

    default:
      return (
        <Input
          {...baseProps}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.display.placeholder}
          required={required}
        />
      )
  }
}

/**
 * Render display field for read-only mode
 */
function renderDisplayField(field: EntityField, value: unknown, mode: 'display' | 'list', context?: EntityFieldContext) {
  // Handle user fields specially with UserDisplay component
  if (field.type === 'user') {
    // For user fields, value is stored as user ID string (or array for multi)
    const userId = Array.isArray(value) && value.length > 0
      ? (typeof value[0] === 'object' ? (value[0] as { id: string }).id : value[0])
      : (typeof value === 'object' && value !== null ? (value as { id: string }).id : value as string)

    const userDisplay = (
      <UserDisplay
        value={userId || null}
        teamId={context?.teamId as string | undefined}
        showEmail={mode === 'display'}
      />
    )

    if (mode === 'list') {
      return userDisplay
    }

    // Full display mode
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {field.display.label}
        </Label>
        <div className="text-base">
          {userDisplay}
        </div>
      </div>
    )
  }

  // Handle relation fields specially with RelationDisplay component
  if (field.type === 'relation' || field.type === 'relation-multi') {
    const relationConfig = field.relation
    if (relationConfig?.entity) {
      // For display mode, we might not have formData context, so we need to handle parentId differently
      const parentIdValue = relationConfig.parentId && context?.formData 
        ? context.formData[relationConfig.parentId] as string
        : undefined
      
      const relationDisplay = (
        <RelationDisplay
          value={value as string | string[] | null}
          entityType={relationConfig.entity}
          titleField={relationConfig.titleField}
          parentId={parentIdValue}
          multiple={field.type === 'relation-multi'}
          teamId={context?.teamId as string | undefined}
        />
      )

      if (mode === 'list') {
        return relationDisplay
      }

      // Full display mode
      return (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {field.display.label}
          </Label>
          <div className="text-base">
            {relationDisplay}
          </div>
        </div>
      )
    }
  }

  const formattedValue = formatDisplayValue(value, field)

  if (mode === 'list') {
    // Compact list mode
    if (field.type === 'boolean') {
      return (
        <Badge 
          variant={value ? 'default' : 'secondary'} 
          className={`text-xs ${value ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'}`}
        >
          {formattedValue}
        </Badge>
      )
    }

    if (field.type === 'select' && field.options) {
      const option = field.options.find(opt => opt.value === value)
      return (
        <Badge 
          variant="outline" 
          className="text-xs"
          style={{ backgroundColor: option?.color }}
        >
          {formattedValue}
        </Badge>
      )
    }

    return (
      <span className="text-sm truncate max-w-[200px]" title={formattedValue}>
        {formattedValue}
      </span>
    )
  }

  // Full display mode
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {field.display.label}
      </Label>

      {field.type === 'json' ? (
        <Card>
          <CardContent className="p-3">
            <pre className="text-xs overflow-auto max-h-40">
              {formattedValue}
            </pre>
          </CardContent>
        </Card>
      ) : field.type === 'textarea' ? (
        <p className="text-base leading-relaxed whitespace-pre-wrap">{formattedValue}</p>
      ) : field.type === 'url' ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base underline underline-offset-2 hover:no-underline"
        >
          {formattedValue}
        </a>
      ) : field.type === 'email' ? (
        <a
          href={`mailto:${value}`}
          className="text-base underline underline-offset-2 hover:no-underline"
        >
          {formattedValue}
        </a>
      ) : (
        <p className="text-base">{formattedValue}</p>
      )}
    </div>
  )
}

/**
 * Main EntityFieldRenderer component
 */
export function EntityFieldRenderer({
  field,
  value,
  onChange,
  mode,
  error,
  disabled = false,
  required,
  className,
  testId,
  context,
}: EntityFieldRendererProps) {
  if (mode === 'form') {
    if (!onChange) {
      throw new Error('onChange is required for form mode')
    }

    return (
      <div className={`space-y-2 ${className || ''}`}>
        {field.type !== 'boolean' && (
          <Label htmlFor={`field-${field.name}`} className="text-sm font-medium">
            {field.display.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        
        {field.display.description && (
          <p className="text-xs text-muted-foreground">
            {field.display.description}
          </p>
        )}
        
        {renderFormField(field, value, onChange, error, disabled, required, testId, context)}
        
        {error && (
          <p 
            id={`${field.name}-error`}
            className="text-xs text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {renderDisplayField(field, value, mode, context)}
    </div>
  )
}