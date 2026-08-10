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
      return 'API key inválida, expirada o revocada. Generá una nueva en Settings → API Keys y actualizá la configuración del cliente MCP.'
    case 'TEAM_CONTEXT_REQUIRED':
      return 'Falta el contexto de equipo (team). Verificá que tu API key pertenezca a un usuario con un team activo, o enviá el header x-team-id.'
    case 'TEAM_ACCESS_DENIED':
      return 'El usuario de la API key no es miembro del team indicado. Verificá el x-team-id o usá el team por defecto.'
    case 'VALIDATION_ERROR':
      return `Datos inválidos para ${context.slug}.${formatDetails(body.details)} Corregí los campos y reintentá.`
    case 'INVALID_FIELD_VALUE':
      return `Un campo tiene un valor no permitido${detail}. Revisá los valores del schema de la tool y reintentá.`
    case 'UNIQUE_CONSTRAINT_VIOLATION':
      return `Ya existe un registro de ${context.slug} con ese valor único${detail}. Buscalo con la tool de list y actualizalo en vez de crearlo.`
    case 'RATE_LIMIT_EXCEEDED':
      return 'Límite de requests alcanzado. Esperá un minuto antes de reintentar; para cargas grandes usá las tools de batch si el entity las expone.'
    default:
      break
  }

  switch (status) {
    case 401:
      return 'No autenticado: la API key no fue aceptada. Generá una nueva en Settings → API Keys.'
    case 403:
      return `Sin permiso para ${context.operation} en ${context.slug}. Si es un problema de scope, tu API key necesita el scope ${context.slug}:${scopeFor(context.operation)}. Si es un problema de rol, tu rol en el team no permite esta acción.`
    case 404:
      return `No se encontró el registro de ${context.slug}. El ID puede ser incorrecto o el registro fue eliminado — usá la tool de list para encontrar el ID correcto.`
    case 409:
      return `No se puede completar: el registro de ${context.slug} tiene registros relacionados que dependen de él${detail}. Eliminá o reasigná los registros dependientes primero.`
    case 429:
      return 'Límite de requests alcanzado. Esperá un minuto antes de reintentar.'
    case 500: {
      const hints = context.hints?.length
        ? ` Posibles causas conocidas: ${context.hints.join(' · ')}.`
        : ''
      return `Error interno de la API al ejecutar ${context.operation} en ${context.slug}.${hints} Si persiste, reportalo.`
    }
    default:
      return `Error ${status} (${code}) al ejecutar ${context.operation} en ${context.slug}${detail}.`
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
    return ` Problemas: ${lines.join(' · ')}.`
  }
  return ` Detalle: ${JSON.stringify(details).slice(0, 300)}.`
}
