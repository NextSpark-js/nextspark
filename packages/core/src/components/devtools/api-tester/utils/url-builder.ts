import type { PathParam, KeyValuePair } from '../types'

/**
 * Extrae parametros de path de una URL pattern
 * Soporta: :id, [id], [...path], [[...path]]
 */
export function extractPathParams(path: string): PathParam[] {
  const params: PathParam[] = []

  // Patron para :param (Next.js legacy)
  const colonPattern = /:(\w+)/g
  let match
  while ((match = colonPattern.exec(path)) !== null) {
    params.push({
      name: match[1],
      pattern: match[0],
      value: '',
      required: true,
    })
  }

  // Patron para [param] (Next.js App Router)
  const bracketPattern = /\[([^\]]+)\]/g
  while ((match = bracketPattern.exec(path)) !== null) {
    const paramName = match[1]
    const isCatchAll = paramName.startsWith('...')
    const isOptional = match[0].startsWith('[[')
    const cleanName = paramName.replace('...', '')

    params.push({
      name: cleanName,
      pattern: match[0],
      value: '',
      required: !isOptional && !isCatchAll,
    })
  }

  return params
}

/**
 * Construye la URL final con parametros
 */
export function buildUrl(
  basePath: string,
  pathParams: PathParam[],
  queryParams: KeyValuePair[]
): string {
  let url = basePath

  // Reemplazar parametros de path
  for (const param of pathParams) {
    if (param.value) {
      url = url.replace(param.pattern, param.value)
    }
  }

  // Construir query string
  const searchParams = new URLSearchParams()
  for (const qp of queryParams) {
    if (qp.enabled && qp.key && qp.value) {
      searchParams.append(qp.key, qp.value)
    }
  }

  const queryString = searchParams.toString()
  if (queryString) {
    url = `${url}?${queryString}`
  }

  return url
}

/**
 * Valida que todos los parametros requeridos tengan valor
 */
export function validatePathParams(params: PathParam[]): string[] {
  const errors: string[] = []
  for (const param of params) {
    if (param.required && !param.value) {
      errors.push(`Path parameter "${param.name}" is required`)
    }
  }
  return errors
}

/**
 * Valida que el body sea JSON valido
 */
export function validateJsonBody(body: string): string | null {
  if (!body.trim()) return null
  try {
    JSON.parse(body)
    return null
  } catch {
    return 'Invalid JSON format'
  }
}
