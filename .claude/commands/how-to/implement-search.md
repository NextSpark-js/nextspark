# /how-to:implement-search

Interactive tutorial for implementing search functionality using the client-side entity search system.

## Required Skills
- `.claude/skills/react-patterns/SKILL.md`
- `.claude/skills/tanstack-query/SKILL.md`
- `.claude/skills/entity-system/SKILL.md`
- `.claude/skills/cypress-selectors/SKILL.md`

## Syntax

```
/how-to:implement-search [options]
```

### Options:
- `--step <n>` - Start at specific step (1-5)
- `--quick` - Quick reference without explanations

## Behavior

This command guides you through implementing search in your NextSpark application.
It covers the useEntitySearch hook, search components, and custom implementations.

## Tutorial Structure

```
┌─────────────────────────────────────────────────────────────┐
│  /how-to:implement-search - 5 Steps Overview                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [1] Understanding Search → Client-side architecture        │
│           │                                                 │
│           ↓                                                 │
│  [2] useEntitySearch Hook → Hook usage & configuration      │
│           │                                                 │
│           ↓                                                 │
│  [3] Search Results → EntitySearchResult types              │
│           │                                                 │
│           ↓                                                 │
│  [4] EntitySearch Component → Pre-built component variants  │
│           │                                                 │
│           ↓                                                 │
│  [5] Custom Search → Advanced patterns                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Understanding Search Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: SEARCH ARCHITECTURE                                │
│  Client-side search with entity integration                 │
└─────────────────────────────────────────────────────────────┘
```

### How Search Works in NextSpark

NextSpark uses **client-side search** that integrates with the Entity System:

```
┌─────────────────────────────────────────────────────────────┐
│                    SEARCH FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [User Input] → [Debounce 150ms] → [Search Function]        │
│                                           │                 │
│                                           ↓                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SEARCH SOURCES                          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  • Entity Registry (searchable entities)             │   │
│  │  • System Pages (dashboard, settings)                │   │
│  │  • User Plan/Permission Filtering                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ↓                                 │
│  [Relevance Scoring] → [Sort Results] → [Return Top N]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Characteristics

1. **Client-Side Execution**
   - No server round-trip for basic search
   - Instant results with debouncing
   - Entity registry populated by server component

2. **Multi-Source Search**
   - Entities: From entity registry
   - System Pages: Dashboard, settings, profile
   - Filtered by user permissions and plan

3. **Relevance Scoring**
   - Exact title match: +100 points
   - Title starts with query: +50 points
   - Title contains query: +25 points
   - Entity type match: +80 points
   - Description match: +10 points

4. **Configuration**
   - Minimum 2 characters to trigger search
   - Maximum 8-12 results returned
   - 150ms debounce delay

### Making Entities Searchable

To make an entity searchable, enable in config:

```typescript
// entity.config.ts
export const productConfig: EntityConfig = {
  slug: 'products',
  // ...
  ui: {
    features: {
      searchable: true,  // Enable for global search
      // ...
    }
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      api: {
        searchable: true,  // This field is searchable
        // ...
      }
    }
  ]
}
```

### Search Result Priority

```
┌─────────────────────────────────────────────────────────────┐
│  RESULT PRIORITY ORDER                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Relevance Score (highest first)                         │
│  2. Entity vs System (entities prioritized)                 │
│  3. Priority Level (high > medium > low)                    │
│  4. Alphabetical (as tiebreaker)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 2: useEntitySearch Hook

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: useEntitySearch HOOK                               │
│  Primary hook for search functionality                      │
└─────────────────────────────────────────────────────────────┘
```

### Hook Location

```
/packages/core/src/hooks/useEntitySearch.ts
```

### Basic Usage

```typescript
'use client'

import { useEntitySearch } from '@nextsparkjs/core/hooks'

export function SearchComponent() {
  const {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
    hasResults,
    isEmpty,
    availableEntities
  } = useEntitySearch()

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        data-cy="search-input"
      />

      {isSearching && <p>Searching...</p>}

      {hasResults && (
        <ul>
          {results.map(result => (
            <li key={result.id}>
              <a href={result.url}>{result.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Hook Return Values

```
┌─────────────────────────────────────────────────────────────┐
│  useEntitySearch() RETURN TYPE                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  interface EntitySearchHookResult {                         │
│    query: string           // Current search query          │
│    setQuery: (q) => void   // Update query function         │
│    results: EntitySearchResult[]  // Search results         │
│    isSearching: boolean    // Loading state                 │
│    clearSearch: () => void // Reset search state            │
│    hasResults: boolean     // results.length > 0            │
│    isEmpty: boolean        // query.trim() === ''           │
│    availableEntities: EntityConfig[]  // Searchable entities│
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Complete Example with Keyboard Support

```typescript
'use client'

import { useEntitySearch } from '@nextsparkjs/core/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function GlobalSearch() {
  const {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
    hasResults
  } = useEntitySearch()

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Result keyboard navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev =>
        Math.min(prev + 1, results.length - 1)
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && hasResults) {
      e.preventDefault()
      router.push(results[selectedIndex].url)
      clearSearch()
    } else if (e.key === 'Escape') {
      clearSearch()
      inputRef.current?.blur()
    }
  }

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  return (
    <div className="relative" data-cy="global-search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="Search... (Cmd+K)"
        className="w-full px-4 py-2 border rounded"
        data-cy="search-input"
      />

      {hasResults && (
        <ul className="absolute w-full mt-1 bg-white border rounded shadow-lg">
          {results.map((result, index) => (
            <li
              key={result.id}
              className={`px-4 py-2 cursor-pointer ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                router.push(result.url)
                clearSearch()
              }}
              data-cy="search-result"
            >
              <div className="font-medium">{result.title}</div>
              {result.description && (
                <div className="text-sm text-gray-500">
                  {result.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## Step 3: Search Results Structure

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: SEARCH RESULTS STRUCTURE                           │
│  Understanding EntitySearchResult type                      │
└─────────────────────────────────────────────────────────────┘
```

### EntitySearchResult Interface

```typescript
interface EntitySearchResult {
  id: string              // Unique identifier
  title: string           // Display title
  description?: string    // Optional description
  entityType: string      // Entity slug or 'system'
  type: 'entity' | 'system'  // Result type
  url: string             // Navigation URL
  category?: string       // Category for grouping
  priority?: 'low' | 'medium' | 'high'  // Display priority
  completed?: boolean     // For task-like entities
  icon?: string           // Icon name (Lucide)
  limitInfo?: {           // Plan limit information
    current: number
    max: number | 'unlimited'
    canCreate: boolean
  }
}
```

### Result Types Explained

```
┌─────────────────────────────────────────────────────────────┐
│  RESULT TYPES                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TYPE: 'entity'                                             │
│  ├── From entity registry                                   │
│  ├── URL: /dashboard/{entity.slug}                          │
│  ├── Category: 'Entities'                                   │
│  └── Priority: 'medium' (default)                           │
│                                                             │
│  TYPE: 'system'                                             │
│  ├── Static system pages                                    │
│  ├── URL: /dashboard/settings/{page}                        │
│  ├── Category: 'Navigation' | 'Settings'                    │
│  └── Priority: 'low' (default)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Working with Results

```typescript
// Grouping results by category
const groupedResults = useMemo(() => {
  const groups = new Map<string, EntitySearchResult[]>()

  results.forEach(result => {
    const category = result.category || 'Other'
    const group = groups.get(category) || []
    group.push(result)
    groups.set(category, group)
  })

  return groups
}, [results])

// Render grouped results
return (
  <div>
    {Array.from(groupedResults.entries()).map(([category, items]) => (
      <div key={category}>
        <h3 className="font-bold">{category}</h3>
        <ul>
          {items.map(item => (
            <li key={item.id}>
              {item.type === 'entity' && (
                <span className="text-blue-500">[Entity]</span>
              )}
              {item.title}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)
```

### Displaying Plan Limits

```typescript
// Show limit information for entity results
function ResultWithLimits({ result }: { result: EntitySearchResult }) {
  const { limitInfo } = result

  if (!limitInfo || result.type !== 'entity') {
    return <span>{result.title}</span>
  }

  const limitDisplay = limitInfo.max === 'unlimited'
    ? 'Unlimited'
    : `${limitInfo.current}/${limitInfo.max}`

  return (
    <div className="flex items-center gap-2">
      <span>{result.title}</span>
      <span className={`text-xs ${
        limitInfo.canCreate ? 'text-green-500' : 'text-red-500'
      }`}>
        ({limitDisplay})
      </span>
    </div>
  )
}
```

---

## Step 4: EntitySearch Component

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: EntitySearch COMPONENT                             │
│  Pre-built search component with variants                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Location

```
/packages/core/src/components/entities/EntitySearch.tsx
```

### Available Variants

```
┌─────────────────────────────────────────────────────────────┐
│  EntitySearch VARIANTS                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  'inline'   - Full search with results below input          │
│  'dropdown' - Compact dropdown with popover results         │
│  'modal'    - Full-screen modal search (EntitySearchModal)  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Basic Usage

```typescript
// Import from core
import { EntitySearch } from '@nextsparkjs/core/components/entities'

// In a Server Component - fetch entities
import { getEnabledEntities } from '@nextsparkjs/core/lib/entities/registry'

export default async function SearchPage() {
  const entities = getEnabledEntities()

  return (
    <div>
      <h1>Search</h1>
      <EntitySearch
        entities={entities}
        placeholder="Search everything..."
        variant="inline"
        enableEntityFilter
        maxResults={20}
      />
    </div>
  )
}
```

### Component Props

```typescript
interface EntitySearchProps {
  /** REQUIRED: Entity configs from server component */
  entities: EntityConfig[]

  /** Placeholder text */
  placeholder?: string  // default: 'Search everything...'

  /** Display variant */
  variant?: 'inline' | 'modal' | 'dropdown'  // default: 'inline'

  /** Custom result click handler */
  onResultClick?: (result: SearchResult) => void

  /** Search callback */
  onSearch?: (query: string, entityName?: string) => void

  /** Enable entity type filter */
  enableEntityFilter?: boolean  // default: true

  /** Maximum results to show */
  maxResults?: number  // default: 20

  /** Additional CSS classes */
  className?: string
}
```

### Dropdown Variant Example

```typescript
// Compact search in header/navbar
export function HeaderSearch({ entities }: { entities: EntityConfig[] }) {
  return (
    <EntitySearch
      entities={entities}
      variant="dropdown"
      placeholder="Quick search..."
      maxResults={8}
      data-cy="header-search"
    />
  )
}
```

### Modal Variant Example

```typescript
import {
  EntitySearchModal
} from '@nextsparkjs/core/components/entities'
import { useState } from 'react'

export function SearchWithModal({ entities }: { entities: EntityConfig[] }) {
  const [isOpen, setIsOpen] = useState(false)

  // Open with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-cy="open-search-modal"
      >
        Search (Cmd+K)
      </button>

      <EntitySearchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        entities={entities}
        onResultClick={(result) => {
          console.log('Selected:', result)
        }}
      />
    </>
  )
}
```

### Custom Result Click Handler

```typescript
export function SearchWithCustomAction({ entities }: { entities: EntityConfig[] }) {
  const handleResultClick = (result: SearchResult) => {
    // Custom action instead of navigation
    if (result.entityName === 'tasks') {
      // Open task in sidebar
      openTaskSidebar(result.id)
    } else {
      // Default navigation
      window.location.href = result.url
    }
  }

  return (
    <EntitySearch
      entities={entities}
      onResultClick={handleResultClick}
    />
  )
}
```

---

## Step 5: Custom Search Implementation

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: CUSTOM SEARCH IMPLEMENTATION                       │
│  Advanced patterns for specialized search                   │
└─────────────────────────────────────────────────────────────┘
```

### Custom Relevance Scoring

```typescript
// Custom scoring function for your domain
function calculateRelevanceScore(
  item: EntitySearchResult,
  query: string
): number {
  const lowerQuery = query.toLowerCase()
  let score = 0

  // Exact title match
  if (item.title.toLowerCase() === lowerQuery) {
    score += 100
  }

  // Title starts with query
  if (item.title.toLowerCase().startsWith(lowerQuery)) {
    score += 50
  }

  // Title contains query
  if (item.title.toLowerCase().includes(lowerQuery)) {
    score += 25
  }

  // Entity type matches
  if (item.entityType.toLowerCase() === lowerQuery) {
    score += 80
  }

  // Description contains query
  if (item.description?.toLowerCase().includes(lowerQuery)) {
    score += 10
  }

  // Boost entity results
  if (item.type === 'entity') {
    score += 5
  }

  // Custom domain-specific boosts
  if (item.priority === 'high') {
    score += 20
  }

  return score
}
```

### API-Backed Search

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useDebounce } from '@nextsparkjs/core/hooks'

interface APISearchResult {
  id: string
  title: string
  entityType: string
  score: number
}

export function useAPISearch(entitySlug: string) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<APISearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  // Search effect
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setResults([])
      return
    }

    const performSearch = async () => {
      setIsSearching(true)

      try {
        const response = await fetch(
          `/api/v1/${entitySlug}?search=${encodeURIComponent(debouncedQuery)}`
        )

        if (!response.ok) throw new Error('Search failed')

        const data = await response.json()
        setResults(data.data || [])
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [debouncedQuery, entitySlug])

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch: useCallback(() => {
      setQuery('')
      setResults([])
    }, [])
  }
}
```

### Multi-Entity Search with Filters

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useEntitySearch } from '@nextsparkjs/core/hooks'

interface SearchFilters {
  entityTypes: string[]
  dateRange?: { from: Date; to: Date }
  priority?: 'low' | 'medium' | 'high'
}

export function useFilteredSearch() {
  const search = useEntitySearch()
  const [filters, setFilters] = useState<SearchFilters>({
    entityTypes: []
  })

  // Filter results based on active filters
  const filteredResults = useMemo(() => {
    let results = search.results

    // Filter by entity types
    if (filters.entityTypes.length > 0) {
      results = results.filter(r =>
        filters.entityTypes.includes(r.entityType)
      )
    }

    // Filter by priority
    if (filters.priority) {
      results = results.filter(r =>
        r.priority === filters.priority
      )
    }

    return results
  }, [search.results, filters])

  return {
    ...search,
    results: filteredResults,
    filters,
    setFilters,
    // Available entity types from results
    availableTypes: useMemo(() => {
      const types = new Set(search.results.map(r => r.entityType))
      return Array.from(types)
    }, [search.results])
  }
}

// Usage
function FilteredSearchUI() {
  const {
    query,
    setQuery,
    results,
    filters,
    setFilters,
    availableTypes
  } = useFilteredSearch()

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        data-cy="filtered-search-input"
      />

      <div className="filters">
        {availableTypes.map(type => (
          <label key={type}>
            <input
              type="checkbox"
              checked={filters.entityTypes.includes(type)}
              onChange={e => {
                setFilters(prev => ({
                  ...prev,
                  entityTypes: e.target.checked
                    ? [...prev.entityTypes, type]
                    : prev.entityTypes.filter(t => t !== type)
                }))
              }}
              data-cy={`filter-${type}`}
            />
            {type}
          </label>
        ))}
      </div>

      <ul>
        {results.map(r => (
          <li key={r.id} data-cy="search-result">
            {r.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Search with Highlighting

```typescript
// Highlight matches in search results
function highlightMatches(
  text: string,
  query: string
): React.ReactNode {
  if (!query.trim()) return text

  const parts = text.split(new RegExp(`(${query})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

// Usage in results
function SearchResultItem({
  result,
  query
}: {
  result: EntitySearchResult
  query: string
}) {
  return (
    <div data-cy="search-result">
      <h4>{highlightMatches(result.title, query)}</h4>
      {result.description && (
        <p className="text-sm text-gray-500">
          {highlightMatches(result.description, query)}
        </p>
      )}
    </div>
  )
}
```

### Test Selectors for Search

```typescript
// Always use data-cy attributes for search components
const SEARCH_SELECTORS = {
  container: 'search-container',
  input: 'search-input',
  results: 'search-results',
  result: 'search-result',
  resultLink: 'search-result-link',
  clearButton: 'search-clear',
  filter: (type: string) => `search-filter-${type}`,
  loading: 'search-loading',
  empty: 'search-empty'
}

// Usage in component
<div data-cy={SEARCH_SELECTORS.container}>
  <input data-cy={SEARCH_SELECTORS.input} />
  <div data-cy={SEARCH_SELECTORS.results}>
    {results.map(r => (
      <div key={r.id} data-cy={SEARCH_SELECTORS.result}>
        <a data-cy={SEARCH_SELECTORS.resultLink} href={r.url}>
          {r.title}
        </a>
      </div>
    ))}
  </div>
</div>
```

---

## Interactive Options

When running `/how-to:implement-search`:

```
┌─────────────────────────────────────────────────────────────┐
│  What would you like to learn?                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [1] Basic hook usage (useEntitySearch)                     │
│  [2] Pre-built component (EntitySearch)                     │
│  [3] Custom search implementation                           │
│  [4] Search with API integration                            │
│  [5] Start from Step 1 (full tutorial)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Questions

### Q: Why is search client-side?
A: Client-side search provides instant results without server round-trips.
For large datasets, you can extend with API-backed search.

### Q: How do I make a field searchable?
A: In your entity config, set `api.searchable: true` on the field.

### Q: Can I search across multiple entities?
A: Yes, useEntitySearch automatically searches all entities with
`ui.features.searchable: true` in their config.

### Q: How do I customize result ranking?
A: Override the relevance scoring function or post-process results
with your own sorting logic.

### Q: Why do I need to pass entities from server?
A: Entity configs must come from server components to ensure
proper permission filtering and avoid client-side registry access.

---

## Related Commands

- `/how-to:create-entity` - Create entities with searchable fields
- `/how-to:create-api` - API endpoints that support search
- `/how-to:use-devtools` - Test search in API explorer
- `/skill:react-patterns` - React patterns for search UIs
- `/skill:tanstack-query` - Data fetching patterns
- `/skill:cypress-selectors` - Test selectors for search components
