/**
 * Universal Entity Detail Component
 * 
 * Automatically generates detail/view pages for any entity based on configuration.
 * Supports child entities, actions, and comprehensive layout.
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '../ui/card'
import { Alert, AlertDescription } from '../ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import type { Permission } from '../../lib/permissions/types'
import { getEntity, getEntityRegistry, getEntityMetadata } from '../../lib/entities/queries'
import { EntityFieldRenderer } from './EntityFieldRenderer'
import { EntityChildManager } from './EntityChildManager'
import { EntityDetailHeader } from './EntityDetailHeader'
import { sel } from '../../lib/test'
import { useTeam } from '../../hooks/useTeam'
import { usePermissions } from '../../lib/permissions/hooks'

/**
 * Custom section configuration for entity details
 */
export interface CustomSectionConfig {
  /**
   * Unique identifier for the section
   */
  id: string
  /**
   * Component to render for this section
   * Receives the entity data and entityConfig as props
   */
  component: React.ComponentType<{
    data: Record<string, unknown>
    entityConfig: EntityConfig
  }>
  /**
   * Position where to render the section
   * - 'after-details': After the main details card
   * - 'after-children': After child entity sections
   * - 'sidebar': In the sidebar area
   */
  position?: 'after-details' | 'after-children' | 'sidebar'
}

export interface EntityDetailProps {
  entityConfig: EntityConfig
  data: Record<string, unknown>
  isLoading?: boolean
  error?: string | null
  childData?: Record<string, Record<string, unknown>[]>
  childEntityNames?: string[]
  onEdit?: () => void
  onDelete?: () => Promise<void>
  onChildAdd?: (childName: string, data: Record<string, unknown>) => Promise<void>
  onChildEdit?: (childName: string, id: string, data: Record<string, unknown>) => Promise<void>
  onChildDelete?: (childName: string, id: string) => Promise<void>
  onRefresh?: () => void
  enableActions?: boolean
  className?: string
  /**
   * Optional custom form components for specific child entities
   * Map of childEntityName -> CustomFormComponent
   * Example: { 'social-platforms': SocialPlatformOAuthForm }
   */
  customFormComponents?: Record<string, React.ComponentType<any>>
  /**
   * Optional custom sections to render in the detail view
   * Useful for entity-specific features like team members
   */
  customSections?: CustomSectionConfig[]
}


export function EntityDetail({
  entityConfig,
  data,
  isLoading = false,
  error = null,
  childData = {},
  childEntityNames = [],
  onEdit,
  onDelete,
  onChildAdd,
  onChildEdit,
  onChildDelete,
  onRefresh,
  enableActions = true,
  className,
  customFormComponents = {},
  customSections = [],
}: EntityDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  // Get current team ID for team-scoped operations like user display
  const { teamId } = useTeam()

  // Check permissions for edit and delete actions
  const { canUpdate, canDelete } = usePermissions({
    canUpdate: `${entityConfig.slug}.update` as Permission,
    canDelete: `${entityConfig.slug}.delete` as Permission,
  })


  // Get fields that should be shown in detail view
  const detailFields = entityConfig.fields
    .filter(field => field.display.showInDetail)
    .sort((a, b) => a.display.order - b.display.order)

  // Get child entities that should be shown from registry data
  console.log('[EntityDetail] childEntityNames:', childEntityNames)
  console.log('[EntityDetail] childData:', childData)
  console.log('[EntityDetail] Object.keys(childData):', Object.keys(childData))
  console.log('[EntityDetail] customFormComponents:', customFormComponents)
  console.log('[EntityDetail] customFormComponents keys:', Object.keys(customFormComponents || {}))
  // Always show child entity sections if childEntityNames are provided
  // This allows for creation even when no child data exists
  const childEntities = childEntityNames || []
  console.log('[EntityDetail] childEntities (always show if names provided):', childEntities)

  // Handle delete with loading state
  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete()
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-6">
      <div
        className={`max-w-7xl mx-auto space-y-6 ${className || ''}`}
        data-cy={sel('entities.detail.container', { slug: entityConfig.slug })}
      >
        {/* Entity Detail Header */}
        {enableActions ? (
          <EntityDetailHeader
            entityConfig={entityConfig}
            mode="view"
            entity={{
              id: String(data.id),
              createdAt: data.createdAt as string | undefined,
              updatedAt: data.updatedAt as string | undefined,
              ...data,
            }}
            onEdit={onEdit}
            onDelete={onDelete ? handleDelete : undefined}
            canEdit={canUpdate}
            canDelete={canDelete}
            isDeleting={isDeleting}
          />
        ) : (
          <EntityDetailHeader
            entityConfig={entityConfig}
            mode="view"
            entity={{
              id: String(data.id),
              createdAt: data.createdAt as string | undefined,
              updatedAt: data.updatedAt as string | undefined,
              ...data,
            }}
            canEdit={false}
            canDelete={false}
          />
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* Main Details Section */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {detailFields.map((field) => {
                  // Map columnWidth to proper Tailwind classes (12-column system)
                  const getColumnSpanClass = (width: number | undefined) => {
                    if (!width) return 'md:col-span-6' // Default to half width (6/12)
                    switch (width) {
                      case 1: return 'md:col-span-1'
                      case 2: return 'md:col-span-2'
                      case 3: return 'md:col-span-3'
                      case 4: return 'md:col-span-4'
                      case 5: return 'md:col-span-5'
                      case 6: return 'md:col-span-6'
                      case 7: return 'md:col-span-7'
                      case 8: return 'md:col-span-8'
                      case 9: return 'md:col-span-9'
                      case 10: return 'md:col-span-10'
                      case 11: return 'md:col-span-11'
                      case 12: return 'md:col-span-12'
                      default: return 'md:col-span-12' // Full width for larger values
                    }
                  }

                  return (
                    <div
                      key={field.name}
                      className={getColumnSpanClass(field.display.columnWidth)}
                    >
                      <EntityFieldRenderer
                        field={field}
                        value={data[field.name]}
                        mode="display"
                        context={{
                          entityType: entityConfig.slug,
                          formData: data, // Pass the record data so RelationDisplay can access parentId
                          teamId, // Pass teamId for user field display
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

        {/* Custom Sections (after-details) */}
        {customSections
          .filter(section => section.position === 'after-details')
          .map(section => (
            <section.component
              key={section.id}
              data={data}
              entityConfig={entityConfig}
            />
          ))}

        {/* Child Entities Sections */}
        {childEntities.map((childName) => {
          // Get child entity configuration from registry
          const childEntityConfig = getEntity(childName)
          const childRegistryEntry = getEntityMetadata(childName)

          if (!childEntityConfig || !childRegistryEntry) {
            console.warn(`Child entity "${childName}" not found in registry`)
            return null
          }

          // Create a ChildEntityDefinition from the EntityConfig
          const childConfig = {
            fields: childEntityConfig.fields,
            display: {
              title: (childEntityConfig as any).names?.plural || (childEntityConfig as any).display?.title || childName,
              description: `Manage ${((childEntityConfig as any).names?.plural || (childEntityConfig as any).display?.title || childName).toLowerCase()} for this ${entityConfig.names.singular.toLowerCase()}`,
              mode: 'table' as const
            }
          }

          console.log(`[EntityDetail] Rendering EntityChildManager for ${childName}`)
          console.log(`[EntityDetail] customFormComponents[${childName}]:`, customFormComponents[childName])

          return (
            <EntityChildManager
              key={childName}
              parentEntityConfig={entityConfig}
              parentEntityId={String(data.id)}
              childEntityName={childName}
              childEntityConfig={childConfig as any}
              childData={childData[childName] || []}
              onChildAdd={onChildAdd ? (data) => onChildAdd(childName, data) : undefined}
              onChildUpdate={onChildEdit ? (id, data) => onChildEdit(childName, id, data) : undefined}
              onChildDelete={onChildDelete ? (id) => onChildDelete(childName, id) : undefined}
              onRefresh={onRefresh}
              isLoading={isLoading}
              customFormComponent={customFormComponents[childName]}
            />
          )
        })}

        {/* Custom Sections (after-children) - default position */}
        {customSections
          .filter(section => !section.position || section.position === 'after-children')
          .map(section => (
            <section.component
              key={section.id}
              data={data}
              entityConfig={entityConfig}
            />
          ))}
        </div>
      </div>
    </div>
  )
}