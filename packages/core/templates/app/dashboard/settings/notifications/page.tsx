'use client'


import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { toast } from 'sonner'
import { 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Shield,
  Zap,
  Save,
  Loader2
} from 'lucide-react'
import { createTestId, createCyId } from '@nextsparkjs/testing'
import { useTranslations } from 'next-intl'
import { useUserWithMetaSettings } from '@nextsparkjs/core/hooks/useUserSettings'
import { NotificationsPageSkeleton } from '@nextsparkjs/core/components/settings/SettingsPageSkeleton'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function NotificationsPage() {
  const t = useTranslations('settings')
  
  // Hook para manejar user metadata con autenticación de sesión
  const { 
    data: userData, 
    isLoading: isLoadingUser,
    updateEntity: updateUserMeta,
    isUpdating 
  } = useUserWithMetaSettings()
  
  // Estado para el master switch de push notifications
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true)
  
  // Estados individuales para cada notificación
  const [notificationSettings, setNotificationSettings] = useState({
    login_alerts: { email: true, push: true },
    password_changes: { email: true, push: true },
    suspicious_activity: { email: true, push: true },
    mentions: { email: true, push: true },
    project_updates: { email: true, push: false },
    team_invites: { email: true, push: true },
    newsletter: { email: false, push: false },
    promotions: { email: false, push: false },
    feature_announcements: { email: true, push: false },
  })

  const [statusMessage, setStatusMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Cargar configuraciones desde metadata al montar el componente
  useEffect(() => {
    if (userData?.meta?.notificationsPreferences) {
      const notifPrefs = userData.meta.notificationsPreferences as Record<string, unknown>
      
      // Cargar configuración de push notifications
      if (notifPrefs.pushEnabled !== undefined) {
        setPushNotificationsEnabled(notifPrefs.pushEnabled as boolean)
      }
      
      // Cargar configuraciones individuales de notificaciones
      setNotificationSettings({
        login_alerts: { 
          email: (notifPrefs.loginAlertsEmail as boolean) ?? true, 
          push: (notifPrefs.loginAlertsPush as boolean) ?? true 
        },
        password_changes: { 
          email: (notifPrefs.passwordChangesEmail as boolean) ?? true, 
          push: (notifPrefs.passwordChangesPush as boolean) ?? true 
        },
        suspicious_activity: { 
          email: (notifPrefs.suspiciousActivityEmail as boolean) ?? true, 
          push: (notifPrefs.suspiciousActivityPush as boolean) ?? true 
        },
        mentions: { 
          email: (notifPrefs.mentionsEmail as boolean) ?? true, 
          push: (notifPrefs.mentionsPush as boolean) ?? true 
        },
        project_updates: { 
          email: (notifPrefs.projectUpdatesEmail as boolean) ?? true, 
          push: (notifPrefs.projectUpdatesPush as boolean) ?? false 
        },
        team_invites: { 
          email: (notifPrefs.teamInvitesEmail as boolean) ?? true, 
          push: (notifPrefs.teamInvitesPush as boolean) ?? true 
        },
        newsletter: { 
          email: (notifPrefs.newsletterEmail as boolean) ?? false, 
          push: (notifPrefs.newsletterPush as boolean) ?? false 
        },
        promotions: { 
          email: (notifPrefs.promotionsEmail as boolean) ?? false, 
          push: (notifPrefs.promotionsPush as boolean) ?? false 
        },
        feature_announcements: { 
          email: (notifPrefs.featureAnnouncementsEmail as boolean) ?? true, 
          push: (notifPrefs.featureAnnouncementsPush as boolean) ?? false 
        }
      })
      setHasUnsavedChanges(false)
    }
  }, [userData?.meta])

  const notificationTypes = [
    {
      category: t('notifications.categories.security.title'),
      icon: <Shield className="h-5 w-5 text-red-500" />,
      description: t('notifications.categories.security.description'),
      notifications: [
        {
          id: 'login_alerts',
          title: t('notifications.types.loginAlerts.title'),
          description: t('notifications.types.loginAlerts.description'),
          email: notificationSettings.login_alerts.email,
          push: notificationSettings.login_alerts.push,
          required: true,
        },
        {
          id: 'password_changes',
          title: t('notifications.types.passwordChanges.title'),
          description: t('notifications.types.passwordChanges.description'),
          email: notificationSettings.password_changes.email,
          push: notificationSettings.password_changes.push,
          required: true,
        },
        {
          id: 'suspicious_activity',
          title: t('notifications.types.suspiciousActivity.title'),
          description: t('notifications.types.suspiciousActivity.description'),
          email: notificationSettings.suspicious_activity.email,
          push: notificationSettings.suspicious_activity.push,
          required: true,
        },
      ]
    },
    {
      category: t('notifications.categories.activity.title'),
      icon: <Zap className="h-5 w-5 text-blue-500" />,
      description: t('notifications.categories.activity.description'),
      notifications: [
        {
          id: 'mentions',
          title: t('notifications.types.mentions.title'),
          description: t('notifications.types.mentions.description'),
          email: notificationSettings.mentions.email,
          push: notificationSettings.mentions.push,
          required: false,
        },
        {
          id: 'project_updates',
          title: t('notifications.types.projectUpdates.title'),
          description: t('notifications.types.projectUpdates.description'),
          email: notificationSettings.project_updates.email,
          push: notificationSettings.project_updates.push,
          required: false,
        },
        {
          id: 'team_invites',
          title: t('notifications.types.teamInvites.title'),
          description: t('notifications.types.teamInvites.description'),
          email: notificationSettings.team_invites.email,
          push: notificationSettings.team_invites.push,
          required: false,
        },
      ]
    },
    {
      category: t('notifications.categories.marketing.title'),
      icon: <MessageSquare className="h-5 w-5 text-green-500" />,
      description: t('notifications.categories.marketing.description'),
      notifications: [
        {
          id: 'newsletter',
          title: t('notifications.types.newsletter.title'),
          description: t('notifications.types.newsletter.description'),
          email: notificationSettings.newsletter.email,
          push: notificationSettings.newsletter.push,
          required: false,
        },
        {
          id: 'promotions',
          title: t('notifications.types.promotions.title'),
          description: t('notifications.types.promotions.description'),
          email: notificationSettings.promotions.email,
          push: notificationSettings.promotions.push,
          required: false,
        },
        {
          id: 'feature_announcements',
          title: t('notifications.types.featureAnnouncements.title'),
          description: t('notifications.types.featureAnnouncements.description'),
          email: notificationSettings.feature_announcements.email,
          push: notificationSettings.feature_announcements.push,
          required: false,
        },
      ]
    }
  ]

  const handleNotificationToggle = useCallback((notificationId: string, type: 'email' | 'push') => {
    setNotificationSettings(prev => ({
      ...prev,
      [notificationId]: {
        ...prev[notificationId as keyof typeof prev],
        [type]: !prev[notificationId as keyof typeof prev][type]
      }
    }))
    
    const currentValue = notificationSettings[notificationId as keyof typeof notificationSettings][type]
    const status = currentValue ? t('notifications.labels.disabled') : t('notifications.labels.enabled')
    setStatusMessage(t('notifications.messages.notificationToggled', { type: type, notification: notificationId, status: status }))
    setHasUnsavedChanges(true)
  }, [notificationSettings, t])

  // Función para guardar configuraciones como metadata
  const handleSaveSettings = useCallback(async () => {
    try {
      // Crear metadata en formato anidado
      const notificationsPreferences = {
        pushEnabled: pushNotificationsEnabled,
        loginAlertsEmail: notificationSettings.login_alerts.email,
        loginAlertsPush: notificationSettings.login_alerts.push,
        passwordChangesEmail: notificationSettings.password_changes.email,
        passwordChangesPush: notificationSettings.password_changes.push,
        suspiciousActivityEmail: notificationSettings.suspicious_activity.email,
        suspiciousActivityPush: notificationSettings.suspicious_activity.push,
        mentionsEmail: notificationSettings.mentions.email,
        mentionsPush: notificationSettings.mentions.push,
        projectUpdatesEmail: notificationSettings.project_updates.email,
        projectUpdatesPush: notificationSettings.project_updates.push,
        teamInvitesEmail: notificationSettings.team_invites.email,
        teamInvitesPush: notificationSettings.team_invites.push,
        newsletterEmail: notificationSettings.newsletter.email,
        newsletterPush: notificationSettings.newsletter.push,
        promotionsEmail: notificationSettings.promotions.email,
        promotionsPush: notificationSettings.promotions.push,
        featureAnnouncementsEmail: notificationSettings.feature_announcements.email,
        featureAnnouncementsPush: notificationSettings.feature_announcements.push,
      }

      await updateUserMeta({
        meta: {
          notificationsPreferences
        }
      })

      setHasUnsavedChanges(false)
      toast.success(t('notifications.messages.saveSuccess'), {
        description: t('notifications.messages.saveSuccessDescription'),
      })
    } catch (error) {
      console.error('Error saving notification settings:', error)
      toast.error(t('notifications.messages.saveError'), {
        description: t('notifications.messages.saveErrorDescription'),
      })
    }
  }, [pushNotificationsEnabled, notificationSettings, updateUserMeta, t])

  // Mostrar skeleton mientras cargan los datos
  if (isLoadingUser) {
    return <NotificationsPageSkeleton />
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('notifications', 'status', 'message') && { 'data-testid': createTestId('notifications', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <div 
        className="max-w-4xl"
        {...createTestId('notifications', 'container') && { 'data-testid': createTestId('notifications', 'container') }}
        {...createCyId('notifications', 'main') && { 'data-cy': createCyId('notifications', 'main') }}
      >
        <div className="space-y-6">
          {/* Header */}
          <header 
            {...createTestId('notifications', 'header') && { 'data-testid': createTestId('notifications', 'header') }}
            {...createCyId('notifications', 'header') && { 'data-cy': createCyId('notifications', 'header') }}
          >
            <h1 
              className="text-2xl font-bold"
              id="notifications-heading"
              {...createTestId('notifications', 'title') && { 'data-testid': createTestId('notifications', 'title') }}
            >
              {t('notifications.title')}
            </h1>
            <p 
              className="text-muted-foreground mt-1"
              {...createTestId('notifications', 'description') && { 'data-testid': createTestId('notifications', 'description') }}
            >
              {t('notifications.description')}
            </p>
          </header>

        {/* Main Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('notifications.main.title')}</CardTitle>
            <CardDescription>
              {t('notifications.main.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Canales de Notificación */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {t('notifications.channels.title')}
              </h3>
              
              {/* Push Notifications Master Switch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5" />
                    <h4 className="font-medium">{t('notifications.channels.push.title')}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('notifications.channels.push.description')}
                  </p>
                </div>
                <div className="flex justify-end">
                  <div className="flex items-center gap-3">
                    <Badge variant={pushNotificationsEnabled ? 'default' : 'secondary'}>
                      {pushNotificationsEnabled ? t('notifications.channels.push.enabled') : t('notifications.channels.push.disabled')}
                    </Badge>
                    <Switch
                      checked={pushNotificationsEnabled}
                      onCheckedChange={(checked: boolean) => {
                        setPushNotificationsEnabled(checked)
                        setStatusMessage(checked ? t('notifications.messages.pushEnabled') : t('notifications.messages.pushDisabled'))
                        setHasUnsavedChanges(true)
                      }}
                      aria-label={pushNotificationsEnabled ? t('notifications.channels.push.ariaEnabled') : t('notifications.channels.push.ariaDisabled')}
                      {...createTestId('notifications', 'push', 'master') && { 'data-testid': createTestId('notifications', 'push', 'master') }}
                      {...createCyId('notifications', 'push-master') && { 'data-cy': createCyId('notifications', 'push-master') }}
                    />
                  </div>
                </div>
              </div>

              {/* Email Notifications Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5" />
                    <h4 className="font-medium">{t('notifications.channels.email.title')}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('notifications.channels.email.description')}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Badge variant="outline">{t('notifications.channels.email.alwaysEnabled')}</Badge>
                </div>
              </div>
            </div>

            {/* Divisor */}
            <hr className="border-muted" />

            {/* Tipos de Notificaciones */}
            {notificationTypes.map((type, index) => (
              <div 
                key={index} 
                className="space-y-6"
                {...createTestId('notifications', 'category', type.category.toLowerCase().replace(/\s+/g, '-')) && { 'data-testid': createTestId('notifications', 'category', type.category.toLowerCase().replace(/\s+/g, '-')) }}
                {...createCyId('notifications', type.category.toLowerCase().replace(/\s+/g, '-')) && { 'data-cy': createCyId('notifications', type.category.toLowerCase().replace(/\s+/g, '-')) }}
              >
                <h3 
                  className="text-lg font-semibold flex items-center gap-2"
                  {...createTestId('notifications', 'category', 'title') && { 'data-testid': createTestId('notifications', 'category', 'title') }}
                >
                  {type.icon}
                  {type.category}
                </h3>
                
                <div className="space-y-6">
                  {type.notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
                      {...createTestId('notifications', 'item', notification.id) && { 'data-testid': createTestId('notifications', 'item', notification.id) }}
                      {...createCyId('notifications', `item-${notification.id}`) && { 'data-cy': createCyId('notifications', `item-${notification.id}`) }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{notification.title}</h4>
                          {notification.required && (
                            <Badge variant="outline" className="text-xs">
                              {t('notifications.labels.required')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                      
                      <div className="flex justify-end">
                        <div className="flex items-center gap-6">
                          {/* Email Toggle */}
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{t('notifications.labels.email')}</span>
                            <Switch
                              checked={notification.email}
                              disabled={notification.required}
                              onCheckedChange={() => handleNotificationToggle(notification.id, 'email')}
                              aria-label={t('notifications.labels.emailAriaLabel', { title: notification.title, status: notification.email ? t('notifications.labels.enabled') : t('notifications.labels.disabled') })}
                              {...createTestId('notifications', notification.id, 'email') && { 'data-testid': createTestId('notifications', notification.id, 'email') }}
                              {...createCyId('notifications', `${notification.id}-email`) && { 'data-cy': createCyId('notifications', `${notification.id}-email`) }}
                            />
                          </div>
                          
                          {/* Push Toggle */}
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{t('notifications.labels.push')}</span>
                            <Switch
                              checked={notification.push && pushNotificationsEnabled}
                              disabled={notification.required || !pushNotificationsEnabled}
                              onCheckedChange={() => handleNotificationToggle(notification.id, 'push')}
                              aria-label={t('notifications.labels.pushAriaLabel', { title: notification.title, status: (notification.push && pushNotificationsEnabled) ? t('notifications.labels.enabled') : t('notifications.labels.disabled') })}
                              {...createTestId('notifications', notification.id, 'push') && { 'data-testid': createTestId('notifications', notification.id, 'push') }}
                              {...createCyId('notifications', `${notification.id}-push`) && { 'data-cy': createCyId('notifications', `${notification.id}-push`) }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divisor entre secciones (excepto la última) */}
                {index < notificationTypes.length - 1 && (
                  <hr className="border-muted" />
                )}
              </div>
            ))}

            {/* Botón de Guardar */}
            <div className="flex justify-end pt-6 border-t border-muted">
              <Button 
                onClick={handleSaveSettings}
                disabled={!hasUnsavedChanges || isUpdating || isLoadingUser}
                className="min-w-[120px]"
                {...createTestId('notifications', 'save', 'button') && { 'data-testid': createTestId('notifications', 'save', 'button') }}
                {...createCyId('notifications', 'save-button') && { 'data-cy': createCyId('notifications', 'save-button') }}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('notifications.buttons.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('notifications.buttons.save')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/notifications/page.tsx', NotificationsPage)