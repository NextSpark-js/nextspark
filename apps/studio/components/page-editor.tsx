/**
 * Page Editor
 *
 * Main page editing interface for the block builder.
 * Left sidebar: page list. Center: block list with reorder/delete.
 * Supports adding blocks via the block picker.
 */

'use client'

import { useState, useCallback } from 'react'
import {
  Plus, ChevronUp, ChevronDown, Trash2, GripVertical, FileText,
  Rocket, Maximize2, Video, LayoutGrid, GitBranch, Building2,
  Grid, Quote, TrendingUp, DollarSign, Megaphone, HelpCircle, Zap,
  ChevronRight, Edit3, LayoutTemplate,
} from 'lucide-react'
import { BlockPicker } from './block-picker'
import { getBlockByType, type BlockCatalogItem } from '@/lib/block-catalog'
import type { PageDefinition, BlockInstance } from '@/lib/types'

const ICON_MAP: Record<string, typeof Rocket> = {
  Rocket, FileText, Maximize2, Video, LayoutGrid, GitBranch,
  Building2, Grid, Quote, TrendingUp, DollarSign, Megaphone,
  HelpCircle, Zap,
}

function BlockIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Grid
  return <Icon className={className} />
}

interface PageEditorProps {
  pages: PageDefinition[]
  onUpdatePages: (pages: PageDefinition[]) => void
}

export function PageEditor({ pages, onUpdatePages }: PageEditorProps) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [editingBlock, setEditingBlock] = useState<number | null>(null)

  const selectedPage = pages[selectedPageIndex] || null

  // ── Page operations ──

  const handleAddPage = useCallback(() => {
    const name = `Page ${pages.length + 1}`
    const route = `/${name.toLowerCase().replace(/\s+/g, '-')}`
    const updated = [...pages, { pageName: name, route, blocks: [] }]
    onUpdatePages(updated)
    setSelectedPageIndex(updated.length - 1)
  }, [pages, onUpdatePages])

  const handleDeletePage = useCallback((index: number) => {
    if (pages.length <= 1) return
    const updated = pages.filter((_, i) => i !== index)
    onUpdatePages(updated)
    setSelectedPageIndex(Math.min(selectedPageIndex, updated.length - 1))
  }, [pages, onUpdatePages, selectedPageIndex])

  // ── Block operations ──

  const handleAddBlock = useCallback((catalogItem: BlockCatalogItem) => {
    if (!selectedPage) return
    const newBlock: BlockInstance = {
      blockType: catalogItem.type,
      props: { ...catalogItem.defaultProps },
      order: selectedPage.blocks.length,
    }
    const updated = [...pages]
    updated[selectedPageIndex] = {
      ...selectedPage,
      blocks: [...selectedPage.blocks, newBlock],
    }
    onUpdatePages(updated)
    setShowPicker(false)
  }, [pages, selectedPage, selectedPageIndex, onUpdatePages])

  const handleMoveBlock = useCallback((blockIndex: number, direction: 'up' | 'down') => {
    if (!selectedPage) return
    const newIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1
    if (newIndex < 0 || newIndex >= selectedPage.blocks.length) return

    const blocks = [...selectedPage.blocks]
    const temp = blocks[blockIndex]
    blocks[blockIndex] = blocks[newIndex]
    blocks[newIndex] = temp
    // Update order
    blocks.forEach((b, i) => { b.order = i })

    const updated = [...pages]
    updated[selectedPageIndex] = { ...selectedPage, blocks }
    onUpdatePages(updated)
  }, [pages, selectedPage, selectedPageIndex, onUpdatePages])

  const handleDeleteBlock = useCallback((blockIndex: number) => {
    if (!selectedPage) return
    const blocks = selectedPage.blocks.filter((_, i) => i !== blockIndex)
    blocks.forEach((b, i) => { b.order = i })

    const updated = [...pages]
    updated[selectedPageIndex] = { ...selectedPage, blocks }
    onUpdatePages(updated)
    setEditingBlock(null)
  }, [pages, selectedPage, selectedPageIndex, onUpdatePages])

  const handleUpdateBlockProp = useCallback((blockIndex: number, key: string, value: unknown) => {
    if (!selectedPage) return
    const blocks = [...selectedPage.blocks]
    blocks[blockIndex] = {
      ...blocks[blockIndex],
      props: { ...blocks[blockIndex].props, [key]: value },
    }

    const updated = [...pages]
    updated[selectedPageIndex] = { ...selectedPage, blocks }
    onUpdatePages(updated)
  }, [pages, selectedPage, selectedPageIndex, onUpdatePages])

  // Empty state
  if (pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3 opacity-50">
          <LayoutTemplate className="h-14 w-14 mx-auto text-text-muted" />
          <p className="text-xs text-text-muted">Pages will appear here after AI generation</p>
          <button
            onClick={handleAddPage}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Page Manually
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left — Page list */}
      <div className="w-44 flex-shrink-0 border-r border-border bg-bg-surface/20 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Pages
          </span>
          <button
            onClick={handleAddPage}
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted/50 hover:text-accent hover:bg-accent-muted/20 transition-colors"
            title="Add page"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {pages.map((page, i) => (
            <button
              key={i}
              onClick={() => { setSelectedPageIndex(i); setShowPicker(false); setEditingBlock(null) }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                i === selectedPageIndex
                  ? 'bg-accent-muted/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
              }`}
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium truncate">{page.pageName}</div>
                <div className="text-[9px] text-text-muted/60 font-mono truncate">{page.route}</div>
              </div>
              {pages.length > 1 && i === selectedPageIndex && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePage(i) }}
                  className="flex-shrink-0 text-text-muted/30 hover:text-error transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Center — Block list */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPage && (
          <>
            {/* Page header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div>
                <span className="text-xs font-medium text-text-secondary">{selectedPage.pageName}</span>
                <span className="ml-2 text-[10px] text-text-muted font-mono">{selectedPage.route}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-muted">
                  {selectedPage.blocks.length} block{selectedPage.blocks.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => { setShowPicker(!showPicker); setEditingBlock(null) }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    showPicker
                      ? 'bg-accent text-white'
                      : 'bg-accent/10 text-accent hover:bg-accent/20'
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  Add Block
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Blocks list */}
              <div className="flex-1 overflow-y-auto">
                {selectedPage.blocks.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-2 opacity-50">
                      <LayoutGrid className="h-10 w-10 mx-auto text-text-muted" />
                      <p className="text-[11px] text-text-muted">No blocks yet</p>
                      <button
                        onClick={() => setShowPicker(true)}
                        className="text-[10px] text-accent hover:underline"
                      >
                        Add your first block
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 space-y-1.5">
                    {selectedPage.blocks.map((block, i) => {
                      const catalog = getBlockByType(block.blockType)
                      const isEditing = editingBlock === i

                      return (
                        <div key={i}>
                          {/* Block row */}
                          <div
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                              isEditing
                                ? 'border-accent/40 bg-accent-muted/10'
                                : 'border-border/50 bg-bg/50 hover:border-border'
                            }`}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-text-muted/30 flex-shrink-0" />

                            <div className="flex h-7 w-7 items-center justify-center rounded bg-bg-elevated flex-shrink-0">
                              <BlockIcon
                                name={catalog?.icon || 'Grid'}
                                className="h-3.5 w-3.5 text-text-muted"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-text-secondary truncate">
                                {catalog?.label || block.blockType}
                              </div>
                              {typeof block.props.title === 'string' && block.props.title && (
                                <div className="text-[9px] text-text-muted/60 truncate">
                                  {block.props.title}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => setEditingBlock(isEditing ? null : i)}
                                className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                                  isEditing
                                    ? 'text-accent bg-accent/10'
                                    : 'text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover'
                                }`}
                                title="Edit props"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveBlock(i, 'up')}
                                disabled={i === 0}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Move up"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveBlock(i, 'down')}
                                disabled={i === selectedPage.blocks.length - 1}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-muted/40 hover:text-text-secondary hover:bg-bg-hover disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="Move down"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteBlock(i)}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-muted/40 hover:text-error hover:bg-error/10 transition-colors"
                                title="Delete block"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Inline props editor */}
                          {isEditing && (
                            <div className="ml-6 mt-1 rounded-lg border border-border/50 bg-bg-surface/30 p-3">
                              <div className="space-y-2">
                                {Object.entries(block.props).map(([key, value]) => {
                                  // Skip complex objects/arrays for now — show as JSON
                                  if (typeof value === 'object' && value !== null) {
                                    return (
                                      <div key={key}>
                                        <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                                          {key}
                                        </label>
                                        <textarea
                                          value={JSON.stringify(value, null, 2)}
                                          onChange={(e) => {
                                            try {
                                              handleUpdateBlockProp(i, key, JSON.parse(e.target.value))
                                            } catch {
                                              // Invalid JSON, don't update
                                            }
                                          }}
                                          rows={3}
                                          className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] font-mono text-text-secondary focus:outline-none focus:border-accent/50 resize-y"
                                        />
                                      </div>
                                    )
                                  }

                                  if (typeof value === 'boolean') {
                                    return (
                                      <div key={key} className="flex items-center gap-2">
                                        <label className="text-[9px] font-medium text-text-muted uppercase tracking-wider flex-1">
                                          {key}
                                        </label>
                                        <button
                                          onClick={() => handleUpdateBlockProp(i, key, !value)}
                                          className={`relative h-4 w-7 rounded-full transition-colors ${
                                            value ? 'bg-accent' : 'bg-border'
                                          }`}
                                        >
                                          <span
                                            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                              value ? 'left-3.5' : 'left-0.5'
                                            }`}
                                          />
                                        </button>
                                      </div>
                                    )
                                  }

                                  return (
                                    <div key={key}>
                                      <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                                        {key}
                                      </label>
                                      <input
                                        type="text"
                                        value={String(value ?? '')}
                                        onChange={(e) => handleUpdateBlockProp(i, key, e.target.value)}
                                        className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Right — Block picker panel (slide-in) */}
              {showPicker && (
                <div className="w-56 flex-shrink-0 border-l border-border">
                  <BlockPicker
                    onAddBlock={handleAddBlock}
                    onClose={() => setShowPicker(false)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
