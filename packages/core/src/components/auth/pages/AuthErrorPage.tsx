'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldAlert, Lock, Globe, UserX, ArrowLeft, Mail } from 'lucide-react'
import { Button } from '../../ui/button'
import { PUBLIC_AUTH_CONFIG } from '../../../lib/config/config-sync'

/**
 * Map Better Auth error codes and our custom codes to structured error info.
 * Returns the appropriate icon, translation key, and suggested action.
 */
function getErrorInfo(error: string | null, registrationMode: string) {
  // Normalize the error code
  const code = (error || 'unknown').toLowerCase()

  // Domain-restricted: user tried to sign in with a non-allowed domain
  if (code === 'unable_to_create_user' && registrationMode === 'domain-restricted') {
    return {
      type: 'domain_restricted' as const,
      icon: Globe,
      severity: 'warning' as const,
    }
  }

  // Closed mode: user tried to register when registration is closed
  if (code === 'unable_to_create_user' && registrationMode === 'closed') {
    return {
      type: 'registration_closed' as const,
      icon: Lock,
      severity: 'info' as const,
    }
  }

  // Invitation-only: user tried to register without invitation
  if (code === 'unable_to_create_user' && registrationMode === 'invitation-only') {
    return {
      type: 'invitation_required' as const,
      icon: Mail,
      severity: 'info' as const,
    }
  }

  // Generic unable to create user
  if (code === 'unable_to_create_user') {
    return {
      type: 'unable_to_create' as const,
      icon: UserX,
      severity: 'warning' as const,
    }
  }

  // User not found or invalid credentials during OAuth
  if (code === 'user_not_found') {
    return {
      type: 'user_not_found' as const,
      icon: UserX,
      severity: 'warning' as const,
    }
  }

  // Fallback for any other error
  return {
    type: 'generic' as const,
    icon: ShieldAlert,
    severity: 'error' as const,
  }
}

const severityStyles = {
  warning: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    accentBorder: 'border-amber-500/20',
  },
  info: {
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    accentBorder: 'border-blue-500/20',
  },
  error: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    accentBorder: 'border-destructive/20',
  },
}

export function AuthErrorPage() {
  const searchParams = useSearchParams()
  const t = useTranslations('auth.error')

  const error = searchParams.get('error')
  const registrationMode = PUBLIC_AUTH_CONFIG.registration.mode

  const errorInfo = getErrorInfo(error, registrationMode)
  const styles = severityStyles[errorInfo.severity]
  const Icon = errorInfo.icon

  // Get translations for this error type
  const title = t(`${errorInfo.type}.title`)
  const description = t(`${errorInfo.type}.description`)

  return (
    <div className="space-y-6" data-cy="auth-error-page">
      {/* Icon */}
      <div className="flex justify-center">
        <div className={`rounded-full p-4 ${styles.iconBg}`}>
          <Icon className={`h-8 w-8 ${styles.iconColor}`} strokeWidth={1.5} />
        </div>
      </div>

      {/* Title & Description */}
      <div className="text-center space-y-2">
        <h1
          className="text-xl font-semibold text-foreground"
          data-cy="auth-error-title"
        >
          {title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          asChild
          className="w-full"
          data-cy="auth-error-back-to-login"
        >
          <a href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToLogin')}
          </a>
        </Button>
      </div>
    </div>
  )
}
