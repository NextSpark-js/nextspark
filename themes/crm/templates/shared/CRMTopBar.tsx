/**
 * CRM TopBar Component
 * Professional top navigation bar for CRM dashboard
 *
 * Uses useQuickCreateEntities hook to dynamically show quick create options
 * based on user permissions and entity configuration.
 */

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import {
    Bell,
    Search,
    Plus,
    User,
    Settings,
    CreditCard,
    LogOut,
    Sun,
    Moon,
    HelpCircle,
    ChevronDown,
    Loader2
} from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { useTheme } from 'next-themes'
import { useQuickCreateEntities } from '@nextsparkjs/core/hooks/useQuickCreateEntities'

export function CRMTopBar() {
    const { user, signOut, isLoading } = useAuth()
    const { theme, setTheme } = useTheme()
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)

    // Get quick create entities filtered by permissions
    const { entities: quickCreateEntities, isLoading: isLoadingEntities, hasEntities } = useQuickCreateEntities()

    // Transform entities to quick actions format
    const quickActions = useMemo(() => {
        return quickCreateEntities.map(entity => ({
            label: `New ${entity.names?.singular || entity.slug}`,
            href: `/dashboard/${entity.slug}/create`,
            icon: entity.icon
        }))
    }, [quickCreateEntities])

    // Generate user initials
    const getUserInitials = (user: { firstName?: string; lastName?: string; email: string }) => {
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
        }
        if (user.firstName) {
            return user.firstName.slice(0, 2).toUpperCase()
        }
        return user.email.slice(0, 2).toUpperCase()
    }

    const handleSignOut = useCallback(async () => {
        try {
            await signOut()
        } catch (error) {
            console.error('Sign out failed:', error)
        }
    }, [signOut])

    return (
        <header
            data-cy="crm-topbar"
            className={cn(
                'hidden lg:block bg-background/80 backdrop-blur-md border-b border-border/50 fixed top-0 right-0 z-40 transition-all duration-300 ease-out'
            )}
            style={{ left: 'var(--crm-sidebar-width, 4rem)' }}
        >
            <div className="h-16 px-6 flex items-center justify-between gap-4">
                {/* Center: Search */}
                <div className="hidden md:flex flex-1 max-w-lg">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search leads, contacts, deals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            data-cy="crm-topbar-search-input"
                        />
                        {searchQuery && (
                            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                ESC
                            </kbd>
                        )}
                    </div>
                </div>

                {/* Right side: Actions */}
                <div className="flex items-center gap-2">
                    {/* Mobile search toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-9 w-9"
                        onClick={() => setShowSearch(!showSearch)}
                        data-cy="crm-topbar-search-mobile-toggle"
                    >
                        <Search className="h-4 w-4" />
                    </Button>

                    {/* Quick Create - Permission-filtered */}
                    {isLoadingEntities ? (
                        <Button size="sm" className="gap-2 h-9" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="hidden sm:inline">New</span>
                        </Button>
                    ) : hasEntities ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="gap-2 h-9" data-cy="crm-topbar-quick-create-btn">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">New</span>
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48" data-cy="crm-topbar-quick-create-dropdown">
                                {quickActions.map((action) => (
                                    <DropdownMenuItem key={action.href} asChild>
                                        <Link href={action.href} className="flex items-center gap-2">
                                            {action.icon && <action.icon className="h-4 w-4" />}
                                            {action.label}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}

                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="h-9 w-9 relative" data-cy="crm-topbar-notifications-btn">
                        <Bell className="h-4 w-4" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                    </Button>

                    {/* Help */}
                    <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex" data-cy="crm-topbar-help-btn">
                        <HelpCircle className="h-4 w-4" />
                    </Button>

                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        data-cy="crm-topbar-theme-toggle"
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>

                    {/* User Menu */}
                    {isLoading ? (
                        <div className="h-9 w-9 bg-muted animate-pulse rounded-full" />
                    ) : user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-9 gap-2 pl-2 pr-3" data-cy="crm-topbar-user-menu-trigger">
                                    {user.image ? (
                                        <Image
                                            src={user.image}
                                            alt=""
                                            width={28}
                                            height={28}
                                            className="h-7 w-7 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                                            {getUserInitials(user)}
                                        </div>
                                    )}
                                    <ChevronDown className="h-3 w-3 opacity-50 hidden sm:block" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56" data-cy="crm-topbar-user-menu-content">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{user.firstName || 'User'}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild data-cy="crm-topbar-menu-profile">
                                    <Link href="/dashboard/settings/profile" className="flex items-center">
                                        <User className="mr-2 h-4 w-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild data-cy="crm-topbar-menu-settings">
                                    <Link href="/dashboard/settings" className="flex items-center">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild data-cy="crm-topbar-menu-billing">
                                    <Link href="/dashboard/settings/billing" className="flex items-center">
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Billing
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleSignOut}
                                    className="text-destructive focus:text-destructive"
                                    data-cy="crm-topbar-menu-signout"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/login">Sign in</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href="/signup">Sign up</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile search bar */}
            {showSearch && (
                <div className="md:hidden px-4 pb-4 animate-in slide-in-from-top-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            autoFocus
                        />
                    </div>
                </div>
            )}
        </header>
    )
}

export default CRMTopBar
