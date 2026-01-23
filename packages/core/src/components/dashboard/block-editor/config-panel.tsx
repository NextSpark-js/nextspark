'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../../ui/collapsible'
import { ScrollArea } from '../../ui/scroll-area'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import {
  ChevronDown,
  FileText,
  Image,
  Tag,
  Search,
  Settings2,
  Plus,
  Trash2,
  Loader2
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import type { PageSettings, PageSeoSettings, PageCustomField } from './page-settings-panel'

interface TaxonomyItem {
  id: string
  name: string
  slug: string
  color?: string
}

interface ConfigPanelProps {
  entityConfig: ClientEntityConfig
  entityFields: Record<string, unknown>
  onEntityFieldChange: (field: string, value: unknown) => void
  pageSettings: PageSettings
  onPageSettingsChange: (settings: PageSettings) => void
}

/**
 * ConfigPanel - Settings view for the center column
 *
 * Combines entity fields and SEO/meta settings in a single scrollable panel
 * with two collapsible sections.
 */
export function ConfigPanel({
  entityConfig,
  entityFields,
  onEntityFieldChange,
  pageSettings,
  onPageSettingsChange
}: ConfigPanelProps) {
  const t = useTranslations('admin.builder')
  const tSettings = useTranslations('admin.pages.settings')

  // Entity fields section state
  const [entityFieldsOpen, setEntityFieldsOpen] = useState(true)
  const [seoMetaOpen, setSeoMetaOpen] = useState(true)

  // SEO state (synced with pageSettings)
  const [seo, setSeo] = useState<PageSeoSettings>(pageSettings.seo || {})
  const [customFields, setCustomFields] = useState<PageCustomField[]>(
    pageSettings.customFields || []
  )

  // Sync SEO state when pageSettings prop changes
  useEffect(() => {
    setSeo(pageSettings.seo || {})
    setCustomFields(pageSettings.customFields || [])
  }, [pageSettings])

  // Get sidebar field definitions
  const sidebarFields = entityConfig.builder?.sidebarFields || []

  // Taxonomies config
  const taxonomyTypes = entityConfig.taxonomies?.types || []
  const taxonomiesEnabled = entityConfig.taxonomies?.enabled && taxonomyTypes.length > 0
  const firstTaxonomy = taxonomyTypes[0]
  const taxonomyApiPath = firstTaxonomy?.type?.replace('_', '-') + 's'

  // Fetch taxonomies
  const { data: taxonomyData, isLoading: taxonomyLoading } = useQuery({
    queryKey: ['taxonomies', taxonomyApiPath],
    queryFn: async () => {
      const response = await fetch(`/api/v1/${taxonomyApiPath}`)
      if (!response.ok) return { data: [] }
      return response.json()
    },
    enabled: taxonomiesEnabled && !!taxonomyApiPath,
  })

  const taxonomyItems: TaxonomyItem[] = taxonomyData?.data || []
  const currentCategories = (entityFields.categories as string[]) || []

  // Show entity fields section?
  const showEntityFieldsSection = useMemo(() => {
    return sidebarFields.length > 0 || taxonomiesEnabled
  }, [sidebarFields.length, taxonomiesEnabled])

  // Show SEO section?
  const showSeoSection = entityConfig.builder?.seo !== false

  // Field renderer for entity fields
  const renderField = (fieldName: string) => {
    const value = entityFields[fieldName] as string | undefined

    const isTextarea = fieldName.toLowerCase().includes('excerpt') ||
      fieldName.toLowerCase().includes('description') ||
      fieldName.toLowerCase().includes('summary')

    const isImage = fieldName.toLowerCase().includes('image') ||
      fieldName.toLowerCase().includes('thumbnail') ||
      fieldName.toLowerCase().includes('photo')

    const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1')

    if (isTextarea) {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName} className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {fieldLabel}
          </Label>
          <Textarea
            id={fieldName}
            value={value || ''}
            onChange={(e) => onEntityFieldChange(fieldName, e.target.value)}
            placeholder={t('placeholders.excerpt')}
            rows={4}
            className="resize-none"
            data-cy={sel('blockEditor.configPanel.entityFieldsSection.field', { name: fieldName })}
          />
        </div>
      )
    }

    if (isImage) {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName} className="flex items-center gap-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            {fieldLabel}
          </Label>
          <Input
            id={fieldName}
            type="url"
            value={value || ''}
            onChange={(e) => onEntityFieldChange(fieldName, e.target.value)}
            placeholder={t('placeholders.imageUrl')}
            data-cy={sel('blockEditor.configPanel.entityFieldsSection.field', { name: fieldName })}
          />
          {value && (
            <div className="mt-2 rounded-md border overflow-hidden">
              <img
                src={value}
                alt={fieldLabel}
                className="w-full h-32 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={fieldName} className="space-y-2">
        <Label htmlFor={fieldName}>{fieldLabel}</Label>
        <Input
          id={fieldName}
          value={value || ''}
          onChange={(e) => onEntityFieldChange(fieldName, e.target.value)}
          data-cy={sel('blockEditor.configPanel.entityFieldsSection.field', { name: fieldName })}
        />
      </div>
    )
  }

  // Category handlers
  const handleCategoryClick = useCallback((categoryId: string) => {
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId]
    onEntityFieldChange('categories', newCategories)
  }, [currentCategories, onEntityFieldChange])

  // SEO handlers
  const handleSeoChange = useCallback((field: keyof PageSeoSettings, value: string | boolean) => {
    const newSeo = { ...seo, [field]: value }
    setSeo(newSeo)
    onPageSettingsChange({ seo: newSeo, customFields })
  }, [seo, customFields, onPageSettingsChange])

  // Custom fields handlers
  const handleAddCustomField = useCallback(() => {
    const newFields = [...customFields, { key: '', value: '' }]
    setCustomFields(newFields)
    onPageSettingsChange({ seo, customFields: newFields })
  }, [seo, customFields, onPageSettingsChange])

  const handleUpdateCustomField = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const newFields = customFields.map((f, i) =>
      i === index ? { ...f, [field]: value } : f
    )
    setCustomFields(newFields)
    onPageSettingsChange({ seo, customFields: newFields })
  }, [seo, customFields, onPageSettingsChange])

  const handleRemoveCustomField = useCallback((index: number) => {
    const newFields = customFields.filter((_, i) => i !== index)
    setCustomFields(newFields)
    onPageSettingsChange({ seo, customFields: newFields })
  }, [seo, customFields, onPageSettingsChange])

  return (
    <div
      data-cy={sel('blockEditor.configPanel.container')}
      className="h-full bg-background"
    >
      <ScrollArea
        data-cy={sel('blockEditor.configPanel.scroll')}
        className="h-full"
      >
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Entity Fields Section */}
          {showEntityFieldsSection && (
            <Collapsible
              open={entityFieldsOpen}
              onOpenChange={setEntityFieldsOpen}
              data-cy={sel('blockEditor.configPanel.entityFieldsSection.container')}
            >
              <CollapsibleTrigger
                data-cy={sel('blockEditor.configPanel.entityFieldsSection.trigger')}
                className="flex items-center justify-between w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{t('config.entityFields')}</h3>
                </div>
                <ChevronDown className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  entityFieldsOpen && 'rotate-180'
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent
                data-cy={sel('blockEditor.configPanel.entityFieldsSection.content')}
                className="pt-4"
              >
                <div className="space-y-6 p-4 bg-card rounded-lg border">
                  {/* Entity specific fields */}
                  {sidebarFields.length > 0 && (
                    <div className="space-y-4">
                      {sidebarFields.map(fieldName => renderField(fieldName))}
                    </div>
                  )}

                  {/* Taxonomies */}
                  {taxonomiesEnabled && firstTaxonomy && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Label>{firstTaxonomy.label || 'Categories'}</Label>
                      </div>

                      {taxonomyLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : taxonomyItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t('sidebar.noCategories')}</p>
                      ) : (
                        <div className="space-y-2">
                          {taxonomyItems.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-md border p-2 hover:bg-accent transition-colors cursor-pointer"
                              onClick={() => handleCategoryClick(item.id)}
                            >
                              <Checkbox
                                checked={currentCategories.includes(item.id)}
                                onCheckedChange={() => handleCategoryClick(item.id)}
                              />
                              <span className="text-sm flex-1">{item.name}</span>
                              {item.color && (
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selected categories badges */}
                      {currentCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {currentCategories.map(catId => {
                            const cat = taxonomyItems.find(t => t.id === catId)
                            return cat ? (
                              <Badge
                                key={cat.id}
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => handleCategoryClick(cat.id)}
                                style={cat.color ? { backgroundColor: cat.color, color: '#fff' } : undefined}
                              >
                                {cat.name} &times;
                              </Badge>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* SEO & Meta Section */}
          {showSeoSection && (
            <Collapsible
              open={seoMetaOpen}
              onOpenChange={setSeoMetaOpen}
              data-cy={sel('blockEditor.configPanel.seoMetaSection.container')}
            >
              <CollapsibleTrigger
                data-cy={sel('blockEditor.configPanel.seoMetaSection.trigger')}
                className="flex items-center justify-between w-full p-4 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{t('config.seoMeta')}</h3>
                </div>
                <ChevronDown className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  seoMetaOpen && 'rotate-180'
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent
                data-cy={sel('blockEditor.configPanel.seoMetaSection.content')}
                className="pt-4"
              >
                <div className="space-y-6 p-4 bg-card rounded-lg border">
                  {/* Meta Title */}
                  <div className="space-y-2">
                    <Label htmlFor="meta-title">{tSettings('seo.metaTitle')}</Label>
                    <Input
                      id="meta-title"
                      value={seo.metaTitle || ''}
                      onChange={(e) => handleSeoChange('metaTitle', e.target.value)}
                      placeholder={tSettings('seo.metaTitlePlaceholder')}
                      data-cy={sel('blockEditor.configPanel.seoMetaSection.metaTitle')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tSettings('seo.metaTitleHint')}
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-2">
                    <Label htmlFor="meta-description">{tSettings('seo.metaDescription')}</Label>
                    <Textarea
                      id="meta-description"
                      value={seo.metaDescription || ''}
                      onChange={(e) => handleSeoChange('metaDescription', e.target.value)}
                      placeholder={tSettings('seo.metaDescriptionPlaceholder')}
                      rows={3}
                      data-cy={sel('blockEditor.configPanel.seoMetaSection.metaDescription')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {seo.metaDescription?.length || 0}/160 {tSettings('seo.characters')}
                    </p>
                  </div>

                  {/* Meta Keywords */}
                  <div className="space-y-2">
                    <Label htmlFor="meta-keywords">{tSettings('seo.metaKeywords')}</Label>
                    <Input
                      id="meta-keywords"
                      value={seo.metaKeywords || ''}
                      onChange={(e) => handleSeoChange('metaKeywords', e.target.value)}
                      placeholder={tSettings('seo.metaKeywordsPlaceholder')}
                      data-cy={sel('blockEditor.configPanel.seoMetaSection.metaKeywords')}
                    />
                  </div>

                  {/* OG Image */}
                  <div className="space-y-2">
                    <Label htmlFor="og-image">{tSettings('seo.ogImage')}</Label>
                    <Input
                      id="og-image"
                      value={seo.ogImage || ''}
                      onChange={(e) => handleSeoChange('ogImage', e.target.value)}
                      placeholder={tSettings('seo.ogImagePlaceholder')}
                      data-cy={sel('blockEditor.configPanel.seoMetaSection.ogImage')}
                    />
                  </div>

                  {/* Custom Fields */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <Label>{tSettings('customFields.title')}</Label>
                    </div>

                    {customFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {tSettings('customFields.empty')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {customFields.map((field, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <Input
                                value={field.key}
                                onChange={(e) => handleUpdateCustomField(index, 'key', e.target.value)}
                                placeholder={tSettings('customFields.keyPlaceholder')}
                                className="font-mono text-sm"
                                data-cy={sel('blockEditor.configPanel.seoMetaSection.customFields.fieldKey', { index })}
                              />
                            </div>
                            <div className="flex-1">
                              <Input
                                value={field.value}
                                onChange={(e) => handleUpdateCustomField(index, 'value', e.target.value)}
                                placeholder={tSettings('customFields.valuePlaceholder')}
                                data-cy={sel('blockEditor.configPanel.seoMetaSection.customFields.fieldValue', { index })}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCustomField(index)}
                              data-cy={sel('blockEditor.configPanel.seoMetaSection.customFields.fieldRemove', { index })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomField}
                      className="w-full"
                      data-cy={sel('blockEditor.configPanel.seoMetaSection.customFields.addButton')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {tSettings('customFields.add')}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
