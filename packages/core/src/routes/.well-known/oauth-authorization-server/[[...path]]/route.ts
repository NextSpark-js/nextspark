import { discoveryPreflight, serveOAuthDiscovery } from '@nextsparkjs/core/lib/mcp/oauth/discovery'

// No segment config: a route handler that reads its request is never cached, and Cache Components rejects `dynamic`.
export const GET = (request: Request) => serveOAuthDiscovery(request)
export const HEAD = (request: Request) => serveOAuthDiscovery(request)
export const OPTIONS = () => discoveryPreflight()
