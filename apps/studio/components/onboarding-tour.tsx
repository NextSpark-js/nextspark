/**
 * Onboarding Tour Overlay
 *
 * Renders a spotlight + tooltip overlay for each tour step.
 * Highlights the target element and shows a description tooltip.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import type { TourStep } from '@/hooks/use-onboarding-tour'

interface OnboardingTourProps {
  isActive: boolean
  step: TourStep | null
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingTour({
  isActive,
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: OnboardingTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  const findTarget = useCallback(() => {
    if (!step) return null
    const el = document.querySelector(step.target)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  }, [step])

  // Update target position on step change and on resize
  useEffect(() => {
    if (!isActive || !step) {
      setTargetRect(null)
      return
    }

    const update = () => setTargetRect(findTarget())

    // Initial + small delay for animations
    update()
    const timer = setTimeout(update, 100)

    window.addEventListener('resize', update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', update)
    }
  }, [isActive, step, findTarget])

  if (!isActive || !step || !targetRect) return null

  const pad = 8 // padding around target
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1

  // Calculate tooltip position based on placement
  const tooltipStyle = getTooltipPosition(targetRect, step.placement, pad)

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Onboarding tour">
      {/* Backdrop with cutout — uses CSS clip-path for spotlight */}
      <div
        className="absolute inset-0 bg-black/60 transition-all duration-300"
        style={{
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${targetRect.left - pad}px 100%,
            ${targetRect.left - pad}px ${targetRect.top - pad}px,
            ${targetRect.left + targetRect.width + pad}px ${targetRect.top - pad}px,
            ${targetRect.left + targetRect.width + pad}px ${targetRect.top + targetRect.height + pad}px,
            ${targetRect.left - pad}px ${targetRect.top + targetRect.height + pad}px,
            ${targetRect.left - pad}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
        onClick={onSkip}
      />

      {/* Spotlight border */}
      <div
        className="absolute rounded-lg border-2 border-accent/50 shadow-[0_0_0_4px_rgba(var(--color-accent-rgb,99,102,241),0.15)] transition-all duration-300 pointer-events-none"
        style={{
          top: targetRect.top - pad,
          left: targetRect.left - pad,
          width: targetRect.width + pad * 2,
          height: targetRect.height + pad * 2,
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute w-72 rounded-xl border border-border bg-bg-surface shadow-2xl shadow-black/40 transition-all duration-300 animate-card-in"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-medium text-accent">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="flex h-5 w-5 items-center justify-center rounded text-text-muted/50 hover:text-text-secondary transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-2">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {step.title}
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-4 bg-accent'
                    : i < currentStep
                      ? 'w-1.5 bg-accent/40'
                      : 'w-1.5 bg-text-muted/20'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-0.5 rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent/90 transition-colors"
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTooltipPosition(
  rect: TargetRect,
  placement: TourStep['placement'],
  pad: number
): React.CSSProperties {
  const gap = 16
  const tooltipWidth = 288 // w-72

  switch (placement) {
    case 'bottom':
      return {
        top: rect.top + rect.height + pad + gap,
        left: Math.max(8, Math.min(
          rect.left + rect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - 8
        )),
      }
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + pad + gap,
        left: Math.max(8, Math.min(
          rect.left + rect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - 8
        )),
      }
    case 'right':
      return {
        top: Math.max(8, rect.top + rect.height / 2 - 60),
        left: rect.left + rect.width + pad + gap,
      }
    case 'left':
      return {
        top: Math.max(8, rect.top + rect.height / 2 - 60),
        right: window.innerWidth - rect.left + pad + gap,
      }
  }
}
