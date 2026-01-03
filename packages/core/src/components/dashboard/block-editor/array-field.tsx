'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
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
import { Card, CardContent, CardHeader } from '../../ui/card'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { FieldDefinition } from '../../../types/blocks'

interface ArrayFieldProps {
  field: FieldDefinition
  value: unknown[]
  onChange: (value: unknown[]) => void
}

export function ArrayField({ field, value, onChange }: ArrayFieldProps) {
  const t = useTranslations('admin.blockEditor.form')
  const items = Array.isArray(value) ? value : []
  const itemFields = field.itemFields || []
  const minItems = field.minItems ?? 0
  const maxItems = field.maxItems ?? Infinity

  const canAdd = items.length < maxItems
  const canRemove = items.length > minItems

  // Create empty item with default values
  const createEmptyItem = useCallback(() => {
    const emptyItem: Record<string, unknown> = {}
    for (const itemField of itemFields) {
      emptyItem[itemField.name] = itemField.default ?? ''
    }
    return emptyItem
  }, [itemFields])

  const handleAddItem = useCallback(() => {
    if (!canAdd) return
    onChange([...items, createEmptyItem()])
  }, [items, onChange, canAdd, createEmptyItem])

  const handleRemoveItem = useCallback((index: number) => {
    if (!canRemove) return
    onChange(items.filter((_, i) => i !== index))
  }, [items, onChange, canRemove])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    const newItems = [...items]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    onChange(newItems)
  }, [items, onChange])

  const handleMoveDown = useCallback((index: number) => {
    if (index === items.length - 1) return
    const newItems = [...items]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    onChange(newItems)
  }, [items, onChange])

  const handleItemFieldChange = useCallback((itemIndex: number, fieldName: string, fieldValue: unknown) => {
    const newItems = items.map((item, i) => {
      if (i !== itemIndex) return item
      return {
        ...(item as Record<string, unknown>),
        [fieldName]: fieldValue
      }
    })
    onChange(newItems)
  }, [items, onChange])

  // Render a single field within an item
  const renderItemField = (itemField: FieldDefinition, itemIndex: number, itemValue: Record<string, unknown>) => {
    const fieldValue = itemValue[itemField.name] ?? itemField.default ?? ''

    switch (itemField.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={String(fieldValue)}
            onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
            placeholder={itemField.placeholder}
            required={itemField.required}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )

      case 'textarea':
        return (
          <Textarea
            value={String(fieldValue)}
            onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
            placeholder={itemField.placeholder}
            required={itemField.required}
            rows={itemField.rows || 3}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )

      case 'url':
        return (
          <Input
            type="url"
            value={String(fieldValue)}
            onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
            placeholder={itemField.placeholder || 'https://example.com'}
            required={itemField.required}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={Number(fieldValue)}
            onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, Number(e.target.value))}
            placeholder={itemField.placeholder}
            required={itemField.required}
            min={itemField.min}
            max={itemField.max}
            step={itemField.step}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )

      case 'select':
        return (
          <Select
            value={String(fieldValue)}
            onValueChange={(newValue: string) => handleItemFieldChange(itemIndex, itemField.name, newValue)}
          >
            <SelectTrigger data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}>
              <SelectValue placeholder={itemField.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {itemField.options?.map((option) => (
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
            value={Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [String(fieldValue)] : [])}
            onChange={(newValue) => handleItemFieldChange(itemIndex, itemField.name, newValue[0] || '')}
            maxImages={1}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded border cursor-pointer relative overflow-hidden flex-shrink-0"
              style={{ backgroundColor: String(fieldValue || '#000000') }}
            >
              <Input
                type="color"
                value={String(fieldValue || '#000000')}
                onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
              />
            </div>
            <Input
              type="text"
              value={String(fieldValue || '#000000')}
              onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
              placeholder="#000000"
              className="flex-1 font-mono text-sm"
            />
          </div>
        )

      default:
        return (
          <Input
            type="text"
            value={String(fieldValue)}
            onChange={(e) => handleItemFieldChange(itemIndex, itemField.name, e.target.value)}
            placeholder={itemField.placeholder}
            data-cy={`array-field-${field.name}-${itemIndex}-${itemField.name}`}
          />
        )
    }
  }

  return (
    <div className="space-y-3" data-cy={`array-field-${field.name}`}>
      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">{t('emptyArray')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={index} className="relative">
              <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0 bg-muted/30">
                <span className="text-sm font-medium">
                  {t('itemNumber', { number: index + 1 })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    data-cy={`array-field-${field.name}-${index}-move-up`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    data-cy={`array-field-${field.name}-${index}-move-down`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveItem(index)}
                    disabled={!canRemove}
                    data-cy={`array-field-${field.name}-${index}-remove`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {itemFields.map((itemField) => (
                  <div key={itemField.name} className="space-y-1">
                    <Label className="text-xs">
                      {itemField.label}
                      {itemField.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {renderItemField(itemField, index, item as Record<string, unknown>)}
                    {itemField.helpText && (
                      <p className="text-xs text-muted-foreground">{itemField.helpText}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Button & Counter */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={!canAdd}
          className="w-full"
          data-cy={`array-field-${field.name}-add`}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addItem')}
        </Button>
      </div>

      {/* Counter */}
      {maxItems !== Infinity && (
        <p className="text-xs text-muted-foreground text-center">
          {t('itemCount', { current: items.length, max: maxItems })}
        </p>
      )}
    </div>
  )
}
