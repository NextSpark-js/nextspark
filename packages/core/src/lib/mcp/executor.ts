/**
 * In-process entity executor.
 *
 * Invokes the core generic handlers directly (exactly like
 * app/api/v1/[entity]/route.ts does) with a synthesized NextRequest carrying
 * the caller's Authorization and the resolved x-team-id. NO fetch fallback:
 * if the in-process path fails it fails loudly; we never degrade to HTTP,
 * which would send the credential to an env-derived URL.
 *
 * Team context is injected in ALL FIVE operations — the handler only reads
 * the x-team-id header, and validates it on every operation.
 */

import { NextRequest } from 'next/server'
import {
  handleGenericList,
  handleGenericCreate,
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
} from '../api/entity/generic-handler'
import type { EntityApiResult, EntityExecutor, ExecuteEntityArgs, ToolExecutionContext } from './types'

/** Internal-only origin: never used for network I/O, only for URL parsing. */
const INTERNAL_ORIGIN = 'http://mcp.internal'

export const executeEntityOperation: EntityExecutor = async (
  args: ExecuteEntityArgs,
  ctx: ToolExecutionContext
): Promise<EntityApiResult> => {
  const request = buildRequest(args, ctx)
  const params = Promise.resolve({ entity: args.slug, id: args.id ?? '' })

  let response: Response
  switch (args.operation) {
    case 'list':
      response = await handleGenericList(request)
      break
    case 'create':
      response = await handleGenericCreate(request)
      break
    case 'get':
      response = await handleGenericRead(request, { params })
      break
    case 'update':
      response = await handleGenericUpdate(request, { params })
      break
    case 'delete':
      response = await handleGenericDelete(request, { params })
      break
    default:
      throw new Error(`Unsupported entity operation: ${String(args.operation)}`)
  }

  const body = (await response.json()) as EntityApiResult['body']
  return { status: response.status, body }
}

function buildRequest(args: ExecuteEntityArgs, ctx: ToolExecutionContext): NextRequest {
  const path = args.id ? `/api/v1/${args.slug}/${args.id}` : `/api/v1/${args.slug}`
  const url = new URL(path, INTERNAL_ORIGIN)
  for (const [key, value] of Object.entries(args.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  }

  const method = METHODS[args.operation]
  const headers: Record<string, string> = {
    authorization: ctx.authHeader,
    'x-team-id': ctx.teamId,
  }

  let body: string | undefined
  if (args.body !== undefined) {
    body = JSON.stringify(args.body)
    headers['content-type'] = 'application/json'
  }

  return new NextRequest(url, { method, headers, body })
}

const METHODS: Record<ExecuteEntityArgs['operation'], string> = {
  list: 'GET',
  get: 'GET',
  create: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
}
