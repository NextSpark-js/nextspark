import { notFound } from 'next/navigation'
import { PLUGIN_SUPERADMIN_PAGES } from '@/.nextspark/registries/plugin-registry'

interface PluginPageProps {
  params: Promise<{ plugin: string }>
}

export default async function PluginSuperadminPage({ params }: PluginPageProps) {
  const { plugin } = await params
  const PageComponent = PLUGIN_SUPERADMIN_PAGES[plugin]

  if (!PageComponent) {
    notFound()
  }

  return <PageComponent />
}
