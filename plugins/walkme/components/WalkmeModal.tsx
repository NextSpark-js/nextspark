'use client'

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import type { TourStep } from '../types/walkme.types'
import { WalkmeProgress } from './WalkmeProgress'
import { WalkmeControls } from './WalkmeControls'

interface WalkmeModalProps {
  step: TourStep
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  isFirst: boolean
  isLast: boolean
  currentIndex: number
  totalSteps: number
  labels?: {
    close?: string
    next?: string
    prev?: string
    skip?: string
    complete?: string
    progress?: string
  }
}

/**
 * Centered modal dialog for tour steps.
 * Includes focus trap and keyboard handling.
 * Uses theme-aware CSS variables for premium dark/light mode support.
 */
export const WalkmeModal = memo(function WalkmeModal({
  step,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirst,
  isLast,
  currentIndex,
  totalSteps,
  labels,
}: WalkmeModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus trap: keep focus within the modal
  useEffect(() => {
    containerRef.current?.focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [step.id])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      ref={containerRef}
      data-cy="walkme-modal"
      data-walkme
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      aria-describedby={`walkme-modal-content-${step.id}`}
      tabIndex={-1}
      className="fixed left-1/2 top-1/2 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 outline-none animate-in fade-in-0 zoom-in-95 duration-300"
      style={{
        zIndex: 9999,
        backgroundColor: 'var(--walkme-bg, #ffffff)',
        color: 'var(--walkme-text, #111827)',
        border: '1px solid var(--walkme-border, #e5e7eb)',
        boxShadow: 'var(--walkme-shadow, 0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1))',
      }}
    >
      {/* Close button */}
      <button
        data-cy="walkme-btn-close"
        onClick={onSkip}
        type="button"
        className="absolute right-3 top-3 rounded-lg p-1.5 transition-all duration-150 hover:scale-110 hover:bg-black/5 active:scale-95"
        style={{
          color: 'var(--walkme-text-muted, #6b7280)',
          backgroundColor: 'transparent',
        }}
        aria-label={labels?.close ?? 'Close'}
      >
        <X size={16} weight="bold" />
      </button>

      {/* Title */}
      <h2 className="mb-2 pr-8 text-lg font-semibold tracking-tight">{step.title}</h2>

      {/* Content */}
      <p
        id={`walkme-modal-content-${step.id}`}
        className="mb-5 text-sm leading-relaxed"
        style={{ color: 'var(--walkme-text-muted, #6b7280)' }}
      >
        {step.content}
      </p>

      {/* Progress */}
      <div className="mb-4">
        <WalkmeProgress current={currentIndex} total={totalSteps} progressTemplate={labels?.progress} />
      </div>

      {/* Controls */}
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
  )
})
