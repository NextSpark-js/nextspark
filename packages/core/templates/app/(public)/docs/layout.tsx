import { Suspense } from 'react'
import { DocsLayout } from '@nextsparkjs/core/components/docs/docs-layout'
import { DocsSidebar } from '@nextsparkjs/core/components/docs/docs-sidebar'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'

export default function DocsLayoutPage({
  children
}: {
  children: React.ReactNode
}) {
  const sections = DOCS_REGISTRY.all

  return (
    <DocsLayout>
      <DocsSidebar sections={sections} />
      <main className="flex-1 p-6 lg:p-8" data-cy="docs-main-content">
        <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </DocsLayout>
  )
}
