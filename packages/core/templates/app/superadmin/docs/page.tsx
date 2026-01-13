import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'
import { SuperadminDocsSidebar } from '@nextsparkjs/core/components/docs/superadmin-docs-sidebar'
import Link from 'next/link'
import { FileText, Folder } from 'lucide-react'
import type { Metadata } from 'next'
import { sel } from '@nextsparkjs/core/selectors'

export const metadata: Metadata = {
  title: 'Admin Documentation | Super Admin',
  description: 'Administrator documentation for deployment, configuration, and management',
  robots: 'noindex, nofollow'
}

export default function SuperadminDocsPage() {
  const sections = DOCS_REGISTRY.superadmin

  if (sections.length === 0) {
    return (
      <div className="flex gap-8">
        <aside className="hidden lg:block w-64 shrink-0">
          <SuperadminDocsSidebar sections={sections} />
        </aside>
        <main className="flex-1">
          <h1 className="text-3xl font-bold mb-4">Admin Documentation</h1>
          <p className="text-muted-foreground">
            No administrator documentation available yet.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex gap-8" data-cy={sel('superadmin.docs.container')}>
      <aside className="hidden lg:block w-64 shrink-0">
        <SuperadminDocsSidebar sections={sections} />
      </aside>

      <main className="flex-1">
        <h1 className="text-3xl font-bold mb-4">Admin Documentation</h1>
        <p className="text-muted-foreground mb-8">
          Documentation for administrators covering deployment, configuration, and system management.
        </p>

        <div className="grid gap-6">
          {sections.map((section) => (
            <div key={section.slug} className="border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">{section.title}</h2>
              </div>

              <div className="grid gap-2">
                {section.pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/superadmin/docs/${section.slug}/${page.slug}`}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors"
                    data-cy={sel('superadmin.docs.pageLink', { slug: page.slug })}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{page.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
