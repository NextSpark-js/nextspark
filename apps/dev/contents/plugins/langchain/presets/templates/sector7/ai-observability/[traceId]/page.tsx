'use client'

/**
 * AI Observability Trace Detail Page Preset
 *
 * Shows detailed view of a specific trace with its spans.
 * Configurable basePath allows use at any URL (e.g., /superadmin/ai-observability/{traceId})
 */

import { useRouter } from 'next/navigation'
import { useTraceDetail } from '@/plugins/langchain/hooks/observability/useTraceDetail'
import { TraceDetail } from '@/plugins/langchain/components/observability/TraceDetail'

interface TraceDetailPagePresetProps {
  traceId: string
  enabled?: boolean
  /** Base path for navigation (e.g., '/superadmin/ai-observability') */
  basePath?: string
}

export function TraceDetailPagePreset({
  traceId,
  enabled = true,
  basePath = '/superadmin/ai-observability'
}: TraceDetailPagePresetProps) {
  const router = useRouter()
  const { data, isLoading, isError } = useTraceDetail(traceId)

  const handleBack = () => {
    router.push(basePath)
  }

  const handleSelectChildTrace = (childTraceId: string) => {
    router.push(`${basePath}/${childTraceId}`)
  }

  const handleSelectParentTrace = (parentTraceId: string) => {
    router.push(`${basePath}/${parentTraceId}`)
  }

  if (!enabled) {
    return (
      <div className="container py-6">
        <p className="text-muted-foreground">Observability is disabled.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading trace...</p>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="container py-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load trace</p>
          <button
            onClick={handleBack}
            className="mt-4 text-primary hover:underline"
          >
            Back to traces
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6">
      <TraceDetail
        trace={data.trace}
        spans={data.spans}
        childTraces={data.childTraces}
        childSpansMap={data.childSpansMap}
        parentTrace={data.parentTrace}
        onBack={handleBack}
        onSelectChildTrace={handleSelectChildTrace}
        onSelectParentTrace={handleSelectParentTrace}
      />
    </div>
  )
}

export default TraceDetailPagePreset
