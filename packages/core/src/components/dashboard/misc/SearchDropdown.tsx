'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { 
  Search, 
  X, 
  Settings, 
  FileText, 
  Loader2,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { useEntitySearch, type EntitySearchResult } from '../../../hooks/useEntitySearch'
import { formatSearchResult } from '../../../lib/search-highlighting'
import { cn } from '../../../lib/utils'
import { sel, createAriaLabel } from '../../../lib/test'
import { useTranslations } from 'next-intl'

const getTypeIcon = (result: EntitySearchResult) => {
  if (result.type === 'entity') {
    // Use the entity's configured icon
    return <FileText className="h-4 w-4" />
  }
  
  switch (result.category) {
    case 'Settings':
      return <Settings className="h-4 w-4" />
    case 'Navigation':
      return <ArrowRight className="h-4 w-4" />
    default:
      return <Search className="h-4 w-4" />
  }
}

const getTypeLabel = (result: EntitySearchResult, locale: 'en' | 'es' = 'es') => {
  if (result.type === 'entity') {
    return locale === 'en' ? 'Entity' : 'Entidad'
  }
  
  switch (result.category) {
    case 'Settings':
      return locale === 'en' ? 'Setting' : 'Configuración'
    case 'Navigation':
      return locale === 'en' ? 'Page' : 'Página'
    case 'Entities':
      return locale === 'en' ? 'Entity' : 'Entidad'
    default:
      return locale === 'en' ? 'Result' : 'Resultado'
  }
}

const getPriorityColor = (priority?: 'low' | 'medium' | 'high') => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'low':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

interface SearchResultItemProps {
  result: EntitySearchResult
  onSelect: () => void
  searchQuery: string
}

function SearchResultItem({ result, onSelect, searchQuery }: SearchResultItemProps) {
  const handleSelect = useCallback(() => {
    onSelect()
  }, [onSelect])

  // Format result with highlighting
  const { highlightedTitle, highlightedDescription } = formatSearchResult(
    result.title,
    result.description,
    searchQuery
  )

  return (
    <Link 
      href={result.url}
      className="block p-3 hover:bg-muted/50 transition-colors group focus:outline-none focus:ring-2 focus:ring-accent"
      onClick={handleSelect}
      role="option"
      aria-label={createAriaLabel(
        '{type}: {title}{description}{limits}',
        {
          type: getTypeLabel(result, 'es'),
          title: result.title,
          description: result.description ? ` - ${result.description}` : '',
          limits: result.limitInfo ? ` (${result.limitInfo.current}/${result.limitInfo.max})` : ''
        }
      )}
      data-cy={sel('globalSearch.result')}
      data-result-id={result.id}
      data-result-type={result.type}
      data-entity-type={result.entityType}
    >
      <div className="flex items-start gap-3">
        {/* Icon & Status */}
        <div className="flex items-center gap-2 mt-0.5">
          <div className={cn(
            "p-1 rounded flex items-center justify-center",
            result.type === 'entity' 
              ? "bg-primary/10 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {getTypeIcon(result)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 
              className="text-sm font-medium truncate group-hover:text-foreground"
              dangerouslySetInnerHTML={{ __html: highlightedTitle }}
            />
            {result.limitInfo && (
              <Badge 
                variant={result.limitInfo.canCreate ? "secondary" : "destructive"}
                className="text-xs"
              >
                {result.limitInfo.current}/{result.limitInfo.max === 'unlimited' ? '∞' : result.limitInfo.max}
              </Badge>
            )}
            {result.priority && result.priority !== 'low' && (
              <Badge 
                variant="secondary" 
                className={cn("text-xs", getPriorityColor(result.priority))}
              >
                {result.priority}
              </Badge>
            )}
          </div>
          
          {result.description && (
            <p 
              className="text-xs text-muted-foreground line-clamp-2"
              dangerouslySetInnerHTML={{ __html: highlightedDescription || result.description }}
            />
          )}
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getTypeLabel(result)}
            </Badge>
            {result.category && (
              <Badge variant="outline" className="text-xs">
                {result.category}
              </Badge>
            )}
            {result.type === 'entity' && (
              <Badge variant="outline" className="text-xs text-primary">
                {result.entityType}
              </Badge>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

export function SearchDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [statusMessage, setStatusMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('common')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { 
    query, 
    setQuery, 
    results, 
    isSearching, 
    clearSearch, 
    hasResults,
    isEmpty 
  } = useEntitySearch()

  // Auto-focus en input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSelectedIndex(-1)
    clearSearch()
    setStatusMessage('Búsqueda cerrada')
  }, [clearSearch])

  // Manejar navegación con teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(prev => 
            prev < results.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : results.length - 1
          )
          break
        case 'Enter':
          if (selectedIndex >= 0 && results[selectedIndex]) {
            window.location.href = results[selectedIndex].url
            handleClose()
          }
          break
        case 'Escape':
          handleClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, results, handleClose])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    setSelectedIndex(-1)
    if (value.trim().length > 0) {
      setIsOpen(true)
      setStatusMessage(`Buscando: ${value}`)
    } else {
      setIsOpen(false)
      setStatusMessage('')
    }
  }, [setQuery])

  const showDropdown = isOpen && (hasResults || isSearching || (!isEmpty && !hasResults))

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <div
        className="relative w-full"
        ref={dropdownRef}
      >
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => query.trim().length > 0 && setIsOpen(true)}
            className="pl-10 pr-10 bg-muted/50 border-0 focus-visible:ring-1"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-owns={isOpen ? "search-results" : undefined}
            aria-autocomplete="list"
            aria-label={t('search.label')}
            data-cy={sel('globalSearch.input')}
          />
        
        {/* Clear button */}
        {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={handleClose}
              aria-label={t('search.clear')}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
        )}
        
        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50"
            id="search-results"
            role="listbox"
            aria-label={t('search.results')}
            data-cy={sel('globalSearch.results')}
          >
            <ScrollArea className="max-h-96">
            {isSearching ? (
              <div className="p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('search.searching')}</p>
              </div>
            ) : hasResults ? (
              <div className="py-2">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className={cn(
                      selectedIndex === index && "bg-muted/50"
                    )}
                  >
                    <SearchResultItem
                      result={result}
                      onSelect={handleClose}
                      searchQuery={query}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('search.noResults', { query })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('search.tryDifferent')}
                </p>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {hasResults && (
            <div className="border-t border-border p-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                  <span>↑↓ navegar</span>
                  <span>↵ seleccionar</span>
                  <span>esc cerrar</span>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
