'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '../../ui/button'

export function AuthErrorPage() {
  const searchParams = useSearchParams()
  const t = useTranslations('auth.error')

  const error = searchParams.get('error')

  // Intentionally generic: don't reveal registration mode or system config
  const isAccountError = error?.toLowerCase() === 'unable_to_create_user'
    || error?.toLowerCase() === 'user_not_found'

  const titleKey = isAccountError ? 'unable_to_create.title' : 'generic.title'
  const descriptionKey = isAccountError ? 'unable_to_create.description' : 'generic.description'

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
          {t(descriptionKey)}
        </p>
      </div>

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
