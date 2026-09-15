'use client'

import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface NoPermissionProps {
  /** Entity name for the message */
  entityName?: string
  /** Action that was attempted */
  action?: 'list' | 'read' | 'create' | 'update' | 'delete'
  /** Custom title */
  title?: string
  /** Custom description */
  description?: string
  /** Show back button */
  showBackButton?: boolean
  /** Show home button */
  showHomeButton?: boolean
  /** Custom redirect path */
  redirectPath?: string
}

/**
 * Component to display when user doesn't have permission to access a resource
 */
export function NoPermission({
  entityName,
  action = 'list',
  title,
  description,
  showBackButton = true,
  showHomeButton = true,
  redirectPath = '/dashboard',
}: NoPermissionProps) {
  const router = useRouter()

  const getActionText = () => {
    switch (action) {
      case 'list':
        return 'view the list of'
      case 'read':
        return 'view the details of'
      case 'create':
        return 'create'
      case 'update':
        return 'edit'
      case 'delete':
        return 'delete'
      default:
        return 'access'
    }
  }

  const defaultTitle = title || 'Access denied'
  const defaultDescription = description || (
    entityName
      ? `You don't have permission to ${getActionText()} ${entityName}. Contact your administrator if you need access.`
      : "You don't have permission to access this section. Contact your administrator if you need access."
  )

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8"
      data-cy="permission-denied"
    >
      <div className="max-w-md mx-auto">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl" data-cy="permission-denied-title">{defaultTitle}</CardTitle>
            <CardDescription className="text-base" data-cy="permission-denied-description">
              {defaultDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {showBackButton && (
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go back
              </Button>
            )}
            {showHomeButton && (
              <Button asChild className="w-full">
                <Link href={redirectPath}>
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default NoPermission
