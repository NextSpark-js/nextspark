'use client'


import { useState, useCallback, useEffect } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nextsparkjs/core/components/ui/dialog'
import { 
  Shield, 
  Smartphone, 
  Monitor, 
  Globe, 
  AlertTriangle,
  Check,
  X,
  Eye,
  Clock,
  MapPin,
  Wifi,
  Save,
  Loader2
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useUserWithMetaSettings } from '@nextsparkjs/core/hooks/useUserSettings'
import { SecurityPageSkeleton } from '@nextsparkjs/core/components/settings/SettingsPageSkeleton'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function SecurityPage() {
  const t = useTranslations('settings')
  
  // Hook para manejar user metadata con autenticación de sesión
  const { 
    data: userData, 
    isLoading: isLoadingUser,
    updateEntity: updateUserMeta,
    isUpdating 
  } = useUserWithMetaSettings()

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true)

  const [statusMessage, setStatusMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Cargar configuraciones desde metadata al montar el componente
  useEffect(() => {
    if (userData?.meta?.securityPreferences) {
      const securityPrefs = userData.meta.securityPreferences as Record<string, unknown>
      
      if (securityPrefs.twoFactorEnabled !== undefined) {
        setTwoFactorEnabled(securityPrefs.twoFactorEnabled as boolean)
      }
      
      if (securityPrefs.loginAlertsEnabled !== undefined) {
        setLoginAlertsEnabled(securityPrefs.loginAlertsEnabled as boolean)
      }
      
      setHasUnsavedChanges(false)
    }
  }, [userData?.meta])

  // Datos de ejemplo para sesiones activas
  const activeSessions = [
    {
      id: '1',
      device: 'MacBook Pro',
      browser: 'Chrome 120',
      location: 'Buenos Aires, Argentina',
      ip: '192.168.1.100',
      lastActive: '2 minutos atrás',
      current: true,
      icon: <Monitor className="h-4 w-4" />
    },
    {
      id: '2',
      device: 'iPhone 15 Pro',
      browser: 'Safari Mobile',
      location: 'Buenos Aires, Argentina',
      ip: '192.168.1.101',
      lastActive: '1 hora atrás',
      current: false,
      icon: <Smartphone className="h-4 w-4" />
    },
    {
      id: '3',
      device: 'Unknown Device',
      browser: 'Chrome 119',
      location: 'Córdoba, Argentina',
      ip: '200.45.123.45',
      lastActive: '3 días atrás',
      current: false,
      icon: <Globe className="h-4 w-4" />
    }
  ]

  // Datos de ejemplo para historial de logins
  const loginHistory = [
    {
      id: '1',
      success: true,
      location: 'Buenos Aires, Argentina',
      device: 'MacBook Pro - Chrome',
      timestamp: '2024-01-15 10:30:00',
      ip: '192.168.1.100'
    },
    {
      id: '2',
      success: true,
      location: 'Buenos Aires, Argentina',
      device: 'iPhone 15 Pro - Safari',
      timestamp: '2024-01-15 08:45:00',
      ip: '192.168.1.101'
    },
    {
      id: '3',
      success: false,
      location: 'Madrid, España',
      device: 'Unknown - Chrome',
      timestamp: '2024-01-14 22:15:00',
      ip: '85.123.45.67'
    },
    {
      id: '4',
      success: true,
      location: 'Buenos Aires, Argentina',
      device: 'MacBook Pro - Chrome',
      timestamp: '2024-01-14 09:20:00',
      ip: '192.168.1.100'
    }
  ]

  const handleTerminateSession = useCallback((sessionId: string) => {
    console.log('Terminating session:', sessionId)
    setStatusMessage(t('security.messages.sessionTerminated'))
    // Aquí iría la lógica para terminar la sesión
  }, [t])

  const handleTwoFactorToggle = useCallback((enabled: boolean) => {
    setTwoFactorEnabled(enabled)
    setStatusMessage(enabled ? t('security.messages.twoFactorEnabled') : t('security.messages.twoFactorDisabled'))
    setHasUnsavedChanges(true)
  }, [t])

  const handleLoginAlertsToggle = useCallback((enabled: boolean) => {
    setLoginAlertsEnabled(enabled)
    setStatusMessage(enabled ? t('security.messages.alertsEnabled') : t('security.messages.alertsDisabled'))
    setHasUnsavedChanges(true)
  }, [t])

  // Función para guardar configuraciones como metadata
  const handleSaveSettings = useCallback(async () => {
    try {
      // Crear metadata en formato anidado
      const securityPreferences = {
        twoFactorEnabled: twoFactorEnabled,
        loginAlertsEnabled: loginAlertsEnabled,
      }

      await updateUserMeta({
        meta: {
          securityPreferences
        }
      })

      setHasUnsavedChanges(false)
      toast.success(t('security.messages.saveSuccess'), {
        description: t('security.messages.saveSuccessDescription'),
      })
    } catch (error) {
      console.error('Error saving security settings:', error)
      toast.error(t('security.messages.saveError'), {
        description: t('security.messages.saveErrorDescription'),
      })
    }
  }, [twoFactorEnabled, loginAlertsEnabled, updateUserMeta, t])

  // Mostrar skeleton mientras cargan los datos
  if (isLoadingUser) {
    return <SecurityPageSkeleton />
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <div className="max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <header>
            <h1 className="text-2xl font-bold" id="security-heading">
              {t('security.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('security.description')}
            </p>
          </header>

          {/* Main Security Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('security.main.title')}</CardTitle>
              <CardDescription>
                {t('security.main.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Autenticación de Dos Factores */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('security.twoFactor.title')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-1">
                    <h4 className="font-medium">
                      {twoFactorEnabled ? t('security.twoFactor.enabled') : t('security.twoFactor.disabled')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorEnabled 
                        ? t('security.twoFactor.enabledStatus') 
                        : t('security.twoFactor.disabledStatus')
                      }
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex items-center gap-3">
                      <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
                        {twoFactorEnabled ? t('security.twoFactor.active') : t('security.twoFactor.inactive')}
                      </Badge>
                      <Switch
                        checked={twoFactorEnabled}
                        onCheckedChange={handleTwoFactorToggle}
                        aria-label={twoFactorEnabled ? t('security.twoFactor.ariaEnabled') : t('security.twoFactor.ariaDisabled')}
                        aria-describedby="2fa-description"
                      />
                    </div>
                  </div>
                </div>
                
                {!twoFactorEnabled && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('security.twoFactor.recommendation')}
                    </AlertDescription>
                  </Alert>
                )}

                {twoFactorEnabled && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t('security.twoFactor.configuredMethods')}</p>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">{t('security.twoFactor.appAuthenticator')}</p>
                          <p className="text-xs text-muted-foreground">{t('security.twoFactor.appDescription')}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{t('security.twoFactor.configured')}</Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <hr className="border-muted" />

              {/* Alertas de Seguridad */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('security.alerts.title')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <div className="space-y-1 md:col-span-3">
                    <h4 className="font-medium">{t('security.alerts.loginTitle')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('security.alerts.loginDescription')}
                    </p>
                  </div>
                  <div className="flex justify-end md:col-span-1">
                    <Switch
                      checked={loginAlertsEnabled}
                      onCheckedChange={handleLoginAlertsToggle}
                      aria-label={loginAlertsEnabled ? t('security.alerts.ariaEnabled') : t('security.alerts.ariaDisabled')}
                      aria-describedby="alerts-description"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Guardar */}
              <div className="flex justify-end pt-6 border-t border-muted">
                <Button
                  onClick={handleSaveSettings}
                  disabled={!hasUnsavedChanges || isUpdating || isLoadingUser}
                  className="min-w-[120px]"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('security.buttons.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {t('security.buttons.save')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Two Column Layout for Sessions and History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sesiones Activas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  {t('security.sessions.title')}
                </CardTitle>
                <CardDescription>
                  {t('security.sessions.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border border-muted/40 rounded-lg space-y-3"
                      role="article"
                      aria-label={t('security.sessions.sessionAriaLabel', { device: session.device, status: session.current ? t('security.sessions.currentSession') : t('security.sessions.activeSession') })}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {session.icon}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{session.device}</p>
                              {session.current && (
                                <Badge variant="default" className="text-xs shrink-0">
                                  {t('security.sessions.current')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{session.browser}</p>
                          </div>
                        </div>
                        {!session.current && (
                          <div className="shrink-0 ml-3">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={t('security.sessions.terminateAriaLabel', { device: session.device })}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('security.sessions.terminate')}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{t('security.sessions.terminateDialog.title')}</DialogTitle>
                                  <DialogDescription>
                                    {t('security.sessions.terminateDialog.description')}
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline">{t('security.sessions.terminateDialog.cancel')}</Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => handleTerminateSession(session.id)}
                                  >
                                    {t('security.sessions.terminateDialog.confirm')}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>
                      
                      {/* Details Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{session.location}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Wifi className="h-3 w-3 shrink-0" />
                          <span className="truncate">{session.ip}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{session.lastActive}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Historial de Accesos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {t('security.loginHistory.title')}
                </CardTitle>
                <CardDescription>
                  {t('security.loginHistory.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loginHistory.map((login) => (
                    <div
                      key={login.id}
                      className="p-3 border border-muted/40 rounded-lg space-y-2"
                      role="article"
                      aria-label={t('security.loginHistory.attemptAriaLabel', { status: login.success ? t('security.loginHistory.successBadge').toLowerCase() : t('security.loginHistory.failBadge').toLowerCase(), location: login.location })}
                    >
                      {/* Header Row */}
                      <div className="flex items-center gap-3">
                        {login.success ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {login.success ? t('security.loginHistory.successful') : t('security.loginHistory.failed')}
                            </p>
                            <Badge variant={login.success ? 'default' : 'destructive'} className="text-xs shrink-0">
                              {login.success ? t('security.loginHistory.successBadge') : t('security.loginHistory.failBadge')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Details Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground pl-7">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{login.location}</span>
                        </span>
                        <span className="truncate">{login.device}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">{new Date(login.timestamp).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('security.loginHistory.viewHistoryAriaLabel')}
                  >
                    {t('security.loginHistory.viewComplete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/security/page.tsx', SecurityPage)