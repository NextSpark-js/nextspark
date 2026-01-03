'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from './input'
import { Badge } from './badge'
import { cn } from '../../lib/utils'

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showRequirements?: boolean
  showToggle?: boolean
  password?: string
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showRequirements = false, showToggle = true, password = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    
    const passwordRequirements = [
      { met: password.length >= 8, text: '8+ characters' },
      { met: /[A-Z]/.test(password), text: 'One uppercase' },
      { met: /[a-z]/.test(password), text: 'One lowercase' },
      { met: /[0-9]/.test(password), text: 'One number' },
    ]

    return (
      <div className="space-y-2">
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            {...props}
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={cn("pl-9", showToggle && "pr-9", className)}
          />
          {showToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {showRequirements && password && (
          <div className="flex flex-wrap gap-2">
            {passwordRequirements.map((req, index) => (
              <Badge 
                key={index}
                variant={req.met ? "default" : "secondary"}
                className="text-xs"
              >
                {req.met ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                {req.text}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }