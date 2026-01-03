'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { Checkbox } from '../../ui/checkbox'
import { FileText, Image, Tag, Loader2 } from 'lucide-react'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'

interface TaxonomyItem {
  id: string
  name: string
  slug: string
  color?: string
}

interface EntityFieldsSidebarProps {
  entityConfig: ClientEntityConfig
  fields: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  selectedCategories?: string[]
  onCategoryToggle?: (categoryId: string) => void
}

/**
 * Entity Fields Sidebar
 *
 * Shows entity-specific fields (excerpt, featuredImage, etc.) and taxonomies
 * for builder-enabled entities.
 */
export function EntityFieldsSidebar({
  entityConfig,
  fields,
  onChange,
  selectedCategories = [],
  onCategoryToggle
}: EntityFieldsSidebarProps) {
  const t = useTranslations('admin.builder')

  // Get sidebar field definitions
  const sidebarFields = entityConfig.builder?.sidebarFields || []

  // Fetch taxonomies if enabled
  const taxonomyTypes = entityConfig.taxonomies?.types || []
  const taxonomiesEnabled = entityConfig.taxonomies?.enabled && taxonomyTypes.length > 0

  // Fetch first taxonomy type (usually 'post_category')
  const firstTaxonomy = taxonomyTypes[0]
  const taxonomyApiPath = firstTaxonomy?.type?.replace('_', '-') + 's' // post_category -> post-categories

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

  // Field type renderers
  const renderField = (fieldName: string) => {
    const value = fields[fieldName] as string | undefined

    // Determine field type from common patterns
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
            onChange={(e) => onChange(fieldName, e.target.value)}
            placeholder={t('placeholders.excerpt')}
            rows={4}
            className="resize-none"
            data-cy={`field-${fieldName}`}
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
            onChange={(e) => onChange(fieldName, e.target.value)}
            placeholder={t('placeholders.imageUrl')}
            data-cy={`field-${fieldName}`}
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

    // Default: text input
    return (
      <div key={fieldName} className="space-y-2">
        <Label htmlFor={fieldName}>{fieldLabel}</Label>
        <Input
          id={fieldName}
          value={value || ''}
          onChange={(e) => onChange(fieldName, e.target.value)}
          data-cy={`field-${fieldName}`}
        />
      </div>
    )
  }

  // Handle category selection (stored in entityFields as array of IDs)
  const currentCategories = (fields.categories as string[]) || []

  const handleCategoryClick = (categoryId: string) => {
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId]
    onChange('categories', newCategories)
  }

  return (
    <div className="flex h-full flex-col bg-card" data-cy="entity-fields-sidebar">
      <div className="border-b p-4">
        <h3 className="font-semibold text-foreground">{t('sidebar.fieldsTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('sidebar.fieldsDescription')}</p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Entity Fields */}
          {sidebarFields.length > 0 && (
            <div className="space-y-4">
              {sidebarFields.map(fieldName => renderField(fieldName))}
            </div>
          )}

          {/* Taxonomies Section */}
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
                      data-cy={`category-${item.slug}`}
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

          {/* Empty state */}
          {sidebarFields.length === 0 && !taxonomiesEnabled && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('sidebar.noFields')}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
