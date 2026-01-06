'use client'

/**
 * AI Observability Trace Detail Page
 *
 * Theme implementation of the trace detail page.
 * Uses the plugin preset and applies theme-specific configuration.
 */

import { use } from 'react'
import { observabilityConfig } from '@/themes/default/lib/langchain/observability.config'
import { TraceDetailPagePreset } from '@/plugins/langchain/presets/templates/sector7/ai-observability/[traceId]/page'

interface PageProps {
  params: Promise<{ traceId: string }>
}

export default function TraceDetailPage({ params }: PageProps) {
  const { traceId } = use(params)

  return (
    <TraceDetailPagePreset
      traceId={traceId}
      enabled={observabilityConfig.observability?.enabled ?? false}
    />
  )
}
