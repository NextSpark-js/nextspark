'use client'

/**
 * Reading Progress Component
 *
 * Fixed progress bar at the top of the page that tracks
 * scroll progress through an article.
 */

import { useState, useEffect } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface ReadingProgressProps {
  className?: string
  height?: number
}

export function ReadingProgress({
  className,
  height = 3
}: ReadingProgressProps) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const calculateProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0

      setProgress(Math.min(100, Math.max(0, scrollPercent)))
      setIsVisible(scrollTop > 100)
    }

    // Calculate initial progress
    calculateProgress()

    // Add scroll listener with passive for better performance
    window.addEventListener('scroll', calculateProgress, { passive: true })

    return () => {
      window.removeEventListener('scroll', calculateProgress)
    }
  }, [])

  return (
    <div
      data-cy="reading-progress"
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        data-cy="reading-progress-bar"
        className="h-full bg-primary transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default ReadingProgress
