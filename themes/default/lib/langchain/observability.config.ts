/**
 * Observability Configuration (Client-Safe)
 *
 * This file exports ONLY observability config without server dependencies.
 * Use this in 'use client' components to avoid importing server-only code.
 */

import type { ObservabilityConfig } from '@/plugins/langchain/types/observability.types'

// ============================================================================
// OBSERVABILITY CONFIGURATION (CLIENT-SAFE)
// ============================================================================

export const observabilityConfig: { observability: ObservabilityConfig } = {
  observability: {
    enabled: true,
    retention: {
      traces: 7, // Days to keep trace data
    },
    sampling: {
      rate: 1.0, // 100% sampling in development
      alwaysTraceErrors: true,
    },
    pii: {
      maskInputs: true,
      maskOutputs: true,
      truncateAt: 10000,
    },
  },
}
