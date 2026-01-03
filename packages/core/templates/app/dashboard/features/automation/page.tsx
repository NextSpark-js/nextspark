'use client'

import { FeatureGate } from '@nextsparkjs/core/components/billing/FeatureGate'
import { FeaturePlaceholder } from '@nextsparkjs/core/components/billing/FeaturePlaceholder'
import { Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function TaskAutomationPage() {
  const t = useTranslations('features')

  return (
    <div data-cy="feature-automation-page">
      <FeatureGate
        feature="task_automation"
        fallback={
          <FeaturePlaceholder
            feature="task_automation"
            icon={<Zap className="h-8 w-8" />}
            benefits={[
              t('automation.benefit1'),
              t('automation.benefit2'),
              t('automation.benefit3'),
            ]}
          />
        }
      >
        {/* Contenido real cuando se implemente */}
        <div data-cy="automation-content">
          <h1 className="text-2xl font-bold">{t('automation.title')}</h1>
          <p className="text-muted-foreground mt-2">Task automation coming soon...</p>
        </div>
      </FeatureGate>
    </div>
  )
}
