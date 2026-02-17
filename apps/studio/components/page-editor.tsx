/**
 * Page Editor
 *
 * Main page editing interface for the block builder.
 * Left sidebar: page list with rename. Center: block list with drag-drop reorder.
 * Supports adding/duplicating blocks, type-aware prop editing, and auto-save.
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, GripVertical, FileText, Copy,
  Rocket, Maximize2, Video, LayoutGrid, GitBranch, Building2,
  Grid, Quote, TrendingUp, DollarSign, Megaphone, HelpCircle, Zap,
  ChevronRight, Edit3, LayoutTemplate, Check, Loader2,
} from 'lucide-react'
import { BlockPicker } from './block-picker'
import { BlockEditor } from './block-editor'
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

// ── Sortable Block Row ──

interface SortableBlockProps {
  block: BlockInstance
  index: number
  isEditing: boolean
  onToggleEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUpdateProp: (key: string, value: unknown) => void
}

function SortableBlock({
  block, index, isEditing, onToggleEdit, onDuplicate, onDelete, onUpdateProp,
}: SortableBlockProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `block-${index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const catalog = getBlockByType(block.blockType)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Block row */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-150 ${
          isEditing
            ? 'border-accent/40 bg-accent-muted/10 shadow-sm shadow-accent/5'
            : isDragging
            ? 'border-accent/20 bg-bg-elevated shadow-lg scale-[1.02]'
            : 'border-border/50 bg-bg/50 hover:border-border hover:bg-bg-surface/40'
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-muted/30 hover:text-text-muted/60 flex-shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

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
            onClick={onToggleEdit}
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
            onClick={onDuplicate}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted/40 hover:text-accent hover:bg-accent-muted/20 transition-colors"
            title="Duplicate block"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted/40 hover:text-error hover:bg-error/10 transition-colors"
            title="Delete block"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Inline props editor */}
      <div className="collapsible" data-expanded={isEditing}>
        <div className="collapsible-inner">
          <div className="ml-6 mt-1 rounded-lg border border-border/50 bg-bg-surface/30 p-3">
            <BlockEditor props={block.props} onUpdateProp={onUpdateProp} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main PageEditor ──

interface PageEditorProps {
  pages: PageDefinition[]
  onUpdatePages: (pages: PageDefinition[]) => void
  slug?: string | null
  externalSelection?: { pageIndex: number; blockIndex: number } | null
  onClearExternalSelection?: () => void
  onFilesChanged?: () => void
}

export function PageEditor({ pages, onUpdatePages, slug, externalSelection, onClearExternalSelection, onFilesChanged }: PageEditorProps) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [editingBlock, setEditingBlock] = useState<number | null>(null)
  const [renamingPage, setRenamingPage] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastSavedRef = useRef<string>('')

  const selectedPage = pages[selectedPageIndex] || null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Auto-save ──

  useEffect(() => {
    if (!slug || pages.length === 0) return

    const serialized = JSON.stringify(pages)
    if (serialized === lastSavedRef.current) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)

    autoSaveTimer.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setAutoSaveStatus('saving')
      try {
        const res = await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, pages }),
          signal: controller.signal,
        })
        if (res.ok) {
          lastSavedRef.current = serialized
          setAutoSaveStatus('saved')
          onFilesChanged?.()
          setTimeout(() => setAutoSaveStatus('idle'), 2000)
        } else {
          setAutoSaveStatus('idle')
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setAutoSaveStatus('idle')
        }
      }
    }, 1500)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [pages, slug])

  // ── External selection (from block selector in preview) ──

  useEffect(() => {
    if (!externalSelection) return
    const { pageIndex, blockIndex } = externalSelection

    if (pageIndex >= 0 && pageIndex < pages.length) {
      setSelectedPageIndex(pageIndex)
      setShowPicker(false)

      const page = pages[pageIndex]
      if (blockIndex >= 0 && blockIndex < page.blocks.length) {
        setEditingBlock(blockIndex)
      }
    }

    onClearExternalSelection?.()
  }, [externalSelection]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleStartRename = useCallback((index: number) => {
    setRenamingPage(index)
    setRenameValue(pages[index].pageName)
  }, [pages])

  const handleFinishRename = useCallback(() => {
    if (renamingPage === null || !renameValue.trim()) {
      setRenamingPage(null)
      return
    }
    const updated = [...pages]
    const newRoute = `/${renameValue.trim().toLowerCase().replace(/\s+/g, '-')}`
    updated[renamingPage] = {
      ...updated[renamingPage],
      pageName: renameValue.trim(),
      route: newRoute,
    }
    onUpdatePages(updated)
    setRenamingPage(null)
  }, [pages, onUpdatePages, renamingPage, renameValue])

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || !selectedPage || active.id === over.id) return

    const oldIndex = Number(String(active.id).replace('block-', ''))
    const newIndex = Number(String(over.id).replace('block-', ''))

    const blocks = arrayMove([...selectedPage.blocks], oldIndex, newIndex)
    blocks.forEach((b, i) => { b.order = i })

    const updated = [...pages]
    updated[selectedPageIndex] = { ...selectedPage, blocks }
    onUpdatePages(updated)

    // Update editing index if needed
    if (editingBlock === oldIndex) setEditingBlock(newIndex)
    else if (editingBlock !== null) {
      if (oldIndex < editingBlock && newIndex >= editingBlock) setEditingBlock(editingBlock - 1)
      else if (oldIndex > editingBlock && newIndex <= editingBlock) setEditingBlock(editingBlock + 1)
    }
  }, [pages, selectedPage, selectedPageIndex, onUpdatePages, editingBlock])

  const handleDuplicateBlock = useCallback((blockIndex: number) => {
    if (!selectedPage) return
    const original = selectedPage.blocks[blockIndex]
    const clone: BlockInstance = {
      blockType: original.blockType,
      props: JSON.parse(JSON.stringify(original.props)),
      order: blockIndex + 1,
    }
    const blocks = [...selectedPage.blocks]
    blocks.splice(blockIndex + 1, 0, clone)
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

  const blockIds = selectedPage?.blocks.map((_, i) => `block-${i}`) || []

  return (
    <div className="flex h-full">
      {/* Left — Page list */}
      <div className="w-44 flex-shrink-0 border-r border-border bg-bg-surface/20 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Pages
          </span>
          <div className="flex items-center gap-1">
            {autoSaveStatus === 'saving' && (
              <Loader2 className="h-3 w-3 text-text-muted/40 animate-spin" />
            )}
            {autoSaveStatus === 'saved' && (
              <Check className="h-3 w-3 text-success/60" />
            )}
            <button
              onClick={handleAddPage}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted/50 hover:text-accent hover:bg-accent-muted/20 transition-colors"
              title="Add page"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {pages.map((page, i) => (
            <div
              key={i}
              onClick={() => { setSelectedPageIndex(i); setShowPicker(false); setEditingBlock(null) }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                i === selectedPageIndex
                  ? 'bg-accent-muted/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
              }`}
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                {renamingPage === i ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename()
                      if (e.key === 'Escape') setRenamingPage(null)
                    }}
                    className="w-full bg-transparent border-b border-accent text-[11px] font-medium focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="text-[11px] font-medium truncate"
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(i) }}
                    title="Double-click to rename"
                  >
                    {page.pageName}
                  </div>
                )}
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
            </div>
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={blockIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="p-3 space-y-1.5">
                        {selectedPage.blocks.map((block, i) => (
                          <SortableBlock
                            key={`block-${i}`}
                            block={block}
                            index={i}
                            isEditing={editingBlock === i}
                            onToggleEdit={() => setEditingBlock(editingBlock === i ? null : i)}
                            onDuplicate={() => handleDuplicateBlock(i)}
                            onDelete={() => handleDeleteBlock(i)}
                            onUpdateProp={(key, value) => handleUpdateBlockProp(i, key, value)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Right — Block picker panel (slide-in) */}
              <div
                className="flex-shrink-0 border-l border-border overflow-hidden slide-panel"
                style={{ width: showPicker ? 256 : 0, opacity: showPicker ? 1 : 0 }}
              >
                <div className="w-64 h-full">
                  <BlockPicker
                    onAddBlock={handleAddBlock}
                    onClose={() => setShowPicker(false)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
