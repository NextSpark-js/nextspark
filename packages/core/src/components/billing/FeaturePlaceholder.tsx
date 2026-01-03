'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface FeaturePlaceholderProps {
  feature: string
  icon: ReactNode
  benefits: string[]
}

/**
 * FeaturePlaceholder - Display a placeholder for features that are not yet implemented
 *
 * Used for "fake door" testing to validate user interest in features
 * before actually implementing them.
 *
 * @example
 * ```tsx
 * <FeaturePlaceholder
 *   feature="advanced_analytics"
 *   icon={<BarChart3 className="h-8 w-8" />}
 *   benefits={['Real-time dashboards', 'Custom reports', 'Export to PDF']}
 * />
 * ```
 */
export function FeaturePlaceholder({ feature, icon, benefits }: FeaturePlaceholderProps) {
  const t = useTranslations('billing')

  return (
    <div className="max-w-2xl mx-auto py-12" data-cy={`feature-placeholder-${feature}`}>
      <Card className="border-dashed border-2 border-muted">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 bg-muted rounded-full w-fit">
            {icon}
          </div>
          <CardTitle className="text-2xl" data-cy="placeholder-title">
            {t(`features.${feature}`)}
          </CardTitle>
          <CardDescription className="flex items-center justify-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            {t('placeholder.notReal')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground" data-cy="placeholder-description">
            {t('placeholder.description')}
          </p>

          <div className="bg-muted/50 p-4 rounded-lg" data-cy="placeholder-benefits">
            <h4 className="font-medium mb-2">{t('placeholder.benefits')}</h4>
            <ul className="space-y-2">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-3 w-3 text-primary" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <Link href="/dashboard/settings/pricing">
              <Button data-cy="placeholder-upgrade-btn">
                {t('upgrade')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
