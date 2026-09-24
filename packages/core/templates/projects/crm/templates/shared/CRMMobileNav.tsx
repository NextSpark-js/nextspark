/**
 * CRM Mobile Navigation Component
 * Bottom navigation for mobile devices
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { TeamSwitcherCompact } from '@nextsparkjs/core/components/teams/TeamSwitcherCompact'
import { useTranslations } from 'next-intl'
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Building2,
    Layers,
    MoreHorizontal,
    X,
    Package,
    Megaphone,
    Calendar,
    Settings
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@nextsparkjs/core/components/ui/sheet'

interface NavItem {
    href: string
    icon: React.ElementType
    labelKey: string
}

const mainNavItems: NavItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, labelKey: 'common.mobileNav.home' },
    { href: '/dashboard/leads', icon: UserPlus, labelKey: 'crm.navigation.leads' },
    { href: '/dashboard/contacts', icon: Users, labelKey: 'crm.navigation.contacts' },
    { href: '/dashboard/pipelines', icon: Layers, labelKey: 'pipelines.entity.plural' },
]

const moreNavItems: NavItem[] = [
    { href: '/dashboard/companies', icon: Building2, labelKey: 'crm.navigation.companies' },
    { href: '/dashboard/products', icon: Package, labelKey: 'products.entity.plural' },
    { href: '/dashboard/campaigns', icon: Megaphone, labelKey: 'crm.navigation.campaigns' },
    { href: '/dashboard/activities', icon: Calendar, labelKey: 'crm.navigation.activities' },
    { href: '/dashboard/settings', icon: Settings, labelKey: 'crm.navigation.settings' },
]

export function CRMMobileNav() {
    const pathname = usePathname()
    const t = useTranslations()
    const [moreOpen, setMoreOpen] = useState(false)

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard'
        }
        return pathname.startsWith(href)
    }

    const isMoreActive = moreNavItems.some(item => isActive(item.href))

    return (
        <>
            {/* Mobile Top Bar */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur-md border-b border-border" data-cy="crm-mobile-topbar">
                <div className="flex items-center justify-between h-full px-4">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Layers className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-lg">CRM</span>
                    </Link>

                    <TeamSwitcherCompact />
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-20 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom" data-cy="crm-mobile-nav">
                <div className="flex items-center justify-around h-full px-2">
                    {mainNavItems.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.href)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 min-w-[4rem] py-2 rounded-xl transition-colors',
                                    active
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                                data-cy={`crm-mobile-nav-${item.href.split('/').pop() || 'home'}`}
                            >
                                <div className={cn(
                                    'flex items-center justify-center w-10 h-7 rounded-lg transition-colors',
                                    active && 'bg-primary/10'
                                )}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-medium">{t(item.labelKey)}</span>
                            </Link>
                        )
                    })}

                    {/* More Button */}
                    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                        <SheetTrigger asChild>
                            <button
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 min-w-[4rem] py-2 rounded-xl transition-colors',
                                    isMoreActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                                data-cy="crm-mobile-nav-more"
                            >
                                <div className={cn(
                                    'flex items-center justify-center w-10 h-7 rounded-lg transition-colors',
                                    isMoreActive && 'bg-primary/10'
                                )}>
                                    <MoreHorizontal className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-medium">{t('common.mobileNav.more')}</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-auto rounded-t-3xl pb-8" data-cy="crm-mobile-more-sheet">
                            <div className="flex justify-center mb-4">
                                <div className="w-10 h-1 rounded-full bg-muted" />
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {moreNavItems.map((item) => {
                                    const Icon = item.icon
                                    const active = isActive(item.href)

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setMoreOpen(false)}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors',
                                                active
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                            data-cy={`crm-mobile-more-${item.href.split('/').pop()}`}
                                        >
                                            <div className={cn(
                                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                                active ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                            )}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-medium">{t(item.labelKey)}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>
        </>
    )
}

export default CRMMobileNav
