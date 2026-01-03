'use client'

import { useEffect, useState } from 'react'

export function useOrigin() {
  const [mounted, setMounted] = useState(false)
  const [origin, setOrigin] = useState<string>('')
  
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      try {
        // Safely access location only when in browser
        const loc = window.location
        if (loc && loc.origin) {
          setOrigin(loc.origin)
        }
      } catch {
        // Silently fail if location is not accessible
      }
    }
  }, [])
  
  // Return default URL if not mounted or origin not available
  if (!mounted || !origin) {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
  }
  
  return origin
}