'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@nextsparkjs/core/components/ui/button'

interface CollapsibleJsonProps {
  data: unknown
  maxPreviewLength?: number
  className?: string
}

/**
 * Collapsible JSON viewer that shows a truncated preview by default.
 * Useful for long JSON objects in conversation flows.
 */
export function CollapsibleJson({ data, maxPreviewLength = 100, className = '' }: CollapsibleJsonProps) {
  const t = useTranslations('observability')
  const [isExpanded, setIsExpanded] = useState(false)

  // Format the JSON
  const formattedJson = JSON.stringify(data, null, 2)

  // Check if content is long enough to need collapsing
  const needsCollapsing = formattedJson.length > maxPreviewLength

  // Create preview (first maxPreviewLength chars + ellipsis)
  const preview = needsCollapsing
    ? formattedJson.slice(0, maxPreviewLength) + '...'
    : formattedJson

  // Check if content contains error-related keywords
  const hasError =
    formattedJson.toLowerCase().includes('"error"') ||
    formattedJson.toLowerCase().includes('"error_type"') ||
    formattedJson.toLowerCase().includes('failed') ||
    formattedJson.toLowerCase().includes('exception')

  const textColorClass = hasError
    ? 'text-destructive'
    : 'text-foreground'

  const bgColorClass = hasError
    ? 'bg-destructive/10'
    : 'bg-muted'

  if (!needsCollapsing) {
    return (
      <pre className={`text-xs p-2 rounded overflow-x-auto whitespace-pre-wrap ${bgColorClass} ${textColorClass} ${className}`}>
        {formattedJson}
      </pre>
    )
  }

  return (
    <div className={className}>
      <pre className={`text-xs p-2 rounded overflow-x-auto whitespace-pre-wrap ${bgColorClass} ${textColorClass}`}>
        {isExpanded ? formattedJson : preview}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-1 h-6 text-xs"
        data-cy="toggle-json"
      >
        {isExpanded ? t('flow.collapse') : t('flow.showFull')}
      </Button>
    </div>
  )
}
