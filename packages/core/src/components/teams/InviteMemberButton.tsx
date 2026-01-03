'use client'

import { Button } from '../ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { useTeamsConfig } from '../../hooks/useTeamsConfig'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'

interface InviteMemberButtonProps {
  /**
   * Current team ID (to check member count)
   */
  teamId?: string

  /**
   * Current member count (if already available)
   * If provided, skips fetching member count
   */
  memberCount?: number

  /**
   * Callback fired when button is clicked (if allowed)
   * Opens the InviteMemberDialog
   */
  onClick?: () => void

  /**
   * Custom button text
   */
  children?: React.ReactNode

  /**
   * Button variant
   */
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'

  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon'

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Show icon
   */
  showIcon?: boolean
}

/**
 * InviteMemberButton - Conditional button for inviting team members
 *
 * Features:
 * - Respects Teams Mode configuration (canInvite)
 * - Validates maxMembersPerTeam limit
 * - Returns null if mode doesn't allow invitations
 * - Shows disabled state with tooltip if at limit
 *
 * Usage:
 * ```tsx
 * <InviteMemberButton
 *   memberCount={members.length}
 *   onClick={() => setDialogOpen(true)}
 * >
 *   Invite Member
 * </InviteMemberButton>
 * ```
 */
export function InviteMemberButton({
  memberCount = 0,
  onClick,
  children,
  variant = 'outline',
  size = 'default',
  className,
  showIcon = true,
}: InviteMemberButtonProps) {
  const t = useTranslations('teams')
  const { canInvite, options } = useTeamsConfig()

  // No mostrar en modo single-user
  if (!canInvite) {
    return null
  }

  // Verificar limite de miembros
  const maxMembersPerTeam = options?.maxMembersPerTeam
  const atLimit = maxMembersPerTeam != null && memberCount >= maxMembersPerTeam

  if (atLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={className}
              disabled
              data-cy="invite-member-button-disabled"
              aria-label={t('invite.limitReached', { limit: maxMembersPerTeam })}
            >
              {showIcon && <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />}
              {children || t('invite.inviteMember')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('invite.limitReached', { limit: maxMembersPerTeam })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      data-cy="invite-member-button"
      aria-label={t('invite.inviteMember')}
    >
      {showIcon && <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />}
      {children || t('invite.inviteMember')}
    </Button>
  )
}
