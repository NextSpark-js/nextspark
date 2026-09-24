'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'

export function DisabledMessage() {
  const t = useTranslations('observability')

  return (
    <div className="flex items-center justify-center min-h-[400px]" data-cy="observability-disabled">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{t('disabled')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
