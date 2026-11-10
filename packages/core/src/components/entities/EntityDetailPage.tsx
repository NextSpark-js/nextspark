/**
 * Complete Entity Detail Page Component
 * 
 * A clean, organized page that displays entity details with actions
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { 
  Edit,
  Trash2,
  Calendar,
  Clock,
  Copy
} from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import { deleteEntityData } from '../../lib/api/entities'
import { useLocale, useTranslations } from 'next-intl'
import { EntityPageHeader } from './EntityPageHeader'

export interface EntityDetailPageProps {
  entityConfig: EntityConfig
  data: Record<string, unknown>
  isLoading?: boolean
  error?: string | null
  className?: string
}

export function EntityDetailPage({
  entityConfig,
  data,
  isLoading,
  error,
  className
}: EntityDetailPageProps) {
  const router = useRouter()
  const locale = useLocale()
  const text = useTranslations('entities.detail')
  const [isDeleting, setIsDeleting] = useState(false)

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

  const handleDelete = async () => {
    if (!confirm(text('confirmDelete', { entity: entityConfig.names.singular.toLowerCase() }))) {
      return
    }

    try {
      setIsDeleting(true)
      await deleteEntityData(entityConfig.slug, data.id as string)
      router.push(`/dashboard/${entityConfig.slug}`)
    } catch (error) {
      console.error('Error deleting entity:', error)
      alert(text('deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(data.id as string)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Alert>
            <AlertDescription>{text('loading')}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={handleCopyId}>
        <Copy className="h-4 w-4 mr-2" />
        {text('copyId')}
      </Button>
      <Link href={`/dashboard/${entityConfig.slug}/${data.id}/edit`}>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          {text('edit')}
        </Button>
      </Link>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {isDeleting ? text('deleting') : text('delete')}
      </Button>
    </>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className={`max-w-7xl mx-auto space-y-6 ${className || ''}`}>
      <EntityPageHeader 
        entityConfig={entityConfig}
        mode="view"
        data={data}
        actions={headerActions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{text('details')}</CardTitle>
              <CardDescription>
                {text('mainInfo', { entity: entityConfig.names.singular.toLowerCase() })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {entityConfig.fields
                .filter(field => field.display.showInDetail && field.name !== 'id')
                .map(field => {
                  const value = data[field.name]
                  if (value === null || value === undefined) return null

                  return (
                    <div key={field.name} className="space-y-2">
                      <dt className="text-sm font-medium text-muted-foreground">
                        {field.display.label}
                      </dt>
                      <dd className="text-sm">
                        {field.type === 'date' || field.type === 'datetime' ? (
                          value ? formatDateTime(value as string) : text('notSpecified')
                        ) : field.type === 'boolean' ? (
                          <Badge variant={value ? 'default' : 'secondary'}>
                            {value ? text('yes') : text('no')}
                          </Badge>
                        ) : field.type === 'number' && field.name === 'price' ? (
                          `$${value}`
                        ) : (
                          String(value) || text('notSpecified')
                        )}
                      </dd>
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>{text('metadata')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <div>
                  <div className="font-medium">{text('created')}</div>
                  <div>
                    {data.createdAt && typeof data.createdAt === 'string'
                      ? formatDateTime(data.createdAt)
                      : text('notAvailable')
                    }
                  </div>
                </div>
              </div>

              {data.updatedAt && typeof data.updatedAt === 'string' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{text('lastUpdated')}</div>
                    <div>
                      {formatDateTime(data.updatedAt)}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

        </div>
      </div>
      </div>
    </div>
  )
}
