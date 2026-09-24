'use client'

/**
 * AI Observability Dashboard Page Preset
 *
 * Client component preset for the observability dashboard.
 * The theme template should define its own metadata since this is a client component.
 *
 * Usage in theme template:
 * ```tsx
 * // In your theme, import the langchain config from lib/langchain/langchain.config
 * // import { AIObservabilityPagePreset } from '@/plugins/langchain/presets/templates/sector7/ai-observability/page'
 *
 * export const metadata = {
 *   title: 'AI Observability',
 *   description: 'Monitor LangChain agent invocations and traces',
 * }
 *
 * export default function AIObservabilityPage() {
 *   // Pass observability.enabled prop from your theme's langchain config
 *   return <AIObservabilityPagePreset enabled={true} />
 * }
 * ```
 */

import { ObservabilityDashboard } from '@/plugins/langchain/components/observability/ObservabilityDashboard'
import { DisabledMessage } from '@/plugins/langchain/components/observability/DisabledMessage'

interface AIObservabilityPagePresetProps {
  enabled?: boolean
  /** Base path for trace detail navigation (e.g., '/superadmin/ai-observability') */
  basePath?: string
}

export function AIObservabilityPagePreset({
  enabled = true,
  basePath = '/superadmin/ai-observability'
}: AIObservabilityPagePresetProps) {
  if (!enabled) {
    return (
      <div className="container py-6">
        <DisabledMessage />
      </div>
    )
  }

  return (
    <div className="container py-6">
      <ObservabilityDashboard basePath={basePath} />
    </div>
  )
}

export default AIObservabilityPagePreset
