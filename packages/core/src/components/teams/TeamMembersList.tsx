'use client'

import { useState } from 'react'
import { MoreHorizontal, Crown, Shield, Eye, UserMinus, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { useTeam } from '../../hooks/useTeam'
import { useAuth } from '../../hooks/useAuth'
import { InviteMemberDialog } from './InviteMemberDialog'
import { TeamRole } from '../../lib/teams/types'
import { APP_CONFIG_MERGED } from '../../lib/config/config-sync'
import { canManageRole } from '../../lib/teams/permissions'

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

interface TeamMembersListProps {
  /**
   * Optional teamId to use instead of context teamId.
   * Useful when displaying in entity detail page where teamId comes from URL.
   */
  teamId?: string
  /**
   * When true, hides all management actions (invite, change role, remove).
   * Used for read-only views like in admin panel.
   */
  readOnly?: boolean
}

export function TeamMembersList({ teamId: propTeamId, readOnly = false }: TeamMembersListProps = {}) {
  const t = useTranslations('teams')
  const { user } = useAuth()
  const { team } = useTeam()
  // Use prop teamId if provided, otherwise fall back to context
  const { members, isLoading, updateMemberRole, removeMember } = useTeamMembers({ teamId: propTeamId })
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {t('messages.loading')}
        </div>
      </div>
    )
  }

  const currentUserMember = members.find((m: any) => m.userId === user?.id || m.user_id === user?.id)
  const currentUserRole = currentUserMember?.role || 'viewer'
  // In readOnly mode, no one can manage members
  const canManageMembers = !readOnly && currentUserMember && ['owner', 'admin'].includes(currentUserMember.role)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {t('entity.plural')} ({members.length})
        </h3>
        {canManageMembers && (
          <Button
            onClick={() => setShowInviteDialog(true)}
            data-cy="invite-member-button"
          >
            {t('actions.invite')}
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.name')}</TableHead>
              <TableHead>{t('fields.role')}</TableHead>
              <TableHead>{t('fields.joinedAt')}</TableHead>
              {canManageMembers && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member: any) => {
              const memberRole = member.role as TeamRole
              const RoleIcon = getRoleIcon(memberRole)
              const isOwner = memberRole === 'owner'
              const isCurrentUser = member.userId === user?.id || member.user_id === user?.id

              return (
                <TableRow key={member.id} data-cy={`member-row-${member.userId || member.user_id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.user?.avatarUrl || member.user?.avatar_url} alt={member.user?.name} />
                        <AvatarFallback>
                          {(member.user?.name?.[0] || member.user?.email?.[0] || '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={getRoleColor(memberRole)}>
                      {RoleIcon && <RoleIcon className="h-3 w-3 mr-1" aria-hidden="true" />}
                      {t(`roles.${memberRole}`)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(member.joinedAt || member.joined_at), {
                        addSuffix: true
                      })}
                    </span>
                  </TableCell>

                  {canManageMembers && (
                    <TableCell>
                      {!isOwner && !isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-cy={`member-actions-${member.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Dynamic role options from merged config */}
                            {APP_CONFIG_MERGED.teamRoles.availableTeamRoles
                              .filter((role: string) =>
                                role !== 'owner' && // Cannot assign owner role
                                role !== memberRole && // Don't show current role
                                canManageRole(currentUserRole, role) // Only roles user can manage
                              )
                              .map((role: string) => {
                                // Get role label with fallback to capitalized role name
                                const roleLabel = t(`roles.${role}`, { defaultValue: role.charAt(0).toUpperCase() + role.slice(1) })
                                return (
                                  <DropdownMenuItem
                                    key={role}
                                    onClick={() => updateMemberRole({
                                      memberId: member.id,
                                      role: role as TeamRole
                                    })}
                                    data-cy={`make-${role}-action`}
                                  >
                                    {t('actions.makeRole', { role: roleLabel })}
                                  </DropdownMenuItem>
                                )
                              })
                            }
                            <DropdownMenuItem
                              onClick={() => removeMember(member.id)}
                              className="text-destructive"
                              data-cy="remove-member-action"
                            >
                              <UserMinus className="h-4 w-4 mr-2" aria-hidden="true" />
                              {t('actions.removeMember')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          teamId={propTeamId}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  )
}
