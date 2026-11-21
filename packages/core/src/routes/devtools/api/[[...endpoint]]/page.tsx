import { ApiRoutesService } from "@nextsparkjs/core/lib/services/api-routes.service"
import { ApiExplorer } from "@nextsparkjs/core/components/devtools/api-explorer"
import { bodySkeleton } from "@nextsparkjs/core/components/devtools/api-explorer/explorer-helpers"
import { ENTITY_REGISTRY } from "@nextsparkjs/registries/entity-registry"

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

  // What a create request needs at least, for each entity that has required fields: the Body tab of its POST
  // opens with it instead of empty (a preset, when the endpoint has one, wins over it).
  const bodySkeletons: Record<string, Record<string, unknown>> = {}
  for (const route of routesByCategory.entity) {
    if (route.path.endsWith('/[id]') || !route.methods.includes('POST')) continue
    const fields = ENTITY_REGISTRY[route.source ?? '']?.config?.fields
    const skeleton = fields ? bodySkeleton(fields) : null
    if (skeleton) bodySkeletons[route.path] = skeleton
  }

  return <ApiExplorer routes={routesByCategory} initialEndpoint={initialEndpoint} bodySkeletons={bodySkeletons} />
}
