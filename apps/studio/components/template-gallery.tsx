'use client'

import { useState, useMemo } from 'react'
import {
  Search, Dumbbell, Building2, Users, Camera, Code2, ChefHat,
  KanbanSquare, Receipt, CalendarCheck, ShoppingBag, Truck, Warehouse,
  Contact, Headphones, Wallet, Sparkles,
} from 'lucide-react'
import {
  TEMPLATES, TEMPLATE_CATEGORIES,
  type TemplateCategory, type Template,
} from '@/lib/templates'

const ICON_MAP: Record<string, typeof Sparkles> = {
  Dumbbell, Building2, Users, Camera, Code2, ChefHat,
  KanbanSquare, Receipt, CalendarCheck, ShoppingBag, Truck, Warehouse,
  Contact, Headphones, Wallet,
}

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  blue:    { border: 'border-l-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400' },
  purple:  { border: 'border-l-purple-400',  bg: 'bg-purple-500/10',  text: 'text-purple-400' },
  emerald: { border: 'border-l-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  amber:   { border: 'border-l-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  rose:    { border: 'border-l-rose-400',    bg: 'bg-rose-500/10',    text: 'text-rose-400' },
}

function TemplateIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Sparkles
  return <Icon className={className} />
}

interface TemplateGalleryProps {
  onSelectTemplate: (prompt: string) => void
  disabled?: boolean
}

export function TemplateGallery({ onSelectTemplate, disabled }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const filteredTemplates = useMemo(() => {
    let list: Template[] = activeCategory === 'all'
      ? TEMPLATES
      : TEMPLATES.filter(t => t.category === activeCategory)

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      )
    }

    return list
  }, [activeCategory, search])

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-muted text-center uppercase tracking-wider font-medium">
        Or start from a template
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full rounded-lg border border-border bg-bg-surface pl-9 pr-3 py-2 text-xs text-text-secondary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
        />
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
          }`}
        >
          All
        </button>
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-bg-elevated text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {filteredTemplates.length === 0 ? (
        <p className="text-center text-xs text-text-muted/60 py-4">No templates match your search</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filteredTemplates.map(template => {
            const colors = COLOR_CLASSES[template.color] || COLOR_CLASSES.blue
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.prompt)}
                disabled={disabled}
                className={`flex items-start gap-3 rounded-lg border border-border/60 ${colors.border} border-l-2 bg-bg-surface px-3 py-2.5 text-left transition-all hover:border-border-strong hover:shadow-sm hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed group`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${colors.bg} mt-0.5`}>
                  <TemplateIcon name={template.icon} className={`h-4 w-4 ${colors.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-text-primary group-hover:text-accent transition-colors">
                    {template.title}
                  </div>
                  <div className="text-[10px] text-text-muted/70 line-clamp-2 mt-0.5 leading-relaxed">
                    {template.description}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {template.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded px-1.5 py-0.5 text-[8px] bg-bg-elevated text-text-muted/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
