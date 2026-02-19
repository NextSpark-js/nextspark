/**
 * Onboarding Tour Hook
 *
 * Manages a multi-step onboarding tour with localStorage persistence.
 * Tour auto-starts on first visit and can be replayed manually.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ns-onboarding-complete'

export interface TourStep {
  /** CSS selector or data attribute to highlight */
  target: string
  /** Tooltip title */
  title: string
  /** Tooltip description */
  description: string
  /** Tooltip placement relative to target */
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export interface UseOnboardingTourReturn {
  /** Whether the tour is currently active */
  isActive: boolean
  /** Current step index (0-based) */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Current step data */
  step: TourStep | null
  /** Go to next step (or finish if last) */
  next: () => void
  /** Go to previous step */
  prev: () => void
  /** Skip/dismiss the tour */
  skip: () => void
  /** Manually start/restart the tour */
  start: () => void
  /** Whether the tour has been completed before */
  hasCompleted: boolean
}

export function useOnboardingTour(steps: TourStep[]): UseOnboardingTourReturn {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(true) // default true to avoid flash

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === 'true'
    setHasCompleted(completed)
    if (!completed) {
      // Small delay so the page has time to render targets
      const timer = setTimeout(() => setIsActive(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const markComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setHasCompleted(true)
    setIsActive(false)
    setCurrentStep(0)
  }, [])

  const next = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      markComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, steps.length, markComplete])

  const prev = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }, [])

  const skip = useCallback(() => {
    markComplete()
  }, [markComplete])

  const start = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  return {
    isActive,
    currentStep,
    totalSteps: steps.length,
    step: isActive ? steps[currentStep] ?? null : null,
    next,
    prev,
    skip,
    start,
    hasCompleted,
  }
}
