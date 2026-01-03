/**
 * Public Entity Card
 * 
 * Generic card component for displaying entity items in public grid view.
 * Focuses on clean, website-friendly presentation.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { CalendarDays, Eye } from 'lucide-react'
import type { EntityConfig, EntityField } from '../../../lib/entities/types'

interface PublicEntityCardProps {
  entityConfig: EntityConfig | null
  entitySlug: string
  data: Record<string, unknown>
  className?: string
}

export function PublicEntityCard({ entityConfig, entitySlug, data, className }: PublicEntityCardProps) {
  const entityId = data.id as string

  // Use entityConfig if available, otherwise use fallback logic
  let title: string
  let description: string | undefined
  let displayFields: EntityField[] = []
  let entityDisplayName: string

  if (entityConfig) {
    // Get primary display field (usually title or name)
    const titleField = entityConfig.fields.find(field => 
      ['title', 'name'].includes(field.name) && field.display.showInList
    )
    
    // Get description field
    const descriptionField = entityConfig.fields.find(field => 
      ['description', 'summary', 'excerpt'].includes(field.name) && field.display.showInList
    )

    // Get fields to show in card (limit to 2-3 key fields)
    displayFields = entityConfig.fields
      .filter(field => 
        field.display.showInList && 
        !['id', 'userId', 'createdAt', 'updatedAt'].includes(field.name) &&
        field.name !== titleField?.name &&
        field.name !== descriptionField?.name
      )
      .slice(0, 3)

    title = titleField ? (data[titleField.name] as string) : `${entityConfig.names.singular} ${entityId}`
    description = descriptionField ? (data[descriptionField.name] as string) : undefined
    entityDisplayName = entityConfig.names.singular
  } else {
    // Fallback when entityConfig is not loaded
    title = (data.title || data.name || `Item ${entityId}`) as string
    description = data.description as string | undefined
    entityDisplayName = entitySlug.charAt(0).toUpperCase() + entitySlug.slice(1)
  }

  const createdAt = data.createdAt as string

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // Format field value for display
  const formatFieldValue = (field: EntityField, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return 'N/A'
    
    switch (field.type) {
      case 'date':
      case 'datetime':
        return formatDate(value as string)
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value)
      case 'select':
        // Find option label if available
        const option = field.options?.find(opt => opt.value === value)
        return option?.label || String(value)
      default:
        return String(value)
    }
  }

  return (
    <Card className={`group hover:shadow-lg transition-all duration-200 ${className}`}>
      <Link href={`/${entitySlug}/${entityId}`} className="block">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="mt-2 line-clamp-3">
                  {description}
                </CardDescription>
              )}
            </div>
            <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-2 flex-shrink-0" />
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Display key fields - only if entityConfig is loaded */}
          {entityConfig && displayFields.length > 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {displayFields.map((field) => (
                <div key={field.name} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">
                    {field.display.label}:
                  </span>
                  <span className="text-foreground font-medium">
                    {formatFieldValue(field, data[field.name])}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer with metadata */}
          <div className="flex items-center justify-between pt-4 border-t">
            {createdAt && (
              <div className="flex items-center text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3 mr-1" />
                {formatDate(createdAt)}
              </div>
            )}
            
            <Badge variant="outline" className="text-xs">
              {entityDisplayName}
            </Badge>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}