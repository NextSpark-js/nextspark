import type { ApiRouteEntry } from '../../../lib/services/api-routes.service'

/**
 * HTTP Methods disponibles
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS'

/**
 * Tipo de autenticacion
 */
export type AuthType = 'session' | 'apiKey'

/**
 * Par clave-valor generico
 */
export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

/**
 * Parametro de path extraido de la URL
 */
export interface PathParam {
  name: string        // Nombre del parametro (sin : o [])
  pattern: string     // Patron original (:id, [...path], [slug])
  value: string       // Valor ingresado por el usuario
  required: boolean   // Si es requerido
}

/**
 * Estado del request
 */
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'

/**
 * Informacion de la respuesta
 */
export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  timing: number       // Tiempo en ms
  size?: number        // Tamano aproximado en bytes
}

/**
 * Estado del formulario de request
 */
export interface RequestFormState {
  method: HttpMethod
  pathParams: PathParam[]
  queryParams: KeyValuePair[]
  headers: KeyValuePair[]
  authType: AuthType
  apiKey: string
  body: string
}

/**
 * Props del componente ApiTester
 */
export interface ApiTesterProps {
  route: ApiRouteEntry
  basePath: string     // Path original del endpoint (ej: /api/v1/users/[id])
}

/**
 * Hook result para useApiRequest
 */
export interface UseApiRequestResult {
  status: RequestStatus
  response: ApiResponse | null
  error: string | null
  execute: (config: RequestConfig) => Promise<void>
  cancel: () => void
  reset: () => void
}

/**
 * Configuracion para ejecutar un request
 */
export interface RequestConfig {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body?: string
  authType: AuthType
  apiKey?: string
}
