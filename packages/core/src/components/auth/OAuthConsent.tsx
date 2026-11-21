'use client'

/**
 * Consent screen of an MCP browser sign-in (#541, spike): names the client that asks, lists what it asks for grouped
 * by read, write and delete, and sends the decision. The signed query in the URL is what the server acts on; this
 * page only displays it and never rebuilds it.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '../../lib/auth-client'
import { withBasePath } from '../../lib/base-path'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'

const IDENTITY_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access'])
const ACTIONS = ['read', 'write', 'delete'] as const

interface PublicClient { client_name?: string; client_uri?: string; client_id?: string }

type OAuthCalls = {
  publicClient: (input: { query: { client_id: string } }) => Promise<{ data: PublicClient | null }>
  consent: (input: { accept: boolean }) => Promise<{ data: { url?: string; redirect_uri?: string } | null; error: { message?: string } | null }>
}

export function OAuthConsent() {
  const t = useTranslations('auth.oauthConsent')
  const params = useSearchParams()
  const clientId = params.get('client_id') ?? ''
  const scopes = useMemo(() => (params.get('scope') ?? '').split(/\s+/).filter(Boolean), [params])
  const [client, setClient] = useState<PublicClient | null>(null)
  const [team, setTeam] = useState<string | null>(null)
  const [pending, setPending] = useState<'accept' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const oauth2 = (authClient as unknown as { oauth2: OAuthCalls }).oauth2

  useEffect(() => {
    if (!clientId) return
    oauth2.publicClient({ query: { client_id: clientId } }).then(({ data }) => setClient(data)).catch(() => setClient(null))
  }, [clientId, oauth2])

  // The team this connection is for: the one chosen (or the only one) in this session
  useEffect(() => {
    fetch(withBasePath('/api/internal/oauth-team'), { credentials: 'include' })
      .then(response => (response.ok ? response.json() : null))
      .then((body: { data?: Array<{ id: string; name: string }>; selected?: string | null } | null) => {
        setTeam(body?.data?.find(candidate => candidate.id === body.selected)?.name ?? null)
      })
      .catch(() => setTeam(null))
  }, [])

  const decide = async (accept: boolean) => {
    setPending(accept ? 'accept' : 'deny')
    setError(null)
    const { data, error: failure } = await oauth2.consent({ accept })
    const next = data?.url ?? data?.redirect_uri
    if (failure || !next) {
      setError(t('error'))
      setPending(null)
      return
    }
    window.location.assign(next)
  }

  const resourceScopes = scopes.filter(scope => !IDENTITY_SCOPES.has(scope))
  const clientHost = (() => {
    try { return new URL(client?.client_uri ?? clientId).host } catch { return null }
  })()

  return (
    <Card data-cy="oauth-consent">
      <CardHeader>
        <CardTitle>{t('title', { client: client?.client_name ?? t('unknownClient') })}</CardTitle>
        <CardDescription>{clientHost ? t('description', { host: clientHost }) : t('descriptionUnknown')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {team && <p className="text-sm font-medium" data-cy="oauth-consent-team">{t('team', { team })}</p>}
        {ACTIONS.map(action => {
          const entities = resourceScopes.filter(scope => scope.endsWith(`:${action}`)).map(scope => scope.slice(0, -action.length - 1))
          if (!entities.length) return null
          return (
            <div key={action} data-cy={`oauth-consent-${action}`}>
              <p className="text-sm font-medium">{t(action)}</p>
              <p className="text-sm text-muted-foreground">{entities.join(', ')}</p>
            </div>
          )
        })}
        {resourceScopes.length === 0 && <p className="text-sm text-muted-foreground">{t('identityOnly')}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending !== null} onClick={() => decide(false)} data-cy="oauth-consent-deny">{t('deny')}</Button>
        <Button disabled={pending !== null} onClick={() => decide(true)} data-cy="oauth-consent-allow">{t('allow')}</Button>
      </CardFooter>
    </Card>
  )
}
