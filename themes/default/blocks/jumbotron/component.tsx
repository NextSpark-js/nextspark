import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { JumbotronBlockProps } from './schema'

/**
 * Jumbotron Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, subtitle, primaryCta, secondaryCta
 * - Design: backgroundColor, fullscreen, backgroundImage, textColor, textAlign
 * - Advanced: className, id
 */
export function JumbotronBlock({
  // Base content props
  title,
  // Jumbotron-specific content
  subtitle,
  primaryCta,
  secondaryCta,
  // Base design props
  backgroundColor,
  // Jumbotron-specific design
  fullscreen = false,
  backgroundImage,
  textColor = 'light',
  textAlign = 'center',
  // Base advanced props
  className,
  id,
}: JumbotronBlockProps) {
  // Determine alignment classes
  const align = textAlign as 'center' | 'left' | 'right'
  const alignmentClasses = {
    center: 'text-center items-center justify-center',
    left: 'text-left items-start justify-start',
    right: 'text-right items-end justify-end',
  }[align]

  const contentAlignmentClasses = {
    center: 'mx-auto',
    left: 'mr-auto',
    right: 'ml-auto',
  }[align]

  const ctaJustifyClasses = {
    center: '@sm:justify-center',
    left: '@sm:justify-start',
    right: '@sm:justify-end',
  }[align]

  // Build section classes with fullscreen or standard padding
  const sectionClasses = buildSectionClasses(
    cn(
      'relative flex overflow-hidden px-4',
      fullscreen ? 'min-h-screen' : 'py-16 @md:py-24',
      alignmentClasses,
      textColor === 'light' ? 'text-white' : 'text-gray-900'
    ),
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.jumbotron.container')}>
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
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Content */}
      <div className={cn('container relative z-10 max-w-4xl', contentAlignmentClasses)}>
        {title && (
          <h1 className="mb-6 text-5xl font-bold leading-tight @md:text-6xl @lg:text-7xl">
            {title}
          </h1>
        )}

        {subtitle && (
          <p className="mb-8 text-xl @md:text-2xl opacity-90">
            {subtitle}
          </p>
        )}

        {/* CTAs - automatically center based on count */}
        {(primaryCta || secondaryCta) && (
          <div className={cn('flex flex-col gap-4 @sm:flex-row', ctaJustifyClasses)}>
            {primaryCta && primaryCta.text && (
              <Button
                asChild
                size="lg"
                variant={primaryCta.variant || 'default'}
                className="text-lg px-8 py-6"
              >
                <a
                  href={primaryCta.link || '#'}
                  target={primaryCta.target || '_self'}
                  rel={primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined}
                >
                  {primaryCta.text}
                </a>
              </Button>
            )}

            {secondaryCta && secondaryCta.text && (
              <Button
                asChild
                size="lg"
                variant={secondaryCta.variant || 'outline'}
                className="text-lg px-8 py-6"
              >
                <a
                  href={secondaryCta.link || '#'}
                  target={secondaryCta.target || '_self'}
                  rel={secondaryCta.target === '_blank' ? 'noopener noreferrer' : undefined}
                >
                  {secondaryCta.text}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
