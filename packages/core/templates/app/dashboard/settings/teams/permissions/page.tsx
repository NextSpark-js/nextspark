import { useTranslations } from 'next-intl'
import { PermissionsMatrix } from '@nextsparkjs/core/components/permissions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nextsparkjs/core/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
// Use PermissionService which reads from the build-time generated registry
import { PermissionService } from '@nextsparkjs/core/lib/services/permission.service'

/**
 * Team Permissions Page
 *
 * Displays a visual permissions matrix showing what each team role can do.
 * Organized by categories with tabs for easy navigation.
 */
export default function TeamPermissionsPage() {
  const t = useTranslations('permissions')

  // Get all unique categories from registry
  const categories = PermissionService.getCategories()

  return (
    <div className="space-y-6" data-cy="team-permissions-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Info Card with Role Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('rolesOverview')}</CardTitle>
          <CardDescription>{t('rolesOverviewDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <RoleCard role="owner" />
            <RoleCard role="admin" />
            <RoleCard role="member" />
            <RoleCard role="viewer" />
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix with Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-cy="tab-all">
            {t('allPermissions')}
          </TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} data-cy={`tab-${cat.toLowerCase()}`}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <PermissionsMatrix />
        </TabsContent>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat}>
            <PermissionsMatrix category={cat} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/**
 * RoleCard component
 *
 * Displays a visual card for each team role with color coding
 */
function RoleCard({ role }: { role: 'owner' | 'admin' | 'member' | 'viewer' }) {
  const t = useTranslations('permissions')

  const roleColors = {
    owner: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
    admin: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
    member: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
    viewer: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20',
  }

  return (
    <div className={`rounded-lg border p-4 ${roleColors[role]}`} data-cy={`role-card-${role}`}>
      <h3 className="font-semibold">{t(`roles.${role}.title`)}</h3>
      <p className="text-sm text-muted-foreground">{t(`roles.${role}.description`)}</p>
    </div>
  )
}
