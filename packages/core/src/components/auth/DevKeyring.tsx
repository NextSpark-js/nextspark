'use client'

import { useState, useCallback, useMemo } from 'react'
import { Key, ChevronDown, User, Shield, Crown, ShieldCheck, UserCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { sel } from '../../lib/test'
import type { DevKeyringConfig, DevKeyringUser } from '../../lib/config/types'

interface DevKeyringProps {
  /** DevKeyring configuration from theme */
  config: DevKeyringConfig
}

interface ParsedRole {
  team: string
  role: 'owner' | 'admin' | 'member'
  isHighlighted: boolean
}

/**
 * Parse teamRoles string into structured role objects
 * Example: "TechCorp (admin), RetailCo (member) ⭐" → [{team: "TechCorp", role: "admin"}, {team: "RetailCo", role: "member", isHighlighted: true}]
 */
function parseTeamRoles(teamRoles: string | undefined): ParsedRole[] {
  if (!teamRoles) return []

  // Check for highlight marker (star emoji)
  const hasHighlight = teamRoles.includes('⭐')
  const cleanRoles = teamRoles.replace('⭐', '').trim()

  // Split by comma and parse each role
  return cleanRoles.split(',').map((part, index, arr) => {
    const trimmed = part.trim()
    // Extract team name and role from pattern like "TeamName (role)"
    const match = trimmed.match(/^(.+?)\s*\((\w+)\)$/)

    if (match) {
      const [, team, role] = match
      return {
        team: team.trim(),
        role: (role.toLowerCase() as 'owner' | 'admin' | 'member'),
        // Highlight the last item if star was present
        isHighlighted: hasHighlight && index === arr.length - 1
      }
    }

    // Fallback for unstructured text
    return {
      team: trimmed,
      role: 'member' as const,
      isHighlighted: false
    }
  })
}

/**
 * Get badge styling based on role type
 */
function getRoleBadgeStyle(role: 'owner' | 'admin' | 'member', isHighlighted: boolean) {
  const baseClass = 'text-[9px] px-1.5 py-0 h-4 font-medium gap-0.5'

  if (isHighlighted) {
    return {
      className: `${baseClass} bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700`,
      icon: Crown
    }
  }

  switch (role) {
    case 'owner':
      return {
        className: `${baseClass} bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700`,
        icon: Crown
      }
    case 'admin':
      return {
        className: `${baseClass} bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700`,
        icon: ShieldCheck
      }
    case 'member':
    default:
      return {
        className: `${baseClass} bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600`,
        icon: UserCircle
      }
  }
}

/**
 * Role badges component for a user
 */
function UserRoleBadges({ teamRoles }: { teamRoles: string | undefined }) {
  const parsedRoles = useMemo(() => parseTeamRoles(teamRoles), [teamRoles])

  if (parsedRoles.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {parsedRoles.map((parsed, idx) => {
        const style = getRoleBadgeStyle(parsed.role, parsed.isHighlighted)
        const Icon = style.icon

        return (
          <Badge
            key={`${parsed.team}-${idx}`}
            variant="outline"
            className={style.className}
          >
            <Icon className="h-2.5 w-2.5" />
            <span className="truncate max-w-[120px]">{parsed.team}</span>
            <span className="opacity-60">({parsed.role})</span>
          </Badge>
        )
      })}
    </div>
  )
}

/**
 * DevKeyring - Development/QA credential selector
 *
 * Provides quick access to test credentials during development.
 * This component should ONLY be rendered in development/test environments.
 *
 * Features:
 * - Shows a floating button below the login form
 * - Displays list of test users with their roles
 * - Auto-fills email and password on user selection
 * - Auto-expands email form if collapsed
 *
 * SECURITY: Only renders when NODE_ENV !== 'production'
 */
export function DevKeyring({ config }: DevKeyringProps) {
  const [isOpen, setIsOpen] = useState(false)

  // SECURITY: Never render in production
  if (process.env.NODE_ENV === 'production') return null

  // Check if enabled and has users
  if (!config?.enabled || !config.users?.length) return null

  /**
   * Fill the login form with selected user's credentials
   */
  const fillForm = useCallback((email: string, password: string) => {
    // First, check if email form needs to be expanded
    const showEmailButton = document.querySelector('[data-cy="login-show-email"]') as HTMLButtonElement

    if (showEmailButton) {
      // Click to show email form, then fill after brief delay
      showEmailButton.click()
      setTimeout(() => fillInputs(email, password), 100)
    } else {
      // Form already visible, fill immediately
      fillInputs(email, password)
    }

    setIsOpen(false)
  }, [])

  /**
   * Fill input fields using native value setter to work with react-hook-form
   */
  const fillInputs = (email: string, password: string) => {
    const emailInput = document.getElementById('email') as HTMLInputElement
    const passwordInput = document.getElementById('password') as HTMLInputElement

    if (emailInput && passwordInput) {
      // Use native value setter to bypass React's synthetic events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set

      nativeInputValueSetter?.call(emailInput, email)
      nativeInputValueSetter?.call(passwordInput, password)

      // Dispatch input events to trigger react-hook-form validation
      emailInput.dispatchEvent(new Event('input', { bubbles: true }))
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <div
      className="flex justify-center mt-4"
      data-cy={sel('auth.devKeyring.container')}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            data-cy={sel('auth.devKeyring.trigger')}
          >
            <Key className="h-3 w-3" />
            <span>Dev Keyring</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-0"
          align="center"
          data-cy={sel('auth.devKeyring.content')}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Test Credentials</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                DEV ONLY
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select a user to auto-fill the login form
            </p>
          </div>

          {/* User List */}
          <div className="max-h-[400px] overflow-y-auto">
            <div className="p-1">
              {config.users.map((user, index) => (
                <button
                  key={user.id || user.email}
                  type="button"
                  onClick={() => fillForm(user.email, user.password)}
                  className="w-full text-left px-3 py-2 rounded-sm hover:bg-accent transition-colors"
                  data-cy={sel('auth.devKeyring.user', { index })}
                >
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {user.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <UserRoleBadges teamRoles={user.teamRoles} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t text-[10px] text-muted-foreground text-center space-y-0.5">
            <div>Core: <code className="bg-muted px-1 rounded">Pandora1234</code></div>
            <div>Demo: <code className="bg-muted px-1 rounded">Test1234</code></div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
