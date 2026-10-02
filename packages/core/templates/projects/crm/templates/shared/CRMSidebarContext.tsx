/**
 * CRM sidebar state, shared by the dashboard layout (provider) and any component that reads it.
 * Lives outside the layout: Next only allows a layout to export its default component.
 */

'use client'

import { createContext, useContext } from 'react'

export interface SidebarContextValue {
  expanded: boolean
  setExpanded: (value: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function useCRMSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    return { expanded: false, setExpanded: () => {} }
  }
  return context
}
