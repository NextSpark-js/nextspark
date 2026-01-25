'use client'

import { Monitor, Smartphone } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

export type ViewportMode = 'desktop' | 'mobile'

export const MOBILE_VIEWPORT_WIDTH = 375 // Standard mobile width (iPhone SE/6/7/8)

interface ViewportToggleProps {
  value: ViewportMode
  onChange: (value: ViewportMode) => void
  className?: string
}

export function ViewportToggle({ value, onChange, className }: ViewportToggleProps) {
  return (
    <div
      data-cy={sel('blockEditor.header.viewportToggle.container')}
      className={cn(
        'flex items-center bg-muted rounded-lg p-1',
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0 rounded-md cursor-pointer',
          value === 'mobile' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('mobile')}
        data-cy={sel('blockEditor.header.viewportToggle.mobileBtn')}
        title="Mobile view (375px)"
      >
        <Smartphone className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0 rounded-md cursor-pointer',
          value === 'desktop' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('desktop')}
        data-cy={sel('blockEditor.header.viewportToggle.desktopBtn')}
        title="Desktop view (100%)"
      >
        <Monitor className="h-4 w-4" />
      </Button>
    </div>
  )
}
