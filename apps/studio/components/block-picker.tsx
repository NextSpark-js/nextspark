/**
 * Block Picker Panel
 *
 * Visual panel for browsing and adding blocks to a page.
 * Shows blocks organized by category with search and descriptions.
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Rocket, FileText, Maximize2, Video, LayoutGrid, GitBranch,
  Building2, Grid, Quote, TrendingUp, DollarSign, Megaphone,
  HelpCircle, Zap, X, Search,
} from 'lucide-react'
import { BLOCK_CATALOG, BLOCK_CATEGORIES, type BlockCategory, type BlockCatalogItem } from '@/lib/block-catalog'

const ICON_MAP: Record<string, typeof Rocket> = {
  Rocket, FileText, Maximize2, Video, LayoutGrid, GitBranch,
  Building2, Grid, Quote, TrendingUp, DollarSign, Megaphone,
  HelpCircle, Zap,
}

function BlockIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Grid
  return <Icon className={className} />
}

interface BlockPickerProps {
  onAddBlock: (block: BlockCatalogItem) => void
  onClose: () => void
}

export function BlockPicker({ onAddBlock, onClose }: BlockPickerProps) {
  const [activeCategory, setActiveCategory] = useState<BlockCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const filteredBlocks = useMemo(() => {
    let blocks = activeCategory === 'all'
      ? BLOCK_CATALOG
      : BLOCK_CATALOG.filter(b => b.category === activeCategory)

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      blocks = blocks.filter(b =>
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q)
      )
    }

    return blocks
  }, [activeCategory, search])

  const handleAdd = useCallback((block: BlockCatalogItem) => {
    onAddBlock(block)
  }, [onAddBlock])

  return (
    <div className="flex flex-col h-full bg-bg-surface/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Add Block
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full rounded-md border border-border bg-bg pl-7 pr-2 py-1 text-[10px] text-text-secondary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-bg-elevated text-text-primary'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
          }`}
        >
          All
        </button>
        {BLOCK_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredBlocks.length === 0 ? (
          <p className="text-center text-[10px] text-text-muted/50 py-4">No blocks match</p>
        ) : (
          <div className="space-y-1.5">
            {filteredBlocks.map(block => (
              <button
                key={block.type}
                onClick={() => handleAdd(block)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-border/50 bg-bg/50 px-3 py-2.5 text-left hover:border-accent/30 hover:bg-accent-muted/20 transition-all group"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-bg-elevated text-text-muted group-hover:text-accent transition-colors">
                  <BlockIcon name={block.icon} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    {block.label}
                  </div>
                  <div className="text-[9px] text-text-muted/50 truncate leading-relaxed">
                    {block.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
