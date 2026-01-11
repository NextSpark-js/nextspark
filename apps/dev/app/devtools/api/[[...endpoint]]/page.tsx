import { ApiRoutesService } from "@nextsparkjs/core/lib/services/api-routes.service"
import { ApiExplorer } from "@nextsparkjs/core/components/devtools"

interface Props {
  params: Promise<{ endpoint?: string[] }>
}

/**
 * Developer API Explorer Page
 *
 * Postman-like interface for exploring and testing API endpoints.
 * Supports deep linking via URL: /devtools/api/{METHOD}/{path}
 *
 * Examples:
 * - /devtools/api                              → No selection
 * - /devtools/api/GET/api/v1/customers         → GET /api/v1/customers selected
 * - /devtools/api/POST/api/v1/billing/checkout → POST /api/v1/billing/checkout
 */
export default async function DevToolsApiPage({ params }: Props) {
  const { endpoint } = await params
  const routesByCategory = ApiRoutesService.getRoutesGroupedByCategory()

  // Parse initial selection from URL
  // endpoint = ['GET', 'api', 'v1', 'customers'] or undefined
  let initialEndpoint: { method: string; path: string } | null = null
  if (endpoint && endpoint.length >= 2) {
    const method = endpoint[0] // GET, POST, etc.
    const path = '/' + endpoint.slice(1).join('/') // /api/v1/customers
    initialEndpoint = { method, path }
  }

  return <ApiExplorer routes={routesByCategory} initialEndpoint={initialEndpoint} />
}
