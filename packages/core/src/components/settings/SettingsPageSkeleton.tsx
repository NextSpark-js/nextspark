import { Card, CardContent, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

interface SettingsPageSkeletonProps {
  title?: string
  description?: string
  sectionsCount?: number
  itemsPerSection?: number
}

export function SettingsPageSkeleton({ 
  title = '',
  description = '',
  sectionsCount = 3,
  itemsPerSection = 4
}: SettingsPageSkeletonProps) {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            {title ? (
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            ) : (
              <Skeleton className="h-8 w-48" />
            )}
            {description ? (
              <p className="text-muted-foreground">{description}</p>
            ) : (
              <Skeleton className="h-4 w-96" />
            )}
          </div>
          <Skeleton className="h-10 w-32" /> {/* Save button skeleton */}
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {Array.from({ length: sectionsCount }).map((_, sectionIndex) => (
          <Card key={sectionIndex}>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5 rounded" /> {/* Icon */}
                <div className="space-y-1">
                  <Skeleton className="h-6 w-40" /> {/* Section title */}
                  <Skeleton className="h-4 w-64" /> {/* Section description */}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: itemsPerSection }).map((_, itemIndex) => (
                <div key={itemIndex} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" /> {/* Setting title */}
                    <Skeleton className="h-3 w-48" /> {/* Setting description */}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-12" /> {/* Email label */}
                      <Skeleton className="h-6 w-12 rounded-full" /> {/* Email toggle */}
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-12" /> {/* Push label */}
                      <Skeleton className="h-6 w-12 rounded-full" /> {/* Push toggle */}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Skeleton específico para página de notificaciones
export function NotificationsPageSkeleton() {
  return (
    <SettingsPageSkeleton
      title="Notificaciones"
      description="Configura cómo y cuándo quieres recibir notificaciones."
      sectionsCount={3}
      itemsPerSection={3}
    />
  )
}

// Skeleton específico para página de seguridad
export function SecurityPageSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Seguridad</h1>
            <p className="text-muted-foreground">
              Mantén tu cuenta segura con estas configuraciones de seguridad.
            </p>
          </div>
          <Skeleton className="h-10 w-32" /> {/* Save button skeleton */}
        </div>
      </div>

      {/* Security Settings Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Two Factor Authentication */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>

            {/* Login Alerts */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
