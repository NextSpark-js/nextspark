'use client'

import { Check, Circle, Zap } from 'lucide-react'
import type { GenerationStep, StudioPhase } from '@/lib/types'
import type { StudioResult } from '@nextsparkjs/studio'

interface GenerationProgressProps {
  steps: GenerationStep[]
  phase: StudioPhase
  slug?: string | null
  result?: StudioResult | null
}

function StepIcon({ status }: { status: GenerationStep['status'] }) {
  if (status === 'complete') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 animate-check">
        <Check className="h-3 w-3 text-success" />
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-accent/20 animate-ping" />
        <span className="relative h-2 w-2 rounded-full bg-accent" />
      </div>
    )
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center">
      <Circle className="h-3 w-3 text-text-muted/30" />
    </div>
  )
}

export function GenerationProgress({ steps, phase, slug, result }: GenerationProgressProps) {
  const entityCount = result?.entities?.length
  const pageCount = result?.pages?.length

  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="text-center space-y-8 max-w-sm w-full px-6">
        {/* Animated icon */}
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-accent/5" />
          <div className="absolute inset-0 rounded-full border-2 border-accent/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
          <div className="absolute -inset-2 rounded-full bg-accent/5 animate-pulse-ring" />
          <Zap className="h-6 w-6 text-accent absolute inset-0 m-auto" />
        </div>

        {/* Steps list */}
        {steps.length > 0 && (
          <div className="space-y-1 text-left">
            {steps.map((step) => (
              <div key={step.id} className="animate-in">
                <div className="flex items-center gap-3 py-1.5">
                  <StepIcon status={step.status} />
                  <span
                    className={`text-sm transition-colors ${
                      step.status === 'complete'
                        ? 'text-text-muted'
                        : step.status === 'active'
                        ? 'text-accent font-medium'
                        : 'text-text-muted/40'
                    }`}
                  >
                    {step.label}
                    {step.count && step.count > 0 && (
                      <span className="ml-1.5 text-xs text-text-muted/60">({step.count})</span>
                    )}
                    {step.status === 'active' && (
                      <span className="text-text-muted/40">...</span>
                    )}
                  </span>
                </div>
                {/* Detail line for active steps */}
                {step.status === 'active' && step.detail && (
                  <div className="ml-8 pb-1">
                    <p className="text-[11px] font-mono text-text-muted/50 truncate max-w-[280px]">
                      {step.detail}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fallback when no steps yet */}
        {steps.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-text-primary">Building your app</p>
            <p className="text-xs text-text-muted">AI is generating your project...</p>
          </div>
        )}

        {/* Project summary */}
        {(slug || entityCount || pageCount) && (
          <div className="space-y-1">
            {slug && (
              <p className="text-xs font-mono text-text-muted/60">{slug}</p>
            )}
            {(entityCount || pageCount) && (
              <p className="text-[11px] text-text-muted/40">
                {[
                  entityCount ? `${entityCount} ${entityCount === 1 ? 'entity' : 'entities'}` : null,
                  pageCount ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
