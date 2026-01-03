import React from 'react'
import { Quote } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@nextsparkjs/core/components/ui/avatar'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { TestimonialsBlockProps, TestimonialItem } from './schema'

/**
 * Testimonials Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, cta, items
 * - Design: backgroundColor, columns
 * - Advanced: className, id
 */
export function TestimonialsBlock({
  // Base content props
  title,
  content,
  cta,
  // Testimonials-specific content
  items,
  // Base design props
  backgroundColor = 'gray-50',
  // Testimonials-specific design
  columns = '3',
  // Base advanced props
  className,
  id,
}: TestimonialsBlockProps) {
  // Build column classes based on columns prop
  const columnClasses: Record<string, string> = {
    '2': 'md:grid-cols-2',
    '3': 'md:grid-cols-2 lg:grid-cols-3',
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : []

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.testimonials.container')}>
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

        {/* Testimonials Grid */}
        <div className={cn('grid gap-8', columnClasses[columns] || columnClasses['3'])}>
          {safeItems.map((item: TestimonialItem, index: number) => (
            <div
              key={index}
              className="flex flex-col p-6 rounded-lg border bg-card"
            >
              <Quote className="h-8 w-8 text-primary mb-4" />

              <blockquote className="mb-6 text-lg flex-grow">
                "{item.quote}"
              </blockquote>

              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={item.avatar} alt={item.author} />
                  <AvatarFallback>
                    {item.author.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="font-semibold">{item.author}</div>
                  {item.role && (
                    <div className="text-sm text-muted-foreground">{item.role}</div>
                  )}
                </div>
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
