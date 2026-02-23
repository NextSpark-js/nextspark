'use client'

import { createContext, useContext } from 'react'
import type { WalkmeContextValue } from '../types/walkme.types'

export const WalkmeContext = createContext<WalkmeContextValue | null>(null)

export function useWalkmeContext(): WalkmeContextValue {
  const context = useContext(WalkmeContext)
  if (!context) {
    throw new Error(
      'useWalkmeContext must be used within a <WalkmeProvider>. ' +
        'Wrap your app or page with <WalkmeProvider tours={[...]}> to use WalkMe hooks.',
    )
  }
  return context
}
