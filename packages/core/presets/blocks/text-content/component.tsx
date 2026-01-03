import React from 'react'
import { cn } from '@/core/lib/utils'
import { buildSectionClasses } from '@/core/types/blocks'
import type { TextContentBlockProps } from './schema'

/**
 * Text Content Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content (rich-text), cta
 * - Design: backgroundColor, maxWidth, alignment
 * - Advanced: className, id
 *
 * Note: `content` is the main rich-text body of this block
 */
export function TextContentBlock({
  // Base content props
  title,
  content,
  cta,
  // Base design props
  backgroundColor,
  // Text-content-specific design
  maxWidth = 'lg',
  alignment = 'left',
  // Base advanced props
  className,
  id,
}: TextContentBlockProps) {
  const maxWidthClasses: Record<string, string> = {
    sm: 'max-w-2xl',
    md: 'max-w-3xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
    full: 'max-w-none',
  }

  const alignmentClasses: Record<string, string> = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy="block-text-content">
      <div className="container mx-auto">
        {/* Optional Section Title */}
        {title && (
          <div className={cn(
            'mb-8',
            maxWidthClasses[maxWidth],
            alignmentClasses[alignment]
          )}>
            <h2 className="text-3xl font-bold md:text-4xl">
              {title}
            </h2>
          </div>
        )}

        {/* Rich Text Content */}
        <div
          className={cn(
            'prose prose-lg dark:prose-invert',
            maxWidthClasses[maxWidth],
            alignmentClasses[alignment]
          )}
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Optional CTA */}
        {cta && (
          <div className={cn(
            'mt-8',
            maxWidthClasses[maxWidth],
            alignmentClasses[alignment]
          )}>
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
