'use client'

/**
 * Consent screen of an MCP browser sign-in (#541): names the client that asks and the team, and lists what it asks
 * for as one row per entity with read, write and delete. The first time, reading and writing come ticked and
 * deleting does not. When the application is already connected to the team, what it holds comes ticked and nothing
 * else, so accepting as it is takes nothing away and adds nothing. The user sends only what stays ticked. A permission the user's role in the team cannot hold is shown and cannot be
 * ticked. The signed query in the URL is what the server acts on; this page displays it and never rebuilds it.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '../../lib/auth-client'
import { withBasePath } from '../../lib/base-path'
import { entityScope, isPreselectedScope } from '../../lib/mcp/oauth/scope-names'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Checkbox } from '../ui/checkbox'

const ACTIONS = ['read', 'write', 'delete'] as const

interface PublicClient { client_name?: string; client_uri?: string; client_id?: string }

type OAuthCalls = {
  publicClient: (input: { query: { client_id: string } }) => Promise<{ data: PublicClient | null }>
  consent: (input: { accept: boolean; scope?: string }) => Promise<{ data: { url?: string; redirect_uri?: string } | null; error: { message?: string } | null }>
}

export function OAuthConsent() {
  const t = useTranslations('auth.oauthConsent')
  const params = useSearchParams()
  const clientId = params.get('client_id') ?? ''
  const scopes = useMemo(() => (params.get('scope') ?? '').split(/\s+/).filter(Boolean), [params])
  // The entity permissions the server offers; null until it has said. An application may ask for one no tool needs
  // any more (it kept an older list): that one is never shown, so no row is shown before the server answers
  const [offered, setOffered] = useState<Set<string> | null>(null)
  // The entity permissions asked for; anything else (offline_access, identity) is not the user's to untick
  const asked = useMemo(() => scopes.filter(scope => entityScope(scope)), [scopes])
  const requested = useMemo(() => asked.filter(scope => offered !== null && offered.has(scope)), [asked, offered])
  const [client, setClient] = useState<PublicClient | null>(null)
  const [team, setTeam] = useState<string | null>(null)
  // null until the server says which of them the user's role in the team can hold
  const [allowed, setAllowed] = useState<Set<string> | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(asked.filter(isPreselectedScope)))
  // The application is already connected to this team: the screen starts from what it holds
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState<'accept' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const oauth2 = (authClient as unknown as { oauth2: OAuthCalls }).oauth2

  useEffect(() => {
    if (!clientId) return
    oauth2.publicClient({ query: { client_id: clientId } }).then(({ data }) => setClient(data)).catch(() => setClient(null))
  }, [clientId, oauth2])

  // The team this connection is for, and what the user's role in it can hold
  useEffect(() => {
    // An answer that arrives after the parameters changed is not this screen's
    let current = true
    const query = new URLSearchParams({ authorization: params.get('code_challenge') ?? '', client_id: clientId })
    fetch(withBasePath(`/api/internal/oauth-team?${query}`), { credentials: 'include' })
      .then(response => (response.ok ? response.json() : null))
      .then((body: { data?: Array<{ id: string; name: string }>; selected?: string | null; allowed?: string[]; offered?: string[]; granted?: string[] | null } | null) => {
        if (!current) return
        setTeam(body?.data?.find(candidate => candidate.id === body.selected)?.name ?? null)
        // No answer, or one that does not say: nothing is offered
        const shown = new Set(Array.isArray(body?.offered) ? body.offered : [])
        setOffered(shown)
        const can = new Set(body?.allowed ?? [])
        setAllowed(can)
        const granted = Array.isArray(body?.granted) ? body.granted : null
        setConnected(granted !== null)
        // Already connected: what it holds. Not yet: the defaults. Either way, only what the role can hold.
        setChosen(new Set(asked.filter(scope => shown.has(scope) && can.has(scope) && (granted ? granted.includes(scope) : isPreselectedScope(scope)))))
      })
      // What is offered and what the role allows could not be read: no entity permission is shown or stays ticked,
      // so none is asked for
      .catch(() => { if (current) { setTeam(null); setOffered(new Set()); setAllowed(new Set()); setChosen(new Set()) } })
    return () => { current = false }
  }, [params, clientId, asked])

  const entities = useMemo(() => [...new Set(requested.map(scope => entityScope(scope)!.entity))].sort(), [requested])
  const toggle = (scope: string, on: boolean) => setChosen(current => {
    const next = new Set(current)
    if (on) next.add(scope)
    else next.delete(scope)
    return next
  })

  const decide = async (accept: boolean) => {
    setPending(accept ? 'accept' : 'deny')
    setError(null)
    // What stays ticked, with the scopes that are not entity permissions as they were asked for
    const granted = scopes.filter(scope => !entityScope(scope) || chosen.has(scope))
    const { data, error: failure } = await oauth2.consent(accept ? { accept, scope: granted.join(' ') } : { accept })
    const next = data?.url ?? data?.redirect_uri
    if (failure || !next) {
      setError(t('error'))
      setPending(null)
      return
    }
    window.location.assign(next)
  }

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
        {entities.length > 0 && (
          <table className="w-full text-sm" data-cy="oauth-consent-permissions">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-normal">{t('entity')}</th>
                {ACTIONS.map(action => <th key={action} className="py-1 text-center font-normal">{t(action)}</th>)}
              </tr>
            </thead>
            <tbody>
              {entities.map(entity => (
                <tr key={entity} className="border-t">
                  <td className="py-2 font-medium">{entity}</td>
                  {ACTIONS.map(action => {
                    const scope = `${entity}:${action}`
                    const asked = requested.includes(scope)
                    const can = asked && allowed !== null && allowed.has(scope)
                    return (
                      <td key={action} className="py-2 text-center">
                        {asked && (
                          <Checkbox
                            checked={chosen.has(scope)}
                            disabled={!can || pending !== null}
                            onCheckedChange={value => toggle(scope, value === true)}
                            aria-label={`${entity}: ${t(action)}`}
                            data-cy={`oauth-consent-${entity}-${action}`}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {offered !== null && entities.length === 0 && <p className="text-sm text-muted-foreground">{t('identityOnly')}</p>}
        {entities.length > 0 && <p className="text-xs text-muted-foreground" data-cy="oauth-consent-hint">{t(connected ? 'hintConnected' : 'hint')}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending !== null} onClick={() => decide(false)} data-cy="oauth-consent-deny">{t('deny')}</Button>
        <Button disabled={pending !== null || allowed === null} onClick={() => decide(true)} data-cy="oauth-consent-allow">{t('allow')}</Button>
      </CardFooter>
    </Card>
  )
}
