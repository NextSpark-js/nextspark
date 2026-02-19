'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TourStep } from '../types/walkme.types'
import { useStepPositioning, getPlacementFromPosition } from '../lib/positioning'
import { WalkmeOverlay } from './WalkmeOverlay'
import { WalkmeProgress } from './WalkmeProgress'
import { WalkmeControls } from './WalkmeControls'

interface WalkmeSpotlightProps {
  step: TourStep
  targetElement: HTMLElement | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
  currentIndex: number
  totalSteps: number
  labels?: {
    next?: string
    prev?: string
    skip?: string
    complete?: string
    progress?: string
  }
}

/**
 * Spotlight/highlight that illuminates a specific element
 * with an overlay cutout, a subtle glow ring, and a tooltip explanation.
 * Theme-aware with CSS variables for premium dark/light mode.
 */
export const WalkmeSpotlight = memo(function WalkmeSpotlight({
  step,
  targetElement,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirst,
  isLast,
  currentIndex,
  totalSteps,
  labels,
}: WalkmeSpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles, isStable } = useStepPositioning(targetElement, {
    placement: getPlacementFromPosition(step.position ?? 'bottom'),
    offset: 16,
    padding: 8,
  })

  useEffect(() => {
    if (isStable) containerRef.current?.focus()
  }, [isStable])

  if (typeof window === 'undefined') return null

  return (
    <>
      {/* Overlay with cutout around target */}
      <WalkmeOverlay
        visible
        spotlightTarget={targetElement}
        spotlightPadding={8}
      />

      {/* Glow ring around the spotlighted target */}
      {targetElement && <SpotlightRing target={targetElement} padding={8} />}

      {/* Tooltip near the target — only render when target is resolved */}
      {targetElement && createPortal(
        <div
          ref={(el) => {
            refs.setFloating(el)
            ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
          }}
          data-cy="walkme-spotlight"
          data-walkme
          role="dialog"
          aria-label={step.title}
          aria-describedby={`walkme-spotlight-content-${step.id}`}
          tabIndex={-1}
          className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-4 outline-none"
          style={{
            ...floatingStyles,
            zIndex: 9999,
            backgroundColor: 'var(--walkme-bg)',
            color: 'var(--walkme-text)',
            border: '1px solid var(--walkme-border)',
            boxShadow: 'var(--walkme-shadow)',
            // Hide until floating-ui has stabilized after scroll
            opacity: isStable ? 1 : 0,
            transition: 'opacity 150ms ease-out',
          }}
        >
          <h3 className="mb-1 text-sm font-semibold tracking-tight">{step.title}</h3>

          <p
            id={`walkme-spotlight-content-${step.id}`}
            className="mb-3 text-sm leading-relaxed"
            style={{ color: 'var(--walkme-text-muted)' }}
          >
            {step.content}
          </p>

          <div className="mb-3">
            <WalkmeProgress current={currentIndex} total={totalSteps} progressTemplate={labels?.progress} />
          </div>

          <WalkmeControls
            actions={step.actions}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            onComplete={onComplete}
            isFirst={isFirst}
            isLast={isLast}
            labels={labels}
          />
        </div>,
        document.body,
      )}
    </>
  )
})

/**
 * Subtle animated glow ring rendered around the spotlighted element.
 * Creates a visual "pulse" that draws the eye to the highlighted area.
 * Dynamically tracks target position on scroll/resize.
 */
function SpotlightRing({
  target,
  padding,
}: {
  target: HTMLElement
  padding: number
}) {
  const [rect, setRect] = useState(() => target.getBoundingClientRect())

  useEffect(() => {
    const update = () => setRect(target.getBoundingClientRect())
    // Recalculate after scroll settles
    const timer = setTimeout(update, 100)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [target])

  return createPortal(
    <div
      data-walkme
      className="pointer-events-none fixed animate-in fade-in-0 duration-300"
      style={{
        zIndex: 9998,
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 8,
        boxShadow: '0 0 0 2px var(--walkme-primary, oklch(0.588 0.243 264.376)), 0 0 16px 4px var(--walkme-primary, oklch(0.588 0.243 264.376 / 0.3))',
      }}
      aria-hidden="true"
    />,
    document.body,
  )
}
