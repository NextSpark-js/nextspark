/**
 * MCP endpoint — POST /api/mcp (Streamable HTTP, stateless JSON mode).
 *
 * Auth: API key ONLY (Authorization: Bearer sk_... or x-api-key). Session
 * cookies are rejected — this endpoint is for MCP clients, not browsers.
 * authenticateRequest runs ONCE here; the resolved identity, team context and
 * api_key id travel to every tool via ToolExecutionContext.
 *
 * Tools and overrides are entirely registry-driven: every access.api-enabled
 * entity in ENTITY_REGISTRY becomes a set of tools automatically, and any
 * `entities/<slug>/mcp.ts` a theme defines is picked up via the generated
 * MCP_OVERRIDES registry — no per-app hand-wiring required.
 *
 * Security posture:
 * - kill-switch: MCP_ENABLED (dev: on unless 'false'; production: OFF unless 'true')
 * - Origin validated when present (DNS-rebinding protection); no CORS reflection
 * - rate limit: tier 'api' — with the in-process executor this is the ONLY
 *   rate limit on the whole MCP surface (deploy prerequisite: Redis)
 * - team-role permissions + scopes + ownership/field guards come from the
 *   real generic entity handlers the executor calls in-process (#94/#95)
 * - every tool call is audited to api_audit_log
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateRequest,
  resolveTeamContext,
} from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { validateApiKey } from '@nextsparkjs/core/lib/api/auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { createMcpEngine } from '@nextsparkjs/core/lib/mcp'
import type { ToolExecutionContext } from '@nextsparkjs/core/lib/mcp'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
// Import registries directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
import { MCP_OVERRIDES } from '@nextsparkjs/registries/mcp-registry'
import { API_PRESETS_REGISTRY } from '@nextsparkjs/registries/api-presets-registry'

// Initialize registry at module load time (before any handler runs)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

// Registry entries are wrappers ({ name, config, tableName, ... }) — the
// engine consumes the EntityConfig map.
const entityConfigs = Object.fromEntries(
  Object.entries(ENTITY_REGISTRY as Record<string, { config: EntityConfig }>).map(
    ([slug, entry]) => [slug, entry.config]
  )
)

// Tool descriptions are seeded from api/presets.ts (summary → entity
// description, presets → few-shot examples) — the same registry the API
// Explorer already uses, keyed by endpoint instead of slug here.
const presetsBySlug = Object.fromEntries(
  Object.entries(API_PRESETS_REGISTRY.endpoints ?? {}).map(([endpoint, data]) => [
    endpoint.replace(/^\/api\/v1\//, ''),
    { summary: data.summary, presets: data.presets },
  ])
)

const toolPrefix = (process.env.MCP_TOOL_PREFIX || process.env.NEXT_PUBLIC_ACTIVE_THEME || 'app')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const engine = createMcpEngine(entityConfigs, {
  toolPrefix,
  overrides: MCP_OVERRIDES,
  presets: presetsBySlug,
})

const API_KEY_HELP =
  'This endpoint requires an API key: generate one in Settings → API Keys and configure it in your MCP client as the header "Authorization: Bearer sk_...".'

function isMcpEnabled(): boolean {
  const flag = process.env.MCP_ENABLED
  if (process.env.NODE_ENV === 'production') return flag === 'true'
  return flag !== 'false'
}

function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser MCP clients don't send Origin
  const allowed = new Set(
    [request.nextUrl.origin, process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL].filter(
      Boolean
    )
  )
  return allowed.has(origin)
}

function jsonRpcError(
  status: number,
  code: number,
  message: string,
  id: string | number | null = null
): NextResponse {
  return NextResponse.json({ jsonrpc: '2.0', error: { code, message }, id }, { status })
}

async function handleMcpPost(request: NextRequest): Promise<NextResponse> {
  if (!isMcpEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!isOriginAllowed(request)) {
    return jsonRpcError(403, -32000, 'Origin not allowed')
  }

  // Transport-level auth only: per-tool scopes (`<entity>:read/write/delete`)
  // are enforced by the generic entity handlers the executor invokes for each
  // tool call, so this entry point accepts any valid key explicitly (#93).
  const authResult = await authenticateRequest(request, { allowAnyScope: true })
  if (!authResult.success || authResult.type !== 'api-key' || !authResult.user) {
    return jsonRpcError(401, -32001, API_KEY_HELP)
  }

  // Same cached lookup the auth already did — needed for the audit trail.
  const apiKeyAuth = await validateApiKey(request)

  const teamResult = await resolveTeamContext(request, authResult)
  if (teamResult instanceof Response) {
    const status = teamResult.status
    return jsonRpcError(
      status,
      -32002,
      status === 403
        ? 'The API key user is not a member of the team specified in x-team-id.'
        : 'Could not resolve the user team. Send the x-team-id header or assign a default team.'
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonRpcError(400, -32700, 'Parse error: body must be JSON-RPC')
  }

  const ctx: ToolExecutionContext = {
    userId: authResult.user.id,
    userRole: authResult.user.role,
    teamId: teamResult,
    authHeader:
      request.headers.get('authorization') ?? `Bearer ${request.headers.get('x-api-key') ?? ''}`,
    apiKeyId: apiKeyAuth?.keyId ?? null,
    scopes: authResult.scopes ?? [],
  }

  try {
    const result = await engine.handleJsonRpc(body, ctx)
    if (result === null) {
      // Notification(s) only — accepted, nothing to return.
      return new NextResponse(null, { status: 202 })
    }
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[mcp] request failed:', error)
    return jsonRpcError(500, -32603, 'Internal error processing MCP request')
  }
}

export const POST = withRateLimitTier(handleMcpPost, 'api')

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed. MCP requests must be POST (stateless JSON mode, no SSE).' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed. This server is stateless: there is no session to delete.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
