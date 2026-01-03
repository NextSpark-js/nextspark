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
import type { AuthType } from './types'

interface AuthSelectorProps {
  authType: AuthType
  apiKey: string
  bypassMode: boolean
  onAuthTypeChange: (type: AuthType) => void
  onApiKeyChange: (key: string) => void
  onBypassModeChange: (enabled: boolean) => void
}

export function AuthSelector({
  authType,
  apiKey,
  bypassMode,
  onAuthTypeChange,
  onApiKeyChange,
  onBypassModeChange,
}: AuthSelectorProps) {
  const t = useTranslations('devtools.apiTester.auth')

  return (
    <div className="space-y-3" data-cy="api-tester-auth">
      <RadioGroup
        value={authType}
        onValueChange={(value: string) => onAuthTypeChange(value as AuthType)}
        className="flex gap-4"
        data-cy="api-tester-auth-type"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="session" id="auth-session" data-cy="api-tester-auth-session" />
          <Label htmlFor="auth-session" className="cursor-pointer">
            {t('useSession')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="apiKey" id="auth-apikey" data-cy="api-tester-auth-apikey" />
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
          data-cy="api-tester-apikey-input"
        />
      )}

      {/* Admin Bypass Toggle */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Switch
          id="bypass-mode"
          checked={bypassMode}
          onCheckedChange={onBypassModeChange}
          data-cy="api-tester-bypass-toggle"
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
    </div>
  )
}
