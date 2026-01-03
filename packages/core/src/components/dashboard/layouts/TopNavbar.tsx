'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { useSidebar } from '../../../contexts/sidebar-context'
import { Button } from '../../ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Menu, X, LogOut, User, Settings, CreditCard, HelpCircle, Shield, PanelLeft, PanelLeftClose, Key, Code } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { ThemeToggle } from '../../app/misc/ThemeToggle'
import { NotificationsDropdown } from '../misc/NotificationsDropdown'
import { SearchDropdown } from '../misc/SearchDropdown'
import { QuickCreateDropdown } from '../misc/QuickCreateDropdown'
import { cn } from '../../../lib/utils'
import { createTestId, sel, createAriaLabel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { useIsSuperAdmin } from '../../app/guards/SuperAdminGuard'
import { useIsDeveloper } from '../../app/guards/DeveloperGuard'
import { DynamicNavigation } from '../navigation/DynamicNavigation'
import { isTopbarFeatureEnabled, getTopbarFeatureConfig, TOPBAR_CONFIG } from '../../../lib/config'

import type { SerializableEntityConfig } from '../../../lib/entities/serialization'

interface TopNavbarProps {
  entities: SerializableEntityConfig[]
  className?: string
}

export function TopNavbar({ entities, className }: TopNavbarProps) {
  const { user, signOut, isLoading } = useAuth()
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const t = useTranslations('common')
  const isSuperAdmin = useIsSuperAdmin()
  const isDeveloper = useIsDeveloper()

  // Get topbar feature configs
  const superadminConfig = getTopbarFeatureConfig<{ enabled: boolean; showToDevelopers?: boolean }>('superadminAccess')
  const devtoolsConfig = getTopbarFeatureConfig<{ enabled: boolean }>('devtoolsAccess')

  // Determine visibility
  const showSuperadmin = superadminConfig?.enabled && (isSuperAdmin || (isDeveloper && superadminConfig?.showToDevelopers))
  const showDevZone = devtoolsConfig?.enabled && isDeveloper

  // Icon mapping for user menu items
  const iconMap = {
    'user': User,
    'settings': Settings,
    'credit-card': CreditCard,
    'key': Key,
    'shield': Shield,
    'log-out': LogOut,
  }

  // Función para generar iniciales del usuario  
  const getUserInitials = (user: { firstName?: string; lastName?: string; name?: string; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase()
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  // Función para generar color del avatar basado en el email
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
    ]
    const index = email.charCodeAt(0) % colors.length
    return colors[index]
  }

  // Enhanced handlers for accessibility
  const handleMenuToggle = useCallback(() => {
    const newState = !isMenuOpen
    setIsMenuOpen(newState)
    setStatusMessage(newState ? 'Menú móvil abierto' : 'Menú móvil cerrado')
  }, [isMenuOpen])

  const handleSignOut = useCallback(async () => {
    try {
      setStatusMessage('Cerrando sesión...')
      await signOut()
      setStatusMessage('Sesión cerrada exitosamente')
    } catch {
      setStatusMessage('Error al cerrar sesión')
    }
  }, [signOut])

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false)
    setStatusMessage('Menú cerrado')
  }, [])

  // Handler for sidebar toggle
  const handleToggleSidebar = useCallback(() => {
    toggleSidebar()
    const newState = !isCollapsed
    setStatusMessage(newState ? 'Sidebar expandido' : 'Sidebar contraído')
  }, [isCollapsed, toggleSidebar])

  // Keyboard navigation for mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        handleMenuClose()
      }
    }

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen, handleMenuClose])

  return (
    <>
      {/* Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('topnav', 'status', 'message') && { 'data-testid': createTestId('topnav', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <nav
        className={cn(
          "bg-background border-b border-border fixed top-0 right-0 z-40 transition-all duration-300",
          "lg:left-64", // Default left position when sidebar is expanded
          isCollapsed && "lg:left-16", // Adjusted left position when sidebar is collapsed
          className
        )}
        role="banner"
        aria-label="Navegación principal"
        {...createTestId('topnav', 'container') && { 'data-testid': createTestId('topnav', 'container') }}
        data-cy={sel('dashboard.topnav.header')}
      >
      <div className="w-full pl-2.5 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Logo (mobile) or Sidebar Toggle + Quick Create + Search (desktop) */}
          <div className="flex items-center gap-3 flex-1">
            {/* Logo - Solo visible en móvil cuando no hay usuario autenticado */}
            {!user && (
              <Link
                href="/"
                className="text-xl font-bold text-foreground lg:hidden"
                aria-label="Ir a la página principal"
                {...createTestId('topnav', 'logo', 'link') && { 'data-testid': createTestId('topnav', 'logo', 'link') }}
                data-cy={sel('dashboard.topnav.logo')}
              >
                Boilerplate
              </Link>
            )}

            {/* Sidebar Toggle, Quick Create and Search - Solo visible cuando hay usuario autenticado */}
            {user && (
              <>
                {/* Sidebar Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleSidebar}
                  className="hidden lg:flex h-8 w-8"
                  aria-label={isCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
                  aria-expanded={!isCollapsed}
                  aria-controls="sidebar-navigation"
                  data-testid={createTestId('topnav', 'sidebar-toggle', 'button')}
                  data-cy={sel('dashboard.topnav.sidebarToggle')}
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>

                {/* Quick Create Dropdown */}
                {isTopbarFeatureEnabled('quickCreate') && (
                  <div className="hidden lg:block">
                    <QuickCreateDropdown />
                  </div>
                )}

                {/* Search Box */}
                {isTopbarFeatureEnabled('search') && (
                  <div
                    className="hidden lg:flex items-center min-w-0 max-w-sm"
                    role="search"
                    aria-label="Búsqueda de tareas"
                    {...createTestId('topnav', 'search', 'container') && { 'data-testid': createTestId('topnav', 'search', 'container') }}
                    data-cy={sel('dashboard.topnav.searchSection')}
                  >
                    <SearchDropdown />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side: Notifications, Support, Theme, Admin, User Menu */}

          <div
            className="flex items-center space-x-4 flex-shrink-0"
            role="toolbar"
            aria-label="Acciones y configuración"
            {...createTestId('topnav', 'actions', 'toolbar') && { 'data-testid': createTestId('topnav', 'actions', 'toolbar') }}
            data-cy={sel('dashboard.topnav.actions')}
          >
            {/* Notifications - Solo visible cuando hay usuario autenticado */}
            {user && isTopbarFeatureEnabled('notifications') && (
              <div 
                {...createTestId('topnav', 'notifications') && { 'data-testid': createTestId('topnav', 'notifications') }}
                data-cy={sel('dashboard.topnav.notifications')}
              >
                <NotificationsDropdown />
              </div>
            )}

            {/* Help/Support - Solo visible cuando hay usuario autenticado */}
            {user && isTopbarFeatureEnabled('support') && (
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                {...createTestId('topnav', 'help', 'button') && { 'data-testid': createTestId('topnav', 'help', 'button') }}
                data-cy={sel('dashboard.topnav.help')}
              >
                <Link 
                  href="/support" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Abrir centro de ayuda en nueva pestaña"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Ayuda</span>
                </Link>
              </Button>
            )}
            
            {/* Theme Toggle */}
            {isTopbarFeatureEnabled('themeToggle') && (
              <div 
                {...createTestId('topnav', 'theme', 'toggle') && { 'data-testid': createTestId('topnav', 'theme', 'toggle') }}
                data-cy={sel('dashboard.topnav.themeToggle')}
              >
                <ThemeToggle />
              </div>
            )}

            {/* Superadmin Access - Visible to superadmins and developers (if configured) */}
            {user && showSuperadmin && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                {...createTestId('topnav', 'superadmin', 'button') && { 'data-testid': createTestId('topnav', 'superadmin', 'button') }}
                data-cy={sel('dashboard.topnav.superadmin')}
              >
                <Link
                  href="/superadmin"
                  aria-label="Acceder a Super Admin - Área de super administrador"
                  title="Super Admin - Super Admin Area"
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Área de super administrador</span>
                </Link>
              </Button>
            )}

            {/* Dev Zone Access - Visible only to developers */}
            {user && showDevZone && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                {...createTestId('topnav', 'devtools', 'button') && { 'data-testid': createTestId('topnav', 'devtools', 'button') }}
                data-cy={sel('dashboard.topnav.devtools')}
              >
                <Link
                  href="/devtools"
                  aria-label="Acceder a DevTools - Área de desarrolladores"
                  title="DevTools - Developer Area"
                >
                  <Code className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  <span className="sr-only">Área de desarrolladores</span>
                </Link>
              </Button>
            )}
            
            {/* User Menu */}
            {isLoading ? (
              <div 
                className="h-8 w-20 bg-muted animate-pulse rounded"
                role="status"
                aria-label="Cargando información del usuario"
                {...createTestId('topnav', 'user', 'loading') && { 'data-testid': createTestId('topnav', 'user', 'loading') }}
                data-cy={sel('dashboard.topnav.userLoading')}
              >
                <span className="sr-only">Cargando...</span>
              </div>
            ) : user ? (
              TOPBAR_CONFIG.userMenu.enabled ? (
              <DropdownMenu>
                <DropdownMenuTrigger 
                  asChild
                  {...createTestId('topnav', 'user', 'trigger') && { 'data-testid': createTestId('topnav', 'user', 'trigger') }}
                  data-cy={sel('dashboard.topnav.userMenuTrigger')}
                >
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-3 h-auto p-2"
                    aria-label={createAriaLabel(
                      'Menú de usuario. Cuenta: {name}',
                      { name: user.firstName || user.email }
                    )}
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover border border-border"
                        {...createTestId('topnav', 'user', 'avatar') && { 'data-testid': createTestId('topnav', 'user', 'avatar') }}
                      />
                    ) : (
                      <div 
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user.email)}`}
                        role="img"
                        aria-label={`Avatar de ${user.firstName || user.email}`}
                        {...createTestId('topnav', 'user', 'avatar') && { 'data-testid': createTestId('topnav', 'user', 'avatar') }}
                      >
                        {getUserInitials(user)}
                      </div>
                    )}
                    <span className="text-sm text-foreground">
                      {user.firstName || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56"
                  {...createTestId('topnav', 'user', 'menu') && { 'data-testid': createTestId('topnav', 'user', 'menu') }}
                  data-cy={sel('dashboard.topnav.userMenu')}
                >
                  {(TOPBAR_CONFIG.userMenu.showAvatar || TOPBAR_CONFIG.userMenu.showEmail || TOPBAR_CONFIG.userMenu.showRole) && (
                    <DropdownMenuLabel>
                      <div 
                        className="flex flex-col space-y-1"
                        role="group"
                        aria-label="Información del usuario"
                      >
                        {TOPBAR_CONFIG.userMenu.showAvatar && (
                          <p className="text-sm font-medium">{user.firstName || 'Usuario'}</p>
                        )}
                        {TOPBAR_CONFIG.userMenu.showEmail && (
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        )}
                        {TOPBAR_CONFIG.userMenu.showRole && user.role && (
                          <p className="text-xs text-muted-foreground">{t(`userRoles.${user.role}`)}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                  )}
                  {/* Dynamic menu items */}
                  {TOPBAR_CONFIG.userMenu.items.map((item: any, index: number) => {
                    if (item.type === 'divider') {
                      return <DropdownMenuSeparator key={`divider-${index}`} />
                    }

                    if (item.type === 'link' && item.href) {
                      const IconComponent = iconMap[item.icon as keyof typeof iconMap]
                      return (
                        <DropdownMenuItem 
                          key={`link-${index}`}
                          asChild
                          {...createTestId('topnav', 'menu', 'item') && { 'data-testid': createTestId('topnav', 'menu', 'item') }}
                          data-cy={sel('dashboard.topnav.menuItem', { icon: item.icon })}
                        >
                          <Link 
                            href={item.href} 
                            className="flex items-center"
                            aria-label={t(item.label)}
                          >
                            {IconComponent && <IconComponent className="mr-2 h-4 w-4" aria-hidden="true" />}
                            {t(item.label)}
                          </Link>
                        </DropdownMenuItem>
                      )
                    }

                    if (item.type === 'action' && item.action) {
                      const IconComponent = iconMap[item.icon as keyof typeof iconMap]
                      const isSignOut = item.action === 'signOut'
                      
                      return (
                        <DropdownMenuItem 
                          key={`action-${index}`}
                          onClick={isSignOut ? handleSignOut : undefined}
                          className={isSignOut ? "text-red-600 focus:text-red-600" : undefined}
                          {...createTestId('topnav', 'menu', 'action') && { 'data-testid': createTestId('topnav', 'menu', 'action') }}
                          data-cy={sel('dashboard.topnav.menuAction', { action: item.action })}
                        >
                          {IconComponent && <IconComponent className="mr-2 h-4 w-4" aria-hidden="true" />}
                          {t(item.label)}
                        </DropdownMenuItem>
                      )
                    }

                    return null
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              ) : (
                /* Simple avatar without dropdown when userMenu is disabled */
                <div className="flex items-center gap-2">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={`Avatar de ${user.firstName || user.email}`}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user.email)}`}
                      aria-label={`Avatar de ${user.firstName || user.email}`}
                    >
                      {getUserInitials(user)}
                    </div>
                  )}
                  <span className="text-sm text-foreground hidden sm:block">
                    {user.firstName || user.email?.split('@')[0]}
                  </span>
                </div>
              )
            ) : (
              <>
                <Link 
                  href="/login"
                  {...createTestId('topnav', 'signin', 'link') && { 'data-testid': createTestId('topnav', 'signin', 'link') }}
                  data-cy={sel('dashboard.topnav.signin')}
                >
                  <Button 
                    variant="ghost" 
                    size="sm"
                    aria-label="Iniciar sesión"
                  >
                    {t('buttons.signIn')}
                  </Button>
                </Link>
                <Link 
                  href="/signup"
                  {...createTestId('topnav', 'signup', 'link') && { 'data-testid': createTestId('topnav', 'signup', 'link') }}
                  data-cy={sel('dashboard.topnav.signup')}
                >
                  <Button 
                    size="sm"
                    aria-label="Registrarse"
                  >
                    {t('buttons.signUp')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div 
            className="lg:hidden flex items-center space-x-2"
            role="group"
            aria-label="Acciones móviles"
            {...createTestId('topnav', 'mobile', 'actions') && { 'data-testid': createTestId('topnav', 'mobile', 'actions') }}
            data-cy={sel('dashboard.topnav.mobileActions')}
          >
            {isTopbarFeatureEnabled('themeToggle') && (
              <div 
                {...createTestId('topnav', 'mobile', 'theme') && { 'data-testid': createTestId('topnav', 'mobile', 'theme') }}
              >
                <ThemeToggle />
              </div>
            )}
            {user && (
              <button
                onClick={handleMenuToggle}
                className="text-foreground/70 hover:text-foreground"
                aria-label={isMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
                                    {...createTestId('topnav', 'mobile', 'toggle') && { 'data-testid': createTestId('topnav', 'mobile', 'toggle') }}
                data-cy={sel('dashboard.topnav.mobileMenuToggle')}
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div 
          className="lg:hidden border-t border-border"
          id="mobile-menu"
          role="navigation"
          aria-label="Menú de navegación móvil"
          {...createTestId('topnav', 'mobile', 'menu') && { 'data-testid': createTestId('topnav', 'mobile', 'menu') }}
          data-cy={sel('dashboard.topnav.mobileMenu')}
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            {user ? (
              <>
                {/* Mobile Navigation */}
                <div 
                  className="mb-4"
                  role="group"
                  aria-label="Navegación principal"
                >
                  <DynamicNavigation
                    entities={entities}
                    isMobile={true}
                    onItemClick={handleMenuClose}
                  />
                  
                  {/* Superadmin Access - Visible to superadmins and developers (if configured) */}
                  {showSuperadmin && (
                    <Link
                      href="/superadmin"
                      className={cn(
                        "block px-3 py-2 rounded-md text-base font-medium hover:bg-red-50 text-red-600 flex items-center w-fit",
                        pathname.startsWith('/superadmin')
                          ? "bg-red-50 text-red-700"
                          : "text-red-600"
                      )}
                      onClick={handleMenuClose}
                      aria-label="Ir a Super Admin - Área de super administrador"
                      {...createTestId('topnav', 'mobile', 'superadmin') && { 'data-testid': createTestId('topnav', 'mobile', 'superadmin') }}
                      data-cy={sel('dashboard.topnav.mobileNavSuperadmin')}
                    >
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Área de super administrador</span>
                    </Link>
                  )}

                  {/* DevTools Access - Visible only to developers */}
                  {showDevZone && (
                    <Link
                      href="/devtools"
                      className={cn(
                        "block px-3 py-2 rounded-md text-base font-medium hover:bg-violet-50 dark:hover:bg-violet-950/50 flex items-center w-fit",
                        pathname.startsWith('/devtools')
                          ? "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400"
                          : "text-violet-600 dark:text-violet-400"
                      )}
                      onClick={handleMenuClose}
                      aria-label="Ir a DevTools - Área de desarrolladores"
                      {...createTestId('topnav', 'mobile', 'devtools') && { 'data-testid': createTestId('topnav', 'mobile', 'devtools') }}
                      data-cy={sel('dashboard.topnav.mobileNavDevtools')}
                    >
                      <Code className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Área de desarrolladores</span>
                    </Link>
                  )}
                </div>
                
                {/* User Info */}
                <div 
                  className="flex items-center gap-3 px-3 py-2 border-t border-border pt-4"
                  role="group"
                  aria-label="Información del usuario"
                  {...createTestId('topnav', 'mobile', 'userinfo') && { 'data-testid': createTestId('topnav', 'mobile', 'userinfo') }}
                  data-cy={sel('dashboard.topnav.mobileUserInfo')}
                >
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div 
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user.email)}`}
                      role="img"
                      aria-label={`Avatar de ${user.firstName || user.email}`}
                    >
                      {getUserInitials(user)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {user.firstName || 'Usuario'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
                <Link
                  href="/dashboard/settings/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  onClick={handleMenuClose}
                  aria-label="Ir a perfil"
                  {...createTestId('topnav', 'mobile', 'profile') && { 'data-testid': createTestId('topnav', 'mobile', 'profile') }}
                  data-cy={sel('dashboard.topnav.mobileLinkProfile')}
                >
                  <User className="inline mr-2 h-4 w-4" aria-hidden="true" />
                  Profile
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  onClick={handleMenuClose}
                  aria-label="Ir a configuración"
                  {...createTestId('topnav', 'mobile', 'settings') && { 'data-testid': createTestId('topnav', 'mobile', 'settings') }}
                  data-cy={sel('dashboard.topnav.mobileLinkSettings')}
                >
                  <Settings className="inline mr-2 h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
                <Link
                  href="/dashboard/settings/billing"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  onClick={handleMenuClose}
                  aria-label="Ir a facturación"
                  {...createTestId('topnav', 'mobile', 'billing') && { 'data-testid': createTestId('topnav', 'mobile', 'billing') }}
                  data-cy={sel('dashboard.topnav.mobileLinkBilling')}
                >
                  <CreditCard className="inline mr-2 h-4 w-4" aria-hidden="true" />
                  Billing
                </Link>
                <button
                  onClick={() => {
                    handleSignOut()
                    handleMenuClose()
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-accent"
                  aria-label="Cerrar sesión"
                  {...createTestId('topnav', 'mobile', 'signout') && { 'data-testid': createTestId('topnav', 'mobile', 'signout') }}
                  data-cy={sel('dashboard.topnav.mobileSignout')}
                >
                  <LogOut className="inline mr-2 h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  onClick={handleMenuClose}
                  aria-label="Iniciar sesión"
                  {...createTestId('topnav', 'mobile', 'signin') && { 'data-testid': createTestId('topnav', 'mobile', 'signin') }}
                  data-cy="topnav-mobile-signin"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent"
                  onClick={handleMenuClose}
                  aria-label="Registrarse"
                  {...createTestId('topnav', 'mobile', 'signup') && { 'data-testid': createTestId('topnav', 'mobile', 'signup') }}
                  data-cy="topnav-mobile-signup"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
