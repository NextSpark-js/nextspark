'use client'

import { Info } from 'lucide-react'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { Switch } from '../../ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip'
import { useTranslations } from 'next-intl'
import { sel } from '../../../lib/test'
import type { AuthType } from './types'
import { TeamSelector } from './TeamSelector'

interface AuthSelectorProps {
  authType: AuthType
  apiKey: string
  bypassMode: boolean
  selectedTeamId: string | null
  /** Optional. The act-as input renders only when onActAsUserChange is provided. */
  actAsUserId?: string
  onAuthTypeChange: (type: AuthType) => void
  onApiKeyChange: (key: string) => void
  onBypassModeChange: (enabled: boolean) => void
  onTeamChange: (teamId: string | null) => void
  onActAsUserChange?: (userId: string) => void
}

export function AuthSelector({
  authType,
  apiKey,
  bypassMode,
  selectedTeamId,
  actAsUserId,
  onAuthTypeChange,
  onApiKeyChange,
  onBypassModeChange,
  onTeamChange,
  onActAsUserChange,
}: AuthSelectorProps) {
  const t = useTranslations('devtools.apiTester.auth')

  return (
    <div className="space-y-3" data-cy={sel('devtools.apiExplorer.auth.container')}>
      <RadioGroup
        value={authType}
        onValueChange={(value: string) => onAuthTypeChange(value as AuthType)}
        className="flex gap-4"
        data-cy={sel('devtools.apiExplorer.auth.typeGroup')}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="session" id="auth-session" data-cy={sel('devtools.apiExplorer.auth.sessionOption')} />
          <Label htmlFor="auth-session" className="cursor-pointer">
            {t('useSession')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="apiKey" id="auth-apikey" data-cy={sel('devtools.apiExplorer.auth.apiKeyOption')} />
          <Label htmlFor="auth-apikey" className="cursor-pointer">
            {t('useApiKey')}
          </Label>
        </div>
      </RadioGroup>

      {authType === 'apiKey' && (
        <Input
          placeholder={t('apiKeyPlaceholder')}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="font-mono"
          type="password"
          data-cy={sel('devtools.apiExplorer.auth.apiKeyInput')}
        />
      )}

      {/* Admin Bypass Toggle */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Switch
          id="bypass-mode"
          checked={bypassMode}
          onCheckedChange={onBypassModeChange}
          data-cy={sel('devtools.apiExplorer.auth.bypassToggle')}
        />
        <Label htmlFor="bypass-mode" className="text-sm cursor-pointer">
          {t('adminBypass')}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t('adminBypassTooltip')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Team Selector */}
      <TeamSelector
        selectedTeamId={selectedTeamId}
        onTeamChange={onTeamChange}
        bypassMode={bypassMode}
      />

      {/* Act as user — optional request override (the server strictly gates it).
          Renders only where wired (the API Explorer), not the plain API Tester. */}
      {onActAsUserChange && (
        <div className="space-y-1.5 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Label htmlFor="act-as-user" className="text-sm cursor-pointer">
              Act as user
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Developer-only. Resolves session-scoped endpoints (e.g. /me/*) as the
                  given user without switching your session. Requires the developer role,
                  a non-production environment, and ALLOW_ACT_AS_USER=true. Leave empty to
                  use your own session.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="act-as-user"
            placeholder="user id (empty = your own session)"
            value={actAsUserId ?? ''}
            onChange={(e) => onActAsUserChange(e.target.value)}
            className="font-mono text-sm"
            data-cy="devtools-api-auth-act-as-user"
          />
        </div>
      )}
    </div>
  )
}
