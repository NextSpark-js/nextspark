'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Plus } from 'lucide-react'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import type { BlockConfig } from '../../../types/blocks'

interface BlockPickerProps {
  blocks: BlockConfig[]
  onAddBlock: (blockSlug: string) => void
}

export function BlockPicker({ blocks, onAddBlock }: BlockPickerProps) {
  const t = useTranslations('admin.blockEditor.picker')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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

  return (
    <div className="flex h-full flex-col bg-card" data-cy="block-picker">
      <div className="border-b p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-cy="block-search-input"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedCategory ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            data-cy="category-all"
          >
            {t('categories.all')}
          </Button>
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              data-cy={`category-${category}`}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Blocks List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {filteredBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('empty')}</p>
            </div>
          ) : (
            filteredBlocks.map(block => (
              <div
                key={block.slug}
                className="group relative rounded-lg border bg-background p-4 hover:bg-accent transition-colors cursor-pointer"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('blockSlug', block.slug)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onAddBlock(block.slug)}
                data-cy={`block-item-${block.slug}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm text-foreground truncate">
                        {block.name}
                      </h4>
                      <Badge variant="outline" className="text-xs capitalize">
                        {block.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {block.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddBlock(block.slug)
                    }}
                    data-cy={`add-block-${block.slug}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
