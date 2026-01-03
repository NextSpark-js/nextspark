'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { TeamRole } from '../../lib/teams/types'
import { toast } from 'sonner'
import { APP_CONFIG_MERGED } from '../../lib/config/config-sync'
import { getInvitableRoles } from '../../lib/teams/permissions'

// Get roles that a user can invite to (same level or below)
// Uses dynamic config to support theme-defined additional roles
function getAvailableRolesForInvite(userRole: TeamRole): TeamRole[] {
  const hierarchy = APP_CONFIG_MERGED.teamRoles.hierarchy
  const userLevel = hierarchy[userRole] ?? 0
  const invitableRoles = getInvitableRoles()

  // Filter to only roles at same level or below that the user can manage
  return invitableRoles.filter(role => {
    const roleLevel = hierarchy[role] ?? 0
    return roleLevel <= userLevel
  })
}

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Optional teamId to use instead of context teamId.
   * Useful when displaying in entity detail page where teamId comes from URL.
   */
  teamId?: string
  /**
   * Current user's role in the team - used to filter available roles
   */
  currentUserRole?: TeamRole
}

export function InviteMemberDialog({ open, onOpenChange, teamId, currentUserRole = 'owner' }: InviteMemberDialogProps) {
  const t = useTranslations('teams')
  const { inviteMemberAsync, isInviting } = useTeamMembers({ teamId })
  const [email, setEmail] = useState('')

  // Calculate available roles based on current user's role
  const availableRoles = getAvailableRolesForInvite(currentUserRole)

  // Default to 'admin' if available, otherwise highest available role
  const defaultRole = availableRoles.includes('admin') ? 'admin' : availableRoles[0]
  const [role, setRole] = useState<TeamRole>(defaultRole)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await inviteMemberAsync({ email, role })
      toast.success(t('messages.memberInvited'))
      onOpenChange(false)

      // Reset form
      setEmail('')
      setRole(defaultRole)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.unauthorized'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="invite-member-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('actions.invite')}</DialogTitle>
            <DialogDescription>
              {t('entity.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="member-email">
                {t('fields.email')}
              </Label>
              <Input
                id="member-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                data-cy="member-email-input"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="member-role">
                {t('fields.role')}
              </Label>
              <Select
                name="role"
                value={role}
                onValueChange={(value: string) => setRole(value as TeamRole)}
              >
                <SelectTrigger id="member-role" data-cy="member-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r} data-cy={`role-option-${r}`}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(`roles.${role}`)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isInviting}
              data-cy="cancel-invite-member"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isInviting}
              data-cy="submit-invite-member"
            >
              {isInviting ? t('actions.inviting') : t('actions.invite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
