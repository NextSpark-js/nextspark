import React from 'react'
import * as Icons from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { TimelineBlockProps, TimelineItem } from './schema'

/**
 * Timeline Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, subtitle, items
 * - Design: backgroundColor, layout, alternating, showConnector, variant
 * - Advanced: className, id
 */
export function TimelineBlock({
  // Base content props
  title,
  // Timeline-specific content
  subtitle,
  items,
  // Base design props
  backgroundColor,
  // Timeline-specific design
  layout = 'vertical',
  alternating = true,
  showConnector = true,
  variant = 'default',
  // Base advanced props
  className,
  id,
}: TimelineBlockProps) {
  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  // Safe items array
  const safeItems = Array.isArray(items) ? items : []

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.timeline.container')}>
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        {(title || subtitle) && (
          <div className="mb-16 text-center">
            {title && (
              <h2 className="mb-4 text-4xl font-bold md:text-5xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Timeline */}
        {layout === 'vertical' ? (
          <VerticalTimeline
            items={safeItems}
            alternating={alternating}
            showConnector={showConnector}
            variant={variant}
          />
        ) : (
          <HorizontalTimeline
            items={safeItems}
            showConnector={showConnector}
            variant={variant}
          />
        )}
      </div>
    </section>
  )
}

/**
 * Vertical Timeline Layout
 */
function VerticalTimeline({
  items,
  alternating,
  showConnector,
  variant,
}: {
  items: TimelineItem[]
  alternating: boolean
  showConnector: boolean
  variant: 'default' | 'minimal' | 'cards'
}) {
  return (
    <div className="relative">
      {/* Connector Line */}
      {showConnector && (
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2 hidden md:block" />
      )}
      {showConnector && (
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border md:hidden" />
      )}

      {/* Timeline Items */}
      <div className="space-y-12">
        {items.map((item, index) => {
          const isLeft = alternating && index % 2 === 0

          return (
            <div
              key={index}
              className={cn(
                'relative flex items-center gap-8',
                alternating ? 'md:justify-center' : 'md:justify-start md:pl-[50%]',
                'justify-start pl-16 md:pl-0'
              )}
            >
              {/* Mobile/Left Content */}
              <div className={cn(
                'flex-1',
                alternating && !isLeft && 'md:text-right md:order-1',
                !alternating && 'md:pl-8'
              )}>
                <TimelineItemContent item={item} variant={variant} align={alternating && !isLeft ? 'right' : 'left'} />
              </div>

              {/* Center Dot */}
              <div className="absolute left-8 md:left-1/2 md:-translate-x-1/2 flex-shrink-0">
                <TimelineIcon item={item} />
              </div>

              {/* Desktop Spacer (for alternating layout) */}
              {alternating && (
                <div className="hidden md:block flex-1" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Horizontal Timeline Layout
 * Note: Becomes vertical on mobile for better UX
 */
function HorizontalTimeline({
  items,
  showConnector,
  variant,
}: {
  items: TimelineItem[]
  showConnector: boolean
  variant: 'default' | 'minimal' | 'cards'
}) {
  return (
    <div className="relative">
      {/* Mobile: Vertical Layout */}
      <div className="md:hidden">
        {showConnector && (
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
        )}
        <div className="space-y-12">
          {items.map((item, index) => (
            <div key={index} className="relative pl-16">
              <div className="absolute left-8 -translate-x-1/2">
                <TimelineIcon item={item} />
              </div>
              <TimelineItemContent item={item} variant={variant} align="left" />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Horizontal Layout */}
      <div className="hidden md:block overflow-x-auto pb-4">
        <div className="relative min-w-max">
          {/* Connector Line */}
          {showConnector && (
            <div className="absolute left-0 right-0 top-12 h-0.5 bg-border" />
          )}

          {/* Timeline Items */}
          <div className="flex gap-8 pt-8">
            {items.map((item, index) => (
              <div key={index} className="relative flex flex-col items-center w-64 flex-shrink-0">
                {/* Icon */}
                <div className="relative z-10 mb-8">
                  <TimelineIcon item={item} />
                </div>

                {/* Content */}
                <TimelineItemContent item={item} variant={variant} align="center" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Timeline Icon Component
 */
function TimelineIcon({ item }: { item: TimelineItem }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = item.icon ? ((Icons as any)[item.icon] || Icons.Circle) : Icons.Circle

  return (
    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground border-4 border-background">
      <IconComponent className="h-5 w-5" />
    </div>
  )
}

/**
 * Timeline Item Content
 */
function TimelineItemContent({
  item,
  variant,
  align,
}: {
  item: TimelineItem
  variant: 'default' | 'minimal' | 'cards'
  align: 'left' | 'right' | 'center'
}) {
  const alignClasses = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  }

  const contentClasses = cn(
    alignClasses[align],
    variant === 'cards' && 'p-6 rounded-lg border bg-card shadow-sm',
    variant === 'default' && 'p-4 rounded-lg bg-muted/30',
    variant === 'minimal' && 'p-2'
  )

  return (
    <div className={contentClasses}>
      {/* Date Badge */}
      <div className={cn(
        'inline-block mb-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary',
        align === 'center' && 'mx-auto'
      )}>
        {item.date}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold mb-2">
        {item.title}
      </h3>

      {/* Description */}
      {item.description && (
        <p className="text-muted-foreground">
          {item.description}
        </p>
      )}
    </div>
  )
}
