import React from 'react'
import Image from 'next/image'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { SplitContentBlockProps, BulletPoint } from './schema'

/**
 * Split Content Block Component
 *
 * Props from 3-tab structure:
 * - Content: subtitle, title, content, image, imageAlt, bulletPoints, cta
 * - Design: backgroundColor, imagePosition, imageStyle, verticalAlign
 * - Advanced: className, id
 */
export function SplitContentBlock({
  // Content props
  subtitle,
  title,
  content,
  image,
  imageAlt,
  bulletPoints,
  cta,
  // Design props
  backgroundColor,
  imagePosition = 'left',
  imageStyle = 'rounded',
  verticalAlign = 'center',
  // Advanced props
  className,
  id,
}: SplitContentBlockProps) {
  // Safe fallback for bulletPoints array
  const safeBulletPoints = bulletPoints ?? []

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 @md:py-24',
    { backgroundColor, className }
  )

  // Image style classes
  const imageStyleClasses = {
    square: '',
    rounded: 'rounded-lg',
    circle: 'rounded-full',
  }

  // Vertical alignment classes
  const alignmentClasses = {
    top: 'items-start',
    center: 'items-center',
    bottom: 'items-end',
  }

  // Grid order classes based on image position
  const imageOrderClass = imagePosition === 'right' ? '@lg:order-2' : '@lg:order-1'
  const contentOrderClass = imagePosition === 'right' ? '@lg:order-1' : '@lg:order-2'

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.splitContent.container')}>
      <div className="container mx-auto max-w-7xl">
        <div className={cn('grid gap-8 @lg:grid-cols-2 @lg:gap-12', alignmentClasses[verticalAlign as 'top' | 'center' | 'bottom'])}>
          {/* Image Column */}
          <div className={cn('relative', imageOrderClass)}>
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={image}
                alt={imageAlt || title || 'Split content image'}
                fill
                className={cn('object-cover', imageStyleClasses[imageStyle as 'square' | 'rounded' | 'circle'])}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* Content Column */}
          <div className={cn('flex flex-col justify-center', contentOrderClass)}>
            {subtitle && (
              <p className="mb-2 text-sm font-medium uppercase tracking-wide text-primary">
                {subtitle}
              </p>
            )}

            {title && (
              <h2 className="mb-4 text-3xl font-bold @md:text-4xl @lg:text-5xl">
                {title}
              </h2>
            )}

            {content && (
              <p className="mb-6 text-lg text-muted-foreground">
                {content}
              </p>
            )}

            {/* Bullet Points */}
            {safeBulletPoints.length > 0 && (
              <ul className="mb-6 space-y-3">
                {safeBulletPoints.map((point: BulletPoint, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="text-base">{point.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* CTA Button */}
            {cta && cta.text && cta.link && (
              <div className="mt-2">
                <Button
                  asChild
                  size="lg"
                  variant={cta.variant || 'default'}
                >
                  <a
                    href={cta.link}
                    target={cta.target}
                    rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
                  >
                    {cta.text}
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
