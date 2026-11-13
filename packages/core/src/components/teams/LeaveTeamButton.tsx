'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'
import { useTeamContext } from '../../contexts/TeamContext'
import { withBasePath } from '../../lib/base-path'

/** The route's refusal codes with a message of their own in the `teams` catalog */
const REFUSAL_MESSAGES = new Map<unknown, string>([
  ['OWNER_CANNOT_LEAVE', 'errors.cannotLeaveOwner'],
  ['SYSTEM_TEAM_LEAVE_DISABLED', 'errors.cannotLeaveSystemTeam'],
])

interface LeaveTeamButtonProps {
  teamId: string
  teamName: string
  /** The signed-in user's role in this team */
  role: string
}

/**
 * "Leave team" with a confirmation, through DELETE /api/v1/teams/:teamId/members/me (#459). The owner sees it
 * disabled with the reason: they transfer ownership first. Leaving the current team moves the user to their
 * earliest-joined other team (the TeamContext default), or to the no-team state when there is none.
 */
export function LeaveTeamButton({ teamId, teamName, role }: LeaveTeamButtonProps) {
  const t = useTranslations('teams')
  const { currentTeam, userTeams, switchTeam, refreshTeams } = useTeamContext()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const isOwner = role === 'owner'

  const leave = async () => {
    setLeaving(true)
    // A refusal the user can act on is translated by its code; anything else (and a network failure) gets the generic
    // message. The API's own `error` is English, so it is never shown.
    let failure: string | null = null
    try {
      const response = await fetch(withBasePath(`/api/v1/teams/${teamId}/members/me`), { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const key = REFUSAL_MESSAGES.get(body?.code)
        failure = key ? t(key) : t('leave.error')
      }
    } catch {
      failure = t('leave.error')
    }
    if (failure) {
      toast.error(failure)
      setLeaving(false)
      return
    }
    setOpen(false)
    setLeaving(false)
    toast.success(t('leave.success', { name: teamName }))

    if (currentTeam?.id === teamId) {
      const next = userTeams
        .filter(m => m.team.id !== teamId)
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0]
      if (next) {
        // the switch flow: the cookie, a cleared cache and a reload in the new team
        await switchTeam(next.team.id)
        return
      }
      // no team left: TeamContext clears the current team once the refreshed list is empty
      if (typeof window !== 'undefined') localStorage.removeItem('activeTeamId')
    }
    await refreshTeams()
  }

  if (isOwner) {
    return (
      <div className="space-y-2" data-cy="leave-team-owner">
        <Button variant="outline" disabled data-cy="leave-team-button">
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('actions.leave')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('errors.cannotLeaveOwner')}</p>
      </div>
    )
  }

  return (
    <>
      <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)} data-cy="leave-team-button">
        <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
        {t('actions.leave')}
      </Button>
      <AlertDialog open={open} onOpenChange={value => !leaving && setOpen(value)}>
        <AlertDialogContent data-cy="leave-team-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leave.title', { name: teamName })}</AlertDialogTitle>
            <AlertDialogDescription>{t('leave.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => { event.preventDefault(); void leave() }}
              disabled={leaving}
              data-cy="leave-team-confirm"
            >
              {t('leave.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
