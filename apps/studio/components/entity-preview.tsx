'use client'

import { Database, Key, ArrowRight } from 'lucide-react'
import type { StudioResult } from '@/lib/types'
import type { EntityFieldDefinition } from '@nextsparkjs/studio'

interface EntityPreviewProps {
  result: StudioResult
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'text-blue-400',
  textarea: 'text-blue-400',
  number: 'text-yellow-400',
  boolean: 'text-orange-400',
  date: 'text-green-400',
  datetime: 'text-green-400',
  email: 'text-cyan-400',
  url: 'text-cyan-400',
  phone: 'text-cyan-400',
  select: 'text-purple-400',
  multiselect: 'text-purple-400',
  tags: 'text-purple-400',
  image: 'text-pink-400',
  file: 'text-pink-400',
  rating: 'text-yellow-400',
  currency: 'text-emerald-400',
  richtext: 'text-blue-400',
  markdown: 'text-blue-400',
  relation: 'text-accent',
  json: 'text-text-muted',
  country: 'text-green-400',
  address: 'text-green-400',
}

function FieldRow({ field }: { field: EntityFieldDefinition }) {
  const typeColor = FIELD_TYPE_COLORS[field.type] || 'text-text-muted'

  return (
    <div className="flex items-center gap-2 text-sm py-0.5">
      {field.required ? (
        <Key className="h-3 w-3 text-warning flex-shrink-0" />
      ) : (
        <span className="w-3" />
      )}
      <span className="text-text-primary font-mono text-xs">{field.name}</span>
      <span className={`text-xs ${typeColor}`}>{field.type}</span>
      {field.relation && (
        <span className="flex items-center gap-1 text-xs text-accent">
          <ArrowRight className="h-3 w-3" />
          {field.relation.entity}
        </span>
      )}
      {field.options && field.options.length > 0 && (
        <span className="text-xs text-text-muted">
          [{field.options.map(o => o.value).join('|')}]
        </span>
      )}
    </div>
  )
}

export function EntityPreview({ result }: EntityPreviewProps) {
  const { entities } = result

  if (!entities || entities.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Database className="h-4 w-4 text-accent" />
        Entities ({entities.length})
      </div>

      {entities.map((entity) => (
        <div
          key={entity.slug}
          className="rounded-lg border border-border bg-bg-surface p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">
                {entity.names.plural}
              </span>
              <span className="ml-2 text-xs text-text-muted font-mono">
                /{entity.slug}
              </span>
            </div>
            <span className="text-xs rounded-md border border-border px-1.5 py-0.5 text-text-muted">
              {entity.accessMode}
            </span>
          </div>

          <p className="text-xs text-text-muted">{entity.description}</p>

          <div className="border-t border-border pt-2 space-y-0.5">
            {entity.fields.map((field) => (
              <FieldRow key={field.name} field={field} />
            ))}
          </div>

          {/* System fields hint */}
          <div className="text-xs text-text-muted italic pt-1">
            + id, createdAt, updatedAt, userId, teamId (auto)
          </div>
        </div>
      ))}
    </div>
  )
}
