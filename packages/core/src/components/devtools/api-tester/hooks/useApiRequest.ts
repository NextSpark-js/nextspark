'use client'

import { useState, useRef, useCallback } from 'react'
import type {
  UseApiRequestResult,
  RequestConfig,
  ApiResponse,
  RequestStatus
} from '../types'

export function useApiRequest(): UseApiRequestResult {
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(async (config: RequestConfig) => {
    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController()

    setStatus('loading')
    setResponse(null)
    setError(null)

    const startTime = performance.now()

    try {
      const headers: HeadersInit = {
        ...config.headers,
        'Content-Type': 'application/json',
      }

      // Agregar API key si corresponde
      if (config.authType === 'apiKey' && config.apiKey) {
        headers['x-api-key'] = config.apiKey
      }

      const fetchOptions: RequestInit = {
        method: config.method,
        headers,
        signal: abortControllerRef.current.signal,
        credentials: config.authType === 'session' ? 'include' : 'omit',
      }

      // Agregar body solo para metodos que lo soportan
      if (['POST', 'PATCH', 'PUT'].includes(config.method) && config.body) {
        fetchOptions.body = config.body
      }

      const res = await fetch(config.url, fetchOptions)

      const endTime = performance.now()
      const timing = Math.round(endTime - startTime)

      // Parsear headers
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Parsear body
      let body: unknown
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        body = await res.json()
      } else {
        body = await res.text()
      }

      const apiResponse: ApiResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body,
        timing,
      }

      setResponse(apiResponse)
      setStatus('success')

    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setStatus('cancelled')
          setError('Request cancelled')
        } else {
          setStatus('error')
          setError(err.message)
        }
      } else {
        setStatus('error')
        setError('Unknown error occurred')
      }
    }
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setResponse(null)
    setError(null)
  }, [])

  return {
    status,
    response,
    error,
    execute,
    cancel,
    reset,
  }
}
