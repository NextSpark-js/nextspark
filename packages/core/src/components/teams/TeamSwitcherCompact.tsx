'use client'

import Link from 'next/link'
import { ChevronUp, Users, Check, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { useTeamContext } from '../../contexts/TeamContext'
import { useTeamsConfig } from '../../hooks/useTeamsConfig'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface TeamSwitcherCompactProps {
  className?: string
}

/**
 * TeamSwitcherCompact - Compact team switcher for sidebar footer
 *
 * Features:
 * - Displays current team name and avatar
 * - Opens upward dropdown with team list
 * - Separates Personal and Work teams
 * - Shows team role for work teams
 * - Links to Manage Teams settings
 *
 * Usage:
 * ```tsx
 * <TeamSwitcherCompact />
 * ```
 */
export function TeamSwitcherCompact({ className }: TeamSwitcherCompactProps) {
  const t = useTranslations('teams')
  const { currentTeam, userTeams, switchTeam, isLoading } = useTeamContext()
  const { canSwitch } = useTeamsConfig()

  // Don't render if team switching is disabled for this mode
  // (only shown in multi-tenant mode)
  if (!canSwitch) {
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("p-2", className)}>
        <div className="flex items-center gap-2 p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16 mt-1" />
          </div>
        </div>
      </div>
    )
  }

  // No team available
  if (!currentTeam) {
    return null
  }

  const getTeamInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={cn("border-t border-border p-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto p-2 hover:bg-accent"
            data-cy="team-switcher-compact"
            aria-label={t('switcher.switchTeam')}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={currentTeam.avatarUrl || undefined} alt={currentTeam.name} />
                <AvatarFallback className="text-xs">
                  {getTeamInitials(currentTeam.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate max-w-[140px]">
                  {currentTeam.name}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {t('switcher.team')}
                </span>
              </div>
            </div>
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side="top"
          className="w-[240px]"
          data-cy="team-switcher-dropdown"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('switcher.switchTeam')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* All Teams - Simple flat list */}
          {userTeams.map(membership => {
            const isActive = currentTeam.id === membership.team.id

            return (
              <DropdownMenuItem
                key={membership.team.id}
                onClick={() => switchTeam(membership.team.id)}
                className="cursor-pointer"
                data-cy={`team-option-${membership.team.slug}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={membership.team.avatarUrl || undefined} alt={membership.team.name} />
                    <AvatarFallback className="text-xs">
                      <Users className="h-3 w-3" aria-hidden="true" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{membership.team.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {t(`roles.${membership.role}`)}
                    </span>
                  </div>
                </div>
                {isActive && <Check className="h-4 w-4 text-primary shrink-0" aria-label={t('switcher.active')} />}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          {/* Manage Teams Link */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link
              href="/dashboard/settings/teams"
              className="flex items-center gap-2"
              data-cy="manage-teams-link"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span>{t('switcher.manageTeams')}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
