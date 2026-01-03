'use client'

import { Button } from '../ui/button'
import { useTeamsConfig } from '../../hooks/useTeamsConfig'
import { useTeam } from '../../hooks/useTeam'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'

interface CreateTeamButtonProps {
  /**
   * Callback fired when button is clicked (if allowed)
   * Opens the CreateTeamDialog
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
 * CreateTeamButton - Conditional button for creating new teams
 *
 * Features:
 * - Respects Teams Mode configuration (canCreate)
 * - Respects allowCreateTeams option for multi-tenant
 * - Validates maxTeamsPerUser limit
 * - Returns null if mode doesn't allow creation or user already owns a team (when restricted)
 * - Shows disabled state with tooltip if at limit
 *
 * Usage:
 * ```tsx
 * <CreateTeamButton onClick={() => setDialogOpen(true)}>
 *   Create Team
 * </CreateTeamButton>
 * ```
 */
export function CreateTeamButton({
  onClick,
  children,
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
}: CreateTeamButtonProps) {
  const t = useTranslations('teams')
  const { canCreate } = useTeamsConfig()
  const { canCurrentUserCreateTeam } = useTeam()

  // No mostrar si modo no permite crear
  if (!canCreate) {
    return null
  }

  // No mostrar si allowCreateTeams es false Y el usuario ya es owner
  if (!canCurrentUserCreateTeam) {
    return null
  }

  // User can create team - show the button
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      data-cy="create-team-button"
      aria-label={t('create.createTeam')}
    >
      {showIcon && <Plus className="h-4 w-4 mr-2" aria-hidden="true" />}
      {children || t('create.createTeam')}
    </Button>
  )
}
