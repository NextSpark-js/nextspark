'use client'

/**
 * Team picker of an MCP browser sign-in (#541): shown after sign-in to a user in several teams. The choice is sent
 * to the server, which keeps it for this session, and the authorization then continues to the consent screen.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '../../lib/auth-client'
import { withBasePath } from '../../lib/base-path'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

interface Team { id: string; name: string; role: string }

type OAuthContinue = {
  continue: (input: { postLogin: boolean }) => Promise<{ data: { url?: string; redirect_uri?: string } | null; error: { message?: string } | null }>
}

export function OAuthTeamSelect() {
  const t = useTranslations('auth.oauthTeam')
  // The authorization this page is a step of: its PKCE challenge, in the signed query of the URL
  const authorization = useSearchParams().get('code_challenge') ?? ''
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(withBasePath('/api/internal/oauth-team'), { credentials: 'include' })
      .then(response => (response.ok ? response.json() : Promise.reject(response)))
      .then(body => setTeams(body.data as Team[]))
      .catch(() => setError(true))
  }, [])

  const choose = async (teamId: string) => {
    setPending(teamId)
    setError(false)
    try {
      const saved = await fetch(withBasePath('/api/internal/oauth-team'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, authorization }),
      })
      if (!saved.ok) throw new Error('not saved')
      const { data } = await (authClient as unknown as { oauth2: OAuthContinue }).oauth2.continue({ postLogin: true })
      const next = data?.url ?? data?.redirect_uri
      if (!next) throw new Error('no continuation')
      window.location.assign(next)
    } catch {
      setError(true)
      setPending(null)
    }
  }

  return (
    <Card data-cy="oauth-team">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {teams?.map(team => (
          <Button
            key={team.id}
            variant="outline"
            className="w-full justify-between"
            disabled={pending !== null}
            onClick={() => choose(team.id)}
            data-cy={`oauth-team-${team.id}`}
          >
            <span>{team.name}</span>
            <span className="text-xs text-muted-foreground">{team.role}</span>
          </Button>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{t('error')}</p>}
      </CardContent>
    </Card>
  )
}
