/**
 * Block Editor
 *
 * Type-aware prop editing component for page builder blocks.
 * Classifies props by key name and value type for appropriate inputs.
 */

'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface BlockEditorProps {
  props: Record<string, unknown>
  onUpdateProp: (key: string, value: unknown) => void
}

type PropCategory = 'content' | 'appearance' | 'actions' | 'items'

function classifyProp(key: string, value: unknown): PropCategory {
  const k = key.toLowerCase()
  if (Array.isArray(value) || k === 'items' || k === 'plans' || k === 'features') return 'items'
  if (k.includes('color') || k.includes('variant') || k.includes('position') ||
      k.includes('columns') || k.includes('fullscreen') || k.includes('textcolor')) return 'appearance'
  if (k === 'cta' || k.includes('button') || k.includes('link') || k.includes('url')) return 'actions'
  return 'content'
}

function isUrlKey(key: string): boolean {
  const k = key.toLowerCase()
  return k.includes('url') || k.includes('link') || k.includes('href')
}

function isColorKey(key: string): boolean {
  const k = key.toLowerCase()
  return k === 'color' || k.endsWith('color') || k.endsWith('Color')
}

function isTitleKey(key: string): boolean {
  const k = key.toLowerCase()
  return k === 'title' || k === 'heading' || k === 'name' || k === 'formtitle' || k === 'subtitle'
}

const CATEGORY_LABELS: Record<PropCategory, string> = {
  content: 'Content',
  appearance: 'Appearance',
  actions: 'Actions',
  items: 'Items',
}

const CATEGORY_ORDER: PropCategory[] = ['content', 'appearance', 'actions', 'items']

export function BlockEditor({ props, onUpdateProp }: BlockEditorProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<PropCategory>>(new Set())

  const toggleSection = useCallback((cat: PropCategory) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Group props by category
  const grouped = new Map<PropCategory, [string, unknown][]>()
  for (const [key, value] of Object.entries(props)) {
    const cat = classifyProp(key, value)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push([key, value])
  }

  return (
    <div className="space-y-2">
      {CATEGORY_ORDER.map(cat => {
        const entries = grouped.get(cat)
        if (!entries || entries.length === 0) return null

        const collapsed = collapsedSections.has(cat)

        return (
          <div key={cat}>
            <button
              onClick={() => toggleSection(cat)}
              className="flex items-center gap-1 text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1 hover:text-text-secondary transition-colors"
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {CATEGORY_LABELS[cat]}
            </button>

            {!collapsed && (
              <div className="space-y-2 pl-1">
                {entries.map(([key, value]) => (
                  <PropField
                    key={key}
                    propKey={key}
                    value={value}
                    onUpdate={(v) => onUpdateProp(key, v)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── PropField — renders the right input based on type ──

function PropField({ propKey, value, onUpdate }: {
  propKey: string
  value: unknown
  onUpdate: (value: unknown) => void
}) {
  // Boolean — toggle switch
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-[9px] font-medium text-text-muted uppercase tracking-wider flex-1">
          {propKey}
        </label>
        <button
          onClick={() => onUpdate(!value)}
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

  // Number
  if (typeof value === 'number') {
    return (
      <div>
        <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
          {propKey}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => onUpdate(Number(e.target.value))}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50"
        />
      </div>
    )
  }

  // String — many sub-types
  if (typeof value === 'string') {
    const label = (
      <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
        {propKey}
      </label>
    )

    // URL input
    if (isUrlKey(propKey)) {
      return (
        <div>
          {label}
          <input
            type="url"
            value={value}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="https://..."
            className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary font-mono focus:outline-none focus:border-accent/50"
          />
        </div>
      )
    }

    // Color picker
    if (isColorKey(propKey)) {
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value.startsWith('#') ? value : '#6d5cff'}
              onChange={(e) => onUpdate(e.target.value)}
              className="h-6 w-6 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onUpdate(e.target.value)}
              className="flex-1 rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary font-mono focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>
      )
    }

    // Long text — textarea
    if (value.length > 100 || propKey === 'content' || propKey === 'description') {
      return (
        <div>
          {label}
          <textarea
            value={value}
            onChange={(e) => onUpdate(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50 resize-y"
          />
        </div>
      )
    }

    // Title — text input
    return (
      <div>
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50"
        />
      </div>
    )
  }

  // Object (non-array) — collapsible JSON or nested fields
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return <ObjectField propKey={propKey} value={value as Record<string, unknown>} onUpdate={onUpdate} />
  }

  // Array — collapsible JSON
  if (Array.isArray(value)) {
    return <ArrayField propKey={propKey} value={value} onUpdate={onUpdate} />
  }

  // Fallback
  return (
    <div>
      <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
        {propKey}
      </label>
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:outline-none focus:border-accent/50"
      />
    </div>
  )
}

// ── Object field — inline editable sub-fields ──

function ObjectField({ propKey, value, onUpdate }: {
  propKey: string
  value: Record<string, unknown>
  onUpdate: (v: unknown) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5 hover:text-text-secondary"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {propKey}
      </button>
      {expanded && (
        <div className="ml-3 pl-2 border-l border-border/30 space-y-1.5">
          {Object.entries(value).map(([k, v]) => (
            <PropField
              key={k}
              propKey={k}
              value={v}
              onUpdate={(newV) => onUpdate({ ...value, [k]: newV })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Array field — JSON textarea ──

function ArrayField({ propKey, value, onUpdate }: {
  propKey: string
  value: unknown[]
  onUpdate: (v: unknown) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5 hover:text-text-secondary"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {propKey} ({value.length} items)
      </button>
      {expanded && (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onUpdate(JSON.parse(e.target.value))
            } catch {
              // Invalid JSON, don't update
            }
          }}
          rows={Math.min(10, value.length * 3 + 2)}
          className="w-full rounded border border-border bg-bg px-2 py-1 text-[10px] font-mono text-text-secondary focus:outline-none focus:border-accent/50 resize-y"
        />
      )}
    </div>
  )
}
