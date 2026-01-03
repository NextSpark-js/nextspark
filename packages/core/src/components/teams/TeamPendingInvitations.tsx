'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Mail, Clock, Shield, Eye, Crown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { toast } from 'sonner'
import type { TeamInvitation, TeamRole } from '../../lib/teams/types'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { useAuth } from '../../hooks/useAuth'

// Role icons map - core roles only, custom roles use fallback
const roleIconsMap: Record<string, typeof Crown | null> = {
  owner: Crown,
  admin: Shield,
  member: null,
  viewer: Eye,
}

// Role colors map - core roles only, custom roles use fallback
const roleColorsMap: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  owner: 'destructive',
  admin: 'default',
  member: 'secondary',
  viewer: 'outline',
}

// Type-safe helpers - fallback handles any custom theme roles
const getRoleIcon = (role: TeamRole) => roleIconsMap[role] ?? Eye
const getRoleColor = (role: TeamRole) => roleColorsMap[role] ?? 'outline'

interface TeamPendingInvitationsProps {
  teamId: string
}

interface InvitationWithInviter extends TeamInvitation {
  inviterName: string | null
  inviterEmail: string
}

export function TeamPendingInvitations({ teamId }: TeamPendingInvitationsProps) {
  const t = useTranslations('teams')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { members } = useTeamMembers({ teamId })
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Check if current user can manage invitations
  const currentUserMember = members.find((m: any) => m.userId === user?.id || m.user_id === user?.id)
  const canManageInvitations = currentUserMember && ['owner', 'admin'].includes(currentUserMember.role)

  // Fetch pending invitations
  const { data: invitations = [], isLoading } = useQuery<InvitationWithInviter[]>({
    queryKey: ['team-invitations', teamId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/teams/${teamId}/invitations?status=pending`)
      if (!response.ok) throw new Error('Failed to fetch invitations')
      const json = await response.json()
      return json.data || []
    },
    enabled: !!teamId
  })

  // Cancel invitation mutation
  const cancelMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/v1/teams/${teamId}/invitations?id=${invitationId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel invitation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] })
      toast.success(t('messages.invitationCancelled'))
      setCancellingId(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('errors.unauthorized'))
      setCancellingId(null)
    }
  })

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        {t('messages.loading')}
      </div>
    )
  }

  if (invitations.length === 0) {
    return null // Don't show section if no pending invitations
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('invitations.pending')} ({invitations.length})
        </h4>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.email')}</TableHead>
              <TableHead>{t('fields.role')}</TableHead>
              <TableHead>{t('invitations.invitedBy')}</TableHead>
              <TableHead>{t('invitations.expiresAt')}</TableHead>
              {canManageInvitations && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => {
              const invitationRole = invitation.role as TeamRole
              const RoleIcon = getRoleIcon(invitationRole)
              const isExpired = new Date(invitation.expiresAt) < new Date()

              return (
                <TableRow key={invitation.id} data-cy={`invitation-row-${invitation.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{invitation.email}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={getRoleColor(invitationRole)}>
                      {RoleIcon && <RoleIcon className="h-3 w-3 mr-1" aria-hidden="true" />}
                      {t(`roles.${invitationRole}`)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {invitation.inviterName || invitation.inviterEmail}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-sm ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {isExpired
                          ? t('invitations.expired')
                          : formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                      </span>
                    </div>
                  </TableCell>

                  {canManageInvitations && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCancellingId(invitation.id)}
                        disabled={cancelMutation.isPending}
                        data-cy={`cancel-invitation-${invitation.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invitations.cancelTitle')}</DialogTitle>
            <DialogDescription>
              {t('invitations.cancelDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancellingId(null)}
              disabled={cancelMutation.isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancellingId && cancelMutation.mutate(cancellingId)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? t('messages.cancelling') : t('invitations.cancelConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
