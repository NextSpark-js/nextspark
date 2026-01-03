"use client"

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { useEffect, useState, useCallback } from "react"
import { createTestId, createCyId, createAriaLabel } from '../../../lib/test'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../hooks/useAuth'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const t = useTranslations('common')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = useCallback(async (newTheme: string) => {
    setTheme(newTheme)
    const themeNames = {
      light: t('theme.light'),
      dark: t('theme.dark'),
      system: t('theme.system')
    }
    setStatusMessage(`${t('theme.changed')} ${themeNames[newTheme as keyof typeof themeNames]}`)

    // If user is logged in, save theme preference to user meta
    if (user?.id) {
      try {
        await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta: {
              uiPreferences: {
                theme: newTheme
              }
            }
          }),
        })
      } catch (error) {
        console.error('[ThemeToggle] Failed to save theme preference:', error)
      }
    }
  }, [setTheme, t, user])

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        disabled
        aria-label={t('theme.loading')}
        {...createTestId('theme', 'toggle', 'loading') && { 'data-testid': createTestId('theme', 'toggle', 'loading') }}
        {...createCyId('theme', 'loading') && { 'data-cy': createCyId('theme', 'loading') }}
      >
        <Sun className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">{t('theme.loading')}</span>
      </Button>
    )
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('theme', 'status', 'message') && { 'data-testid': createTestId('theme', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            aria-label={createAriaLabel('{selector}, {current}: {theme}', { 
              selector: t('theme.selector'),
              current: t('theme.current'),
              theme: theme || t('theme.system')
            })}
            aria-haspopup="true"
            aria-expanded="false"
            {...createTestId('theme', 'toggle', 'button') && { 'data-testid': createTestId('theme', 'toggle', 'button') }}
            {...createCyId('theme', 'toggle') && { 'data-cy': createCyId('theme', 'toggle') }}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
            <span className="sr-only">{t('theme.change')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end"
          {...createTestId('theme', 'dropdown', 'content') && { 'data-testid': createTestId('theme', 'dropdown', 'content') }}
          {...createCyId('theme', 'menu') && { 'data-cy': createCyId('theme', 'menu') }}
        >
          <DropdownMenuItem 
            onClick={() => handleThemeChange("light")}
            aria-label={t('theme.changeToLight')}
            {...createTestId('theme', 'option', 'light') && { 'data-testid': createTestId('theme', 'option', 'light') }}
            {...createCyId('theme', 'light') && { 'data-cy': createCyId('theme', 'light') }}
          >
            <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{t('theme.light')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleThemeChange("dark")}
            aria-label={t('theme.changeToDark')}
            {...createTestId('theme', 'option', 'dark') && { 'data-testid': createTestId('theme', 'option', 'dark') }}
            {...createCyId('theme', 'dark') && { 'data-cy': createCyId('theme', 'dark') }}
          >
            <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{t('theme.dark')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleThemeChange("system")}
            aria-label={t('theme.changeToSystem')}
            {...createTestId('theme', 'option', 'system') && { 'data-testid': createTestId('theme', 'option', 'system') }}
            {...createCyId('theme', 'system') && { 'data-cy': createCyId('theme', 'system') }}
          >
            <Monitor className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{t('theme.system')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}