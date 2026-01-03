/**
 * Action Buttons Component
 * Reusable action button group for entities
 */

import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'

export interface ActionButton {
    label: string
    onClick: () => void
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    icon?: React.ReactNode
    disabled?: boolean
}

interface ActionButtonsProps {
    actions: ActionButton[]
    className?: string
}

export function ActionButtons({ actions, className = '' }: ActionButtonsProps) {
    return (
        <div className={`flex gap-2 ${className}`}>
            {actions.map((action, index) => (
                <Button
                    key={index}
                    onClick={action.onClick}
                    variant={action.variant || 'default'}
                    disabled={action.disabled}
                    className="gap-2"
                >
                    {action.icon}
                    {action.label}
                </Button>
            ))}
        </div>
    )
}

export default ActionButtons
