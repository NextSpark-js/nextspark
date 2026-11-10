'use client'

import { AlertTriangle, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'

// Loaded only for an upgrade 403: it mounts the team providers to read the role, which other 403s do not need
const UpgradePlansLink = dynamic(() => import('@nextsparkjs/core/components/billing/UpgradePlansLink'), { ssr: false })

function ForbiddenContent() {
  const searchParams = useSearchParams()!
  const text = useTranslations('permissions.forbidden')
  const reason = searchParams.get('reason') || text('defaultReason')
  const upgrade = searchParams.get('upgrade') === 'true'

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-100">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">
            {text('title')}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {reason}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {upgrade && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                {text('upgradeRequired')}
              </p>
              <UpgradePlansLink />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {text('back')}
            </Button>

            <Link href="/dashboard" className="flex-1">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                {text('dashboard')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function ForbiddenPage() {
  const text = useTranslations('permissions.forbidden')
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-100">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">
              {text('title')}
            </CardTitle>
          </CardHeader>
        </Card>
      </main>
    }>
      <ForbiddenContent />
    </Suspense>
  )
}

export default ForbiddenPage