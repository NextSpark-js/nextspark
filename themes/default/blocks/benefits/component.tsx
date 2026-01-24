import { cn } from '@nextsparkjs/core/lib/utils'
import { getBackgroundClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { BenefitsProps } from './schema'

interface BenefitItem {
  title: string
  description?: string
  borderColor?: string
}

export function BenefitsBlock({
  sectionTitle,
  sectionSubtitle,
  benefits = [],
  showColoredBorders = false,
  columns = '3',
  cardStyle = 'bordered',
  backgroundColor,
  className,
  id,
}: BenefitsProps) {
  const bgClasses = getBackgroundClasses(backgroundColor)

  const gridCols = {
    '2': '@md:grid-cols-2',
    '3': '@md:grid-cols-3',
    '4': '@md:grid-cols-2 @lg:grid-cols-4',
  }

  const cardStyles = {
    minimal: '',
    bordered: 'border border-border',
    elevated: 'shadow-lg',
  }

  return (
    <section
      id={id}
      className={cn(
        'py-16 px-4',
        bgClasses,
        className
      )}
      data-cy={sel('blocks.benefits.container')}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        {(sectionTitle || sectionSubtitle) && (
          <div className="text-center mb-12">
            {sectionTitle && (
              <h2 className="text-3xl @md:text-4xl font-bold mb-4">
                {sectionTitle}
              </h2>
            )}
            {sectionSubtitle && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {sectionSubtitle}
              </p>
            )}
          </div>
        )}

        {/* Benefits Grid */}
        <div className={cn(
          'grid gap-6',
          gridCols[columns as keyof typeof gridCols]
        )}>
          {(benefits as BenefitItem[]).map((benefit, index) => (
            <div
              key={index}
              className={cn(
                'bg-card rounded-lg p-6 transition-all hover:scale-[1.02]',
                cardStyles[cardStyle as keyof typeof cardStyles],
                showColoredBorders && 'border-t-4'
              )}
              style={showColoredBorders ? { borderTopColor: benefit.borderColor || '#3b82f6' } : undefined}
            >
              <h3 className="text-xl font-semibold mb-2">
                {benefit.title}
              </h3>
              {benefit.description && (
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {(!benefits || benefits.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No benefits added yet. Add some benefits to display them here.</p>
          </div>
        )}
      </div>
    </section>
  )
}
