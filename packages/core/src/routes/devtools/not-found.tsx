'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@nextsparkjs/core/components/ui/button'
import { cn } from '@nextsparkjs/core/lib/utils'

/**
 * A devtools URL with no page (`/devtools/plugins/x`, `/devtools/anything`): inside the area's layout, with the way back
 * to its home. It renders no area data, since a not-found file is not covered by the area's role check (area-access).
 */
export default function DevtoolsNotFound() {
  const t = useTranslations('devtools.notFound')
  return (
    <div className="py-16 text-center space-y-4" data-cy="devtools-not-found">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Link href="/devtools" className={cn(buttonVariants({ variant: 'outline' }))} data-cy="devtools-not-found-back">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('back')}
      </Link>
    </div>
  )
}
