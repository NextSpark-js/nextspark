/**
 * The `generateMetadata` of every generated dashboard list page (`dashboard/(main)/<entity>/page.tsx`
 * forwards it): the generated host writes one route per entity and none of them declares its own.
 */
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.meta')
  return { title: t('title'), description: t('listDescription') }
}
