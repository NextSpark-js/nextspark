'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Checkbox } from '../../ui/checkbox'
import { useTranslations } from 'next-intl'
import type { KeyValuePair } from './types'

interface KeyValueEditorProps {
  items: KeyValuePair[]
  onChange: (items: KeyValuePair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  dataCyPrefix: string
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  dataCyPrefix,
}: KeyValueEditorProps) {
  const t = useTranslations('devtools.apiTester.editor')
  const addItem = () => {
    onChange([
      ...items,
      { id: crypto.randomUUID(), key: '', value: '', enabled: true },
    ])
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  return (
    <div className="space-y-2" data-cy={`${dataCyPrefix}-editor`}>
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-2 items-center" data-cy={`${dataCyPrefix}-row-${index}`}>
          <Checkbox
            checked={item.enabled}
            onCheckedChange={(checked: boolean | 'indeterminate') => updateItem(item.id, 'enabled', !!checked)}
            data-cy={`${dataCyPrefix}-row-${index}-enabled`}
          />
          <Input
            placeholder={keyPlaceholder || t('keyPlaceholder')}
            value={item.key}
            onChange={(e) => updateItem(item.id, 'key', e.target.value)}
            className="flex-1 font-mono text-sm"
            data-cy={`${dataCyPrefix}-row-${index}-key`}
          />
          <Input
            placeholder={valuePlaceholder || t('valuePlaceholder')}
            value={item.value}
            onChange={(e) => updateItem(item.id, 'value', e.target.value)}
            className="flex-1 font-mono text-sm"
            data-cy={`${dataCyPrefix}-row-${index}-value`}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeItem(item.id)}
            className="shrink-0"
            data-cy={`${dataCyPrefix}-row-${index}-delete`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full"
        data-cy={`${dataCyPrefix}-add-btn`}
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('addButton')}
      </Button>
    </div>
  )
}
