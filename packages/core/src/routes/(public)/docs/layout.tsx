import { Suspense } from 'react'
import { DocsLayout } from '@nextsparkjs/core/components/docs/docs-layout'
import { DocsSidebar } from '@nextsparkjs/core/components/docs/docs-sidebar'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { sel } from '@nextsparkjs/core/selectors/public'
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'

export default async function DocsLayoutPage({
  children
}: {
  children: React.ReactNode
}) {
  // Only show public docs in this layout
  const sections = DOCS_REGISTRY.public
  const t = await getPublicTranslations('docs.index')

  return (
    <DocsLayout>
      <DocsSidebar sections={sections} />
      <div className="flex-1 p-6 lg:p-8" data-cy={sel('public.docs.mainContent')}>
        <Suspense fallback={<div className="animate-pulse">{t('loading')}</div>}>
          {children}
        </Suspense>
      </div>
    </DocsLayout>
  )
}
