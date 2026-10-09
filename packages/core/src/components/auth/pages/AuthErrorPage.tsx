'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '../../ui/button'
import { withBasePath } from '../../../lib/base-path'
import { registrationErrorKey } from '../../../lib/auth/registration-error-keys'

export function AuthErrorPage() {
  const searchParams = useSearchParams()
  const t = useTranslations('auth.error')
  const tAuth = useTranslations('auth')

  const error = searchParams.get('error')

  // Generic for anything else: don't reveal registration mode or system config.
  // A registration-policy code (OAuth sign-in from a domain outside
  // allowedDomains, ...) gets its own message, the same one the login form shows.
  const code = error?.toLowerCase() ?? ''
  const registrationKey = registrationErrorKey(error)
  const isAccountError = registrationKey !== null
    || code === 'unable_to_create_user'
    || code === 'unable_to_create_session'
    || code === 'user_not_found'

  const titleKey = isAccountError ? 'unable_to_create.title' : 'generic.title'
  const description = registrationKey
    ? tAuth(registrationKey)
    : t(isAccountError ? 'unable_to_create.description' : 'generic.description')

  return (
    <div className="space-y-6" data-cy="auth-error-page">
      <div className="flex justify-center">
        <div className="rounded-full p-4 bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1
          className="text-xl font-semibold text-foreground"
          data-cy="auth-error-title"
        >
          {t(titleKey)}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          asChild
          className="w-full"
          data-cy="auth-error-back-to-login"
        >
          <a href={withBasePath('/login')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToLogin')}
          </a>
        </Button>
      </div>
    </div>
  )
}
