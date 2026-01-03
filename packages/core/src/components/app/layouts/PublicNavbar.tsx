'use client'

import Link from 'next/link'
import { useAuth } from '../../../hooks/useAuth'
import { Button } from '../../ui/button'
import { ThemeToggle } from '../misc/ThemeToggle'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { sel } from '../../../lib/test'

import { useTranslations } from 'next-intl'

export function PublicNavbar() {
  const { user, isLoading } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const tNav = useTranslations('navigation')
  const tHome = useTranslations('home')

  const navigationItems = [
    { name: 'features', href: '/features' },
    { name: 'pricing', href: '/pricing' },
    { name: 'support', href: '/support' },
    { name: 'docs', href: '/docs' }
  ]

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      data-cy={sel('public.navbar.container')}
    >
      <div className="container max-w-7xl mx-auto px-4 flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <Link
            href="/"
            className="mr-6 flex items-center space-x-2"
            data-cy={sel('public.navbar.logo')}
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">B</span>
            </div>
            <span className="hidden font-bold sm:inline-block">
              Boilerplate
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex">
          <nav className="flex items-center gap-6 text-sm">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {tNav(item.name)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Side */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Spacer for mobile */}
          </div>
          
          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            
            {isLoading ? (
              <div className="flex gap-2">
                <div className="h-9 w-16 bg-muted animate-pulse rounded-md"></div>
                <div className="h-9 w-20 bg-muted animate-pulse rounded-md"></div>
              </div>
                          ) : user ? (
              <Button asChild>
                <Link href="/dashboard">
                  {tHome('auth.goToDashboard')}
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild data-cy={sel('public.navbar.loginButton')}>
                  <Link href="/login">
                    {tHome('auth.signIn')}
                  </Link>
                </Button>
                <Button asChild data-cy={sel('public.navbar.signupButton')}>
                  <Link href="/signup">
                    {tHome('auth.createAccount')}
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="container px-4 py-4">
            {/* Navigation Links */}
            <nav className="flex flex-col space-y-2 mb-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {tNav(item.name)}
                </Link>
              ))}
            </nav>

            {/* Mobile Auth Buttons */}
            <div className="flex flex-col space-y-2 pt-4 border-t border-border">
              {isLoading ? (
                <div className="flex flex-col space-y-2">
                  <div className="h-9 bg-muted animate-pulse rounded-md"></div>
                  <div className="h-9 bg-muted animate-pulse rounded-md"></div>
                </div>
              ) : user ? (
                <Button asChild className="w-full">
                  <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                    {tHome('auth.goToDashboard')}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild className="w-full">
                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                      {tHome('auth.signIn')}
                    </Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                      {tHome('auth.createAccount')}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
