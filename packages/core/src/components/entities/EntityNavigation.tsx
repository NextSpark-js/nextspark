/**
 * Dynamic Entity Navigation Component
 * 
 * Automatically generates navigation menus for entities based on configuration,
 * respecting user permissions, plan limits, and feature flags.
 */

'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { cn } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import type { EntityConfig } from '../../lib/entities/types'

export interface EntityNavigationProps {
  /** REQUIRED: Entity configs must be passed from server component */
  entities: EntityConfig[]
  variant?: 'sidebar' | 'horizontal' | 'dropdown'
  showLabels?: boolean
  showBadges?: boolean
  showTooltips?: boolean
  className?: string
  onNavigate?: (entityName: string) => void
}

interface NavigationItem {
  entity: EntityConfig
  isActive: boolean
  isAccessible: boolean
  limits?: {
    maxRecords: number | 'unlimited'
    currentUsage?: number
    isNearLimit?: boolean
  }
  href: string
}

/**
 * Get usage statistics for an entity (placeholder implementation)
 */
function getEntityUsage(entityName: string): { currentRecords: number } {
  // TODO: Implement actual usage tracking
  // This would typically come from an API call or context
  // Mock implementation with entity-specific data
  const mockData: Record<string, number> = {
    'user': 25,
    'task': 142,
    'project': 8,
    'client': 12
  }
  return { currentRecords: mockData[entityName] || 0 }
}

export function EntityNavigation({
  entities,
  variant = 'sidebar',
  showLabels = true,
  showBadges = true,
  showTooltips = variant === 'sidebar',
  className,
  onNavigate,
}: EntityNavigationProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  // Get accessible entities for the current user
  const accessibleEntities = useMemo(() => {
    if (!user) return []

    // Permission system removed - all users see all enabled entities
    // Entities must be provided by server component via props

    return entities
      .filter(entity => entity.enabled && entity.ui?.dashboard?.showInMenu)
      .map((entity): NavigationItem => {
        const isAccessible = true // All enabled entities are accessible now
        const usage = getEntityUsage(entity.slug)

        return {
          entity,
          isActive: pathname.startsWith(`/dashboard/${entity.slug}`),
          isAccessible,
          limits: {
            maxRecords: 'unlimited' as const,
            currentUsage: usage.currentRecords,
            isNearLimit: false,
          },
          href: `/dashboard/${entity.slug}`,
        }
      })
      .filter(item => item.isAccessible)
      .sort((a, b) => a.entity.names.singular.localeCompare(b.entity.names.singular))
  }, [user, entities, pathname])

  if (!user || accessibleEntities.length === 0) {
    return null
  }

  const handleNavigation = (entityName: string) => {
    onNavigate?.(entityName)
  }

  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <TooltipProvider delayDuration={300}>
        <nav className={cn('space-y-1', className)}>
          {accessibleEntities.map(({ entity, isActive, limits, href }) => {
            const IconComponent = entity.icon
            
            return (
              <Tooltip key={entity.slug} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    onClick={() => handleNavigation(entity.slug)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive 
                        ? 'bg-accent text-accent-foreground' 
                        : 'text-muted-foreground'
                    )}
                    data-cy={`nav-${entity.slug}`}
                  >
                    <IconComponent className="h-4 w-4 shrink-0" />
                    
                    {showLabels && (
                      <span className="truncate">{entity.names.plural}</span>
                    )}
                    
                    {showBadges && limits && (
                      <div className="ml-auto flex items-center gap-1">
                        {limits.isNearLimit && (
                          <Badge variant="outline" className="text-xs">
                            ⚠
                          </Badge>
                        )}
                        
                        {typeof limits.currentUsage === 'number' && (
                          <Badge variant="secondary" className="text-xs">
                            {limits.currentUsage}
                            {limits.maxRecords !== 'unlimited' && `/${limits.maxRecords}`}
                          </Badge>
                        )}
                      </div>
                    )}
                  </Link>
                </TooltipTrigger>
                
                {showTooltips && (
                  <TooltipContent side="right" className="space-y-1">
                    <p className="font-medium">{entity.names.plural}</p>
                    <p className="text-xs text-muted-foreground">
                      Manage your {entity.names.plural.toLowerCase()}
                    </p>
                    {limits && (
                      <div className="text-xs">
                        <p>
                          Usage: {limits.currentUsage || 0}
                          {limits.maxRecords !== 'unlimited' && ` / ${limits.maxRecords}`}
                        </p>
                        {limits.isNearLimit && (
                          <p className="text-yellow-600">
                            Approaching limit
                          </p>
                        )}
                      </div>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>
      </TooltipProvider>
    )
  }

  // Horizontal variant
  if (variant === 'horizontal') {
    return (
      <nav className={cn('flex items-center space-x-1', className)}>
        {accessibleEntities.map(({ entity, isActive, limits, href }, index) => {
          const IconComponent = entity.icon
          
          return (
            <React.Fragment key={entity.slug}>
              {index > 0 && <Separator orientation="vertical" className="h-6" />}
              
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      asChild
                      className="h-9"
                    >
                      <Link
                        href={href}
                        onClick={() => handleNavigation(entity.slug)}
                        data-cy={`nav-${entity.slug}`}
                      >
                        <IconComponent className="h-4 w-4" />
                        {showLabels && (
                          <span className="ml-2">{entity.names.plural}</span>
                        )}
                        
                        {showBadges && limits?.isNearLimit && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            ⚠
                          </Badge>
                        )}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  
                  {showTooltips && (
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">{entity.names.plural}</p>
                        {limits && (
                          <p className="text-xs">
                            {limits.currentUsage || 0}
                            {limits.maxRecords !== 'unlimited' && ` / ${limits.maxRecords}`}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </React.Fragment>
          )
        })}
      </nav>
    )
  }

  // Dropdown variant (for mobile or compact spaces)
  return (
    <div className={cn('space-y-1', className)}>
      {accessibleEntities.map(({ entity, isActive, limits, href }) => {
        const IconComponent = entity.icon
        
        return (
          <Link
            key={entity.slug}
            href={href}
            onClick={() => handleNavigation(entity.slug)}
            className={cn(
              'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive 
                ? 'bg-accent text-accent-foreground' 
                : 'text-muted-foreground'
            )}
            data-cy={`nav-${entity.slug}`}
          >
            <div className="flex items-center gap-3">
              <IconComponent className="h-4 w-4" />
              <span>{entity.names.plural}</span>
            </div>
            
            {showBadges && limits && (
              <div className="flex items-center gap-1">
                {limits.isNearLimit && (
                  <Badge variant="outline" className="text-xs">
                    ⚠
                  </Badge>
                )}
                
                <Badge variant="secondary" className="text-xs">
                  {limits.currentUsage || 0}
                  {limits.maxRecords !== 'unlimited' && `/${limits.maxRecords}`}
                </Badge>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * Entity Navigation Section Component
 * Groups entities by category or feature
 */
export interface EntityNavigationSectionProps {
  title: string
  entities: EntityConfig[]
  variant?: EntityNavigationProps['variant']
  showLabels?: boolean
  showBadges?: boolean
  showTooltips?: boolean
  className?: string
  onNavigate?: (entityName: string) => void
}

export function EntityNavigationSection({
  title,
  entities,
  variant = 'sidebar',
  showLabels = true,
  showBadges = true,
  showTooltips = true,
  className,
  onNavigate,
}: EntityNavigationSectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      
      <EntityNavigation
        entities={entities}
        variant={variant}
        showLabels={showLabels}
        showBadges={showBadges}
        showTooltips={showTooltips}
        onNavigate={onNavigate}
      />
    </div>
  )
}

/**
 * Full Entity Navigation with sections
 */
export interface FullEntityNavigationProps {
  variant?: EntityNavigationProps['variant']
  showLabels?: boolean
  showBadges?: boolean
  showTooltips?: boolean
  className?: string
  onNavigate?: (entityName: string) => void
}

export function FullEntityNavigation({
  variant = 'sidebar',
  showLabels = true,
  showBadges = true,
  showTooltips = true,
  className,
  onNavigate,
  entities,
}: FullEntityNavigationProps & { entities: EntityConfig[] }) {
  const { user } = useAuth()

  const entitySections = useMemo(() => {
    if (!user) return []

    // Permission system removed - all users see all enabled entities
    // Entities must be provided by server component via props

    const allEntities = entities
      .filter(entity => entity.enabled && entity.ui?.dashboard?.showInMenu)

    // Group entities by features or create logical sections
    const sections = [
      {
        title: 'Core',
        entities: allEntities.filter(entity =>
          ['user', 'task'].includes(entity.slug)
        ),
      },
      {
        title: 'Business',
        entities: allEntities.filter(entity =>
          ['client', 'project', 'invoice', 'order'].includes(entity.slug)
        ),
      },
      {
        title: 'Other',
        entities: allEntities.filter(entity =>
          !['user', 'task', 'client', 'project', 'invoice', 'order'].includes(entity.slug)
        ),
      },
    ].filter(section => section.entities.length > 0)

    return sections
  }, [user, entities])

  if (!user) return null

  return (
    <div className={cn('space-y-6', className)}>
      {entitySections.map((section) => (
        <EntityNavigationSection
          key={section.title}
          title={section.title}
          entities={section.entities}
          variant={variant}
          showLabels={showLabels}
          showBadges={showBadges}
          showTooltips={showTooltips}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}