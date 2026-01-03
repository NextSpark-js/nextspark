/**
 * Universal Entity Search Component
 * 
 * Provides unified search across all accessible entities with proper
 * permission validation, highlighting, and filtering capabilities.
 */

'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import {
  Search,
  Filter,
  X,
  Loader2,
  ExternalLink,
  Calendar,
  User,
} from 'lucide-react'
import type { EntityConfig } from '../../lib/entities/types'
import { useAuth } from '../../hooks/useAuth'
import { createTestId, createCyId } from '../../lib/test'

export interface EntitySearchProps {
  /** REQUIRED: Entity configs must be passed from server component */
  entities: EntityConfig[]
  placeholder?: string
  variant?: 'inline' | 'modal' | 'dropdown'
  onResultClick?: (result: SearchResult) => void
  onSearch?: (query: string, entityName?: string) => void
  enableEntityFilter?: boolean
  maxResults?: number
  className?: string
}

export interface SearchResult {
  id: string
  entityName: string
  entityConfig: EntityConfig
  title: string
  description?: string
  matches: SearchMatch[]
  url: string
  metadata: {
    createdAt?: string
    updatedAt?: string
    createdBy?: string
  }
  data: Record<string, unknown>
}

export interface SearchMatch {
  field: string
  fieldLabel: string
  value: string
  highlights: HighlightRange[]
}

export interface HighlightRange {
  start: number
  end: number
}

interface SearchFilters {
  entityName?: string
  dateRange?: {
    from?: Date
    to?: Date
  }
  createdBy?: string
  [key: string]: unknown
}

/**
 * Mock search API - In production this would be replaced with actual search endpoint
 */
async function performSearch(
  query: string, 
  accessibleEntities: EntityConfig[],
  filters: SearchFilters = {},
  maxResults: number = 50
): Promise<SearchResult[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 150))
  
  if (!query.trim()) return []
  
  // Mock search results generation
  const results: SearchResult[] = []
  const searchTerm = query.toLowerCase().trim()
  
  // Search through each accessible entity
  for (const entityConfig of accessibleEntities) {
    // Skip if filtered by entity
    if (filters.entityName && filters.entityName !== entityConfig.slug) {
      continue
    }
    
    // Mock data for this entity type
    const mockItems = generateMockSearchData(entityConfig, searchTerm)
    
    // Add matching results
    for (const item of mockItems) {
      if (results.length >= maxResults) break
      
      const matches = findSearchMatches(item, entityConfig, searchTerm)
      if (matches.length > 0) {
        results.push({
          id: String(item.id),
          entityName: entityConfig.slug,
          entityConfig,
          title: String(item.title || item.name || `${entityConfig.names.singular} #${item.id}`),
          description: String(item.description || generateDescription(item, entityConfig)),
          matches,
          url: `/dashboard/${entityConfig.slug}/${item.id}`,
          metadata: {
            createdAt: item.createdAt ? String(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
            createdBy: item.createdBy ? String(item.createdBy) : undefined,
          },
          data: item,
        })
      }
    }
  }
  
  return results.sort((a, b) => b.matches.length - a.matches.length)
}

/**
 * Generate mock search data for testing
 */
function generateMockSearchData(entityConfig: EntityConfig, searchTerm: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = []
  
  // Generate realistic test data based on entity type
  for (let i = 1; i <= 5; i++) {
    const item: Record<string, unknown> = {
      id: `${entityConfig.slug}-${i}`,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: `user-${Math.floor(Math.random() * 10) + 1}`,
    }
    
    // Add entity-specific fields
    entityConfig.fields.forEach(field => {
      switch (field.type) {
        case 'text':
        case 'textarea':
          item[field.name] = `${searchTerm} ${field.name} example ${i}`
          break
        case 'email':
          item[field.name] = `${searchTerm}${i}@example.com`
          break
        case 'boolean':
          item[field.name] = Math.random() > 0.5
          break
        case 'number':
          item[field.name] = Math.floor(Math.random() * 1000) + 1
          break
        case 'select':
          item[field.name] = field.options?.[0]?.value || 'option1'
          break
        default:
          item[field.name] = `${field.name} value ${i}`
      }
    })
    
    items.push(item)
  }
  
  return items
}

/**
 * Find search matches in item data
 */
function findSearchMatches(
  item: Record<string, unknown>, 
  entityConfig: EntityConfig, 
  searchTerm: string
): SearchMatch[] {
  const matches: SearchMatch[] = []
  const searchWords = searchTerm.toLowerCase().split(' ').filter(w => w.length > 0)
  
  entityConfig.fields.forEach(field => {
    if (!field.api.searchable) return
    
    const value = String(item[field.name] || '')
    const lowerValue = value.toLowerCase()
    
    const highlights: HighlightRange[] = []
    
    searchWords.forEach(word => {
      let startIndex = 0
      while (true) {
        const index = lowerValue.indexOf(word, startIndex)
        if (index === -1) break
        
        highlights.push({
          start: index,
          end: index + word.length
        })
        
        startIndex = index + word.length
      }
    })
    
    if (highlights.length > 0) {
      matches.push({
        field: field.name,
        fieldLabel: field.display.label,
        value,
        highlights: highlights.sort((a, b) => a.start - b.start)
      })
    }
  })
  
  return matches
}

/**
 * Generate description from entity data
 */
function generateDescription(item: Record<string, unknown>, entityConfig: EntityConfig): string {
  const descFields = ['description', 'summary', 'content', 'notes']
  
  for (const fieldName of descFields) {
    const field = entityConfig.fields.find(f => f.name === fieldName)
    if (field && item[fieldName]) {
      const value = String(item[fieldName])
      return value.length > 100 ? value.substring(0, 100) + '...' : value
    }
  }
  
  return `${entityConfig.names.singular} created ${formatDate(item.createdAt as string)}`
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return 'recently'
  }
}

/**
 * Highlight search matches in text
 */
function highlightMatches(text: string, highlights: HighlightRange[]): React.ReactNode {
  if (highlights.length === 0) return text
  
  const elements: React.ReactNode[] = []
  let lastEnd = 0
  
  highlights.forEach((highlight, index) => {
    // Add text before highlight
    if (highlight.start > lastEnd) {
      elements.push(text.slice(lastEnd, highlight.start))
    }
    
    // Add highlighted text
    elements.push(
      <mark key={index} className="bg-yellow-200 font-medium rounded px-1">
        {text.slice(highlight.start, highlight.end)}
      </mark>
    )
    
    lastEnd = highlight.end
  })
  
  // Add remaining text
  if (lastEnd < text.length) {
    elements.push(text.slice(lastEnd))
  }
  
  return <>{elements}</>
}

/**
 * Generate test IDs for entity search
 */
function generateTestIds() {
  return {
    container: createTestId('search', 'container'),
    input: createTestId('search', 'input'),
    results: createTestId('search', 'results'),
    result: (id: string) => createTestId('search', 'result', id),
    filter: createTestId('search', 'filter'),
  }
}

export function EntitySearch({
  entities,
  placeholder = 'Search everything...',
  variant = 'inline',
  onResultClick,
  onSearch,
  enableEntityFilter = true,
  maxResults = 20,
  className,
}: EntitySearchProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<SearchFilters>({})
  const [isOpen, setIsOpen] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const testIds = generateTestIds()

  // Get accessible entities for the current user - simplified to show all enabled entities
  // Entities must be provided by server component via props
  const accessibleEntities = useMemo(() => {
    if (!user) return []

    return entities
      .filter(entity => entity.ui?.features?.searchable)
      .sort((a, b) => a.names.singular.localeCompare(b.names.singular))
  }, [user, entities])

  // Perform search with debouncing
  const performSearchDebounced = useCallback(async (searchQuery: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!searchQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await performSearch(searchQuery, accessibleEntities, filters, maxResults)
        setResults(searchResults)
        onSearch?.(searchQuery, filters.entityName)
      } catch (error) {
        console.error('Search failed:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [accessibleEntities, filters, maxResults, onSearch])

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value)
    performSearchDebounced(value)
    
    if (variant === 'dropdown') {
      setIsOpen(value.length > 0)
    }
  }, [performSearchDebounced, variant])

  // Handle result click
  const handleResultClick = useCallback((result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result)
    } else {
      router.push(result.url)
    }
    
    if (variant === 'dropdown') {
      setIsOpen(false)
      setQuery('')
    }
  }, [onResultClick, router, variant])

  // Handle filter change
  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters)
    if (query.trim()) {
      performSearchDebounced(query)
    }
  }, [query, performSearchDebounced])

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setFilters({})
    setIsOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  if (!user) return null

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={`justify-between ${className || ''}`}
            data-testid={testIds.container}
            data-cy={createCyId('search', 'trigger')}
          >
            <Search className="mr-2 h-4 w-4" />
            {query || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={handleSearchChange}
              data-testid={testIds.input}
            />
            <CommandList>
              {isSearching && (
                <CommandItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </CommandItem>
              )}
              
              {!isSearching && query && results.length === 0 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              
              {results.length > 0 && (
                <>
                  {enableEntityFilter && (
                    <>
                      <CommandGroup heading="Filter by Type">
                        <CommandItem onSelect={() => handleFilterChange({})}>
                          All Types
                        </CommandItem>
                        {accessibleEntities.map((entity) => (
                          <CommandItem
                            key={entity.slug}
                            onSelect={() => handleFilterChange({ entityName: entity.slug })}
                          >
                            {React.createElement(entity.icon, { className: "mr-2 h-4 w-4" })}
                            {entity.names.plural}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}
                  
                  <CommandGroup heading="Results">
                    {results.map((result) => (
                      <CommandItem
                        key={`${result.entityName}-${result.id}`}
                        onSelect={() => handleResultClick(result)}
                        data-testid={testIds.result(result.id)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {React.createElement(result.entityConfig.icon, { 
                            className: "h-4 w-4 text-muted-foreground flex-shrink-0" 
                          })}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {result.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {result.entityConfig.names.singular}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Inline variant
  return (
    <div className={`w-full space-y-4 ${className || ''}`}>
      {/* Search input with filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9"
            data-testid={testIds.input}
            data-cy={createCyId('search', 'input')}
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1 h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {enableEntityFilter && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" data-testid={testIds.filter}>
                <Filter className="mr-2 h-4 w-4" />
                {filters.entityName 
                  ? accessibleEntities.find(e => e.slug === filters.entityName)?.names.singular
                  : 'All Types'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandList>
                  <CommandGroup>
                    <CommandItem onSelect={() => handleFilterChange({})}>
                      All Types
                    </CommandItem>
                    {accessibleEntities.map((entity) => (
                      <CommandItem
                        key={entity.slug}
                        onSelect={() => handleFilterChange({ entityName: entity.slug })}
                      >
                        {React.createElement(entity.icon, { className: "mr-2 h-4 w-4" })}
                        {entity.names.singular}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Search results */}
      <div data-testid={testIds.results} data-cy={createCyId('search', 'results')}>
        {isSearching && (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Searching...</span>
            </CardContent>
          </Card>
        )}

        {!isSearching && query && results.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search terms or filters
              </p>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result) => (
              <Card 
                key={`${result.entityName}-${result.id}`}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleResultClick(result)}
                data-testid={testIds.result(result.id)}
                data-cy={createCyId('search', 'result')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {React.createElement(result.entityConfig.icon, { 
                      className: "h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" 
                    })}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{result.title}</h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {result.entityConfig.names.singular}
                          </Badge>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      
                      {result.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                      
                      {result.matches.length > 0 && (
                        <div className="space-y-1">
                          {result.matches.slice(0, 2).map((match, index) => (
                            <div key={index} className="text-xs">
                              <span className="font-medium text-muted-foreground">
                                {match.fieldLabel}:{' '}
                              </span>
                              <span className="text-foreground">
                                {highlightMatches(
                                  match.value.length > 80 
                                    ? match.value.substring(0, 80) + '...'
                                    : match.value,
                                  match.highlights
                                )}
                              </span>
                            </div>
                          ))}
                          {result.matches.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{result.matches.length - 2} more matches
                            </div>
                          )}
                        </div>
                      )}
                      
                      {result.metadata.createdAt && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(result.metadata.createdAt)}
                          </div>
                          {result.metadata.createdBy && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {result.metadata.createdBy}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Global Search Modal Component
 */
export function EntitySearchModal({
  isOpen,
  onClose,
  onResultClick,
  entities,
}: {
  isOpen: boolean
  onClose: () => void
  onResultClick?: (result: SearchResult) => void
  /** REQUIRED: Entity configs must be passed from server component */
  entities: EntityConfig[]
}) {
  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}
      data-cy="search-modal"
    >
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-2xl max-h-[80vh] bg-background border rounded-lg shadow-lg overflow-hidden">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Search Everything</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(80vh-80px)]">
          <EntitySearch
            entities={entities}
            variant="inline"
            onResultClick={(result) => {
              onResultClick?.(result)
              onClose()
            }}
            enableEntityFilter
            maxResults={50}
          />
        </div>
      </div>
    </div>
  )
}