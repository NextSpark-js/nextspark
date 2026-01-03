import React from 'react'
import Image from 'next/image'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { LogoCloudBlockProps, LogoItem } from './schema'

/**
 * Logo Cloud Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta, logos
 * - Design: backgroundColor, layout, columns, grayscale, size
 * - Advanced: className, id
 */
export function LogoCloudBlock({
  // Base content props
  title,
  content,
  cta,
  // Logo Cloud-specific content
  logos,
  // Base design props
  backgroundColor,
  // Logo Cloud-specific design
  layout = 'grid',
  columns = '5',
  grayscale = true,
  size = 'md',
  // Base advanced props
  className,
  id,
}: LogoCloudBlockProps) {
  // Ensure logos is an array
  const safeLogos = Array.isArray(logos) ? logos : []

  // Build layout classes based on layout prop
  const layoutClasses: Record<string, string> = {
    grid: 'grid',
    row: 'flex flex-wrap',
    'row-scroll': 'flex overflow-x-auto',
  }

  // Build column classes for grid layout
  const columnClasses: Record<string, string> = {
    '3': 'grid-cols-2 sm:grid-cols-3',
    '4': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    '5': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    '6': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }

  // Build size classes for logo containers
  const sizeClasses: Record<string, string> = {
    sm: 'h-12 w-24',
    md: 'h-16 w-32',
    lg: 'h-20 w-40',
  }

  // Container classes based on layout
  const containerClasses = cn(
    layoutClasses[layout],
    layout === 'grid' && cn('gap-8', columnClasses[columns]),
    layout === 'row' && 'gap-6 justify-center items-center',
    layout === 'row-scroll' && 'gap-6 overflow-x-auto pb-4',
  )

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-12 px-4 md:py-16',
    { backgroundColor, className }
  )

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.logoCloud.container')}>
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        {(title || content) && (
          <div className="mb-10 text-center">
            {title && (
              <h2 className="mb-3 text-2xl font-semibold md:text-3xl">
                {title}
              </h2>
            )}
            {content && (
              <p className="mx-auto max-w-2xl text-muted-foreground">
                {content}
              </p>
            )}
          </div>
        )}

        {/* Logos Container */}
        <div className={containerClasses}>
          {safeLogos.map((logo: LogoItem, index: number) => {
            const LogoImage = (
              <div
                className={cn(
                  'relative flex items-center justify-center transition-all duration-300',
                  sizeClasses[size],
                  grayscale && 'grayscale hover:grayscale-0 opacity-70 hover:opacity-100'
                )}
              >
                <Image
                  src={logo.image}
                  alt={logo.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                />
              </div>
            )

            return (
              <div
                key={index}
                className="flex items-center justify-center"
              >
                {logo.url ? (
                  <a
                    href={logo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                    data-cy={sel('blocks.logoCloud.link', { index: String(index) })}
                  >
                    {LogoImage}
                  </a>
                ) : (
                  <div data-cy={sel('blocks.logoCloud.item', { index: String(index) })}>
                    {LogoImage}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Optional CTA */}
        {cta && (
          <div className="mt-10 text-center">
            <a
              href={cta.link}
              target={cta.target}
              rel={cta.target === '_blank' ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {cta.text}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
