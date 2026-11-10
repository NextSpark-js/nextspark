/**
 * Shared Entity Page Header Component
 * 
 * Provides consistent header design across entity pages (view, edit, create)
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import React from 'react'
import Link from 'next/link'
import { Button } from '../ui/button'
import { ArrowLeft } from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import { entityNameInText, getRecordTitle } from '../../lib/entities/entity-text'

export interface EntityPageHeaderProps {
  entityConfig: EntityConfig
  mode: 'view' | 'edit' | 'create'
  data?: Record<string, unknown>
  actions?: React.ReactNode
  className?: string
}

export function EntityPageHeader({
  entityConfig,
  mode,
  data,
  actions,
  className
}: EntityPageHeaderProps) {
  const text = useTranslations('entities.header')
  const locale = useLocale()
  const Icon = entityConfig.icon

  // Determine title based on mode
  const getTitle = (): string => {
    switch (mode) {
      case 'create':
        return text('create', { entity: entityConfig.names.singular })
      case 'edit':
        return getRecordTitle(entityConfig, data, text('edit', { entity: entityConfig.names.singular }))
      case 'view':
      default:
        return getRecordTitle(entityConfig, data, entityConfig.names.singular)
    }
  }

  // Determine subtitle based on mode
  const getSubtitle = (): string => {
    switch (mode) {
      case 'create':
        return text('newEntity', { entity: entityNameInText(entityConfig.names.singular, locale) })
      case 'edit':
        return text('editing', { entity: entityNameInText(entityConfig.names.singular, locale), id: typeof data?.id === 'string' ? data.id : text('notAvailable') })
      case 'view':
      default:
        return text('viewing', { entity: entityConfig.names.singular, id: typeof data?.id === 'string' ? data.id : text('notAvailable') })
    }
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Breadcrumb */}
      <div>
        <Link href={`/dashboard/${entityConfig.slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {text('back', { entities: entityConfig.names.plural })}
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="h-8 w-8" />
            {getTitle()}
          </h1>
          <p className="text-muted-foreground">
            {getSubtitle()}
          </p>
        </div>
        
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
