/**
 * WalkMe Positioning Module
 *
 * Wrapper around @floating-ui/react for smart element positioning.
 * Handles auto-flip, scroll tracking, viewport containment, and arrow placement.
 */

'use client'

import { useRef } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  type Placement,
} from '@floating-ui/react'
import type { StepPosition } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PositionConfig {
  placement: Placement
  offset?: number
  padding?: number
  fallbackPlacements?: Placement[]
}

export interface StepPositioningResult {
  refs: {
    setReference: (el: HTMLElement | null) => void
    setFloating: (el: HTMLElement | null) => void
  }
  floatingStyles: React.CSSProperties
  placement: Placement
  isPositioned: boolean
  arrowRef: React.RefObject<HTMLDivElement | null>
  middlewareData: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Map StepPosition to @floating-ui Placement */
export function getPlacementFromPosition(position: StepPosition): Placement {
  switch (position) {
    case 'top':
      return 'top'
    case 'bottom':
      return 'bottom'
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    case 'auto':
    default:
      return 'bottom'
  }
}

/** Get current viewport information */
export function getViewportInfo(): {
  width: number
  height: number
  scrollX: number
  scrollY: number
} {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, scrollX: 0, scrollY: 0 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for positioning a floating step element relative to a target.
 * Wraps @floating-ui/react with sensible defaults for WalkMe steps.
 */
export function useStepPositioning(
  targetElement: HTMLElement | null,
  config: PositionConfig,
): StepPositioningResult {
  const arrowRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles, placement, isPositioned, middlewareData } =
    useFloating({
      placement: config.placement,
      elements: {
        reference: targetElement,
      },
      whileElementsMounted: autoUpdate,
      middleware: [
        offset(config.offset ?? 8),
        flip({
          fallbackPlacements: config.fallbackPlacements,
          padding: config.padding ?? 8,
        }),
        shift({ padding: config.padding ?? 8 }),
        arrow({ element: arrowRef }),
      ],
    })

  return {
    refs: {
      setReference: refs.setReference,
      setFloating: refs.setFloating,
    },
    floatingStyles,
    placement,
    isPositioned,
    arrowRef,
    middlewareData,
  }
}
