'use client'

import { useTranslations } from 'next-intl'
import { Layers, Plus } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import type { Pattern } from '../../../types/pattern-reference'

interface PatternCardProps {
  pattern: Pattern
  onSelect: (patternId: string) => void
}

export function PatternCard({ pattern, onSelect }: PatternCardProps) {
  const t = useTranslations('patterns')

  return (
    <div
      className="group relative bg-background border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-[border-color,box-shadow] cursor-pointer"
      onClick={() => onSelect(pattern.id)}
      data-cy={sel('blockEditor.blockPicker.patternCard', { id: pattern.id })}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center"
            data-cy={sel('blockEditor.blockPicker.patternCardIcon', { id: pattern.id })}
          >
            <Layers className="h-3.5 w-3.5" />
          </span>
          <span
            className="font-medium text-sm text-foreground"
            data-cy={sel('blockEditor.blockPicker.patternCardTitle', { id: pattern.id })}
          >
            {pattern.title}
          </span>
        </div>
        <span
          className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
          data-cy={sel('blockEditor.blockPicker.patternCardBlockCount', { id: pattern.id })}
        >
          {pattern.blocks.length} {pattern.blocks.length === 1 ? 'block' : 'blocks'}
        </span>
      </div>

      {pattern.description && (
        <p
          className="text-xs text-muted-foreground line-clamp-2"
          data-cy={sel('blockEditor.blockPicker.patternCardDescription', { id: pattern.id })}
        >
          {pattern.description}
        </p>
      )}

      {/* Hover "+" Button */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="w-6 h-6 bg-foreground text-background rounded flex items-center justify-center text-xs shadow-md hover:scale-110 transition-transform cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(pattern.id)
          }}
          data-cy={sel('blockEditor.blockPicker.patternCardInsertButton', { id: pattern.id })}
          title={t('picker.selectPattern')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
