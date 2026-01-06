/**
 * Entity Card Component
 * Reusable card for displaying entity summaries
 */

import React from 'react'
import '@/contents/themes/crm/styles/crm-theme.css'

interface EntityCardProps {
    title: string
    subtitle?: string
    meta?: string
    status?: {
        label: string
        variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    }
    onClick?: () => void
    children?: React.ReactNode
    className?: string
}

export function EntityCard({
    title,
    subtitle,
    meta,
    status,
    onClick,
    children,
    className = '',
}: EntityCardProps) {
    return (
        <div
            className={`crm-entity-card ${className}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="crm-entity-card-header">
                <div>
                    <div className="crm-entity-card-title">{title}</div>
                    {subtitle && <div className="crm-entity-card-meta">{subtitle}</div>}
                </div>

                {status && (
                    <span className={`crm-badge ${status.variant}`}>
                        {status.label}
                    </span>
                )}
            </div>

            {meta && <div className="crm-entity-card-meta">{meta}</div>}

            {children && <div className="mt-3">{children}</div>}
        </div>
    )
}

export default EntityCard
