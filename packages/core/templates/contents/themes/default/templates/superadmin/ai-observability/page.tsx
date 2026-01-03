'use client'

/**
 * AI Observability Dashboard Page
 *
 * Theme implementation of the LangChain observability dashboard.
 * Uses the plugin preset and applies theme-specific configuration.
 */

import { observabilityConfig } from '@/themes/default/lib/langchain/observability.config'
import { AIObservabilityPagePreset } from '@/plugins/langchain/presets/templates/sector7/ai-observability/page'

export default function AIObservabilityPage() {
  return (
    <AIObservabilityPagePreset enabled={observabilityConfig.observability?.enabled ?? false} />
  )
}
