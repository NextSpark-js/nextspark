/**
 * Universal Entity Form Component
 * 
 * Automatically generates create/edit forms for any entity based on configuration.
 * Supports validation, field dependencies, and child entity management.
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import {
  Loader2,
  Save,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import { EntityFieldRenderer } from './EntityFieldRenderer'
import { sel } from '../../lib/test'

export interface EntityFormProps {
  entityConfig: EntityConfig
  initialData?: Record<string, unknown>
  mode: 'create' | 'edit'
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onChange?: (data: Record<string, unknown>) => void
  isLoading?: boolean
  error?: string | null
  validationErrors?: Record<string, string>
  enableChildEntities?: boolean
  childData?: Record<string, Record<string, unknown>[]>
  onChildAdd?: (childName: string, data: Record<string, unknown>) => Promise<void>
  onChildDelete?: (childName: string, id: string) => Promise<void>
  className?: string
  disabledFields?: string[]
  hiddenFields?: string[]
  /** Team ID for team-scoped operations like user selection */
  teamId?: string
}

interface FormData {
  [key: string]: unknown
}

/**
 * Validate form data against entity configuration
 */
function validateFormData(
  data: FormData,
  entityConfig: EntityConfig
): Record<string, string> {
  const errors: Record<string, string> = {}

  entityConfig.fields.forEach(field => {
    // Skip fields that are not shown in form (they are handled by backend)
    if (!field.display.showInForm) return

    const value = data[field.name]

    // Check required fields
    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field.name] = `${field.display.label} is required`
      return
    }
    
    // Type-specific validation
    if (value !== undefined && value !== null && value !== '') {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(String(value))) {
            errors[field.name] = 'Please enter a valid email address'
          }
          break
          
        case 'url':
          try {
            // Normalize URL by adding https:// if no protocol present
            let urlValue = String(value).trim()
            if (!/^https?:\/\//i.test(urlValue)) {
              urlValue = `https://${urlValue}`
            }
            new URL(urlValue)
          } catch {
            errors[field.name] = 'Please enter a valid URL'
          }
          break
          
        case 'number':
          if (isNaN(Number(value))) {
            errors[field.name] = 'Please enter a valid number'
          }
          break
          
        case 'json':
          if (typeof value === 'string') {
            try {
              JSON.parse(value)
            } catch {
              errors[field.name] = 'Please enter valid JSON'
            }
          }
          break
      }
    }
  })
  
  return errors
}

/**
 * Generate test IDs for entity form
 * @deprecated This will be removed when all data-testid attributes are migrated to data-cy with sel()
 */
function generateTestIds(entityName: string) {
  return {
    form: `${entityName}-form`,
    field: (fieldName: string) => `${entityName}-field-${fieldName}`,
    submit: `${entityName}-submit`,
    childSection: (childName: string) => `${entityName}-child-${childName}`,
    childAdd: (childName: string) => `${entityName}-${childName}-add`,
  }
}

export function EntityForm({
  entityConfig,
  initialData = {},
  mode,
  onSubmit,
  onChange,
  isLoading = false,
  error = null,
  validationErrors = {},
  enableChildEntities = false,
  childData = {},
  onChildAdd,
  onChildDelete,
  className,
  disabledFields = [],
  hiddenFields = [],
  teamId,
}: EntityFormProps) {
  const [formData, setFormData] = useState<FormData>(() => {
    const initial: FormData = {}

    // Initialize with default values from field configuration
    entityConfig.fields.forEach(field => {
      // Skip fields that should not be shown in forms (e.g., createdAt, updatedAt)
      if (!field.display.showInForm) return

      if (field.name in initialData) {
        initial[field.name] = initialData[field.name]
      } else if (field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue
      } else {
        // Set appropriate empty values based on field type
        switch (field.type) {
          case 'boolean':
            initial[field.name] = false
            break
          case 'multiselect':
          case 'tags':
            initial[field.name] = []
            break
          case 'number':
            initial[field.name] = ''
            break
          default:
            initial[field.name] = ''
        }
      }
    })

    return initial
  })
  
  const [localValidationErrors, setLocalValidationErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  
  const testIds = generateTestIds(entityConfig.slug)

  // Update form data when initial data changes (supports both edit and create modes with Quick Fill)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  // Notify parent component when form data changes (moved from setState to avoid render-phase updates)
  useEffect(() => {
    onChange?.(formData)
  }, [formData, onChange])

  // Get fields that should be shown in form
  const formFields = entityConfig.fields
    .filter(field => field.display.showInForm)
    .filter(field => !hiddenFields.includes(field.name))
    .sort((a, b) => a.display.order - b.display.order)

  // Get child entities that should be shown
  const childEntities = enableChildEntities && entityConfig.childEntities 
    ? Object.entries(entityConfig.childEntities).filter(([, config]) => config.showInParentView)
    : []

  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData(prev => {
      const newFormData = { ...prev, [fieldName]: value }

      // Reset dependent fields when parent field changes
      // Find all fields that depend on this field as parent
      const dependentFields = entityConfig.fields.filter(field =>
        field.relation?.parentId === fieldName
      )

      // Reset dependent fields to null/empty
      dependentFields.forEach(field => {
        if (field.type === 'relation-multi') {
          newFormData[field.name] = []
        } else {
          newFormData[field.name] = null
        }
      })

      // Note: onChange is called via useEffect to avoid render-phase state updates

      return newFormData
    })

    // Clear validation error for this field
    if (localValidationErrors[fieldName]) {
      setLocalValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }, [localValidationErrors, entityConfig.fields])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const errors = validateFormData(formData, entityConfig)
    const allErrors = { ...errors, ...validationErrors }

    if (Object.keys(allErrors).length > 0) {
      setLocalValidationErrors(allErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (err) {
      console.error('Form submission failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, entityConfig, validationErrors, onSubmit])

  const allErrors = { ...localValidationErrors, ...validationErrors }
  const hasErrors = Object.keys(allErrors).length > 0

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Global error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        data-testid={testIds.form}
        data-cy={sel('entities.form.container', { slug: entityConfig.slug })}
        className="space-y-6"
      >
        {childEntities.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="main">
                Details
                {hasErrors && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                    !
                  </Badge>
                )}
              </TabsTrigger>
              
              {childEntities.map(([childName, childConfig]) => (
                <TabsTrigger key={childName} value={childName}>
                  {childConfig.display.title}
                  {childData[childName]?.length ? (
                    <Badge variant="outline" className="ml-2">
                      {childData[childName].length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Main form fields */}
            <TabsContent value="main">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {formFields.map((field) => {
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
                        data-cy={sel('entities.form.field', { slug: entityConfig.slug, name: field.name })}
                      >
                        <EntityFieldRenderer
                          field={field}
                          value={formData[field.name]}
                          onChange={(value) => handleFieldChange(field.name, value)}
                          mode="form"
                          error={allErrors[field.name]}
                          disabled={isSubmitting || field.api.readOnly || disabledFields.includes(field.name)}
                          required={field.required}
                          testId={testIds.field(field.name)}
                          context={{
                            entityType: entityConfig.slug,
                            formData: formData,
                            teamId: teamId,
                          }}
                        />
                      </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Child entity tabs */}
            {childEntities.map(([childName, childConfig]) => (
              <TabsContent key={childName} value={childName} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{childConfig.display.title}</CardTitle>
                    {childConfig.display.description && (
                      <CardDescription>{childConfig.display.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="space-y-4"
                      data-testid={testIds.childSection(childName)}
                    >
                      {childData[childName]?.length ? (
                        <div className="space-y-3">
                          {childData[childName].map((item, index) => (
                            <Card key={String(item.id) || index} className="border-dashed">
                              <CardContent className="pt-6">
                                <div className="flex justify-between items-start mb-4">
                                  <h4 className="font-medium">Item {index + 1}</h4>
                                  {onChildDelete && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onChildDelete(childName, String(item.id))}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {childConfig.fields.map((field) => (
                                    <EntityFieldRenderer
                                      key={field.name}
                                      field={{
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
                                      }}
                                      value={item[field.name]}
                                      mode="display"
                                    />
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No {childConfig.display.title.toLowerCase()} added yet</p>
                        </div>
                      )}
                      
                      {onChildAdd && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onChildAdd(childName, {})}
                          data-testid={testIds.childAdd(childName)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add {childConfig.display.title.slice(0, -1)} {/* Remove 's' from plural */}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          /* Single card layout for entities without children */
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {formFields.map((field) => {
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
                    data-cy={sel('entities.form.field', { slug: entityConfig.slug, name: field.name })}
                  >
                    <EntityFieldRenderer
                      field={field}
                      value={formData[field.name]}
                      onChange={(value) => handleFieldChange(field.name, value)}
                      mode="form"
                      error={allErrors[field.name]}
                      disabled={isSubmitting || field.api.readOnly || disabledFields.includes(field.name)}
                      required={field.required}
                      testId={testIds.field(field.name)}
                      context={{
                        entityType: entityConfig.slug,
                        formData: formData,
                        teamId: teamId,
                      }}
                    />
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6">
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            data-testid={testIds.submit}
            data-cy={sel('entities.form.submitButton', { slug: entityConfig.slug })}
          >
            {isSubmitting || isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mode === 'create' ? 'Create' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}