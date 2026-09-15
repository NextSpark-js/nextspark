/**
 * Translates entity API errors into actionable messages for the LLM.
 *
 * Scope/permission failures arrive as HTTP_403, not PERMISSION_DENIED; CHECK
 * violations (23514) are swallowed by the core as a bare 500 — overrides
 * supply `errorHints` so those 500s still carry guidance.
 */

import type { EntityApiResult } from './types'

interface ErrorContext {
  slug: string
  operation: string
  hints?: string[]
}

export function translateApiError(result: EntityApiResult, context: ErrorContext): string {
  const { status, body } = result
  const code = body.code ?? `HTTP_${status}`
  const detail = body.error ? ` (API: ${body.error})` : ''

  switch (code) {
    case 'AUTHENTICATION_FAILED':
      return 'API key invalid, expired, or revoked. Generate a new one in Settings → API Keys and update the MCP client configuration.'
    case 'TEAM_CONTEXT_REQUIRED':
      return 'Missing team context. Verify that your API key belongs to a user with an active team, or send the x-team-id header.'
    case 'TEAM_ACCESS_DENIED':
      return 'The API key user is not a member of the specified team. Check x-team-id or use the default team.'
    case 'VALIDATION_ERROR':
      return `Invalid data for ${context.slug}.${formatDetails(body.details)} Fix the fields and retry.`
    case 'INVALID_FIELD_VALUE':
      return `A field has a value that is not allowed${detail}. Check the tool's schema values and retry.`
    case 'UNIQUE_CONSTRAINT_VIOLATION':
      return `A record for ${context.slug} already exists with that unique value${detail}. Look it up with the list tool and update it instead of creating it.`
    case 'RATE_LIMIT_EXCEEDED':
      return 'Request limit reached. Wait a minute before retrying; for large loads use the batch tools if the entity exposes them.'
    default:
      break
  }

  switch (status) {
    case 401:
      return 'Not authenticated: the API key was not accepted. Generate a new one in Settings → API Keys.'
    case 403:
      return `No permission for ${context.operation} on ${context.slug}. If it's a scope issue, your API key needs the ${context.slug}:${scopeFor(context.operation)} scope. If it's a role issue, your role in the team does not allow this action.`
    case 404:
      return `Record for ${context.slug} not found. The ID may be incorrect or the record may have been deleted — use the list tool to find the correct ID.`
    case 409:
      return `Cannot complete: the record for ${context.slug} has related records that depend on it${detail}. Delete or reassign the dependent records first.`
    case 429:
      return 'Request limit reached. Wait a minute before retrying.'
    case 500: {
      const hints = context.hints?.length
        ? ` Known possible causes: ${context.hints.join(' · ')}.`
        : ''
      return `Internal API error while executing ${context.operation} on ${context.slug}.${hints} If it persists, report it.`
    }
    default:
      return `Error ${status} (${code}) while executing ${context.operation} on ${context.slug}${detail}.`
  }
}

/** Mirrors the scope the generic handler actually checks per operation (post #94/#95: delete uses its own `:delete` scope). */
function scopeFor(operation: string): string {
  if (operation === 'list' || operation === 'get') return 'read'
  if (operation === 'delete') return 'delete'
  return 'write'
}

function formatDetails(details: unknown): string {
  if (!details) return ''
  if (Array.isArray(details)) {
    const lines = details
      .map((issue) => {
        if (issue && typeof issue === 'object') {
          const record = issue as Record<string, unknown>
          const path = Array.isArray(record.path) ? record.path.join('.') : String(record.path ?? '')
          const message = String(record.message ?? JSON.stringify(record))
          return path ? `${path}: ${message}` : message
        }
        return String(issue)
      })
      .slice(0, 8)
    return ` Issues: ${lines.join(' · ')}.`
  }
  return ` Detail: ${JSON.stringify(details).slice(0, 300)}.`
}
