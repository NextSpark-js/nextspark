'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, ChevronDown, Database, Save,
  Loader2, Check, AlertCircle, GripVertical,
} from 'lucide-react'
import type { StudioResult } from '@/lib/types'
import type {
  EntityDefinition,
  EntityFieldDefinition,
  EntityFieldType,
  EntityAccessMode,
} from '@nextsparkjs/studio'
import { generateSqlPreview } from '@/lib/entity-sql-preview'

// ── Constants ──

const FIELD_TYPE_GROUPS: { label: string; types: { value: EntityFieldType; label: string }[] }[] = [
  {
    label: 'Text',
    types: [
      { value: 'text', label: 'Text' },
      { value: 'textarea', label: 'Textarea' },
      { value: 'richtext', label: 'Rich Text' },
      { value: 'markdown', label: 'Markdown' },
    ],
  },
  {
    label: 'Numbers',
    types: [
      { value: 'number', label: 'Number' },
      { value: 'currency', label: 'Currency' },
      { value: 'rating', label: 'Rating' },
    ],
  },
  {
    label: 'Dates',
    types: [
      { value: 'date', label: 'Date' },
      { value: 'datetime', label: 'Date & Time' },
    ],
  },
  {
    label: 'Boolean',
    types: [{ value: 'boolean', label: 'Boolean' }],
  },
  {
    label: 'Contact',
    types: [
      { value: 'email', label: 'Email' },
      { value: 'url', label: 'URL' },
      { value: 'phone', label: 'Phone' },
    ],
  },
  {
    label: 'Selection',
    types: [
      { value: 'select', label: 'Select' },
      { value: 'multiselect', label: 'Multi-select' },
      { value: 'tags', label: 'Tags' },
    ],
  },
  {
    label: 'Media',
    types: [
      { value: 'image', label: 'Image' },
      { value: 'file', label: 'File' },
    ],
  },
  {
    label: 'Data',
    types: [
      { value: 'json', label: 'JSON' },
      { value: 'country', label: 'Country' },
      { value: 'address', label: 'Address' },
    ],
  },
  {
    label: 'Relations',
    types: [{ value: 'relation', label: 'Relation' }],
  },
]

const ACCESS_MODES: { value: EntityAccessMode; label: string; desc: string }[] = [
  { value: 'private', label: 'Private', desc: 'Only the creator can see' },
  { value: 'team', label: 'Team', desc: 'All team members can see' },
  { value: 'shared', label: 'Shared', desc: 'Shared within team' },
  { value: 'public', label: 'Public', desc: 'Visible to everyone' },
]

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'text-blue-400', textarea: 'text-blue-400', richtext: 'text-blue-400', markdown: 'text-blue-400',
  number: 'text-yellow-400', currency: 'text-emerald-400', rating: 'text-yellow-400',
  boolean: 'text-orange-400',
  date: 'text-green-400', datetime: 'text-green-400',
  email: 'text-cyan-400', url: 'text-cyan-400', phone: 'text-cyan-400',
  select: 'text-purple-400', multiselect: 'text-purple-400', tags: 'text-purple-400',
  image: 'text-pink-400', file: 'text-pink-400',
  json: 'text-text-muted', country: 'text-green-400', address: 'text-green-400',
  relation: 'text-accent',
}

function defaultField(): EntityFieldDefinition {
  return { name: '', type: 'text', required: false }
}

function defaultEntity(): EntityDefinition {
  return {
    slug: '',
    names: { singular: '', plural: '' },
    description: '',
    accessMode: 'team',
    fields: [
      { name: 'title', type: 'text', required: true, description: 'Main title' },
      {
        name: 'status', type: 'select', required: false,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    ],
    features: { searchable: true, sortable: true, filterable: true, bulkOperations: true },
  }
}

// ── Component ──

interface EntityEditorProps {
  result: StudioResult
  slug: string | null
  onUpdateResult?: (result: StudioResult) => void
}

export function EntityEditor({ result, slug, onUpdateResult }: EntityEditorProps) {
  const [entities, setEntities] = useState<EntityDefinition[]>(
    () => result.entities ? [...result.entities.map(e => ({ ...e, fields: [...e.fields] }))] : []
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metadata: true, fields: true, features: false, migration: false,
  })
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const selectedEntity = entities[selectedIndex] || null

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleField = useCallback((index: number) => {
    setExpandedFields(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // ── Entity List Operations ──

  const addEntity = useCallback(() => {
    const newEntity = defaultEntity()
    const count = entities.length + 1
    newEntity.slug = `entity-${count}`
    newEntity.names = { singular: `Entity ${count}`, plural: `Entities ${count}` }
    newEntity.description = `New entity ${count}`
    setEntities(prev => [...prev, newEntity])
    setSelectedIndex(entities.length)
  }, [entities.length])

  const deleteEntity = useCallback((index: number) => {
    if (entities.length <= 1) return
    setEntities(prev => prev.filter((_, i) => i !== index))
    setSelectedIndex(Math.min(selectedIndex, entities.length - 2))
  }, [entities.length, selectedIndex])

  // ── Entity Metadata Updates ──

  const updateEntity = useCallback((updates: Partial<EntityDefinition>) => {
    setEntities(prev => {
      const next = [...prev]
      next[selectedIndex] = { ...next[selectedIndex], ...updates }
      return next
    })
  }, [selectedIndex])

  const updateNames = useCallback((key: 'singular' | 'plural', value: string) => {
    setEntities(prev => {
      const next = [...prev]
      next[selectedIndex] = {
        ...next[selectedIndex],
        names: { ...next[selectedIndex].names, [key]: value },
      }
      return next
    })
  }, [selectedIndex])

  const updateFeature = useCallback((key: string, value: boolean) => {
    setEntities(prev => {
      const next = [...prev]
      next[selectedIndex] = {
        ...next[selectedIndex],
        features: { ...next[selectedIndex].features, [key]: value },
      }
      return next
    })
  }, [selectedIndex])

  // ── Field Operations ──

  const addField = useCallback(() => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields, defaultField()]
      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  const removeField = useCallback((fieldIndex: number) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = entity.fields.filter((_, i) => i !== fieldIndex)
      next[selectedIndex] = entity
      return next
    })
    setExpandedFields(prev => {
      const next = new Set(prev)
      next.delete(fieldIndex)
      return next
    })
  }, [selectedIndex])

  const updateField = useCallback((fieldIndex: number, updates: Partial<EntityFieldDefinition>) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields]
      entity.fields[fieldIndex] = { ...entity.fields[fieldIndex], ...updates }

      // Clear options when switching away from select/multiselect
      if (updates.type && updates.type !== 'select' && updates.type !== 'multiselect') {
        delete entity.fields[fieldIndex].options
      }
      // Clear relation when switching away from relation type
      if (updates.type && updates.type !== 'relation') {
        delete entity.fields[fieldIndex].relation
      }
      // Add default options for select/multiselect
      if (updates.type === 'select' || updates.type === 'multiselect') {
        if (!entity.fields[fieldIndex].options?.length) {
          entity.fields[fieldIndex].options = [
            { value: 'option-1', label: 'Option 1' },
            { value: 'option-2', label: 'Option 2' },
          ]
        }
      }
      // Add default relation for relation type
      if (updates.type === 'relation') {
        if (!entity.fields[fieldIndex].relation) {
          entity.fields[fieldIndex].relation = { entity: '', titleField: 'title' }
        }
      }

      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  // Options editor helpers
  const addOption = useCallback((fieldIndex: number) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields]
      const field = { ...entity.fields[fieldIndex] }
      const count = (field.options?.length || 0) + 1
      field.options = [...(field.options || []), { value: `option-${count}`, label: `Option ${count}` }]
      entity.fields[fieldIndex] = field
      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  const removeOption = useCallback((fieldIndex: number, optIndex: number) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields]
      const field = { ...entity.fields[fieldIndex] }
      field.options = field.options?.filter((_, i) => i !== optIndex)
      entity.fields[fieldIndex] = field
      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  const updateOption = useCallback((fieldIndex: number, optIndex: number, key: 'value' | 'label', value: string) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields]
      const field = { ...entity.fields[fieldIndex] }
      field.options = [...(field.options || [])]
      field.options[optIndex] = { ...field.options[optIndex], [key]: value }
      entity.fields[fieldIndex] = field
      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  const updateRelation = useCallback((fieldIndex: number, key: 'entity' | 'titleField', value: string) => {
    setEntities(prev => {
      const next = [...prev]
      const entity = { ...next[selectedIndex] }
      entity.fields = [...entity.fields]
      const field = { ...entity.fields[fieldIndex] }
      field.relation = { ...field.relation!, [key]: value }
      entity.fields[fieldIndex] = field
      next[selectedIndex] = entity
      return next
    })
  }, [selectedIndex])

  // ── Save / Apply ──

  const handleApply = useCallback(async () => {
    if (!slug) return
    setSaving(true)
    setSaveStatus('idle')

    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, entities }),
      })

      if (!res.ok) {
        throw new Error('Failed to apply')
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)

      // Update parent result
      if (onUpdateResult) {
        onUpdateResult({ ...result, entities })
      }
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }, [slug, entities, result, onUpdateResult])

  // SQL preview
  const sqlPreview = useMemo(() => {
    if (!selectedEntity) return ''
    try {
      return generateSqlPreview(selectedEntity)
    } catch {
      return '-- Error generating preview'
    }
  }, [selectedEntity])

  // ── Render ──

  if (entities.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Database className="h-4 w-4 text-accent" />
          Entities
        </div>
        <div className="text-center py-8 space-y-3">
          <Database className="h-10 w-10 mx-auto text-text-muted/30" />
          <p className="text-xs text-text-muted">No entities defined yet</p>
          <button
            onClick={addEntity}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Entity
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Database className="h-4 w-4 text-accent" />
          Entities ({entities.length})
        </div>
      </div>

      <div className="flex gap-4" style={{ minHeight: 400 }}>
        {/* Left — Entity sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {entities.map((entity, i) => (
            <button
              key={i}
              onClick={() => { setSelectedIndex(i); setExpandedFields(new Set()) }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors group ${
                i === selectedIndex
                  ? 'bg-accent-muted/20 text-accent border border-accent/30'
                  : 'text-text-secondary hover:bg-bg-hover/50 border border-transparent'
              }`}
            >
              <Database className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium truncate">
                  {entity.names.plural || entity.slug || 'Untitled'}
                </div>
                <div className="text-[9px] text-text-muted/60">
                  {entity.fields.length} field{entity.fields.length !== 1 ? 's' : ''}
                </div>
              </div>
              {entities.length > 1 && i === selectedIndex && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEntity(i) }}
                  className="flex-shrink-0 text-text-muted/30 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </button>
          ))}

          <button
            onClick={addEntity}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-text-muted hover:text-accent hover:bg-accent-muted/10 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Entity
          </button>
        </div>

        {/* Right — Editor */}
        {selectedEntity && (
          <div className="flex-1 min-w-0 space-y-3 pr-1">
            {/* Metadata Section */}
            <Section title="Metadata" expanded={expandedSections.metadata} onToggle={() => toggleSection('metadata')}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Slug">
                  <input
                    type="text"
                    value={selectedEntity.slug}
                    onChange={(e) => updateEntity({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    className="input-sm"
                    placeholder="my-entity"
                  />
                </Field>
                <Field label="Access Mode">
                  <select
                    value={selectedEntity.accessMode}
                    onChange={(e) => updateEntity({ accessMode: e.target.value as EntityAccessMode })}
                    className="input-sm"
                  >
                    {ACCESS_MODES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Singular Name">
                  <input
                    type="text"
                    value={selectedEntity.names.singular}
                    onChange={(e) => updateNames('singular', e.target.value)}
                    className="input-sm"
                    placeholder="Product"
                  />
                </Field>
                <Field label="Plural Name">
                  <input
                    type="text"
                    value={selectedEntity.names.plural}
                    onChange={(e) => updateNames('plural', e.target.value)}
                    className="input-sm"
                    placeholder="Products"
                  />
                </Field>
              </div>
              <Field label="Description">
                <input
                  type="text"
                  value={selectedEntity.description}
                  onChange={(e) => updateEntity({ description: e.target.value })}
                  className="input-sm w-full"
                  placeholder="Manage your products..."
                />
              </Field>
            </Section>

            {/* Fields Section */}
            <Section title={`Fields (${selectedEntity.fields.length})`} expanded={expandedSections.fields} onToggle={() => toggleSection('fields')}>
              <div className="space-y-1.5">
                {selectedEntity.fields.map((field, fi) => {
                  const isExpanded = expandedFields.has(fi)
                  const typeColor = FIELD_TYPE_COLORS[field.type] || 'text-text-muted'

                  return (
                    <div key={fi} className="rounded-lg border border-border/50 bg-bg/30 transition-colors duration-150 hover:border-border-strong/40">
                      {/* Field row */}
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <GripVertical className="h-3 w-3 text-text-muted/20 flex-shrink-0" />

                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateField(fi, { name: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                          className="w-36 rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-mono text-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                          placeholder="fieldName"
                        />

                        <select
                          value={field.type}
                          onChange={(e) => updateField(fi, { type: e.target.value as EntityFieldType })}
                          className={`rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] ${typeColor} focus:outline-none focus:border-accent/50 transition-colors`}
                        >
                          {FIELD_TYPE_GROUPS.map(group => (
                            <optgroup key={group.label} label={group.label}>
                              {group.types.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <label className="flex items-center gap-1 text-[9px] text-text-muted">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(fi, { required: e.target.checked })}
                            className="h-3 w-3 rounded border-border accent-accent"
                          />
                          req
                        </label>

                        <div className="flex-1" />

                        <button
                          onClick={() => toggleField(fi)}
                          className="flex h-5 w-5 items-center justify-center rounded text-text-muted/40 hover:text-text-secondary transition-colors"
                          title="Expand"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>

                        <button
                          onClick={() => removeField(fi)}
                          className="flex h-5 w-5 items-center justify-center rounded text-text-muted/30 hover:text-error transition-colors"
                          title="Remove field"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Expanded field details */}
                      <div className="collapsible" data-expanded={isExpanded}>
                        <div className="collapsible-inner">
                        <div className="border-t border-border/30 px-3 py-2 space-y-2">
                          <Field label="Description">
                            <input
                              type="text"
                              value={field.description || ''}
                              onChange={(e) => updateField(fi, { description: e.target.value })}
                              className="input-sm w-full"
                              placeholder="Field description..."
                            />
                          </Field>

                          {/* Options editor for select/multiselect */}
                          {(field.type === 'select' || field.type === 'multiselect') && (
                            <div className="space-y-1">
                              <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider">
                                Options
                              </label>
                              {field.options?.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={opt.value}
                                    onChange={(e) => updateOption(fi, oi, 'value', e.target.value)}
                                    className="input-sm flex-1 font-mono"
                                    placeholder="value"
                                  />
                                  <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => updateOption(fi, oi, 'label', e.target.value)}
                                    className="input-sm flex-1"
                                    placeholder="Label"
                                  />
                                  <button
                                    onClick={() => removeOption(fi, oi)}
                                    className="text-text-muted/30 hover:text-error transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(fi)}
                                className="text-[9px] text-accent hover:underline"
                              >
                                + Add option
                              </button>
                            </div>
                          )}

                          {/* Relation editor */}
                          {field.type === 'relation' && field.relation && (
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Related Entity">
                                <select
                                  value={field.relation.entity}
                                  onChange={(e) => updateRelation(fi, 'entity', e.target.value)}
                                  className="input-sm"
                                >
                                  <option value="">Select entity...</option>
                                  {entities.filter((_, i) => i !== selectedIndex).map(e => (
                                    <option key={e.slug} value={e.slug}>{e.names.plural}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Title Field">
                                <input
                                  type="text"
                                  value={field.relation.titleField || ''}
                                  onChange={(e) => updateRelation(fi, 'titleField', e.target.value)}
                                  className="input-sm"
                                  placeholder="title"
                                />
                              </Field>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={addField}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium text-text-muted hover:text-accent hover:bg-accent-muted/10 transition-colors mt-1"
              >
                <Plus className="h-3 w-3" />
                Add Field
              </button>
            </Section>

            {/* Features Section */}
            <Section title="Features" expanded={expandedSections.features} onToggle={() => toggleSection('features')}>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'searchable', label: 'Searchable' },
                  { key: 'sortable', label: 'Sortable' },
                  { key: 'filterable', label: 'Filterable' },
                  { key: 'bulkOperations', label: 'Bulk Operations' },
                  { key: 'importExport', label: 'Import/Export' },
                ].map(feat => (
                  <label key={feat.key} className="flex items-center gap-2 text-[10px] text-text-secondary">
                    <input
                      type="checkbox"
                      checked={!!(selectedEntity.features as Record<string, boolean>)?.[feat.key]}
                      onChange={(e) => updateFeature(feat.key, e.target.checked)}
                      className="h-3 w-3 rounded border-border accent-accent"
                    />
                    {feat.label}
                  </label>
                ))}
              </div>
            </Section>

            {/* Migration Preview */}
            <Section title="Migration Preview" expanded={expandedSections.migration} onToggle={() => toggleSection('migration')}>
              <pre className="rounded-lg bg-bg p-3 text-[9px] font-mono text-text-muted overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
                {sqlPreview}
              </pre>
            </Section>

            {/* Apply Button */}
            {slug && (
              <div className="sticky bottom-0 bg-bg-surface/90 backdrop-blur-md border-t border-border pt-3 pb-1">
                <button
                  onClick={handleApply}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-all duration-150 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying...</>
                  ) : saveStatus === 'saved' ? (
                    <><Check className="h-3.5 w-3.5" /> Applied!</>
                  ) : saveStatus === 'error' ? (
                    <><AlertCircle className="h-3.5 w-3.5" /> Error — try again</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Apply Changes</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ──

function Section({ title, expanded, onToggle, children }: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border bg-bg-surface transition-colors duration-150 ${expanded ? 'border-border-strong/60' : 'border-border'}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {title}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
      </button>
      <div className="collapsible" data-expanded={expanded}>
        <div className="collapsible-inner">
          <div className="border-t border-border px-3 py-2.5 space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
        {label}
      </label>
      {children}
    </div>
  )
}
