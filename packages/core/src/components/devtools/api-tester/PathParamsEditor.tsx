'use client'

import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { useTranslations } from 'next-intl'
import type { PathParam } from './types'

interface PathParamsEditorProps {
  params: PathParam[]
  onChange: (params: PathParam[]) => void
}

export function PathParamsEditor({ params, onChange }: PathParamsEditorProps) {
  const t = useTranslations('devtools.apiTester.pathParam')

  if (params.length === 0) return null

  const updateParam = (index: number, value: string) => {
    const updated = [...params]
    updated[index] = { ...updated[index], value }
    onChange(updated)
  }

  return (
    <div className="space-y-3" data-cy="api-tester-path-params">
      {params.map((param, index) => (
        <div key={param.name} className="space-y-1" data-cy={`api-tester-path-param-${param.name}`}>
          <div className="flex items-center gap-2">
            <Label htmlFor={`path-param-${param.name}`} className="font-mono text-sm">
              {param.name}
            </Label>
            {param.required && (
              <Badge variant="destructive" className="text-xs">
                {t('required')}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              {param.pattern}
            </span>
          </div>
          <Input
            id={`path-param-${param.name}`}
            placeholder={t('enterPlaceholder', { name: param.name })}
            value={param.value}
            onChange={(e) => updateParam(index, e.target.value)}
            className="font-mono"
            data-cy={`api-tester-path-param-${param.name}-input`}
          />
        </div>
      ))}
    </div>
  )
}
