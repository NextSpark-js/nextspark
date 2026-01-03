/**
 * Public Entity Detail
 * 
 * Generic detail component for displaying individual entity records in public pages.
 * Focuses on clean, readable presentation with proper SEO structure.
 */

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Separator } from '../../ui/separator'
import { Skeleton } from '../../ui/skeleton'
import { Alert, AlertDescription } from '../../ui/alert'
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react'
import { entityApi } from '../../../lib/api/entities'
import { getAllEntityConfigs } from '../../../lib/entities/registry.client'
import type { EntityConfig, EntityField } from '../../../lib/entities/types'
import { SYSTEM_TIMESTAMP_FIELDS } from '../../../lib/entities/system-fields'

interface PublicEntityDetailProps {
  entityType: string
  entitySlug: string
  id: string
  className?: string
}

export function PublicEntityDetail({ entityType, entitySlug, id, className }: PublicEntityDetailProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entityConfig, setEntityConfig] = useState<EntityConfig | null>(null)

  // Load entity configuration from client registry
  useEffect(() => {
    try {
      const configs = getAllEntityConfigs()
      const config = configs.find(c => c.slug === entitySlug)
      setEntityConfig(config || null)
    } catch (err) {
      console.error('Failed to load entity config:', err)
    }
  }, [entitySlug])

  // Load entity data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await entityApi.get(entityType, id)
        setData(result)
      } catch (err) {
        console.error('Error loading public entity:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [entityType, id])

  // Get primary display fields
  const titleField = entityConfig?.fields.find(field => 
    ['title', 'name'].includes(field.name) && field.display.showInDetail
  )
  
  const descriptionField = entityConfig?.fields.find(field => 
    ['description', 'summary', 'content', 'excerpt'].includes(field.name) && field.display.showInDetail
  )

  // Get all detail fields (excluding system fields)
  const detailFields = entityConfig?.fields.filter(field => 
    field.display.showInDetail && 
    !['id', 'userId'].includes(field.name) &&
    field.name !== titleField?.name &&
    field.name !== descriptionField?.name
  ) || []

  // Separate metadata fields - use system timestamp fields (always implicit)
  // These fields are always available from the API even if not declared in entity config
  const metadataFields = SYSTEM_TIMESTAMP_FIELDS

  const contentFields = detailFields.filter(field =>
    !['createdAt', 'updatedAt'].includes(field.name)
  )

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Format field value for display
  const formatFieldValue = (field: EntityField, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return 'Not specified'
    
    switch (field.type) {
      case 'date':
      case 'datetime':
        return formatDate(value as string)
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value)
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-primary hover:underline">
            {value as string}
          </a>
        )
      case 'url':
        return (
          <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {value as string}
          </a>
        )
      case 'select':
        // Find option label if available
        const option = field.options?.find(opt => opt.value === value)
        return option?.label || String(value)
      case 'text':
        // For text fields, preserve line breaks
        return (
          <div className="whitespace-pre-wrap">
            {String(value)}
          </div>
        )
      default:
        return String(value)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    )
  }

  if (loading || !entityConfig) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {entityConfig?.names.singular || 'Entity'} not found
        </AlertDescription>
      </Alert>
    )
  }

  const title = titleField ? (data[titleField.name] as string) : `${entityConfig?.names.singular || 'Entity'} ${id}`
  const description = descriptionField ? (data[descriptionField.name] as string) : undefined

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${entityConfig?.slug || ''}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {entityConfig?.names.plural || 'List'}
          </Link>
        </Button>
        
        <Badge variant="outline">
          {entityConfig?.names.singular || 'Entity'}
        </Badge>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-base leading-relaxed">
              {description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Content Fields */}
          {contentFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contentFields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      {field.display.label}
                    </label>
                    <div className="text-sm text-foreground">
                      {formatFieldValue(field, data[field.name])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {metadataFields.length > 0 && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                {metadataFields.map((field) => {
                  const Icon = field.name === 'createdAt' ? CalendarDays : Clock
                  return (
                    <div key={field.name} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>
                        {field.display.label}: {formatFieldValue(field, data[field.name])}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Related Actions */}
      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href={`/${entityConfig?.slug || ''}`}>
            View More {entityConfig?.names.plural || 'Items'}
          </Link>
        </Button>
      </div>
    </div>
  )
}