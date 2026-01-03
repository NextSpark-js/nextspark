import React from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { StatsCounterBlockProps, StatItem } from './schema'

/**
 * Stats Counter Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta, stats
 * - Design: backgroundColor, columns, variant, size
 * - Advanced: className, id
 */
export function StatsCounterBlock({
  // Base content props
  title,
  content,
  cta,
  // Stats-specific content
  stats,
  // Base design props
  backgroundColor,
  // Stats-specific design
  columns = '4',
  variant = 'default',
  size = 'md',
  // Base advanced props
  className,
  id,
}: StatsCounterBlockProps) {
  // Safely handle stats array
  const safeStats = Array.isArray(stats) ? stats : []

  // Build column classes based on columns prop
  const columnClasses: Record<string, string> = {
    '2': 'sm:grid-cols-2',
    '3': 'sm:grid-cols-2 lg:grid-cols-3',
    '4': 'sm:grid-cols-2 lg:grid-cols-4',
  }

  // Size classes for numbers
  const sizeClasses: Record<string, string> = {
    sm: 'text-3xl md:text-4xl',
    md: 'text-4xl md:text-5xl',
    lg: 'text-5xl md:text-6xl lg:text-7xl',
  }

  // Variant-specific stat item classes
  const getStatItemClasses = () => {
    const baseClasses = 'flex flex-col items-center text-center'

    switch (variant) {
      case 'cards':
        return cn(baseClasses, 'p-6 rounded-lg border bg-card shadow-sm')
      case 'minimal':
        return cn(baseClasses, 'p-4')
      default:
        return cn(baseClasses, 'p-6')
    }
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.statsCounter.container')}>
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        {(title || content) && (
          <div className="mb-12 text-center">
            {title && (
              <h2 className="mb-4 text-4xl font-bold md:text-5xl">
                {title}
              </h2>
            )}
            {content && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {content}
              </p>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className={cn('grid gap-8', columnClasses[columns] || columnClasses['4'])}>
          {safeStats.map((stat: StatItem, index: number) => (
            <div key={index} className={getStatItemClasses()}>
              <div className={cn('font-bold mb-2', sizeClasses[size] || sizeClasses['md'])}>
                {stat.prefix && (
                  <span className="text-primary">{stat.prefix}</span>
                )}
                {stat.value}
                {stat.suffix && (
                  <span className="text-primary">{stat.suffix}</span>
                )}
              </div>
              <div className="text-sm md:text-base text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Optional CTA */}
        {cta && (
          <div className="mt-12 text-center">
            <a
              href={cta.link}
              target={cta.target}
              rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {cta.text}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
