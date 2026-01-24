import React from 'react'
import * as Icons from 'lucide-react'
import { cn } from '@/core/lib/utils'
import { buildSectionClasses } from '@/core/types/blocks'
import type { FeaturesGridBlockProps, FeatureItem } from './schema'

/**
 * Features Grid Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta, items
 * - Design: backgroundColor, columns
 * - Advanced: className, id
 */
export function FeaturesGridBlock({
  // Base content props
  title,
  content,
  cta,
  // Features-specific content
  items,
  // Base design props
  backgroundColor,
  // Features-specific design
  columns = '3',
  // Base advanced props
  className,
  id,
  // Legacy props for backward compatibility
  ...legacyProps
}: FeaturesGridBlockProps & { features?: FeatureItem[]; description?: string }) {
  // Handle legacy 'features' prop for backward compatibility
  const safeItems = Array.isArray(items)
    ? items
    : Array.isArray((legacyProps as { features?: FeatureItem[] }).features)
      ? (legacyProps as { features: FeatureItem[] }).features
      : []

  // Handle legacy description prop
  const displayContent = content || (legacyProps as { description?: string }).description

  // Build column classes based on columns prop
  const columnClasses: Record<string, string> = {
    '2': '@sm:grid-cols-2',
    '3': '@sm:grid-cols-2 @lg:grid-cols-3',
    '4': '@sm:grid-cols-2 @lg:grid-cols-4',
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 @md:py-24',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy="block-features-grid">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        {(title || displayContent) && (
          <div className="mb-12 text-center">
            {title && (
              <h2 className="mb-4 text-4xl font-bold @md:text-5xl">
                {title}
              </h2>
            )}
            {displayContent && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {displayContent}
              </p>
            )}
          </div>
        )}

        {/* Features Grid */}
        <div className={cn('grid gap-8', columnClasses[columns] || columnClasses['3'])}>
          {safeItems.map((item, index) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const IconComponent = (Icons as any)[item.icon] || Icons.Circle

            return (
              <div
                key={index}
                className="flex flex-col items-center text-center p-6 rounded-lg border bg-card"
              >
                <div className="mb-4 rounded-full bg-primary/10 p-4">
                  <IconComponent className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
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
