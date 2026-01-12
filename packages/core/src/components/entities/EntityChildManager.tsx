/**
 * Universal Child Entity Manager Component
 * 
 * Provides comprehensive management interface for child entities including
 * inline creation, editing, and advanced relationship management.
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  AlertCircle,
  Loader2
} from 'lucide-react'
import type { EntityConfig, ChildEntityDefinition } from '../../lib/entities/types'
import { EntityFieldRenderer } from './EntityFieldRenderer'
import { EntityForm } from './EntityForm'
import { sel } from '../../lib/test'

export interface EntityChildManagerProps {
  parentEntityConfig: EntityConfig
  parentEntityId: string
  childEntityName: string
  childEntityConfig: ChildEntityDefinition
  childData: Record<string, unknown>[]
  onChildAdd?: (data: Record<string, unknown>) => Promise<string | void>
  onChildUpdate?: (id: string, data: Record<string, unknown>) => Promise<string | void>
  onChildDelete?: (id: string) => Promise<void>
  onRefresh?: () => void | Promise<void>
  isLoading?: boolean
  error?: string | null
  enableInlineEditing?: boolean
  enableReordering?: boolean
  enableBulkOperations?: boolean
  maxItems?: number
  className?: string
  /**
   * Optional custom form component to replace the default EntityForm
   * Useful for theme-level customizations (e.g., OAuth integration for social platforms)
   *
   * Component receives same props as EntityForm:
   * - entityConfig, initialData, mode, onSubmit, onCancel, isLoading, onRefresh
   */
  customFormComponent?: React.ComponentType<any>
}

interface ChildFormState {
  isOpen: boolean
  mode: 'create' | 'edit'
  item: Record<string, unknown> | null
  index?: number
}


export function EntityChildManager({
  parentEntityConfig,
  childEntityName,
  childEntityConfig,
  childData = [],
  onChildAdd,
  onChildUpdate,
  onChildDelete,
  onRefresh,
  isLoading = false,
  error = null,
  maxItems,
  className,
  customFormComponent,
}: EntityChildManagerProps) {
  // Debug logging
  console.log(`[EntityChildManager] childEntityName: ${childEntityName}`)
  console.log(`[EntityChildManager] customFormComponent:`, customFormComponent)
  console.log(`[EntityChildManager] customFormComponent type:`, typeof customFormComponent)

  const [formState, setFormState] = useState<ChildFormState>({
    isOpen: false,
    mode: 'create',
    item: null,
  })
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionMode, setSubmissionMode] = useState<'create' | 'edit'>('create')
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set())
  
  // Transition effects for recently modified items
  const [recentlyModified, setRecentlyModified] = useState<Set<string>>(new Set())
  
  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    item: Record<string, unknown> | null
  }>({ isOpen: false, item: null })
  
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Helper function to add transition effect
  const addTransitionEffect = useCallback((itemId: string) => {
    setRecentlyModified(prev => new Set(prev).add(itemId))
    
    // Remove the effect after 2 seconds
    setTimeout(() => {
      setRecentlyModified(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }, 2000)
  }, [])

  // Get visible fields for this child entity
  const visibleFields = useMemo(() => {
    return childEntityConfig.fields
      .map(field => ({
        ...field,
        api: {
          searchable: false,
          sortable: true,
          readOnly: false,
        },
        display: field.display || {
          label: field.name,
          description: `${field.name} field`,
          showInList: true,
          showInDetail: true,
          showInForm: true,
          order: 1,
        },
      }))
      .filter(field => field.display?.showInList !== false)
      .sort((a, b) => (a.display?.order || 0) - (b.display?.order || 0))
  }, [childEntityConfig.fields])

  // Sort child data
  const sortedChildData = useMemo(() => {
    if (!sortField) return childData
    
    const sorted = [...childData].sort((a, b) => {
      const aValue = a[sortField] as string | number
      const bValue = b[sortField] as string | number
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [childData, sortField, sortDirection])

  // Handle sort
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  // Get sort icon
  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />
  }, [sortField, sortDirection])

  // Handle create
  const handleCreate = useCallback(() => {
    setFormState({
      isOpen: true,
      mode: 'create',
      item: null,
    })
  }, [])

  // Handle edit
  const handleEdit = useCallback((item: Record<string, unknown>, index: number) => {
    setFormState({
      isOpen: true,
      mode: 'edit',
      item,
      index,
    })
  }, [])

  // Handle form submit
  const handleFormSubmit = useCallback(async (data: Record<string, unknown>) => {
    // Save the mode before closing modal
    const currentMode = formState.mode
    setSubmissionMode(currentMode)
    
    // Close modal immediately for better UX
    setFormState({ isOpen: false, mode: 'create', item: null })
    setIsSubmitting(true)
    
    try {
      let resultId: string | undefined
      
      if (currentMode === 'create') {
        const result = await onChildAdd?.(data)
        resultId = typeof result === 'string' ? result : undefined
        if (resultId) {
          addTransitionEffect(resultId)
        }
      } else if (currentMode === 'edit' && formState.item) {
        const itemId = String(formState.item.id)
        await onChildUpdate?.(itemId, data)
        addTransitionEffect(itemId)
      }
    } catch (error) {
      console.error('Child entity operation failed:', error)
      // Optionally show error toast/notification here instead of throwing
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [formState, onChildAdd, onChildUpdate, addTransitionEffect])

  // Handle delete click - show confirmation modal
  const handleDelete = useCallback((item: Record<string, unknown>) => {
    setDeleteConfirmation({ isOpen: true, item })
  }, [])
  
  // Handle confirmed delete
  const handleConfirmedDelete = useCallback(async () => {
    const { item } = deleteConfirmation
    if (!onChildDelete || !item) return
    
    const itemId = String(item.id)
    
    // Close confirmation modal and start loading
    setDeleteConfirmation({ isOpen: false, item: null })
    setDeletingItems(prev => new Set(prev).add(itemId))
    
    try {
      await onChildDelete(itemId)
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }, [deleteConfirmation, onChildDelete])
  
  // Handle delete cancellation
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmation({ isOpen: false, item: null })
  }, [])

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    setFormState({ isOpen: false, mode: 'create', item: null })
  }, [])

  // Check if at max items
  const isAtMaxItems = maxItems ? childData.length >= maxItems : false

  // Create child entity config for form
  const childEntityFormConfig = useMemo(() => ({
    name: childEntityName,
    slug: childEntityName, // Use same as name for child entities
    displayName: childEntityConfig.display.title.slice(0, -1), // Remove 's' from plural
    pluralName: childEntityConfig.display.title,
    icon: parentEntityConfig.icon, // Use parent icon
    public: false, // Child entities are not public
    hasArchivePage: false, // Child entities don't have archive pages
    hasSinglePage: false, // Child entities don't have single pages
    features: {
      enabled: true,
      showInMenu: false,
      searchable: false,
      allowSearch: false,
      hasExternalAPI: false,
      supportsMetas: false,
      sortable: true,
      filterable: false,
      supportsBulkOperations: false,
      supportsImportExport: false,
    },
    fields: childEntityConfig.fields.map(field => ({
      ...field,
      api: {
        searchable: false,
        sortable: true,
        readOnly: false,
      },
      display: field.display || {
        label: field.name,
        description: `${field.name} field`,
        showInList: true,
        showInDetail: true,
        showInForm: true,
        order: 1,
      },
    })),
    permissions: {
      actions: [
        { action: 'create', label: 'Create', roles: ['owner', 'admin', 'member'] },
        { action: 'read', label: 'View', roles: ['owner', 'admin', 'member', 'viewer'] },
        { action: 'list', label: 'List', roles: ['owner', 'admin', 'member', 'viewer'] },
        { action: 'update', label: 'Edit', roles: ['owner', 'admin', 'member'] },
        { action: 'delete', label: 'Delete', roles: ['owner', 'admin'], dangerous: true },
      ],
    },
    planLimits: {
      availableInPlans: ['free', 'starter', 'premium'],
      limits: {
        free: { maxRecords: 'unlimited' },
        starter: { maxRecords: 'unlimited' },
        premium: { maxRecords: 'unlimited' },
      },
    },
    routes: {
      list: '',
      detail: '',
      create: '',
      edit: '',
    },
    hooks: {
      beforeCreate: [],
      afterCreate: [],
      beforeUpdate: [],
      afterUpdate: [],
      beforeDelete: [],
      afterDelete: [],
    },
    database: {
      tableName: '',
      primaryKey: 'id',
      timestamps: true,
      softDelete: false,
    },
    api: {
      apiPath: '',
      enabled: false,
      rateLimit: { requests: 100, windowMs: 60000 },
    },
  }), [childEntityName, childEntityConfig, parentEntityConfig.icon])

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className || ''}`}>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`space-y-4 ${className || ''}`}
      data-cy={sel('entities.childEntity.container', { parentSlug: parentEntityConfig.slug, childName: childEntityName })}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">{childEntityConfig.display.title}</h3>
          {childEntityConfig.display.description && (
            <p className="text-sm text-muted-foreground">
              {childEntityConfig.display.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {childData.length > 0 && (
            <Badge variant="outline">
              {childData.length}
              {maxItems && ` / ${maxItems}`}
            </Badge>
          )}
          
          {onChildAdd && !isAtMaxItems && (
            <Button
              size="sm"
              onClick={handleCreate}
              data-cy={sel('entities.childEntity.addButton', { parentSlug: parentEntityConfig.slug, childName: childEntityName })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add {childEntityConfig.display.title.slice(0, -1)}
            </Button>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {isSubmitting && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            {submissionMode === 'create' ? 'Creando' : 'Actualizando'} {childEntityConfig.display.title.slice(0, -1).toLowerCase()}...
          </AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Max items warning */}
      {isAtMaxItems && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Maximum number of {childEntityConfig.display.title.toLowerCase()} reached ({maxItems})
          </AlertDescription>
        </Alert>
      )}

      {/* Child items */}
      {sortedChildData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {React.createElement(parentEntityConfig.icon, { 
              className: "h-12 w-12 text-muted-foreground/50 mb-4" 
            })}
            <h4 className="font-medium mb-2">
              No {childEntityConfig.display.title.toLowerCase()}
            </h4>
            <p className="text-sm text-muted-foreground text-center mb-4">
              This {parentEntityConfig.names.singular.toLowerCase()} doesn&apos;t have any {childEntityConfig.display.title.toLowerCase()} yet.
            </p>
            {onChildAdd && !isAtMaxItems && (
              <Button onClick={handleCreate} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add First {childEntityConfig.display.title.slice(0, -1)}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {childEntityConfig.display.mode === 'table' ? (
            // Table view
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      {visibleFields.map((field) => (
                        <th key={field.name} className="px-4 py-3 text-left text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort(field.name)}
                            className="h-auto p-0 font-medium hover:bg-transparent"
                          >
                            {field.display?.label || field.name}
                            {getSortIcon(field.name)}
                          </Button>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-sm font-medium w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedChildData.map((item, index) => {
                      const itemId = String(item.id)
                      const isRecentlyModified = recentlyModified.has(itemId)
                      
                      return (
                        <tr
                          key={itemId || index}
                          className={`hover:bg-muted/50 transition-colors duration-1000 ${
                            isRecentlyModified ? 'bg-accent/50' : ''
                          }`}
                        >
                        {visibleFields.map((field) => (
                          <td key={field.name} className="px-4 py-3">
                            <EntityFieldRenderer
                              field={field}
                              value={item[field.name]}
                              mode="list"
                              context={{
                                entityType: `${parentEntityConfig.slug}_${childEntityName}`, // Child entity type
                                formData: item, // Pass the record data
                              }}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              
                              {onChildUpdate && (
                                <DropdownMenuItem
                                  onClick={() => handleEdit(item, index)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText(String(item.id))}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy ID
                              </DropdownMenuItem>
                              
                              {onChildDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDelete(item)}
                                    disabled={deletingItems.has(String(item.id))}
                                  >
                                    {deletingItems.has(String(item.id)) ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            // Card view
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedChildData.map((item, index) => {
                const itemId = String(item.id)
                const isRecentlyModified = recentlyModified.has(itemId)
                
                return (
                  <Card
                    key={itemId || index}
                    className={`transition-colors duration-1000 ${
                      isRecentlyModified ? 'bg-accent/30 border-accent' : ''
                    }`}
                  >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {String(item.title || item.name || `Item ${index + 1}`)}
                        </CardTitle>
                        {typeof item.description === 'string' && item.description && (
                          <CardDescription className="text-xs line-clamp-2">
                            {item.description}
                          </CardDescription>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onChildUpdate && (
                            <DropdownMenuItem
                              onClick={() => handleEdit(item, index)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          
                          {onChildDelete && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(item)}
                              disabled={deletingItems.has(String(item.id))}
                            >
                              {deletingItems.has(String(item.id)) ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {visibleFields.slice(0, 3).map((field) => (
                      <div key={field.name}>
                        <EntityFieldRenderer
                          field={field}
                          value={item[field.name]}
                          mode="display"
                        />
                      </div>
                    ))}
                  </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formState.isOpen} onOpenChange={(open) => !open && handleFormCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formState.mode === 'create' ? 'Add' : 'Edit'} {childEntityConfig.display.title.slice(0, -1)}
            </DialogTitle>
            <DialogDescription>
              {formState.mode === 'create' 
                ? `Add a new ${childEntityConfig.display.title.slice(0, -1).toLowerCase()} to this ${parentEntityConfig.names.singular.toLowerCase()}.`
                : `Update the details for this ${childEntityConfig.display.title.slice(0, -1).toLowerCase()}.`
              }
            </DialogDescription>
          </DialogHeader>

          <div>
            {useMemo(() => {
              console.log('[EntityChildManager RENDER] Rendering form for:', childEntityName)
              console.log('[EntityChildManager RENDER] customFormComponent:', customFormComponent)
              console.log('[EntityChildManager RENDER] Using custom form?:', !!customFormComponent)

              if (customFormComponent) {
                console.log('[EntityChildManager RENDER] Creating custom component with stable props')
                return React.createElement(customFormComponent, {
                  entityConfig: childEntityFormConfig as any,
                  initialData: formState.item || {},
                  mode: formState.mode,
                  onSubmit: handleFormSubmit,
                  onCancel: handleFormCancel,
                  onRefresh: onRefresh,
                  isLoading: isSubmitting,
                  className: "border-0 shadow-none p-0"
                })
              } else {
                console.log('[EntityChildManager RENDER] Using generic EntityForm')
                return (
                  <EntityForm
                    entityConfig={childEntityFormConfig as any}
                    initialData={formState.item || {}}
                    mode={formState.mode}
                    onSubmit={handleFormSubmit}
                    isLoading={isSubmitting}
                    className="border-0 shadow-none p-0"
                  />
                )
              }
            }, [
              customFormComponent,
              childEntityFormConfig,
              formState.item,
              formState.mode,
              handleFormSubmit,
              handleFormCancel,
              onRefresh,
              isSubmitting,
              childEntityName
            ])}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmation.isOpen} onOpenChange={(open) => !open && handleCancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este {childEntityConfig.display.title.slice(0, -1).toLowerCase()}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancelDelete}
              disabled={false}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmedDelete}
              disabled={false}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}