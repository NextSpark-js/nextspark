"use client"

import * as React from "react"
import { Button } from './button'
import { Badge } from './badge'
import { X } from "lucide-react"
import { parseChildEntity, clientMetaSystemAdapter, getEntityApiPath } from '@nextsparkjs/registries/entity-registry.client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'

export interface SimpleEntityOption {
  id: string
  title: string
  subtitle?: string
}

export interface SimplePropertyOption {
  value: string
  label: string
  entityType: string
}

export interface SimpleRelationSelectProps {
  value?: string | string[]
  onChange: (value: string | string[] | null) => void
  entityType: string
  titleField?: string
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  parentId?: string
  // For property-based relations
  propField?: string
  usePropertyMode?: boolean
  propertyOptions?: Array<{ value: string; label: string }>
  // For user filtering
  userFiltered?: boolean
  // Team ID for team-scoped entity queries
  teamId?: string
}

export function SimpleRelationSelect({
  value,
  onChange,
  entityType,
  titleField,
  multiple = false,
  placeholder = "Seleccionar...",
  disabled = false,
  parentId,
  propField,
  usePropertyMode = false,
  propertyOptions = [],
  userFiltered = false,
  teamId,
}: SimpleRelationSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<SimpleEntityOption[]>([])
  const [propertyOptionsState, setPropertyOptionsState] = React.useState<SimplePropertyOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedOptions, setSelectedOptions] = React.useState<SimpleEntityOption[]>([])
  const [selectedPropertyValues, setSelectedPropertyValues] = React.useState<Array<{ value: string; label: string }>>([])
  const loadedIdsRef = React.useRef<string[]>([])
  const lastSelectedPropertyValuesRef = React.useRef<string>('')
  const lastParentIdRef = React.useRef<string>('')

  // Reset options and value when parentId changes for child entities
  React.useEffect(() => {
    const childInfo = parseChildEntity(entityType)
    if (childInfo.isChild && lastParentIdRef.current !== '' && lastParentIdRef.current !== parentId) {
      // ParentId changed for a child entity - clear everything
      setOptions([])
      setSelectedOptions([])
      
      // Clear the form value
      if (multiple) {
        onChange([])
      } else {
        onChange('')
      }
    }
    
    // Always update the lastParentIdRef to track changes
    lastParentIdRef.current = parentId || ''
  }, [parentId, entityType, multiple, onChange])

  // Normalize value to arrays for easier handling
  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // Load options when opened
  const loadOptions = React.useCallback(async () => {
    if (loading) return
    
    setLoading(true)
    try {
      if (usePropertyMode && propField) {
        // Only load property-based options if we have a parentId (for filtering)
        if (parentId) {
          // Use specific entity API with fields parameter
          const apiPath = getEntityApiPath(entityType)
          const hasSpecificAPI = apiPath !== null

          let url: URL
          if (hasSpecificAPI) {
            // Use specific API with fields filter
            url = new URL(`/api/v1/${apiPath}`, window.location.origin)
            url.searchParams.set('fields', propField)
            url.searchParams.set('distinct', 'true')
            url.searchParams.set('parentId', parentId)
            url.searchParams.set('limit', '50')
          } else {
            // No specific API available for this entity type
            console.warn(`No specific API available for entity type: ${entityType}`)
            return []
          }
          
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(teamId && { 'x-team-id': teamId })
            },
            credentials: 'include',
          })

          if (response.ok) {
            const result = await response.json()
            const fetchedOptions = result.success ? result.data : []
            setPropertyOptionsState(fetchedOptions)
          } else {
            console.error(`[SimpleRelationSelect] API Error:`, response.status, response.statusText)
          }
        } else {
          // No parentId, clear dynamic options to show only static ones
          setPropertyOptionsState([])
        }
      } else {
        let url: URL
        
        // Check if this is a child entity that needs special handling
        const childInfo = parseChildEntity(entityType)
        if (childInfo.isChild && childInfo.parentEntity && childInfo.childType && parentId) {
          // Use child entity API: /api/v1/{parent}s/{parentId}/child/{childType}
          const parentApiPath = getEntityApiPath(childInfo.parentEntity)
          if (parentApiPath) {
            url = new URL(`/api/v1/${parentApiPath}/${parentId}/child/${childInfo.childType}`, window.location.origin)
          } else {
            console.warn(`No API path found for parent entity: ${childInfo.parentEntity}`)
            return []
          }
        } else {
          // Regular entity - use specific entity API
          const apiPath = getEntityApiPath(entityType)
          const hasSpecificAPI = apiPath !== null

          if (hasSpecificAPI) {
            url = new URL(`/api/v1/${apiPath}`, window.location.origin)
            url.searchParams.set('limit', '20')
            if (parentId) {
              url.searchParams.set('parentId', parentId)
            }
            if (userFiltered) {
              url.searchParams.set('userFiltered', 'true')
            }
          } else {
            console.warn(`No specific API available for entity type: ${entityType}`)
            return []
          }
        }
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(teamId && { 'x-team-id': teamId })
          },
          credentials: 'include',
        })

        if (response.ok) {
          const result = await response.json()

          // Handle API response format (both child entities and regular entities use same format)
          if (result.success && Array.isArray(result.data)) {
            // Transform API data to SimpleEntityOption format
            const transformedData = result.data.map((item: Record<string, unknown>) => ({
              id: String(item.id || ''),
              title: String(item[titleField || 'name'] || item.name || item.title || item.id || ''),
              subtitle: String(item.industry || item.description || ''),
              entityType: entityType
            }))
            setOptions(transformedData)
          } else {
            setOptions([])
          }
        }
      }
    } catch (error) {
      console.error(`Error loading options for ${entityType}:`, error)
    } finally {
      setLoading(false)
    }
  }, [entityType, parentId, titleField, propField, usePropertyMode, userFiltered, loading, teamId])

  // Auto-load options for child entities when parentId is available
  React.useEffect(() => {
    const childInfo = parseChildEntity(entityType)
    if (childInfo.isChild && parentId && options.length === 0 && !loading) {
      loadOptions()
    }
  }, [entityType, parentId, options.length, loading, loadOptions])

  // Load selected options details by IDs
  const loadSelectedOptions = React.useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setSelectedOptions([])
      loadedIdsRef.current = []
      return
    }
    
    // Check if we already loaded these exact IDs
    const idsString = ids.sort().join(',')
    const loadedIdsString = loadedIdsRef.current.sort().join(',')
    
    if (idsString === loadedIdsString) {
      // We already loaded these exact IDs
      return
    }
    
    try {
      let url: URL
      
      // Check if this is a child entity that needs special handling
      const childInfo = parseChildEntity(entityType)
      if (childInfo.isChild && childInfo.parentEntity && childInfo.childType && parentId) {
        // Use child entity API: /api/v1/{parent}s/{parentId}/child/{childType}
        const parentApiPath = getEntityApiPath(childInfo.parentEntity)
        if (parentApiPath) {
          url = new URL(`/api/v1/${parentApiPath}/${parentId}/child/${childInfo.childType}`, window.location.origin)
        } else {
          console.warn(`No API path found for parent entity: ${childInfo.parentEntity}`)
          return
        }
      } else {
        // Regular entity - use specific entity API
        const apiPath = getEntityApiPath(entityType)
        const hasSpecificAPI = apiPath !== null

        if (hasSpecificAPI) {
          url = new URL(`/api/v1/${apiPath}`, window.location.origin)
          url.searchParams.set('ids', ids.join(','))
          if (parentId) {
            url.searchParams.set('parentId', parentId)
          }
          if (userFiltered) {
            url.searchParams.set('userFiltered', 'true')
          }
        } else {
          console.warn(`No specific API available for entity type: ${entityType}`)
          return
        }
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(teamId && { 'x-team-id': teamId })
        },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()

        // Handle API response format (both child entities and regular entities use same format)
        if (data.success && Array.isArray(data.data)) {
          const transformedData = data.data.map((item: Record<string, unknown>) => ({
            id: String(item.id || ''),
            title: String(item[titleField || 'name'] || item.name || item.title || item.id || ''),
            subtitle: String(item.industry || item.description || ''),
            entityType: entityType
          }))
          setSelectedOptions(transformedData)
        } else {
          setSelectedOptions([])
        }

        loadedIdsRef.current = [...ids]
      }
    } catch (error) {
      console.error(`Error loading selected options for ${entityType}:`, error)
      setSelectedOptions([])
      loadedIdsRef.current = []
    }
  }, [entityType, parentId, titleField, userFiltered, teamId])

  // Memoize propertyOptions to prevent unnecessary re-renders
  const memoizedPropertyOptions = React.useMemo(() => {
    if (!propertyOptions || !Array.isArray(propertyOptions)) return []
    return propertyOptions
  }, [propertyOptions])
  
  // Memoize propertyOptionsState to prevent unnecessary re-renders
  const memoizedPropertyOptionsState = React.useMemo(() => {
    if (!propertyOptionsState || !Array.isArray(propertyOptionsState)) return []
    return propertyOptionsState
  }, [propertyOptionsState])
  
  // Load selected options for regular relations when value changes
  React.useEffect(() => {
    if (!usePropertyMode) {
      if (selectedValues.length > 0) {
        loadSelectedOptions(selectedValues)
      } else {
        setSelectedOptions([])
      }
    }
  }, [selectedValues, loadSelectedOptions, usePropertyMode])

  // Load property options when parentId changes (for property mode)
  React.useEffect(() => {
    if (usePropertyMode && propField && parentId) {
      // Avoid loading if parentId hasn't changed
      if (lastParentIdRef.current === parentId) {
        return
      }
      
      lastParentIdRef.current = parentId
      
      setLoading(true)
      const loadOptionsAsync = async () => {
        try {
          // Use specific entity API with fields parameter
          const apiPath = getEntityApiPath(entityType)
          const hasSpecificAPI = apiPath !== null

          let url: URL
          if (hasSpecificAPI) {
            // Use specific API with fields filter
            url = new URL(`/api/v1/${apiPath}`, window.location.origin)
            url.searchParams.set('fields', propField)
            url.searchParams.set('distinct', 'true')
            url.searchParams.set('parentId', parentId)
            url.searchParams.set('limit', '50')
            if (userFiltered) {
              url.searchParams.set('userFiltered', 'true')
            }
          } else {
            // No specific API available for this entity type
            console.warn(`No specific API available for entity type: ${entityType}`)
            return []
          }

          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(teamId && { 'x-team-id': teamId })
            },
            credentials: 'include',
          })

          if (response.ok) {
            const result = await response.json()
            const fetchedOptions = result.success ? result.data : []
            setPropertyOptionsState(fetchedOptions)
          } else {
            console.error(`[SimpleRelationSelect] API Error:`, response.status, response.statusText)
          }
        } catch (error) {
          console.error(`Error loading options for ${entityType}:`, error)
        } finally {
          setLoading(false)
        }
      }

      loadOptionsAsync()
    } else if (usePropertyMode && !parentId) {
      lastParentIdRef.current = ''
      setPropertyOptionsState([])
    }
  }, [usePropertyMode, propField, parentId, entityType, userFiltered, teamId])

  // Load selected property values when value or property options change
  React.useEffect(() => {
    if (usePropertyMode) {
      if (selectedValues.length > 0) {
        const selectedPropertyItems = selectedValues.map(val => {
          // Try to find label in static options first
          const staticOption = memoizedPropertyOptions.find(opt => opt.value === val)
          if (staticOption) {
            return { value: val, label: staticOption.label }
          }
          // Try to find in loaded options
          const dynamicOption = memoizedPropertyOptionsState.find(opt => opt.value === val)
          if (dynamicOption) {
            return { value: val, label: dynamicOption.label }
          }
          // Fallback to value as label
          return { value: val, label: val }
        })
        
        // Only update if the selected property values actually changed
        const newValuesString = selectedPropertyItems.map(v => `${v.value}:${v.label}`).sort().join(',')
        
        if (lastSelectedPropertyValuesRef.current !== newValuesString) {
          setSelectedPropertyValues(selectedPropertyItems)
          lastSelectedPropertyValuesRef.current = newValuesString
        }
      } else if (lastSelectedPropertyValuesRef.current !== '') {
        setSelectedPropertyValues([])
        lastSelectedPropertyValuesRef.current = ''
      }
    }
  }, [selectedValues, usePropertyMode, memoizedPropertyOptions, memoizedPropertyOptionsState])

  // Handle selection
  const handleSelect = (optionId: string) => {
    // Find the selected option in current options to get its title
    const selectedOption = options.find(opt => opt.id === optionId)
    
    if (multiple) {
      const newValues = selectedValues.includes(optionId)
        ? selectedValues.filter(id => id !== optionId)
        : [...selectedValues, optionId]
      onChange(newValues.length > 0 ? newValues : null)
      
      // Update selectedOptions immediately for better UX
      if (selectedOption) {
        if (selectedValues.includes(optionId)) {
          // Removing option
          setSelectedOptions(prev => prev.filter(opt => opt.id !== optionId))
        } else {
          // Adding option
          setSelectedOptions(prev => [...prev.filter(opt => opt.id !== optionId), selectedOption])
        }
      }
    } else {
      onChange(selectedValues.includes(optionId) ? null : optionId)
      setOpen(false)
      
      // Update selectedOptions immediately for better UX
      if (selectedOption && !selectedValues.includes(optionId)) {
        setSelectedOptions([selectedOption])
      } else if (selectedValues.includes(optionId)) {
        setSelectedOptions([])
      }
    }
  }

  // Handle remove (for multiple)
  const handleRemove = (optionId: string) => {
    if (multiple) {
      const newValues = selectedValues.filter(id => id !== optionId)
      onChange(newValues.length > 0 ? newValues : null)
      
      // Update selectedOptions immediately for better UX
      setSelectedOptions(prev => prev.filter(opt => opt.id !== optionId))
    } else {
      onChange(null)
      setSelectedOptions([])
    }
  }

  // Handle selection for property-based relations
  const handlePropertySelect = (propertyValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(propertyValue)
        ? selectedValues.filter(val => val !== propertyValue)
        : [...selectedValues, propertyValue]
      onChange(newValues.length > 0 ? newValues : null)
    } else {
      onChange(selectedValues.includes(propertyValue) ? null : propertyValue)
      setOpen(false)
    }
  }

  // Handle remove for property values
  const handlePropertyRemove = (propertyValue: string) => {
    if (multiple) {
      const newValues = selectedValues.filter(val => val !== propertyValue)
      onChange(newValues.length > 0 ? newValues : null)
    } else {
      onChange(null)
    }
  }

  // Get display text for selected values
  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder
    }

    if (usePropertyMode) {
      if (multiple) {
        if (selectedPropertyValues.length > 0) {
          return selectedPropertyValues.map(opt => opt.label).join(', ')
        }
        return `${selectedValues.length} seleccionado${selectedValues.length !== 1 ? 's' : ''}`
      }

      // For single select property, show label if available, otherwise show value
      const selectedPropertyItem = selectedPropertyValues.find(item => item.value === selectedValues[0])
      return selectedPropertyItem ? selectedPropertyItem.label : selectedValues[0]
    } else {
      if (multiple) {
        if (selectedOptions.length > 0) {
          return selectedOptions.map(opt => opt.title).join(', ')
        }
        return `${selectedValues.length} seleccionado${selectedValues.length !== 1 ? 's' : ''}`
      }

      // For single select, show title if available, otherwise show ID
      const selectedOption = selectedOptions.find(opt => opt.id === selectedValues[0])
      return selectedOption ? selectedOption.title : selectedValues[0]
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          onClick={() => {
            if (!open) {
              if (usePropertyMode && parentId) {
                // For property mode with parentId, always try to load fresh options
                loadOptions()
              } else if (!usePropertyMode && options.length === 0) {
                // For regular mode, load only if no options
                loadOptions()
              }
            }
          }}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {multiple && selectedValues.length > 0 ? (
              selectedValues.map((value) => {
                let displayText = value
                if (usePropertyMode) {
                  const propertyItem = selectedPropertyValues.find(item => item.value === value)
                  displayText = propertyItem ? propertyItem.label : value
                } else {
                  const selectedOption = selectedOptions.find(opt => opt.id === value)
                  displayText = selectedOption ? selectedOption.title : value
                }
                
                return (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="text-xs"
                  >
                    {displayText}
                    <X 
                      className="ml-1 h-3 w-3 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation()
                        if (usePropertyMode) {
                          handlePropertyRemove(value)
                        } else {
                          handleRemove(value)
                        }
                      }}
                    />
                  </Badge>
                )
              })
            ) : (
              <span className={selectedValues.length === 0 ? "text-muted-foreground" : ""}>
                {getDisplayText()}
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Cargando..." : "No se encontraron opciones."}
            </CommandEmpty>
            <CommandGroup>
              {usePropertyMode ? (
                // Render property options - combine static and dynamic options
                (() => {
                  
                  let allPropertyOptions = []
                  
                  if (memoizedPropertyOptionsState.length > 0 && parentId) {
                    // If we have dynamic options from API (filtered by parent), use only those with static labels
                    allPropertyOptions = memoizedPropertyOptionsState.map(dynOpt => {
                      const staticOption = memoizedPropertyOptions.find(statOpt => statOpt.value === dynOpt.value)
                      return {
                        value: dynOpt.value,
                        label: staticOption ? staticOption.label : dynOpt.label,
                        isStatic: Boolean(staticOption)
                      }
                    })
                  } else {
                    // If no dynamic options (no parent selected or API returned empty), show static options as fallback
                    allPropertyOptions = memoizedPropertyOptions.map(opt => ({ 
                      value: opt.value, 
                      label: opt.label, 
                      isStatic: true 
                    }))
                  }

                  return allPropertyOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handlePropertySelect(option.value)}
                    >
                      <div className="flex items-center space-x-2 w-full">
                        <div className="flex-1">
                          <div className="font-medium">{option.label}</div>
                          {!option.isStatic && (
                            <div className="text-sm text-muted-foreground">Dinámico</div>
                          )}
                        </div>
                        {selectedValues.includes(option.value) && (
                          <div className="text-primary">✓</div>
                        )}
                      </div>
                    </CommandItem>
                  ))
                })()
              ) : (
                // Render regular entity options
                options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => handleSelect(option.id)}
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <div className="flex-1">
                        <div className="font-medium">{option.title}</div>
                        {option.subtitle && (
                          <div className="text-sm text-muted-foreground">{option.subtitle}</div>
                        )}
                      </div>
                      {selectedValues.includes(option.id) && (
                        <div className="text-primary">✓</div>
                      )}
                    </div>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
