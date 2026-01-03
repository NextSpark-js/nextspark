"use client"

import * as React from "react"
import { User, X, Plus, Search, Loader2 } from "lucide-react"
import { Button } from './button'
import { Input } from './input'
import { Badge } from './badge'
import { Card, CardContent } from './card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { cn } from '../../lib/utils'
import { useTeam } from '../../hooks/useTeam'

export interface SelectedUser {
  id: string | number
  firstName: string
  lastName?: string
  email: string
  avatar?: string
  role?: string
}

// Type for what onChange receives - can be IDs for storage or full objects
type OnChangeValue = SelectedUser[] | (string | number)[] | string | number | null

interface UserSelectProps {
  value: SelectedUser[]
  onChange: (value: OnChangeValue) => void
  multiple?: boolean
  maxUsers?: number
  disabled?: boolean
  className?: string
  placeholder?: string
  searchPlaceholder?: string
  onSearch?: (query: string) => Promise<SelectedUser[]>
  onCreate?: () => void
  allowCreate?: boolean
  roleFilter?: string[]
  /** Team ID for loading real team members */
  teamId?: string
}

export function UserSelect({
  value = [],
  onChange,
  multiple = false,
  maxUsers,
  disabled = false,
  className,
  placeholder = "Seleccionar usuarios...",
  searchPlaceholder = "Buscar usuarios...",
  onSearch,
  onCreate,
  allowCreate = false,
  roleFilter = [],
  teamId,
}: UserSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SelectedUser[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [teamMembers, setTeamMembers] = React.useState<SelectedUser[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(true)
  const [resolvedValue, setResolvedValue] = React.useState<SelectedUser[]>([])

  // Get team from context if not provided via props
  const { teamId: contextTeamId } = useTeam()
  const effectiveTeamId = teamId || contextTeamId

  // Fetch team members when teamId is available
  React.useEffect(() => {
    if (!effectiveTeamId) {
      setIsLoadingMembers(false)
      return
    }

    setIsLoadingMembers(true)
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch(`/api/v1/teams/${effectiveTeamId}/members`)
        if (!response.ok) {
          console.error('Failed to fetch team members')
          return
        }
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          // Map API response to SelectedUser format
          const users: SelectedUser[] = data.data.map((member: {
            userId: string
            userName: string | null
            userEmail: string
            userImage: string | null
            role: string
          }) => {
            // Split name into firstName and lastName
            const nameParts = (member.userName || '').split(' ')
            const firstName = nameParts[0] || member.userEmail.split('@')[0]
            const lastName = nameParts.slice(1).join(' ') || undefined

            return {
              id: member.userId,
              firstName,
              lastName,
              email: member.userEmail,
              avatar: member.userImage || undefined,
              role: member.role,
            }
          })
          setTeamMembers(users)
        }
      } catch (error) {
        console.error('Error fetching team members:', error)
      } finally {
        setIsLoadingMembers(false)
      }
    }

    fetchTeamMembers()
  }, [effectiveTeamId])

  // Resolve value - convert ID strings to full user objects when possible
  React.useEffect(() => {
    if (value.length === 0) {
      setResolvedValue([])
      return
    }

    // Check if value contains full objects or just IDs
    const resolved = value.map(v => {
      // If it's already a full user object with firstName, use it
      if (typeof v === 'object' && v.firstName) {
        return v
      }

      // If it's an ID (either string or object with just id), look up in teamMembers
      const userId = typeof v === 'object' ? v.id : v
      const found = teamMembers.find(m => m.id === userId)
      if (found) {
        return found
      }

      // Return a placeholder if user not found
      return {
        id: userId,
        firstName: String(userId).slice(0, 8) + '...',
        email: '',
      } as SelectedUser
    })

    setResolvedValue(resolved)
  }, [value, teamMembers])

  // Stabilize roleFilter to prevent constant re-renders
  const stableRoleFilter = React.useMemo(() => {
    if (!roleFilter || roleFilter.length === 0) return []
    return [...roleFilter].sort()
  }, [roleFilter])

  // Filter users based on search query and role
  const filteredUsers = React.useMemo(() => {
    let users = teamMembers

    // Apply role filter
    if (stableRoleFilter.length > 0) {
      users = users.filter(user => user.role && stableRoleFilter.includes(user.role))
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase()
      users = users.filter(user => {
        const fullName = `${user.firstName} ${user.lastName || ''}`.toLowerCase()
        const email = user.email.toLowerCase()
        return fullName.includes(queryLower) || email.includes(queryLower)
      })
    }

    return users
  }, [teamMembers, stableRoleFilter, searchQuery])

  // Custom search handler (if provided)
  React.useEffect(() => {
    if (!onSearch || !open) return

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await onSearch(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, open, onSearch])

  // Use custom search results if onSearch is provided, otherwise use filtered users
  const displayUsers = onSearch ? searchResults : filteredUsers

  const handleSelect = React.useCallback((user: SelectedUser) => {
    if (disabled) return

    if (multiple) {
      const isSelected = resolvedValue.some(v => v.id === user.id)
      if (isSelected) {
        // Remove user - pass only IDs for storage
        const newIds = resolvedValue.filter(v => v.id !== user.id).map(v => v.id)
        onChange(newIds)
      } else {
        if (maxUsers && resolvedValue.length >= maxUsers) return
        // Add user - pass only IDs for storage
        const newIds = [...resolvedValue.map(v => v.id), user.id]
        onChange(newIds)
      }
    } else {
      // Single selection - pass only the user ID string for database storage
      onChange(user.id)
      setOpen(false)
    }
  }, [disabled, multiple, resolvedValue, onChange, maxUsers])

  const handleRemove = React.useCallback((userId: string | number) => {
    if (disabled) return
    // Filter out the user and pass only IDs for storage
    const remainingIds = resolvedValue.filter(user => user.id !== userId).map(user => user.id)
    // For single selection, pass null/empty; for multiple, pass the array
    if (!multiple && remainingIds.length === 0) {
      onChange(null)
    } else if (!multiple) {
      onChange(remainingIds[0] || null)
    } else {
      onChange(remainingIds)
    }
  }, [disabled, onChange, resolvedValue, multiple])

  const isSelected = React.useCallback((user: SelectedUser) => {
    return resolvedValue.some(v => v.id === user.id)
  }, [resolvedValue])

  const getInitials = React.useCallback((user: SelectedUser) => {
    const first = user.firstName?.[0] || ""
    const last = user.lastName?.[0] || ""
    return (first + last).toUpperCase() || "?"
  }, [])

  const getDisplayName = React.useCallback((user: SelectedUser) => {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName
  }, [])

  const getRoleColor = React.useCallback((role?: string) => {
    switch (role) {
      case "owner": return "bg-purple-100 text-purple-800"
      case "admin": return "bg-red-100 text-red-800"
      case "colaborator": return "bg-blue-100 text-blue-800"
      case "member": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }, [])

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    // Only open if team members are loaded or we have a custom search
    if (newOpen && isLoadingMembers && !onSearch) {
      return
    }
    setOpen(newOpen)
    if (!newOpen) {
      setSearchQuery("")
    }
  }, [isLoadingMembers, onSearch])

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Selected Users */}
      {resolvedValue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resolvedValue.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="text-xs flex items-center gap-2 py-1 px-2"
            >
              <Avatar className="w-4 h-4">
                <AvatarImage src={user.avatar} alt={getDisplayName(user)} />
                <AvatarFallback className="text-xs">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{getDisplayName(user)}</span>
              {!disabled && (
                <button
                  onClick={() => handleRemove(user.id)}
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Selection Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled || !!(maxUsers && resolvedValue.length >= maxUsers)}
          >
            {isLoadingMembers ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                {resolvedValue.length > 0
                  ? `${resolvedValue.length} usuario${resolvedValue.length > 1 ? 's' : ''} seleccionado${resolvedValue.length > 1 ? 's' : ''}`
                  : placeholder
                }
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Usuarios</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Role Filter Info */}
            {stableRoleFilter.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Filtrando por roles: {stableRoleFilter.join(", ")}
              </div>
            )}

            {/* Create New Button */}
            {allowCreate && onCreate && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onCreate}
              >
                <Plus className="mr-2 h-4 w-4" />
                Invitar nuevo usuario
              </Button>
            )}

            {/* Search Results */}
            <div className="max-h-60 overflow-auto space-y-2">
              {isSearching ? (
                <div className="text-center text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Buscando usuarios...
                </div>
              ) : displayUsers.length > 0 ? (
                displayUsers.map((user) => (
                  <Card
                    key={user.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted",
                      isSelected(user) && "bg-primary/10 border-primary"
                    )}
                    onClick={() => handleSelect(user)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatar} alt={getDisplayName(user)} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getDisplayName(user)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {user.role && (
                            <Badge
                              variant="secondary"
                              className={cn("text-xs mt-1", getRoleColor(user.role))}
                            >
                              {user.role}
                            </Badge>
                          )}
                        </div>
                        {isSelected(user) && (
                          <div className="text-primary">✓</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  {searchQuery ? "No se encontraron usuarios" : "No hay usuarios disponibles"}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
