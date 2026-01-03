'use client'

import { AlertTriangle, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function ForbiddenContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') || 'No tienes permisos para acceder a este recurso'
  const upgrade = searchParams.get('upgrade') === 'true'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-100">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">
            ⚠️ Ups, no tienes permisos para hacer esto
          </CardTitle>
          <CardDescription className="text-gray-600">
            {reason}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {upgrade && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Esta funcionalidad requiere una mejora de tu plan actual.
              </p>
              <Link href="/dashboard/settings/billing" className="block mt-2">
                <Button variant="outline" size="sm" className="w-full">
                  Ver planes
                </Button>
              </Link>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>

            <Link href="/dashboard" className="flex-1">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ForbiddenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-100">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">
              ⚠️ Ups, no tienes permisos para hacer esto
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ForbiddenContent />
    </Suspense>
  )
}

export default getTemplateOrDefaultClient('app/403/page.tsx', ForbiddenPage)