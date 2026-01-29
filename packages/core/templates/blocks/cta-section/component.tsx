import React from 'react'
import { Button } from '@/core/components/ui/button'
import { buildSectionClasses } from '@/core/types/blocks'
import type { CTASectionBlockProps } from './schema'

/**
 * CTA Section Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta (primary), secondaryButton
 * - Design: backgroundColor
 * - Advanced: className, id
 */
export function CTASectionBlock({
  // Base content props
  title,
  content,
  cta,
  // CTA-specific content
  secondaryButton,
  // Base design props
  backgroundColor,
  // Base advanced props
  className,
  id,
  // Legacy props for backward compatibility
  ...legacyProps
}: CTASectionBlockProps & {
  buttonText?: string
  buttonLink?: string
  primaryButton?: { text: string; link: string; variant?: string }
  description?: string
}) {
  // Handle legacy format (buttonText/buttonLink or primaryButton)
  const primaryCta = cta || (legacyProps.primaryButton ? {
    text: legacyProps.primaryButton.text,
    link: legacyProps.primaryButton.link,
    target: '_self' as const,
  } : legacyProps.buttonText ? {
    text: legacyProps.buttonText,
    link: legacyProps.buttonLink || '#',
    target: '_self' as const,
  } : undefined)

  // Handle legacy description prop
  const displayContent = content || (legacyProps as { description?: string }).description

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 @md:py-24',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy="block-cta-section">
      <div className="container mx-auto max-w-4xl text-center">
        {title && (
          <h2 className="mb-4 text-4xl font-bold @md:text-5xl">{title}</h2>
        )}

        {displayContent && (
          <p className="mb-8 text-lg @md:text-xl opacity-90">{displayContent}</p>
        )}

        {(primaryCta || secondaryButton) && (
          <div className="flex flex-col gap-4 @sm:flex-row @sm:justify-center">
            {primaryCta && (
              <Button asChild size="lg">
                <a
                  href={primaryCta.link}
                  target={primaryCta.target}
                  rel={primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined}
                >
                  {primaryCta.text}
                </a>
              </Button>
            )}

            {secondaryButton && (
              <Button
                asChild
                size="lg"
                variant={secondaryButton.variant || 'outline'}
              >
                <a
                  href={secondaryButton.link}
                  target={secondaryButton.target}
                  rel={secondaryButton.target === '_blank' ? 'noopener noreferrer' : undefined}
                >
                  {secondaryButton.text}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
