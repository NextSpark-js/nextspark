'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import { Button } from '../../ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion'
import { Search, Settings2, Plus, Trash2 } from 'lucide-react'

export interface PageSeoSettings {
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  ogImage?: string
  noIndex?: boolean
  noFollow?: boolean
}

export interface PageCustomField {
  key: string
  value: string
}

export interface PageSettings {
  seo: PageSeoSettings
  customFields: PageCustomField[]
}

interface PageSettingsPanelProps {
  settings: PageSettings
  onChange: (settings: PageSettings) => void
}

export function PageSettingsPanel({ settings, onChange }: PageSettingsPanelProps) {
  const t = useTranslations('admin.pages.settings')

  const [seo, setSeo] = useState<PageSeoSettings>(settings.seo || {})
  const [customFields, setCustomFields] = useState<PageCustomField[]>(
    settings.customFields || []
  )

  // Sync with parent when settings prop changes
  useEffect(() => {
    setSeo(settings.seo || {})
    setCustomFields(settings.customFields || [])
  }, [settings])

  // Update parent when local state changes
  const handleSeoChange = useCallback((field: keyof PageSeoSettings, value: string | boolean) => {
    const newSeo = { ...seo, [field]: value }
    setSeo(newSeo)
    onChange({ seo: newSeo, customFields })
  }, [seo, customFields, onChange])

  const handleAddCustomField = useCallback(() => {
    const newFields = [...customFields, { key: '', value: '' }]
    setCustomFields(newFields)
    onChange({ seo, customFields: newFields })
  }, [seo, customFields, onChange])

  const handleUpdateCustomField = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const newFields = customFields.map((f, i) =>
      i === index ? { ...f, [field]: value } : f
    )
    setCustomFields(newFields)
    onChange({ seo, customFields: newFields })
  }, [seo, customFields, onChange])

  const handleRemoveCustomField = useCallback((index: number) => {
    const newFields = customFields.filter((_, i) => i !== index)
    setCustomFields(newFields)
    onChange({ seo, customFields: newFields })
  }, [seo, customFields, onChange])

  return (
    <div className="mt-16" data-cy="page-settings-panel">
      <hr className="border-border/50 mb-6" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
        <Accordion type="multiple" defaultValue={['seo']} className="w-full">
          {/* SEO Settings Section */}
          <AccordionItem value="seo">
            <AccordionTrigger className="py-3" data-cy="seo-settings-trigger">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{t('seo.title')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Meta Title */}
                <div className="space-y-2">
                  <Label htmlFor="meta-title">{t('seo.metaTitle')}</Label>
                  <Input
                    id="meta-title"
                    value={seo.metaTitle || ''}
                    onChange={(e) => handleSeoChange('metaTitle', e.target.value)}
                    placeholder={t('seo.metaTitlePlaceholder')}
                    data-cy="seo-meta-title"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('seo.metaTitleHint')}
                  </p>
                </div>

                {/* Meta Description */}
                <div className="space-y-2">
                  <Label htmlFor="meta-description">{t('seo.metaDescription')}</Label>
                  <Textarea
                    id="meta-description"
                    value={seo.metaDescription || ''}
                    onChange={(e) => handleSeoChange('metaDescription', e.target.value)}
                    placeholder={t('seo.metaDescriptionPlaceholder')}
                    rows={3}
                    data-cy="seo-meta-description"
                  />
                  <p className="text-xs text-muted-foreground">
                    {seo.metaDescription?.length || 0}/160 {t('seo.characters')}
                  </p>
                </div>

                {/* Meta Keywords */}
                <div className="space-y-2">
                  <Label htmlFor="meta-keywords">{t('seo.metaKeywords')}</Label>
                  <Input
                    id="meta-keywords"
                    value={seo.metaKeywords || ''}
                    onChange={(e) => handleSeoChange('metaKeywords', e.target.value)}
                    placeholder={t('seo.metaKeywordsPlaceholder')}
                    data-cy="seo-meta-keywords"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('seo.metaKeywordsHint')}
                  </p>
                </div>

                {/* OG Image */}
                <div className="space-y-2">
                  <Label htmlFor="og-image">{t('seo.ogImage')}</Label>
                  <Input
                    id="og-image"
                    value={seo.ogImage || ''}
                    onChange={(e) => handleSeoChange('ogImage', e.target.value)}
                    placeholder={t('seo.ogImagePlaceholder')}
                    data-cy="seo-og-image"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('seo.ogImageHint')}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Custom Fields Section */}
          <AccordionItem value="custom-fields">
            <AccordionTrigger className="py-3" data-cy="custom-fields-trigger">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span>{t('customFields.title')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {customFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('customFields.empty')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            value={field.key}
                            onChange={(e) => handleUpdateCustomField(index, 'key', e.target.value)}
                            placeholder={t('customFields.keyPlaceholder')}
                            className="font-mono text-sm"
                            data-cy={`custom-field-key-${index}`}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            value={field.value}
                            onChange={(e) => handleUpdateCustomField(index, 'value', e.target.value)}
                            placeholder={t('customFields.valuePlaceholder')}
                            data-cy={`custom-field-value-${index}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveCustomField(index)}
                          data-cy={`custom-field-remove-${index}`}
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
                  data-cy="add-custom-field"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('customFields.add')}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      </Card>
    </div>
  )
}
