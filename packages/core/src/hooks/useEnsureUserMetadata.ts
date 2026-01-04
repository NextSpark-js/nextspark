'use client'

import { useEffect } from 'react'
import { authClient } from '../lib/auth-client'

// Hook para asegurar que el usuario tenga metadata default
export function useEnsureUserMetadata() {
  const session = authClient.useSession()

  useEffect(() => {
    const ensureMetadata = async () => {
      if (!session.data?.user?.id) return

      try {
        // Verificar si el usuario ya tiene metadata
        const response = await fetch('/api/user/profile?includeMeta=true', {
          credentials: 'include'
        })

        if (response.ok) {
          const userData = await response.json()
          
          // Si no tiene metadata o está vacía, crear metadata default
          if (!userData.meta || Object.keys(userData.meta).length === 0) {
            console.log('Creating default metadata for user:', session.data.user.id)
            
            await fetch('/api/internal/user-metadata', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: session.data.user.id,
                metadata: {
                  uiPreferences: {
                    theme: "light",
                    sidebarCollapsed: false
                  },
                  securityPreferences: {
                    loginAlertsEnabled: true
                  },
                  notificationsPreferences: {
                    pushEnabled: true,
                    loginAlertsEmail: true,
                    loginAlertsPush: true,
                    passwordChangesEmail: true,
                    passwordChangesPush: true,
                    suspiciousActivityEmail: true,
                    suspiciousActivityPush: true,
                    mentionsEmail: true,
                    mentionsPush: true,
                    projectUpdatesEmail: true,
                    projectUpdatesPush: false,
                    teamInvitesEmail: true,
                    teamInvitesPush: true,
                    newsletterEmail: false,
                    newsletterPush: false,
                    promotionsEmail: false,
                    promotionsPush: false,
                    featureAnnouncementsEmail: true,
                    featureAnnouncementsPush: false
                  }
                }
              })
            })
            
            console.log('Default metadata created successfully')
          }
        }
      } catch (error) {
        console.error('Error ensuring user metadata:', error)
        // No hacer nada si falla - no queremos interrumpir la experiencia del usuario
      }
    }

    ensureMetadata()
  }, [session.data?.user?.id])
}
