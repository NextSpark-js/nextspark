'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../../../hooks/useAuth'
import { Bell } from 'lucide-react'
import { Button } from '../../ui/button'
import { ThemeToggle } from '../../app/misc/ThemeToggle'
import { NotificationsDropdown } from '../misc/NotificationsDropdown'
import { createTestId, createCyId } from '../../../lib/test'
import { isTopbarFeatureEnabled } from '../../../lib/config'
import { useTranslations } from 'next-intl'

export function MobileTopBar() {
  const { user } = useAuth()
  const t = useTranslations()

  if (!user) return null

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

  return (
    <header
      className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border"
      role="banner"
      aria-label="Barra de navegación móvil superior"
      {...createTestId('mobile-topbar', 'container') && { 'data-testid': createTestId('mobile-topbar', 'container') }}
      {...createCyId('mobile-topbar', 'header') && { 'data-cy': createCyId('mobile-topbar', 'header') }}
    >
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: User Avatar + Name */}
        <Link
          href="/dashboard/settings/profile"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          aria-label={`Ir al perfil de ${user.firstName || user.email}`}
          {...createTestId('mobile-topbar', 'user', 'link') && { 'data-testid': createTestId('mobile-topbar', 'user', 'link') }}
          {...createCyId('mobile-topbar', 'user-profile') && { 'data-cy': createCyId('mobile-topbar', 'user-profile') }}
        >
          {/* Avatar */}
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover border-2 border-border"
              {...createTestId('mobile-topbar', 'user', 'avatar') && { 'data-testid': createTestId('mobile-topbar', 'user', 'avatar') }}
            />
          ) : (
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold border-2 border-border ${getAvatarColor(user.email)}`}
              role="img"
              aria-label={`Avatar de ${user.firstName || user.email}`}
              {...createTestId('mobile-topbar', 'user', 'avatar') && { 'data-testid': createTestId('mobile-topbar', 'user', 'avatar') }}
            >
              {getUserInitials(user)}
            </div>
          )}

          {/* User Name */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {t('common.mobileNav.greeting', {
                name: user.firstName || user.email.split('@')[0]
              })}
            </span>
          </div>
        </Link>

        {/* Right: Notifications + Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          {isTopbarFeatureEnabled('notifications') && (
            <div
              {...createTestId('mobile-topbar', 'notifications') && { 'data-testid': createTestId('mobile-topbar', 'notifications') }}
              {...createCyId('mobile-topbar', 'notifications') && { 'data-cy': createCyId('mobile-topbar', 'notifications') }}
            >
              <NotificationsDropdown />
            </div>
          )}

          {/* Theme Toggle */}
          {isTopbarFeatureEnabled('themeToggle') && (
            <div
              {...createTestId('mobile-topbar', 'theme', 'toggle') && { 'data-testid': createTestId('mobile-topbar', 'theme', 'toggle') }}
              {...createCyId('mobile-topbar', 'theme-toggle') && { 'data-cy': createCyId('mobile-topbar', 'theme-toggle') }}
            >
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
