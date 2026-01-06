/**
 * Productivity Dashboard Layout
 * Clean layout with fixed sidebar for boards navigation
 */

'use client'

import { ReactNode } from 'react'
import { ProductivitySidebar } from '@/themes/productivity/templates/shared/ProductivitySidebar'
import { ProductivityMobileNav } from '@/themes/productivity/templates/shared/ProductivityMobileNav'

interface ProductivityDashboardLayoutProps {
    children: ReactNode
}

export default function ProductivityDashboardLayout({ children }: ProductivityDashboardLayoutProps) {
    console.log('🎨 [ProductivityDashboardLayout] RENDERING - ProductivitySidebar should be visible')
    return (
        <div className="min-h-screen bg-background">
            {/* Desktop: Fixed Sidebar */}
            <ProductivitySidebar />

            {/* Mobile: Bottom Navigation */}
            <ProductivityMobileNav />

            {/* Main Content Area */}
            <main className="min-h-screen pb-20 lg:pb-0 lg:ml-64">
                {children}
            </main>
        </div>
    )
}
