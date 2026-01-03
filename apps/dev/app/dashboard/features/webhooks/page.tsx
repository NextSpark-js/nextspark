'use client'

import { FeatureGate } from '@nextsparkjs/core/components/billing/FeatureGate'
import { FeaturePlaceholder } from '@nextsparkjs/core/components/billing/FeaturePlaceholder'
import { Webhook } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function WebhooksPage() {
  const t = useTranslations('features')

  return (
    <div data-cy="feature-webhooks-page">
      <FeatureGate
        feature="webhooks"
        fallback={
          <FeaturePlaceholder
            feature="webhooks"
            icon={<Webhook className="h-8 w-8" />}
            benefits={[
              t('webhooks.benefit1'),
              t('webhooks.benefit2'),
              t('webhooks.benefit3'),
            ]}
          />
        }
      >
        {/* Contenido real cuando se implemente */}
        <div data-cy="webhooks-content">
          <h1 className="text-2xl font-bold">{t('webhooks.title')}</h1>
          <p className="text-muted-foreground mt-2">Webhooks configuration coming soon...</p>
        </div>
      </FeatureGate>
    </div>
  )
}
