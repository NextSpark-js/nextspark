/**
 * Deploy Modal
 *
 * Shows deployment progress via SSE (same pattern as generation).
 * Steps: Building → Starting → Routing → Done
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Loader2, CheckCircle2, AlertCircle, ExternalLink,
  Package, Server, Globe, Rocket, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

type DeployStep = 'idle' | 'building' | 'starting' | 'routing' | 'done' | 'error'

interface DeployModalProps {
  slug: string
  onClose: () => void
}

const STEPS: { id: DeployStep; label: string; icon: typeof Package }[] = [
  { id: 'building', label: 'Building project', icon: Package },
  { id: 'starting', label: 'Starting PM2 process', icon: Server },
  { id: 'routing', label: 'Configuring routing', icon: Globe },
  { id: 'done', label: 'Deployed!', icon: Rocket },
]

export function DeployModal({ slug, onClose }: DeployModalProps) {
  const [currentStep, setCurrentStep] = useState<DeployStep>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [deployUrl, setDeployUrl] = useState<string | null>(null)
  const [deployPort, setDeployPort] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const startDeploy = useCallback(async () => {
    setCurrentStep('building')
    setLogs([])
    setError(null)
    setDeployUrl(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Deploy failed' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            const step = event.step as DeployStep
            const message = event.message as string

            if (step === 'error') {
              setError(message)
              setCurrentStep('error')
              toast.error('Deploy failed')
            } else if (step === 'done') {
              setCurrentStep('done')
              try {
                const data = JSON.parse(message)
                setDeployUrl(data.url)
                setDeployPort(data.port)
                toast.success(`Deployed to ${data.url}`)
              } catch {
                setDeployUrl(message)
                toast.success('Deploy complete')
              }
            } else {
              setCurrentStep(step)
              setLogs(prev => [...prev, message])
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
      setCurrentStep('error')
    }
  }, [slug])

  // Auto-start on mount
  useEffect(() => {
    startDeploy()
    return () => { abortRef.current?.abort() }
  }, [startDeploy])

  const stepIndex = STEPS.findIndex(s => s.id === currentStep)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] rounded-xl border border-border bg-bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">Deploy to VPS</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-4 space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isComplete = stepIndex > i || currentStep === 'done'
            const isPending = stepIndex < i && currentStep !== 'done' && currentStep !== 'error'

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                  isActive && currentStep !== 'done'
                    ? 'bg-accent-muted/20 border border-accent/20'
                    : isComplete
                      ? 'bg-success/5'
                      : 'opacity-40'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0">
                  {isActive && currentStep !== 'done' && currentStep !== 'error' ? (
                    <Loader2 className="h-4 w-4 text-accent animate-spin" />
                  ) : isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : currentStep === 'error' && isActive ? (
                    <AlertCircle className="h-4 w-4 text-error" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isPending ? 'text-text-muted/40' : 'text-text-muted'}`} />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  isActive && currentStep !== 'done' ? 'text-accent' :
                  isComplete ? 'text-success' :
                  'text-text-muted'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-error/20 bg-error/5 p-3">
            <p className="text-xs text-error">{error}</p>
            <button
              onClick={startDeploy}
              className="mt-2 text-[11px] font-medium text-error hover:text-error/80 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Deploy URL result */}
        {currentStep === 'done' && deployUrl && (
          <div className="mx-5 mb-3 rounded-lg border border-success/20 bg-success/5 p-3">
            <p className="text-[10px] text-text-muted mb-1">Deployment URL</p>
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              {deployUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
            {deployPort && (
              <p className="mt-1 text-[10px] text-text-muted">
                Port: {deployPort}
              </p>
            )}
          </div>
        )}

        {/* Build logs (collapsible) */}
        {logs.length > 0 && (
          <div className="mx-5 mb-4">
            <button
              onClick={() => setLogsExpanded(!logsExpanded)}
              className="flex w-full items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Build logs ({logs.length})
              <ChevronDown className={`h-3 w-3 transition-transform ${logsExpanded ? 'rotate-180' : ''}`} />
            </button>
            {logsExpanded && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-bg p-2 font-mono text-[9px] text-text-muted leading-relaxed">
                {logs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            {currentStep === 'done' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
