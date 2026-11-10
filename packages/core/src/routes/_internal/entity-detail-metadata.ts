/**
 * The `generateMetadata` of every generated dashboard detail page (`dashboard/(main)/<entity>/[id]/page.tsx`
 * forwards it).
 */
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('title'), description: t('detailDescription') }
}
