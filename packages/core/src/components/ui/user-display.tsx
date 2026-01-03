"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Badge } from './badge'
import { cn } from '../../lib/utils'
import { useTeam } from '../../hooks/useTeam'

interface UserDisplayProps {
  value: string | null | undefined
  /** Team ID for fetching user data (uses context if not provided) */
  teamId?: string
  showRole?: boolean
  showEmail?: boolean
  className?: string
}

interface UserData {
  id: string
  name: string | null
  email: string
  image: string | null
  role?: string
}

/**
 * Display a user's name by fetching their data from the team members API
 * Used in entity detail views for user relation fields
 */
export function UserDisplay({
  value,
  teamId: propTeamId,
  showRole = false,
  showEmail = false,
  className,
}: UserDisplayProps) {
  const [userData, setUserData] = React.useState<UserData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Get team from context if not provided via props
  const { teamId: contextTeamId } = useTeam()
  const effectiveTeamId = propTeamId || contextTeamId

  // Track loaded user ID and team ID to prevent unnecessary fetches
  const loadedRef = React.useRef<{ userId: string | null; teamId: string | null }>({ userId: null, teamId: null })

  React.useEffect(() => {
    // Skip if no value or no team ID
    if (!value || !effectiveTeamId) {
      if (!value) {
        setUserData(null)
        loadedRef.current = { userId: null, teamId: null }
      }
      return
    }

    // Skip if already loaded for this user and team
    if (value === loadedRef.current.userId && effectiveTeamId === loadedRef.current.teamId) {
      return
    }

    const fetchUser = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/v1/teams/${effectiveTeamId}/members`, {
          headers: {
            'Content-Type': 'application/json',
            'x-team-id': effectiveTeamId
          },
          credentials: 'include'
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && Array.isArray(result.data)) {
            // Find the user in the team members list
            const member = result.data.find((m: {
              userId: string
              userName: string | null
              userEmail: string
              userImage: string | null
              role: string
            }) => m.userId === value)

            if (member) {
              setUserData({
                id: member.userId,
                name: member.userName,
                email: member.userEmail,
                image: member.userImage,
                role: member.role
              })
              loadedRef.current = { userId: value, teamId: effectiveTeamId }
            } else {
              // User not found in team members - show ID as fallback
              setError('Usuario no encontrado')
            }
          }
        } else {
          setError('Error al cargar usuario')
        }
      } catch (err) {
        console.error('[UserDisplay] Error fetching user:', err)
        setError('Error al cargar usuario')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [value, effectiveTeamId])

  // No value - show placeholder
  if (!value) {
    return <span className={cn("text-muted-foreground", className)}>-</span>
  }

  // Loading state
  if (loading) {
    return <span className={cn("text-muted-foreground", className)}>Cargando...</span>
  }

  // Error state - show user ID as fallback
  if (error || !userData) {
    return <span className={cn("text-muted-foreground", className)}>{value}</span>
  }

  // Get initials for avatar fallback
  const getInitials = (name: string | null) => {
    if (!name) return '?'
    const parts = name.split(' ')
    const first = parts[0]?.[0] || ''
    const last = parts[1]?.[0] || ''
    return (first + last).toUpperCase() || '?'
  }

  // Get role color
  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800'
      case 'admin': return 'bg-red-100 text-red-800'
      case 'member': return 'bg-green-100 text-green-800'
      case 'viewer': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="h-6 w-6">
        <AvatarImage src={userData.image || undefined} alt={userData.name || 'User'} />
        <AvatarFallback className="text-xs">
          {getInitials(userData.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {userData.name || userData.email}
        </span>
        {showEmail && userData.name && (
          <span className="text-xs text-muted-foreground">{userData.email}</span>
        )}
      </div>
      {showRole && userData.role && (
        <Badge variant="secondary" className={cn("text-xs ml-2", getRoleColor(userData.role))}>
          {userData.role}
        </Badge>
      )}
    </div>
  )
}
