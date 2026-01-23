import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { HeroBlockProps } from './schema'

/**
 * Hero Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta
 * - Design: backgroundColor, backgroundImage, textColor, alignment
 * - Advanced: className, id
 */
export function HeroBlock({
  // Base content props
  title,
  content,
  cta,
  // Base design props
  backgroundColor,
  // Hero-specific design
  backgroundImage,
  textColor = 'light',
  alignment = 'center',
  // Base advanced props
  className,
  id,
  // Legacy props for backward compatibility
  ...legacyProps
}: HeroBlockProps & {
  ctaText?: string
  ctaLink?: string
  subtitle?: string
  description?: string
}) {
  // Handle legacy CTA format (ctaText, ctaLink) for backward compatibility
  const ctaConfig = cta || (legacyProps.ctaText ? {
    text: legacyProps.ctaText,
    link: legacyProps.ctaLink || '#',
    target: '_self' as const,
  } : undefined)

  // Handle legacy subtitle/description props for backward compatibility
  const displayContent = content || legacyProps.subtitle || legacyProps.description

  // Alignment classes mapping
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    cn(
      'relative flex min-h-[600px] items-center justify-center overflow-hidden px-4 py-20',
      textColor === 'light' ? 'text-white dark:text-white' : 'text-gray-900 dark:text-gray-100'
    ),
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.hero.container')}>
      {/* Background Image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'container relative z-10 mx-auto max-w-4xl flex flex-col',
        alignmentClasses[alignment]
      )}>
        {title && (
          <h1 className="mb-6 text-5xl font-bold leading-tight @md:text-6xl @lg:text-7xl">
            {title}
          </h1>
        )}

        {displayContent && (
          <p className="mb-8 text-xl @md:text-2xl opacity-90 max-w-2xl">
            {displayContent}
          </p>
        )}

        {ctaConfig && (
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <a
              href={ctaConfig.link}
              target={ctaConfig.target}
              rel={ctaConfig.target === '_blank' ? 'noopener noreferrer' : undefined}
              data-cy={sel('blocks.hero.cta')}
            >
              {ctaConfig.text}
            </a>
          </Button>
        )}
      </div>
    </section>
  )
}
