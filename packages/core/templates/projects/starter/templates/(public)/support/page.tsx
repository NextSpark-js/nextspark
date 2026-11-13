import type { Metadata } from 'next'
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'
import { pageMetadata } from '@nextsparkjs/core/lib/seo/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getPublicTranslations('public.support')
  return pageMetadata({ title: t('title'), description: t('description'), path: '/support' })
}

export default async function SupportPage() {
  const t = await getPublicTranslations('public.support')
  return (
    <div className="container py-12" data-cy="support-page">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-4 text-muted-foreground">{t('description')}</p>
    </div>
  )
}
