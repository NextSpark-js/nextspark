'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { Card, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Trash2, RotateCcw, FileText, Palette, Settings2, X, SlidersHorizontal, Layers } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { DynamicForm } from './dynamic-form'
import type { BlockInstance, FieldDefinition, FieldTab } from '../../../types/blocks'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

interface BlockSettingsPanelProps {
  block: BlockInstance | undefined
  onUpdateProps: (props: Record<string, unknown>) => void
  onRemove: () => void
  onClose?: () => void
}

/**
 * Group field definitions by tab
 */
function groupFieldsByTab(fields: FieldDefinition[]): Record<FieldTab, FieldDefinition[]> {
  const grouped: Record<FieldTab, FieldDefinition[]> = {
    content: [],
    design: [],
    advanced: [],
  }

  for (const field of fields) {
    const tab = field.tab || 'content' // Default to content tab if not specified
    grouped[tab].push(field)
  }

  return grouped
}

type SettingsTab = 'content' | 'design' | 'advanced'

export function BlockSettingsPanel({
  block,
  onUpdateProps,
  onRemove,
  onClose,
}: BlockSettingsPanelProps) {
  const t = useTranslations('admin.builder.settingsPanel')
  const [activeTab, setActiveTab] = useState<SettingsTab>('content')

  // Memoize grouped fields
  const groupedFields = useMemo(() => {
    if (!block) return null
    const blockConfig = BLOCK_REGISTRY[block.blockSlug]
    if (!blockConfig?.fieldDefinitions) return null
    return groupFieldsByTab(blockConfig.fieldDefinitions)
  }, [block])

  if (!block) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-muted/10" data-cy={sel('blockEditor.settingsPanel.empty')}>
        <div className="text-center">
          <p className="text-muted-foreground">{t('empty.message')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('empty.hint')}</p>
        </div>
      </div>
    )
  }

  const blockConfig = BLOCK_REGISTRY[block.blockSlug]

  if (!blockConfig) {
    return (
      <div className="p-4" data-cy={sel('blockEditor.settingsPanel.error')}>
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive text-sm">
              {t('error.notFound', { slug: block.blockSlug })}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleReset = () => {
    onUpdateProps({})
  }

  // Check if there are fields in each tab
  const hasContentFields = groupedFields && groupedFields.content.length > 0
  const hasDesignFields = groupedFields && groupedFields.design.length > 0
  const hasAdvancedFields = groupedFields && groupedFields.advanced.length > 0
  const hasAnyFields = hasContentFields || hasDesignFields || hasAdvancedFields

  return (
    <div className="flex h-full flex-col bg-card" data-cy={sel('blockEditor.settingsPanel.container')}>
      {/* Header - Panel Title */}
      <div className="border-b p-4" data-cy={sel('blockEditor.settingsPanel.header')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h3
              className="text-lg font-semibold text-foreground"
              data-cy={sel('blockEditor.settingsPanel.title')}
            >
              {t('title')}
            </h3>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              data-cy={sel('blockEditor.settingsPanel.closeBtn')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Block Name */}
        <div
          className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md"
          data-cy={sel('blockEditor.settingsPanel.blockIdentifier')}
        >
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span
            className="text-sm text-foreground"
            data-cy={sel('blockEditor.settingsPanel.blockName')}
          >
            {blockConfig.name}
          </span>
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {hasAnyFields ? (
          <>
            {/* Custom Tabs with Underline Style */}
            <div className="flex border-b border-border" data-cy={sel('blockEditor.settingsPanel.tabs')}>
              <button
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5',
                  activeTab === 'content'
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  !hasContentFields && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => hasContentFields && setActiveTab('content')}
                disabled={!hasContentFields}
                data-cy={sel('blockEditor.settingsPanel.tabContent')}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.content')}</span>
                {activeTab === 'content' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5',
                  activeTab === 'design'
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  !hasDesignFields && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => hasDesignFields && setActiveTab('design')}
                disabled={!hasDesignFields}
                data-cy={sel('blockEditor.settingsPanel.tabDesign')}
              >
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.design')}</span>
                {activeTab === 'design' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-all relative flex items-center justify-center gap-1.5',
                  activeTab === 'advanced'
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  !hasAdvancedFields && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => hasAdvancedFields && setActiveTab('advanced')}
                disabled={!hasAdvancedFields}
                data-cy={sel('blockEditor.settingsPanel.tabAdvanced')}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('tabs.advanced')}</span>
                {activeTab === 'advanced' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'content' && (
                hasContentFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.content}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noContentFields')} />
                )
              )}

              {activeTab === 'design' && (
                hasDesignFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.design}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noDesignFields')} />
                )
              )}

              {activeTab === 'advanced' && (
                hasAdvancedFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.advanced}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noAdvancedFields')} />
                )
              )}
            </div>
          </>
        ) : (
          <div className="p-4">
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('noFields')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Empty state message for tabs
 */
function EmptyTabMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  )
}
