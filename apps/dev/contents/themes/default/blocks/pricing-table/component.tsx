import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Check } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { PricingTableBlockProps, PlanItem } from './schema'

/**
 * Pricing Table Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, content, plans
 * - Design: backgroundColor, columns, highlightPopular
 * - Advanced: className, id
 */
export function PricingTableBlock({
  // Base content props
  title,
  content,
  // Pricing-specific content
  plans,
  // Base design props
  backgroundColor,
  // Pricing-specific design
  columns = '3',
  highlightPopular = true,
  // Base advanced props
  className,
  id,
}: PricingTableBlockProps) {
  // Parse features from newline-separated string
  const parseFeatures = (features?: string): string[] => {
    if (!features) return []
    return features.split('\n').map(f => f.trim()).filter(Boolean)
  }

  // Build column classes based on columns prop
  const columnClasses: Record<string, string> = {
    '2': 'sm:grid-cols-2',
    '3': 'sm:grid-cols-2 lg:grid-cols-3',
    '4': 'sm:grid-cols-2 lg:grid-cols-4',
  }

  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'py-16 px-4 md:py-24',
    { backgroundColor, className }
  )

  // Safe plans array (fallback to empty array)
  const safePlans = Array.isArray(plans) ? plans : []

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.pricingTable.container')}>
      <div className="container mx-auto max-w-7xl">
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

        {/* Pricing Plans Grid */}
        <div className={cn('grid gap-8', columnClasses[columns] || columnClasses['3'])}>
          {safePlans.map((plan: PlanItem, index: number) => {
            const features = parseFeatures(plan.features)
            const isHighlighted = highlightPopular && plan.isPopular

            return (
              <Card
                key={index}
                className={cn(
                  'relative flex flex-col',
                  isHighlighted && 'border-primary shadow-lg scale-105',
                  plan.isDisabled && 'opacity-60'
                )}
                data-cy={sel('blocks.pricingTable.plan', { index: String(index) })}
              >
                {/* Popular Badge */}
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Popular
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  {plan.description && (
                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                  )}
                </CardHeader>

                {/* Card Content */}
                <CardContent className="flex-1 flex flex-col">
                  {/* Features List */}
                  {features.length > 0 && (
                    <ul className="space-y-3 mb-6 flex-1" data-cy={sel('blocks.pricingTable.features')}>
                      {features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* CTA Button */}
                  {plan.ctaText && plan.ctaUrl && (
                    <Button
                      asChild
                      className="w-full"
                      variant={isHighlighted ? 'default' : 'outline'}
                      disabled={plan.isDisabled}
                      data-cy={sel('blocks.pricingTable.cta', { index: String(index) })}
                    >
                      <a href={plan.ctaUrl}>{plan.ctaText}</a>
                    </Button>
                  )}

                  {/* Disabled State Message */}
                  {plan.isDisabled && !plan.ctaText && (
                    <div className="text-center text-sm text-muted-foreground">
                      Coming Soon
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
