'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserWithMetaSettings } from './useUserSettings'

export function useSidebarState() {
  const { data: userData, updateEntity, isLoading } = useUserWithMetaSettings()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Cargar estado inicial desde meta cuando los datos estén disponibles
  useEffect(() => {
    if (userData?.meta?.uiPreferences && !isInitialized) {
      const uiPrefs = userData.meta.uiPreferences as { sidebarCollapsed?: boolean }
      const savedState = uiPrefs.sidebarCollapsed
      if (typeof savedState === 'boolean') {
        setIsCollapsed(savedState)
      }
      setIsInitialized(true)
    }
  }, [userData, isInitialized])

  // Función para actualizar el estado y persistirlo
  const updateSidebarState = useCallback(async (newState: boolean) => {
    try {
      // Actualizar estado local inmediatamente para mejor UX
      setIsCollapsed(newState)
      
      // Persistir en el meta del usuario
      await updateEntity({
        meta: {
          uiPreferences: {
            sidebarCollapsed: newState
          }
        }
      })
    } catch (error) {
      console.error('Error updating sidebar state:', error)
      // Revertir estado local si falla la actualización
      setIsCollapsed(!newState)
    }
  }, [updateEntity])

  // Función toggle
  const toggleSidebar = useCallback(() => {
    updateSidebarState(!isCollapsed)
  }, [isCollapsed, updateSidebarState])

  return {
    isCollapsed,
    toggleSidebar,
    setIsCollapsed: updateSidebarState,
    isLoading: isLoading || !isInitialized
  }
}
