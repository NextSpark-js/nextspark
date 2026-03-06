import { notFound } from 'next/navigation'
import { getPluginDevtoolsPages } from '@nextsparkjs/registries/plugin-registry'

interface PluginDevtoolsPageProps {
  params: Promise<{ plugin: string }>
}

/**
 * Core page component for /devtools/plugins/[plugin].
 *
 * Resolves the plugin name to its registered devtools page component via the
 * auto-generated PLUGIN_DEVTOOLS_PAGES map. Returns 404 if the plugin doesn't
 * have a registered devtools page.
 *
 * Usage in app/devtools/plugins/[plugin]/page.tsx:
 *   export { PluginDevtoolsPage as default } from '@nextsparkjs/core/components/devtools'
 */
export async function PluginDevtoolsPage({ params }: PluginDevtoolsPageProps) {
  const { plugin } = await params
  const pages = getPluginDevtoolsPages()
  const PageComponent = pages[plugin]

  if (!PageComponent) {
    notFound()
  }

  return <PageComponent />
}
