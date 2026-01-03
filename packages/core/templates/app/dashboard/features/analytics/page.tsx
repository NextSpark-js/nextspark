'use client'

import { FeatureGate } from '@nextsparkjs/core/components/billing/FeatureGate'
import { FeaturePlaceholder } from '@nextsparkjs/core/components/billing/FeaturePlaceholder'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AdvancedAnalyticsPage() {
  const t = useTranslations('features')

  return (
    <div data-cy="feature-analytics-page">
      <FeatureGate
        feature="advanced_analytics"
        fallback={
          <FeaturePlaceholder
            feature="advanced_analytics"
            icon={<BarChart3 className="h-8 w-8" />}
            benefits={[
              t('analytics.benefit1'),
              t('analytics.benefit2'),
              t('analytics.benefit3'),
            ]}
          />
        }
      >
        {/* Contenido real cuando se implemente */}
        <div data-cy="analytics-content">
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground mt-2">Analytics dashboard coming soon...</p>
        </div>
      </FeatureGate>
    </div>
  )
}
