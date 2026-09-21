'use client'

import { useEffect, useState } from 'react'
import { withBasePath } from '../lib/base-path'
import { isAuthLoginMethod } from '../lib/auth/auth-methods'
import type { AuthLoginMethod } from '../lib/config/types'

export type AuthReadinessState = 'loading' | 'ready' | 'unavailable' | 'error'

/** Server-derived flows independent of the login UI methods; see runtime-readiness. */
export interface ClientAuthCapabilities {
  invitationPasswordSignup: boolean
  passwordRecovery: boolean
}

export interface ClientAuthReadiness {
  state: AuthReadinessState
  availableMethods: AuthLoginMethod[]
  capabilities: ClientAuthCapabilities
}

const NO_CAPABILITIES: ClientAuthCapabilities = {
  invitationPasswordSignup: false,
  passwordRecovery: false,
}

function parseReadiness(value: unknown): ClientAuthReadiness {
  if (!value || typeof value !== 'object') throw new Error('Invalid auth readiness response')
  const candidate = value as { status?: unknown; availableMethods?: unknown; capabilities?: unknown }
  if (candidate.status !== 'ready' && candidate.status !== 'unavailable') {
    throw new Error('Invalid auth readiness status')
  }
  if (!Array.isArray(candidate.availableMethods) || !candidate.availableMethods.every(isAuthLoginMethod)) {
    throw new Error('Invalid auth readiness methods')
  }
  if (candidate.status === 'ready' && candidate.availableMethods.length === 0) {
    throw new Error('Ready auth response has no available method')
  }
  const capabilities = candidate.capabilities as Partial<Record<keyof ClientAuthCapabilities, unknown>> | null | undefined
  if (
    !capabilities ||
    typeof capabilities !== 'object' ||
    typeof capabilities.invitationPasswordSignup !== 'boolean' ||
    typeof capabilities.passwordRecovery !== 'boolean'
  ) {
    throw new Error('Invalid auth readiness capabilities')
  }
  return {
    state: candidate.status,
    availableMethods: [...new Set(candidate.availableMethods)],
    capabilities: {
      invitationPasswordSignup: capabilities.invitationPasswordSignup,
      passwordRecovery: capabilities.passwordRecovery,
    },
  }
}

/** Load the server-validated login methods without exposing provider diagnostics. */
export function useAuthReadiness(): ClientAuthReadiness {
  const [readiness, setReadiness] = useState<ClientAuthReadiness>({
    state: 'loading',
    availableMethods: [],
    capabilities: NO_CAPABILITIES,
  })

  useEffect(() => {
    let active = true

    void fetch(withBasePath('/api/auth/readiness'), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Auth readiness request failed')
        return parseReadiness(await response.json())
      })
      .then((result) => {
        if (active) setReadiness(result)
      })
      .catch(() => {
        if (active) setReadiness({ state: 'error', availableMethods: [], capabilities: NO_CAPABILITIES })
      })

    return () => { active = false }
  }, [])

  return readiness
}
