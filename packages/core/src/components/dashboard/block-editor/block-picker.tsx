'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, LayoutGrid, LayoutList, Layers } from 'lucide-react'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'
import { getCategoryConfig } from './category-helpers'
import { TreeView } from './tree-view'
import { PatternCard } from './pattern-card'
import type { BlockConfig, BlockInstance } from '../../../types/blocks'
import type { PatternReference } from '../../../types/pattern-reference'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import type { Pattern } from '../../../types/pattern-reference'

type TabValue = 'blocks' | 'patterns' | 'layout'

// Helper to get team ID from localStorage
function getTeamId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeTeamId')
  }
  return null
}

// Helper to build headers with team context
function buildApiHeaders(): HeadersInit {
  const headers: Record<string, string> = {}
  const teamId = getTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  return headers
}

interface BlockPickerProps {
  blocks: BlockConfig[]
  onAddBlock: (blockSlug: string) => void
  onAddPattern?: (patternId: string) => void
  entityConfig: ClientEntityConfig
  entityFields: Record<string, unknown>
  onEntityFieldChange: (field: string, value: unknown) => void
  showFieldsTab: boolean
  showPatternsTab?: boolean
  // TreeView props for Layout tab
  pageBlocks: (BlockInstance | PatternReference)[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onReorderBlocks: (blocks: (BlockInstance | PatternReference)[]) => void
}

export function BlockPicker({
  blocks,
  onAddBlock,
  onAddPattern,
  entityConfig,
  entityFields,
  onEntityFieldChange,
  showFieldsTab,
  showPatternsTab = false,
  // TreeView props
  pageBlocks,
  selectedBlockId,
  onSelectBlock,
  onReorderBlocks,
}: BlockPickerProps) {
  const t = useTranslations('admin.builder')
  const tPatterns = useTranslations('patterns')
  const [activeTab, setActiveTab] = useState<TabValue>('blocks')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Fetch published patterns (only when patterns tab is visible and active)
  const { data: patternsData, isLoading: patternsLoading } = useQuery<{ data: Pattern[] }>({
    queryKey: ['patterns', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/v1/patterns?status=published', {
        headers: buildApiHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch patterns')
      return response.json()
    },
    enabled: showPatternsTab && activeTab === 'patterns',
  })

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(blocks.map(block => block.category))]
    return uniqueCategories.sort()
  }, [blocks])

  // Filter blocks
  const filteredBlocks = useMemo(() => {
    return blocks.filter(block => {
      const matchesSearch = search === '' ||
        block.name.toLowerCase().includes(search.toLowerCase()) ||
        block.description.toLowerCase().includes(search.toLowerCase())

      const matchesCategory = !selectedCategory || block.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [blocks, search, selectedCategory])

  // Filter patterns
  const filteredPatterns = useMemo(() => {
    const patterns = patternsData?.data || []
    if (search === '') return patterns

    return patterns.filter(pattern =>
      pattern.title.toLowerCase().includes(search.toLowerCase()) ||
      pattern.description?.toLowerCase().includes(search.toLowerCase())
    )
  }, [patternsData, search])

  return (
    <div className="flex h-full flex-col bg-card" data-cy={sel('blockEditor.blockPicker.container')}>
      {/* Visual Tabs */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'blocks'
              ? 'text-primary bg-primary/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
          onClick={() => setActiveTab('blocks')}
          data-cy={sel('blockEditor.blockPicker.tabBlocks')}
        >
          <LayoutGrid className="h-4 w-4 inline mr-2" />
          {t('sidebar.tabs.blocks')}
          {activeTab === 'blocks' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              data-cy={sel('blockEditor.blockPicker.tabIndicator')}
            />
          )}
        </button>
        {showPatternsTab && (
          <button
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'patterns'
                ? 'text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={() => setActiveTab('patterns')}
            data-cy={sel('blockEditor.blockPicker.tabPatterns')}
          >
            <Layers className="h-4 w-4 inline mr-2" />
            {t('sidebar.tabs.patterns')}
            {activeTab === 'patterns' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        )}
        {/* Layout tab - always shown (for tree view) */}
        <button
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'layout'
              ? 'text-primary bg-primary/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
          onClick={() => setActiveTab('layout')}
          data-cy={sel('blockEditor.blockPicker.tabLayout')}
        >
          <LayoutList className="h-4 w-4 inline mr-2" />
          {t('sidebar.tabs.layout')}
          {activeTab === 'layout' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'blocks' ? (
        <>
          {/* Search & Filter */}
          <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
            <div className="relative" data-cy={sel('blockEditor.blockPicker.searchWrapper')}>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                data-cy={sel('blockEditor.blockPicker.searchIcon')}
              />
              <Input
                type="text"
                placeholder={t('sidebar.search.placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-cy={sel('blockEditor.blockPicker.searchInput')}
              />
            </div>

            {/* Category Chips - Horizontal Scrollable */}
            <div
              className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin"
              data-cy={sel('blockEditor.blockPicker.categoryChips')}
            >
              <button
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                  !selectedCategory
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                )}
                onClick={() => setSelectedCategory(null)}
                data-cy={sel('blockEditor.blockPicker.categoryActive')}
              >
                {t('sidebar.categories.all')}
              </button>
              {categories.map(category => {
                const config = getCategoryConfig(category)
                const Icon = config.icon
                const isActive = selectedCategory === category

                return (
                  <button
                    key={category}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors capitalize flex items-center gap-1.5',
                      isActive
                        ? `${config.bgColor} ${config.textColor} ${config.borderColor} border`
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                    )}
                    onClick={() => setSelectedCategory(category)}
                    data-cy={sel('blockEditor.blockPicker.categoryChip', { category })}
                  >
                    <Icon className="h-3 w-3" />
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Blocks List */}
          <ScrollArea className="flex-1 p-4" data-cy={sel('blockEditor.blockPicker.blockList')}>
            <div className="space-y-3">
              {filteredBlocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">{t('sidebar.empty')}</p>
                </div>
              ) : (
                filteredBlocks.map(block => {
                  const categoryConfig = getCategoryConfig(block.category)
                  const CategoryIcon = categoryConfig.icon

                  return (
                    <div
                      key={block.slug}
                      className="group relative bg-background border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-[border-color,box-shadow] cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('blockSlug', block.slug)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => onAddBlock(block.slug)}
                      data-cy={sel('blockEditor.blockPicker.blockCard', { slug: block.slug })}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-6 h-6 rounded flex items-center justify-center text-xs',
                              categoryConfig.bgColor,
                              categoryConfig.textColor
                            )}
                            data-cy={sel('blockEditor.blockPicker.blockIcon', { slug: block.slug })}
                          >
                            <CategoryIcon className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className="font-medium text-sm text-foreground"
                            data-cy={sel('blockEditor.blockPicker.blockName', { slug: block.slug })}
                          >
                            {block.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize"
                          data-cy={sel('blockEditor.blockPicker.blockCategory', { slug: block.slug })}
                        >
                          {block.category}
                        </span>
                      </div>
                      <p
                        className="text-xs text-muted-foreground line-clamp-2"
                        data-cy={sel('blockEditor.blockPicker.blockDescription', { slug: block.slug })}
                      >
                        {block.description}
                      </p>

                      {/* Hover "+" Button */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="w-6 h-6 bg-foreground text-background rounded flex items-center justify-center text-xs shadow-md hover:scale-110 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddBlock(block.slug)
                          }}
                          data-cy={sel('blockEditor.blockPicker.addButton', { slug: block.slug })}
                          title={t('sidebar.addBlock')}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </>
      ) : activeTab === 'patterns' ? (
        // Patterns Tab
        <>
          {/* Search */}
          <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
            <div className="relative" data-cy={sel('blockEditor.blockPicker.patternsSearchWrapper')}>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                data-cy={sel('blockEditor.blockPicker.patternsSearchIcon')}
              />
              <Input
                type="text"
                placeholder={tPatterns('picker.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-cy={sel('blockEditor.blockPicker.patternsSearch')}
              />
            </div>
          </div>

          {/* Patterns List */}
          <ScrollArea className="flex-1 p-4" data-cy={sel('blockEditor.blockPicker.patternsList')}>
            {patternsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{tPatterns('picker.loading') || 'Loading patterns...'}</p>
              </div>
            ) : filteredPatterns.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground"
                data-cy={sel('blockEditor.blockPicker.patternsEmpty')}
              >
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium mb-1">
                  {search ? tPatterns('picker.noResults') : tPatterns('list.empty')}
                </p>
                <p className="text-xs">
                  {search ? tPatterns('picker.noResults') : tPatterns('list.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatterns.map(pattern => (
                  <PatternCard
                    key={pattern.id}
                    pattern={pattern}
                    onSelect={(patternId) => {
                      if (onAddPattern) {
                        onAddPattern(patternId)
                        setSearch('') // Clear search after inserting
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      ) : (
        // Layout Tab - Tree View
        <TreeView
          blocks={pageBlocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onReorder={onReorderBlocks}
          emptyMessage={t('layout.empty')}
        />
      )}
    </div>
  )
}
