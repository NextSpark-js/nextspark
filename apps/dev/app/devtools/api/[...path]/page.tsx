import { notFound } from 'next/navigation'
import { ApiRoutesService } from '@nextsparkjs/core/lib/services/api-routes.service'
import { ApiTester } from '@nextsparkjs/core/components/devtools/api-tester'

interface DevApiDetailPageProps {
  params: Promise<{ path: string[] }>
}

/**
 * DevTools API Tester Page (catch-all route)
 *
 * Displays API tester for a specific endpoint.
 * URL format: /devtools/api/v1/users/%5Bid%5D -> path = ['v1', 'users', '%5Bid%5D']
 *
 * Note: Brackets must be URL-encoded in the URL to avoid Next.js treating them
 * as dynamic route segments. We decode them here to match the registry paths.
 */
export default async function DevApiDetailPage({ params }: DevApiDetailPageProps) {
  const { path } = await params

  // Decode URL-encoded brackets back to literal brackets
  // %5B -> [ and %5D -> ]
  const decodedPath = path.map(segment => decodeURIComponent(segment))

  // Reconstruir el path del API
  const apiPath = '/api/' + decodedPath.join('/')

  // Buscar el endpoint en el registry
  const route = ApiRoutesService.getRoute(apiPath)

  if (!route) {
    notFound()
  }

  return <ApiTester route={route} basePath={apiPath} />
}
