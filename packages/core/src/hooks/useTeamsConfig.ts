'use client'

import { useMemo } from 'react'
import type { TeamsMode, TeamsConfig } from '../lib/config/types'
import {
  canInviteMembers,
  canSwitchTeams,
  canCreateTeams
} from '../lib/teams/helpers'
import { APP_CONFIG_MERGED } from '../lib/config/config-sync'

export interface UseTeamsConfigReturn {
  mode: TeamsMode
  options: TeamsConfig['options']

  // Capabilities
  canInvite: boolean
  canSwitch: boolean
  canCreate: boolean

  // Configuration options
  allowCreateTeams: boolean
}

/**
 * Hook para acceder a la configuracion de teams en componentes React
 *
 * Este hook provee acceso a la configuracion de teams y capacidades calculadas
 * basadas en el modo configurado. Es estatico (usa APP_CONFIG_MERGED) por lo que
 * no causa re-renders innecesarios.
 *
 * @returns Configuracion de teams y capacidades del modo actual
 *
 * @example
 * ```tsx
 * function TeamControls() {
 *   const { canSwitch, canCreate, canInvite } = useTeamsConfig()
 *
 *   return (
 *     <div>
 *       {canSwitch && <TeamSwitcher />}
 *       {canCreate && <CreateTeamButton />}
 *       {canInvite && <InviteMemberButton />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useTeamsConfig(): UseTeamsConfigReturn {
  return useMemo(() => {
    const { mode, options } = APP_CONFIG_MERGED.teams

    return {
      mode,
      options,

      canInvite: canInviteMembers(mode),
      canSwitch: canSwitchTeams(mode),
      canCreate: canCreateTeams(mode),

      allowCreateTeams: options?.allowCreateTeams ?? true,
    }
  }, []) // Static config from merged config, no dependencies needed
}
