'use client'

import React from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@nextsparkjs/core/components/ui/accordion'
import type { FaqAccordionBlockProps, FaqItem } from './schema'

/**
 * FAQ Accordion Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, subtitle, items
 * - Design: backgroundColor, allowMultiple, defaultOpenFirst, variant
 * - Advanced: className, id
 */
export function FaqAccordionBlock({
  // Base content props
  title,
  // FAQ-specific content
  subtitle,
  items,
  // Base design props
  backgroundColor,
  // FAQ-specific design
  allowMultiple = false,
  defaultOpenFirst = true,
  variant = 'default',
  // Base advanced props
  className,
  id,
}: FaqAccordionBlockProps) {
  // Safe fallback for items array
  const safeItems = items ?? []

  // Determine default value for accordion
  const defaultValue = defaultOpenFirst && safeItems.length > 0 ? 'item-0' : undefined

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  // Variant-specific classes for accordion container
  const accordionContainerClasses = cn({
    // Default: clean minimal style
    'space-y-0': variant === 'default',
    // Bordered: contained with border
    'border rounded-lg overflow-hidden': variant === 'bordered',
    // Separated: gaps between items
    'space-y-4': variant === 'separated',
  })

  // Variant-specific classes for accordion items
  const getItemClasses = () => {
    if (variant === 'bordered') {
      return cn(
        'border-b last:border-b-0',
        'px-6'
      )
    }
    if (variant === 'separated') {
      return 'border rounded-lg px-6 bg-card'
    }
    // Default variant
    return ''
  }

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.faqAccordion.container')}>
      <div className="container mx-auto max-w-4xl">
        {/* Section Header */}
        {(title || subtitle) && (
          <div className="mb-12 text-center">
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

        {/* FAQ Accordion - Render different types based on allowMultiple */}
        {allowMultiple ? (
          <Accordion
            type="multiple"
            className={accordionContainerClasses}
          >
            {safeItems.map((item: FaqItem, index: number) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className={getItemClasses()}
                data-cy={sel('blocks.faqAccordion.item', { index: String(index) })}
              >
                <AccordionTrigger
                  className="text-base font-semibold hover:no-underline"
                  data-cy={sel('blocks.faqAccordion.question', { index: String(index) })}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className="text-muted-foreground whitespace-pre-wrap"
                  data-cy={sel('blocks.faqAccordion.answer', { index: String(index) })}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Accordion
            type="single"
            defaultValue={defaultValue}
            collapsible
            className={accordionContainerClasses}
          >
            {safeItems.map((item: FaqItem, index: number) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className={getItemClasses()}
                data-cy={sel('blocks.faqAccordion.item', { index: String(index) })}
              >
                <AccordionTrigger
                  className="text-base font-semibold hover:no-underline"
                  data-cy={sel('blocks.faqAccordion.question', { index: String(index) })}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className="text-muted-foreground whitespace-pre-wrap"
                  data-cy={sel('blocks.faqAccordion.answer', { index: String(index) })}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </section>
  )
}
