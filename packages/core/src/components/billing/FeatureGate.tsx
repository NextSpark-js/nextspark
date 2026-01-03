'use client'

import { ReactNode } from 'react'
import { useFeature } from '../../hooks/useFeature'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Lock } from 'lucide-react'

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
  showUpgradePrompt?: boolean
  onUpgrade?: () => void
}

/**
 * FeatureGate - Conditionally render content based on plan feature access
 *
 * @example
 * ```tsx
 * <FeatureGate feature="advanced_analytics">
 *   <AdvancedAnalyticsChart />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  onUpgrade
}: FeatureGateProps) {
  const hasFeature = useFeature(feature)
  const t = useTranslations('billing')

  if (hasFeature) {
    return <>{children}</>
  }

  if (fallback) {
    return <div data-cy={`feature-gate-fallback-${feature}`}>{fallback}</div>
  }

  if (showUpgradePrompt) {
    return (
      <div data-cy={`feature-gate-${feature}`}>
        <Alert className="border-muted">
          <Lock className="h-4 w-4" />
          <AlertTitle>{t('errors.featureNotAvailable')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{t('errors.upgradeRequired')}</span>
            {onUpgrade && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUpgrade}
                data-cy="feature-gate-upgrade-btn"
              >
                {t('upgrade')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return null
}
