/**
 * Shared Entity Page Header Component
 * 
 * Provides consistent header design across entity pages (view, edit, create)
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '../ui/button'
import { ArrowLeft } from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'

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
  const Icon = entityConfig.icon

  // Determine title based on mode
  const getTitle = (): string => {
    switch (mode) {
      case 'create':
        return `Crear ${entityConfig.names.singular}`
      case 'edit':
        return (typeof data?.title === 'string' ? data.title : typeof data?.name === 'string' ? data.name : `Editar ${entityConfig.names.singular}`)
      case 'view':
      default:
        return (typeof data?.title === 'string' ? data.title : typeof data?.name === 'string' ? data.name : entityConfig.names.singular)
    }
  }

  // Determine subtitle based on mode
  const getSubtitle = (): string => {
    switch (mode) {
      case 'create':
        return `Nuevo ${entityConfig.names.singular.toLowerCase()}`
      case 'edit':
        return `Editando ${entityConfig.names.singular.toLowerCase()} • ID: ${typeof data?.id === 'string' ? data.id : 'N/A'}`
      case 'view':
      default:
        return `${entityConfig.names.singular} • ID: ${typeof data?.id === 'string' ? data.id : 'N/A'}`
    }
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Breadcrumb */}
      <div>
        <Link href={`/dashboard/${entityConfig.slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a {entityConfig.names.plural}
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
