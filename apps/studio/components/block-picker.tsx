/**
 * Block Picker Panel
 *
 * Visual panel for browsing and adding blocks to a page.
 * Shows blocks organized by category with icons and descriptions.
 */

'use client'

import { useState, useCallback } from 'react'
import {
  Rocket, FileText, Maximize2, Video, LayoutGrid, GitBranch,
  Building2, Grid, Quote, TrendingUp, DollarSign, Megaphone,
  HelpCircle, Zap, X,
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

  const filteredBlocks = activeCategory === 'all'
    ? BLOCK_CATALOG
    : BLOCK_CATALOG.filter(b => b.category === activeCategory)

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

      {/* Block grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {filteredBlocks.map(block => (
            <button
              key={block.type}
              onClick={() => handleAdd(block)}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/50 bg-bg/50 p-3 text-center hover:border-accent/30 hover:bg-accent-muted/20 transition-all group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-elevated text-text-muted group-hover:text-accent transition-colors">
                <BlockIcon name={block.icon} className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-text-secondary leading-tight">
                {block.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
