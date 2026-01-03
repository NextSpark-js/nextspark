'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '../../ui/button'
import { Card, CardContent } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Trash2, RotateCcw, FileText, Palette, Settings2 } from 'lucide-react'
import { DynamicForm } from './dynamic-form'
import type { BlockInstance, FieldDefinition, FieldTab } from '../../../types/blocks'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

interface BlockSettingsPanelProps {
  block: BlockInstance | undefined
  onUpdateProps: (props: Record<string, unknown>) => void
  onRemove: () => void
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

export function BlockSettingsPanel({
  block,
  onUpdateProps,
  onRemove,
}: BlockSettingsPanelProps) {
  const t = useTranslations('admin.blockEditor.settings')

  // Memoize grouped fields
  const groupedFields = useMemo(() => {
    if (!block) return null
    const blockConfig = BLOCK_REGISTRY[block.blockSlug]
    if (!blockConfig?.fieldDefinitions) return null
    return groupFieldsByTab(blockConfig.fieldDefinitions)
  }, [block])

  if (!block) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-muted/10" data-cy="settings-panel-empty">
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
      <div className="p-4" data-cy="settings-panel-error">
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
    <div className="flex h-full flex-col bg-card" data-cy="block-settings-panel">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{blockConfig.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{blockConfig.description}</p>
          </div>
          <Badge variant="outline" className="capitalize">
            {blockConfig.category}
          </Badge>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex-1"
            data-cy="reset-block-props"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('actions.reset')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            data-cy="remove-block-settings"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('actions.remove')}
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="flex-1 overflow-hidden">
        {hasAnyFields ? (
          <Tabs defaultValue="content" className="h-full flex flex-col">
            <div className="border-b px-4 pt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="content"
                  className="flex items-center gap-1.5"
                  disabled={!hasContentFields}
                  data-cy="tab-content"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('tabs.content')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="design"
                  className="flex items-center gap-1.5"
                  disabled={!hasDesignFields}
                  data-cy="tab-design"
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('tabs.design')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="advanced"
                  className="flex items-center gap-1.5"
                  disabled={!hasAdvancedFields}
                  data-cy="tab-advanced"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('tabs.advanced')}</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Content Tab */}
              <TabsContent value="content" className="p-4 m-0 h-full">
                {hasContentFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.content}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noContentFields')} />
                )}
              </TabsContent>

              {/* Design Tab */}
              <TabsContent value="design" className="p-4 m-0 h-full">
                {hasDesignFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.design}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noDesignFields')} />
                )}
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="p-4 m-0 h-full">
                {hasAdvancedFields ? (
                  <DynamicForm
                    fieldDefinitions={groupedFields!.advanced}
                    values={block.props}
                    onChange={onUpdateProps}
                  />
                ) : (
                  <EmptyTabMessage message={t('tabs.noAdvancedFields')} />
                )}
              </TabsContent>
            </div>
          </Tabs>
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
