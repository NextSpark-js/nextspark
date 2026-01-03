'use client'

/**
 * Blog Navbar Component
 *
 * Editorial navigation with blog title, category links, and actions.
 * Responsive design with mobile hamburger menu.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Moon, Sun, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Button } from '@nextsparkjs/core/components/ui/button'

interface BlogNavbarProps {
  blogTitle?: string
  navLinks?: Array<{ name: string; href: string }>
}

export function BlogNavbar({
  blogTitle = 'My Blog',
  navLinks = []
}: BlogNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header
      data-cy="blog-navbar"
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        isScrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-background border-b border-border'
      )}
    >
      <div className="container mx-auto px-4">
        <nav data-cy="blog-navbar-nav" className="flex items-center justify-between h-16">
          {/* Logo / Blog Title */}
          <Link
            href="/"
            data-cy="blog-navbar-logo"
            className="font-serif text-xl font-bold text-foreground hover:text-primary transition-colors"
          >
            {blogTitle}
          </Link>

          {/* Desktop Navigation */}
          <div data-cy="blog-navbar-links" className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              data-cy="blog-navbar-link-home"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              Home
            </Link>
            <Link
              href="/posts"
              data-cy="blog-navbar-link-posts"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              Posts
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-cy={`blog-navbar-link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div data-cy="blog-navbar-actions" className="flex items-center gap-2">
            {/* Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              data-cy="blog-navbar-search"
              className="hidden md:flex"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                data-cy="blog-navbar-theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Dashboard Link */}
            <Link href="/dashboard" data-cy="blog-navbar-dashboard-link">
              <Button variant="outline" size="sm" className="hidden md:inline-flex">
                Dashboard
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              data-cy="blog-navbar-mobile-toggle"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div data-cy="blog-navbar-mobile-menu" className="md:hidden border-t border-border py-4">
            <div className="flex flex-col gap-1">
              <Link
                href="/"
                data-cy="blog-navbar-mobile-link-home"
                className="px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/posts"
                data-cy="blog-navbar-mobile-link-posts"
                className="px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
                onClick={() => setIsMenuOpen(false)}
              >
                Posts
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  data-cy={`blog-navbar-mobile-link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <hr className="my-2 border-border" />
              <Link
                href="/dashboard"
                data-cy="blog-navbar-mobile-link-dashboard"
                className="px-3 py-2 text-sm font-medium text-primary hover:bg-muted rounded-md"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default BlogNavbar
