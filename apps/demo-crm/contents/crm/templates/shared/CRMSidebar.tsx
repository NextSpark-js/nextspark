/**
 * CRM Sidebar Component
 * Professional sidebar with smooth expand-on-hover animation
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { TeamSwitcherCompact } from '@nextsparkjs/core/components/teams/TeamSwitcherCompact'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import Image from 'next/image'
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Building2,
    Target,
    Layers,
    Package,
    Megaphone,
    Calendar,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Sparkles
} from 'lucide-react'

interface NavItem {
    href: string
    icon: React.ElementType
    label: string
    badge?: number
    color?: string
}

const mainNavItems: NavItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'text-primary' },
    { href: '/dashboard/leads', icon: UserPlus, label: 'Leads', color: 'text-amber-500' },
    { href: '/dashboard/contacts', icon: Users, label: 'Contacts', color: 'text-emerald-500' },
    { href: '/dashboard/companies', icon: Building2, label: 'Companies', color: 'text-blue-500' },
    { href: '/dashboard/pipelines', icon: Layers, label: 'Pipelines', color: 'text-violet-500' },
    { href: '/dashboard/products', icon: Package, label: 'Products', color: 'text-rose-500' },
    { href: '/dashboard/campaigns', icon: Megaphone, label: 'Campaigns', color: 'text-orange-500' },
    { href: '/dashboard/activities', icon: Calendar, label: 'Activities', color: 'text-cyan-500' },
]

const bottomNavItems: NavItem[] = [
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

// Tooltip component
function Tooltip({ children, content, side = 'right', show = true }: {
    children: React.ReactNode
    content: string
    side?: 'right' | 'bottom'
    show?: boolean
}) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {show && isVisible && (
                <div
                    className={cn(
                        'absolute z-[60] px-3 py-1.5 text-sm font-medium text-white bg-foreground rounded-lg whitespace-nowrap shadow-lg',
                        'animate-in fade-in-0 zoom-in-95 duration-100',
                        side === 'right' && 'left-full ml-3 top-1/2 -translate-y-1/2',
                        side === 'bottom' && 'top-full mt-2 left-1/2 -translate-x-1/2'
                    )}
                >
                    {content}
                    {/* Arrow */}
                    <div
                        className={cn(
                            'absolute w-2 h-2 bg-foreground rotate-45',
                            side === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-1',
                            side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1'
                        )}
                    />
                </div>
            )}
        </div>
    )
}

// Nav item component
function NavItemButton({ item, isActive, expanded }: {
    item: NavItem
    isActive: boolean
    expanded: boolean
}) {
    const Icon = item.icon
    const slug = item.href.split('/').pop() || 'dashboard'

    const button = (
        <Link
            href={item.href}
            className={cn(
                'group/item flex items-center gap-3 rounded-xl transition-all duration-200 relative overflow-hidden',
                expanded ? 'px-3 py-2.5' : 'p-2.5 justify-center',
                isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
            data-cy={`crm-sidebar-nav-${slug}`}
        >
            {/* Gradient overlay for active state */}
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}

            <Icon className={cn(
                'shrink-0 w-5 h-5 relative z-10 transition-transform duration-200',
                !isActive && 'group-hover/item:scale-110',
                !isActive && item.color
            )} />

            {expanded && (
                <span className="text-sm font-medium truncate relative z-10">{item.label}</span>
            )}

            {expanded && item.badge && item.badge > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-white/20 text-white rounded-full relative z-10">
                    {item.badge}
                </span>
            )}
        </Link>
    )

    if (expanded) {
        return button
    }

    return (
        <Tooltip content={item.label} show={!expanded}>
            {button}
        </Tooltip>
    )
}

export function CRMSidebar() {
    const pathname = usePathname()
    const { user, signOut } = useAuth()
    const [expanded, setExpanded] = useState(false)

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard'
        }
        return pathname.startsWith(href)
    }

    const getUserInitials = useCallback(() => {
        if (!user) return 'U'
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
        }
        if (user.firstName) {
            return user.firstName.slice(0, 2).toUpperCase()
        }
        return user.email?.slice(0, 2).toUpperCase() || 'U'
    }, [user])

    const handleSignOut = useCallback(async () => {
        try {
            await signOut()
        } catch (error) {
            console.error('Sign out failed:', error)
        }
    }, [signOut])

    return (
        <aside
            data-cy="crm-sidebar"
            className={cn(
                'hidden lg:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-300 ease-out',
                'bg-gradient-to-b from-card via-card to-card/95 border-r border-border/50',
                'shadow-[2px_0_20px_-5px_rgba(0,0,0,0.1)]',
                expanded ? 'w-64' : 'w-16'
            )}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            style={{
                // CSS variable for layout
                ['--crm-sidebar-width' as any]: expanded ? '16rem' : '4rem'
            }}
        >
            {/* Header with Logo */}
            <div className={cn(
                'flex items-center h-16 border-b border-border/50',
                expanded ? 'px-4 justify-between' : 'justify-center'
            )}>
                <Link href="/dashboard" className="flex items-center gap-3 group" data-cy="crm-sidebar-logo">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    {expanded && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                            <span className="font-bold text-lg text-foreground tracking-tight">SalesHub</span>
                            <span className="text-[10px] text-muted-foreground block -mt-0.5 uppercase tracking-widest">CRM Pro</span>
                        </div>
                    )}
                </Link>
                {expanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpanded(false)
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-105"
                        data-cy="crm-sidebar-collapse-btn"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Main Navigation */}
            <nav className={cn('flex-1 overflow-y-auto py-4 scrollbar-thin', expanded ? 'px-3' : 'px-2')}>
                {expanded && (
                    <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 animate-in fade-in duration-200">
                        Navigation
                    </p>
                )}
                <div className="space-y-1">
                    {mainNavItems.map((item, index) => (
                        <div
                            key={item.href}
                            style={{ animationDelay: `${index * 30}ms` }}
                            className={expanded ? 'animate-in fade-in slide-in-from-left-2' : ''}
                        >
                            <NavItemButton
                                item={item}
                                isActive={isActive(item.href)}
                                expanded={expanded}
                            />
                        </div>
                    ))}
                </div>
            </nav>

            {/* Bottom Section */}
            <div className={cn('border-t border-border/50 py-3', expanded ? 'px-3' : 'px-2')}>
                {/* Settings */}
                <div className="space-y-1 mb-3">
                    {bottomNavItems.map((item) => (
                        <NavItemButton
                            key={item.href}
                            item={item}
                            isActive={isActive(item.href)}
                            expanded={expanded}
                        />
                    ))}
                </div>

                {/* Team Switcher */}
                {expanded && (
                    <div className="mb-3 animate-in fade-in slide-in-from-left-2 duration-200">
                        <TeamSwitcherCompact />
                    </div>
                )}

                {/* User Profile Section */}
                <div className={cn(
                    'rounded-xl transition-all duration-200',
                    expanded ? 'bg-muted/50 p-3' : 'flex justify-center'
                )}>
                    {expanded ? (
                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                            {user?.image ? (
                                <Image
                                    src={user.image}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="w-9 h-9 rounded-full object-cover ring-2 ring-background"
                                    data-cy="crm-sidebar-user-avatar"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-background" data-cy="crm-sidebar-user-avatar">
                                    {getUserInitials()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" data-cy="crm-sidebar-user-name">
                                    {user?.firstName || 'User'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate" data-cy="crm-sidebar-user-email">
                                    {user?.email}
                                </p>
                            </div>
                            <Tooltip content="Sign out" side="bottom">
                                <button
                                    onClick={handleSignOut}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    data-cy="crm-sidebar-signout-btn"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </Tooltip>
                        </div>
                    ) : (
                        <Tooltip content={user?.firstName || 'Profile'}>
                            <Link
                                href="/dashboard/settings/profile"
                                className="block"
                            >
                                {user?.image ? (
                                    <Image
                                        src={user.image}
                                        alt=""
                                        width={36}
                                        height={36}
                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-border hover:ring-primary transition-all"
                                        data-cy="crm-sidebar-user-avatar"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-border hover:ring-primary transition-all" data-cy="crm-sidebar-user-avatar">
                                        {getUserInitials()}
                                    </div>
                                )}
                            </Link>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Hover indicator edge */}
            <div className={cn(
                'absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/0 via-primary/50 to-primary/0 opacity-0 transition-opacity duration-300',
                expanded && 'opacity-100'
            )} />
        </aside>
    )
}

export default CRMSidebar
