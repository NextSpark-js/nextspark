import { notFound } from 'next/navigation'
import { PLUGIN_DEVTOOLS_PAGES } from '@/.nextspark/registries/plugin-registry'

interface PluginPageProps {
  params: Promise<{ plugin: string }>
}

export default async function PluginDevtoolsPage({ params }: PluginPageProps) {
  const { plugin } = await params
  const PageComponent = PLUGIN_DEVTOOLS_PAGES[plugin]

  if (!PageComponent) {
    notFound()
  }

  return <PageComponent />
}
