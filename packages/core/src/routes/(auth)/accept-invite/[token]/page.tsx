'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@nextsparkjs/core/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Users, LogIn, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { sel } from '@nextsparkjs/core/selectors/teams'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

type InvitationStatus = 'loading' | 'valid' | 'accepting' | 'accepted' | 'error' | 'expired' | 'not_found' | 'email_mismatch' | 'already_member' | 'requires_auth'

interface InvitationInfo {
  teamName: string
  inviterName: string
  role: string
  email: string
}

function AcceptInvitePage() {
  const params = useParams()!
  const t = useTranslations('auth.acceptInvite')
  // The invitation is validated and accepted per token and user: a new `t` (another language) must not run that again
  const tRef = useRef(t)
  tRef.current = t
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const token = params.token as string

  const [status, setStatus] = useState<InvitationStatus>('loading')
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const autoAcceptAttempted = useRef(false)

  // Validate invitation and auto-accept when user is authenticated
  useEffect(() => {
    if (authLoading) return

    async function validateAndAccept() {
      try {
        // First validate the invitation
        const response = await fetch(withBasePath(`/api/v1/team-invitations/${token}`))
        const data = await response.json()

        if (!response.ok) {
          if (data.code === 'INVITATION_NOT_FOUND') {
            setStatus('not_found')
          } else if (data.code === 'INVITATION_EXPIRED') {
            setStatus('expired')
          } else {
            setStatus('error')
            setErrorMessage(data.error || tRef.current('errors.validate'))
          }
          return
        }

        const info = {
          teamName: data.data.teamName || tRef.current('unknownTeam'),
          inviterName: data.data.inviterName || tRef.current('someone'),
          role: data.data.role,
          email: data.data.email
        }
        setInvitationInfo(info)

        // Check if user is logged in
        if (!user) {
          setStatus('requires_auth')
          return
        }

        // Check email match
        if ((user.email ?? '').toLowerCase()  !== data.data.email.toLowerCase()) {
          setStatus('email_mismatch')
          setErrorMessage(tRef.current('mismatchDescription', { invitationEmail: data.data.email, userEmail: user.email ?? '' }))
          return
        }

        // Auto-accept the invitation since user is authenticated and email matches
        if (autoAcceptAttempted.current) return
        autoAcceptAttempted.current = true

        setStatus('accepting')

        const acceptResponse = await fetch(withBasePath(`/api/v1/team-invitations/${token}/accept`), {
          method: 'POST',
          credentials: 'include'
        })

        const acceptData = await acceptResponse.json()

        if (!acceptResponse.ok) {
          if (acceptData.code === 'ALREADY_MEMBER') {
            setStatus('already_member')
          } else if (acceptData.code === 'EMAIL_MISMATCH') {
            setStatus('email_mismatch')
            setErrorMessage(acceptData.error)
          } else if (acceptData.code === 'INVITATION_EXPIRED') {
            setStatus('expired')
          } else {
            setStatus('error')
            setErrorMessage(acceptData.error || tRef.current('errors.accept'))
          }
          return
        }

        setStatus('accepted')
        toast.success(tRef.current('welcomeToast', { team: info.teamName }), {
          description: tRef.current('toastDescription')
        })

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard/settings/teams')
        }, 1500)
      } catch {
        setStatus('error')
        setErrorMessage(tRef.current('errors.validate'))
      }
    }

    validateAndAccept()
  }, [token, user, authLoading, router])

  // Accept invitation (manual fallback)
  const handleAccept = async () => {
    setStatus('accepting')

    try {
      const response = await fetch(withBasePath(`/api/v1/team-invitations/${token}/accept`), {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'ALREADY_MEMBER') {
          setStatus('already_member')
        } else if (data.code === 'EMAIL_MISMATCH') {
          setStatus('email_mismatch')
          setErrorMessage(data.error)
        } else if (data.code === 'INVITATION_EXPIRED') {
          setStatus('expired')
        } else {
          setStatus('error')
          setErrorMessage(data.error || t('errors.accept'))
        }
        return
      }

      setStatus('accepted')
      toast.success(t('welcomeToast', { team: invitationInfo?.teamName ?? '' }), {
        description: t('toastDescription')
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard/settings/teams')
      }, 1500)
    } catch {
      setStatus('error')
      setErrorMessage(t('errors.accept'))
    }
  }

  // Build auth URLs with invitation context
  const buildAuthUrl = (path: string) => {
    const params = new URLSearchParams({
      callbackUrl: `/accept-invite/${token}`,
      fromInvite: 'true',
    })
    if (invitationInfo?.email) {
      params.set('email', invitationInfo.email)
    }
    // Pass token for signup to skip email verification
    if (path === '/signup') {
      params.set('inviteToken', token)
    }
    return `${path}?${params.toString()}`
  }

  const loginUrl = buildAuthUrl('/login')
  const signupUrl = buildAuthUrl('/signup')

  // Loading state
  if (authLoading || status === 'loading') {
    return (
      <div className="flex flex-col items-center py-6" data-cy={sel('teams.acceptInvite.loading')}>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t('validating')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-cy={sel('teams.acceptInvite.container')}>
      {/* Header with icon */}
      <div className="text-center" data-cy={sel('teams.acceptInvite.info')}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        {invitationInfo && (
          <p className="text-sm text-muted-foreground mt-1">
            {t.rich('invitedTo', { team: (chunks) => <strong data-cy={sel('teams.acceptInvite.teamName')}>{chunks}</strong>, name: invitationInfo.teamName })}
          </p>
        )}
      </div>

      {/* Requires Authentication */}
      {status === 'requires_auth' && invitationInfo && (
        <div data-cy={sel('teams.acceptInvite.requiresAuth')}>
          <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {t.rich('inviteSummary', {
                inviter: (chunks) => <strong data-cy={sel('teams.acceptInvite.inviter')}>{chunks}</strong>,
                team: (chunks) => <strong>{chunks}</strong>,
                role: (chunks) => <strong data-cy={sel('teams.acceptInvite.role')}>{chunks}</strong>,
                inviterName: invitationInfo.inviterName,
                teamName: invitationInfo.teamName,
                roleName: invitationInfo.role,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.rich('sentTo', { email: (chunks) => <strong>{chunks}</strong>, address: invitationInfo.email })}
            </p>
          </div>

          <div className="space-y-3 mt-6">
            <p className="text-sm text-center text-muted-foreground">
              {t('signInPrompt')}
            </p>
            <Button asChild className="w-full" data-cy={sel('teams.acceptInvite.signin')}>
              <Link href={loginUrl}>
                <LogIn className="mr-2 h-4 w-4" />
                {t('signIn')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full" data-cy={sel('teams.acceptInvite.signup')}>
              <Link href={signupUrl}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('createAccount')}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Valid - Ready to Accept */}
      {status === 'valid' && invitationInfo && (
        <div data-cy={sel('teams.acceptInvite.valid')}>
          <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {t.rich('inviteSummary', {
                inviter: (chunks) => <strong>{chunks}</strong>,
                team: (chunks) => <strong>{chunks}</strong>,
                role: (chunks) => <strong>{chunks}</strong>,
                inviterName: invitationInfo.inviterName,
                teamName: invitationInfo.teamName,
                roleName: invitationInfo.role,
              })}
            </p>
          </div>

          <Button onClick={handleAccept} className="w-full mt-6" data-cy={sel('teams.acceptInvite.accept')}>
            {t('accept')}
          </Button>
        </div>
      )}

      {/* Accepting */}
      {status === 'accepting' && (
        <div className="flex flex-col items-center py-4" data-cy={sel('teams.acceptInvite.accepting')}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">{t('accepting')}</p>
        </div>
      )}

      {/* Accepted */}
      {status === 'accepted' && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900" data-cy={sel('teams.acceptInvite.success')}>
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">{t('successTitle')}</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            {t('successDescription', { team: invitationInfo?.teamName ?? '' })}
          </AlertDescription>
        </Alert>
      )}

      {/* Already Member */}
      {status === 'already_member' && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900" data-cy={sel('teams.acceptInvite.alreadyMember')}>
          <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">{t('alreadyTitle')}</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            {t('alreadyDescription')}
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/dashboard/settings/teams">{t('goToTeams')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Email Mismatch */}
      {status === 'email_mismatch' && (
        <Alert variant="destructive" data-cy={sel('teams.acceptInvite.emailMismatch')}>
          <XCircle className="h-5 w-5" />
          <AlertTitle>{t('mismatchTitle')}</AlertTitle>
          <AlertDescription>
            {errorMessage}
            <br />
            <Button asChild variant="link" className="p-0 h-auto">
              <Link href={loginUrl}>{t('differentAccount')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Not Found */}
      {status === 'not_found' && (
        <Alert variant="destructive" data-cy={sel('teams.acceptInvite.notFound')}>
          <XCircle className="h-5 w-5" />
          <AlertTitle>{t('notFoundTitle')}</AlertTitle>
          <AlertDescription>
            {t('notFoundDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* Expired */}
      {status === 'expired' && (
        <Alert variant="destructive" data-cy={sel('teams.acceptInvite.expired')}>
          <XCircle className="h-5 w-5" />
          <AlertTitle>{t('expiredTitle')}</AlertTitle>
          <AlertDescription>
            {t('expiredDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* Generic Error */}
      {status === 'error' && (
        <Alert variant="destructive" data-cy={sel('teams.acceptInvite.error')}>
          <XCircle className="h-5 w-5" />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>{errorMessage || t('errorFallback')}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default AcceptInvitePage
