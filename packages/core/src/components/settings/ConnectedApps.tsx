'use client'

/**
 * The applications connected to the account by MCP browser sign-in (#541), on the security settings page: which
 * client, for which team, with which permissions, since when, and a way to end it. An owner or admin of a team
 * also sees the other members' connections to it. Renders nothing in a project built without the feature.
 */
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plug } from 'lucide-react'
import { toast } from 'sonner'
import { withBasePath } from '../../lib/base-path'
import { formatLocaleDate } from '../../lib/i18n/format'
import { isMcpOAuthBuilt } from '../../lib/mcp/oauth/built'
import { entityScope } from '../../lib/mcp/oauth/scope-names'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'

interface Connection {
  clientId: string
  clientName: string | null
  clientHost: string | null
  teamId: string
  teamName: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  scopes: string[]
  connectedAt: string
  lastRenewedAt: string
}

const ENDPOINT = '/api/internal/oauth-connections'
const QUERY_KEY = ['oauth-connections']
const keyOf = (connection: Connection) => `${connection.userId}|${connection.clientId}|${connection.teamId}`

/** `tasks:read tasks:write customers:read` as `{ tasks: ['read', 'write'], customers: ['read'] }`. */
function byEntity(scopes: string[]): Array<[string, string[]]> {
  const grouped = new Map<string, string[]>()
  for (const scope of scopes) {
    const parsed = entityScope(scope)
    if (parsed) grouped.set(parsed.entity, [...(grouped.get(parsed.entity) ?? []), parsed.action])
  }
  const order = ['read', 'write', 'delete']
  return [...grouped.entries()]
    .map(([entity, actions]): [string, string[]] => [entity, actions.sort((a, b) => order.indexOf(a) - order.indexOf(b))])
    .sort(([a], [b]) => a.localeCompare(b))
}

export function ConnectedApps() {
  // A build-time constant: the hooks below run or do not for the whole life of the build
  if (!isMcpOAuthBuilt()) return null
  return <ConnectedAppsCard />
}

function ConnectedAppsCard() {
  const t = useTranslations('settings.connectedApps')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [ending, setEnding] = useState<{ connection: Connection; own: boolean } | null>(null)
  // The connection whose permissions are being edited, and the ones that stay ticked
  const [editing, setEditing] = useState<{ connection: Connection; keep: Set<string> } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ data: Connection[]; managed: Connection[] }> => {
      const response = await fetch(withBasePath(ENDPOINT), { credentials: 'include' })
      // 404: the feature is switched off for this deployment; there is nothing to list
      if (response.status === 404) return { data: [], managed: [] }
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json()
      return { data: body.data ?? [], managed: body.managed ?? [] }
    },
  })

  const disconnect = useMutation({
    mutationFn: async ({ connection, own }: { connection: Connection; own: boolean }) => {
      const response = await fetch(withBasePath(ENDPOINT), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: connection.clientId, teamId: connection.teamId, ...(own ? {} : { userId: connection.userId }) }),
      })
      // 404: already ended from somewhere else, which is what was asked for
      if (!response.ok && response.status !== 404) throw new Error(String(response.status))
    },
    onSuccess: () => toast.success(t('disconnected')),
    onError: () => toast.error(t('error')),
    onSettled: () => {
      setEnding(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const narrow = useMutation({
    mutationFn: async ({ connection, keep }: { connection: Connection; keep: Set<string> }) => {
      const response = await fetch(withBasePath(ENDPOINT), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: connection.clientId, teamId: connection.teamId, scopes: [...keep] }),
      })
      if (!response.ok) throw new Error(String(response.status))
    },
    onSuccess: () => toast.success(t('edit.saved')),
    onError: () => toast.error(t('edit.error')),
    onSettled: () => {
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const toggleKeep = (scope: string, on: boolean) => setEditing(current => {
    if (!current) return current
    const keep = new Set(current.keep)
    if (on) keep.add(scope)
    else keep.delete(scope)
    return { ...current, keep }
  })

  const row = (connection: Connection, own: boolean) => (
    <li key={keyOf(connection)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-cy="connected-app">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">
          {connection.clientName ?? t('unknownClient')}
          {connection.clientHost && <span className="ml-2 text-sm font-normal text-muted-foreground">{connection.clientHost}</span>}
        </p>
        <p className="text-sm text-muted-foreground">
          {own
            ? t('team', { team: connection.teamName ?? connection.teamId })
            : t('teamAndUser', { team: connection.teamName ?? connection.teamId, user: connection.userName ?? connection.userEmail ?? connection.userId })}
        </p>
        <div className="flex flex-wrap gap-1">
          {byEntity(connection.scopes).map(([entity, actions]) => (
            <Badge key={entity} variant="secondary" className="font-normal">
              {entity}: {actions.map(action => t(`actions.${action}`)).join(', ')}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('since', { date: formatLocaleDate(connection.connectedAt, locale), renewed: formatLocaleDate(connection.lastRenewedAt, locale) })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {/* Permissions are taken away by the person the connection acts for; a manager of the team can only end it */}
        {own && (
          <Button variant="outline" size="sm" onClick={() => setEditing({ connection, keep: new Set(connection.scopes) })} data-cy="connected-app-edit">
            {t('edit.open')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEnding({ connection, own })} data-cy="connected-app-disconnect">
          {t('disconnect')}
        </Button>
      </div>
    </li>
  )

  const own = data?.data ?? []
  const managed = data?.managed ?? []

  return (
    <Card data-cy="connected-apps">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" aria-hidden="true" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t('loading')} />}
        {isError && <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>}
        {!isLoading && !isError && own.length === 0 && <p className="text-sm text-muted-foreground" data-cy="connected-apps-empty">{t('empty')}</p>}
        {own.length > 0 && <ul className="divide-y" data-cy="connected-apps-own">{own.map(connection => row(connection, true))}</ul>}
        {managed.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t('managedTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('managedDescription')}</p>
            <ul className="divide-y" data-cy="connected-apps-managed">{managed.map(connection => row(connection, false))}</ul>
          </div>
        )}
      </CardContent>

      <Dialog open={ending !== null} onOpenChange={open => { if (!open && !disconnect.isPending) setEnding(null) }}>
        <DialogContent data-cy="connected-app-confirm">
          <DialogHeader>
            <DialogTitle>{t('confirmTitle', { client: ending?.connection.clientName ?? t('unknownClient') })}</DialogTitle>
            <DialogDescription>{t('confirmDescription', { team: ending?.connection.teamName ?? ending?.connection.teamId ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={disconnect.isPending} onClick={() => setEnding(null)}>{t('cancel')}</Button>
            <Button variant="destructive" disabled={disconnect.isPending} onClick={() => ending && disconnect.mutate(ending)} data-cy="connected-app-confirm-disconnect">
              {t('disconnect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={open => { if (!open && !narrow.isPending) setEditing(null) }}>
        <DialogContent data-cy="connected-app-edit-dialog">
          <DialogHeader>
            <DialogTitle>{t('edit.title', { client: editing?.connection.clientName ?? t('unknownClient') })}</DialogTitle>
            <DialogDescription>{t('edit.description', { team: editing?.connection.teamName ?? editing?.connection.teamId ?? '' })}</DialogDescription>
          </DialogHeader>
          {editing && (
            <ul className="divide-y text-sm">
              {byEntity(editing.connection.scopes).map(([entity, actions]) => (
                <li key={entity} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-medium">{entity}</span>
                  <span className="flex flex-wrap justify-end gap-4">
                    {actions.map(action => {
                      const scope = `${entity}:${action}`
                      return (
                        <label key={scope} className="flex items-center gap-2">
                          <Checkbox
                            checked={editing.keep.has(scope)}
                            disabled={narrow.isPending}
                            onCheckedChange={value => toggleKeep(scope, value === true)}
                            data-cy={`connected-app-edit-${entity}-${action}`}
                          />
                          {t(`actions.${action}`)}
                        </label>
                      )
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {editing && editing.keep.size === 0 && <p className="text-sm text-muted-foreground" data-cy="connected-app-edit-empty">{t('edit.empty')}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={narrow.isPending} onClick={() => setEditing(null)}>{t('cancel')}</Button>
            <Button
              disabled={narrow.isPending || !editing || editing.keep.size === 0 || editing.keep.size === editing.connection.scopes.length}
              onClick={() => editing && narrow.mutate(editing)}
              data-cy="connected-app-edit-save"
            >
              {t('edit.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
