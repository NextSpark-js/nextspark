'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@nextsparkjs/core/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Users, LogIn, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createCyId } from '@nextsparkjs/core/lib/test'

type InvitationStatus = 'loading' | 'valid' | 'accepting' | 'accepted' | 'error' | 'expired' | 'not_found' | 'email_mismatch' | 'already_member' | 'requires_auth'

interface InvitationInfo {
  teamName: string
  inviterName: string
  role: string
  email: string
}

export default function AcceptInvitePage() {
  const params = useParams()
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
        const response = await fetch(`/api/v1/team-invitations/${token}`)
        const data = await response.json()

        if (!response.ok) {
          if (data.code === 'INVITATION_NOT_FOUND') {
            setStatus('not_found')
          } else if (data.code === 'INVITATION_EXPIRED') {
            setStatus('expired')
          } else {
            setStatus('error')
            setErrorMessage(data.error || 'Failed to validate invitation')
          }
          return
        }

        const info = {
          teamName: data.data.teamName || 'Unknown Team',
          inviterName: data.data.inviterName || 'Someone',
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
        if (user.email.toLowerCase() !== data.data.email.toLowerCase()) {
          setStatus('email_mismatch')
          setErrorMessage(`This invitation was sent to ${data.data.email}, but you are logged in as ${user.email}`)
          return
        }

        // Auto-accept the invitation since user is authenticated and email matches
        if (autoAcceptAttempted.current) return
        autoAcceptAttempted.current = true

        setStatus('accepting')

        const acceptResponse = await fetch(`/api/v1/team-invitations/${token}/accept`, {
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
            setErrorMessage(acceptData.error || 'Failed to accept invitation')
          }
          return
        }

        setStatus('accepted')
        toast.success(`Welcome to ${info.teamName}!`, {
          description: 'You have successfully joined the team'
        })

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard/settings/teams')
        }, 1500)
      } catch {
        setStatus('error')
        setErrorMessage('Failed to validate invitation')
      }
    }

    validateAndAccept()
  }, [token, user, authLoading, router])

  // Accept invitation (manual fallback)
  const handleAccept = async () => {
    setStatus('accepting')

    try {
      const response = await fetch(`/api/v1/team-invitations/${token}/accept`, {
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
          setErrorMessage(data.error || 'Failed to accept invitation')
        }
        return
      }

      setStatus('accepted')
      toast.success(`Welcome to ${invitationInfo?.teamName}!`, {
        description: 'You have successfully joined the team'
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard/settings/teams')
      }, 1500)
    } catch {
      setStatus('error')
      setErrorMessage('Failed to accept invitation')
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

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-cy={createCyId('accept-invite', 'loading')}>
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-cy={createCyId('accept-invite', 'container')}>
      <Card className="w-full max-w-md" data-cy={createCyId('accept-invite', 'info')}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Team Invitation</CardTitle>
          <CardDescription>
            {invitationInfo && (
              <>You&apos;ve been invited to join <strong data-cy={createCyId('accept-invite', 'team-name')}>{invitationInfo.teamName}</strong></>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Requires Authentication */}
          {status === 'requires_auth' && invitationInfo && (
            <div data-cy={createCyId('accept-invite', 'requires-auth')}>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong data-cy={createCyId('accept-invite', 'inviter')}>{invitationInfo.inviterName}</strong> has invited you to join <strong>{invitationInfo.teamName}</strong> as a <strong data-cy={createCyId('accept-invite', 'role')}>{invitationInfo.role}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  This invitation was sent to <strong>{invitationInfo.email}</strong>
                </p>
              </div>

              <div className="space-y-3 mt-6">
                <p className="text-sm text-center text-muted-foreground">
                  Please sign in or create an account to accept this invitation.
                </p>
                <Button asChild className="w-full" data-cy={createCyId('accept-invite', 'signin')}>
                  <Link href={loginUrl}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full" data-cy={createCyId('accept-invite', 'signup')}>
                  <Link href={signupUrl}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Valid - Ready to Accept */}
          {status === 'valid' && invitationInfo && (
            <div data-cy={createCyId('accept-invite', 'valid')}>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{invitationInfo.inviterName}</strong> has invited you to join <strong>{invitationInfo.teamName}</strong> as a <strong>{invitationInfo.role}</strong>.
                </p>
              </div>

              <Button onClick={handleAccept} className="w-full mt-6" data-cy={createCyId('accept-invite', 'accept')}>
                Accept Invitation
              </Button>
            </div>
          )}

          {/* Accepting */}
          {status === 'accepting' && (
            <div className="flex flex-col items-center py-4" data-cy={createCyId('accept-invite', 'accepting')}>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Accepting invitation...</p>
            </div>
          )}

          {/* Accepted */}
          {status === 'accepted' && (
            <Alert className="border-green-200 bg-green-50" data-cy={createCyId('accept-invite', 'success')}>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-800">Welcome to the team!</AlertTitle>
              <AlertDescription className="text-green-700">
                You&apos;ve successfully joined {invitationInfo?.teamName}. Redirecting to your dashboard...
              </AlertDescription>
            </Alert>
          )}

          {/* Already Member */}
          {status === 'already_member' && (
            <Alert className="border-blue-200 bg-blue-50" data-cy={createCyId('accept-invite', 'already-member')}>
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <AlertTitle className="text-blue-800">Already a member</AlertTitle>
              <AlertDescription className="text-blue-700">
                You&apos;re already a member of this team.
                <Button asChild variant="link" className="p-0 h-auto ml-1">
                  <Link href="/dashboard/settings/teams">Go to Teams</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Email Mismatch */}
          {status === 'email_mismatch' && (
            <Alert variant="destructive" data-cy={createCyId('accept-invite', 'email-mismatch')}>
              <XCircle className="h-5 w-5" />
              <AlertTitle>Email mismatch</AlertTitle>
              <AlertDescription>
                {errorMessage}
                <br />
                <Button asChild variant="link" className="p-0 h-auto">
                  <Link href={loginUrl}>Sign in with a different account</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Not Found */}
          {status === 'not_found' && (
            <Alert variant="destructive" data-cy={createCyId('accept-invite', 'not-found')}>
              <XCircle className="h-5 w-5" />
              <AlertTitle>Invitation not found</AlertTitle>
              <AlertDescription>
                This invitation link is invalid or has already been used. Please contact the team owner for a new invitation.
              </AlertDescription>
            </Alert>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <Alert variant="destructive" data-cy={createCyId('accept-invite', 'expired')}>
              <XCircle className="h-5 w-5" />
              <AlertTitle>Invitation expired</AlertTitle>
              <AlertDescription>
                This invitation has expired. Please contact the team owner for a new invitation.
              </AlertDescription>
            </Alert>
          )}

          {/* Generic Error */}
          {status === 'error' && (
            <Alert variant="destructive" data-cy={createCyId('accept-invite', 'error')}>
              <XCircle className="h-5 w-5" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage || 'An error occurred. Please try again.'}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
