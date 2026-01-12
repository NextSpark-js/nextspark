'use client'

import { useState, useMemo, useCallback } from 'react'
import { Check, ChevronsUpDown, Globe, Users, Search, Loader2 } from 'lucide-react'
import { useUserTeams, useTeamSearch } from '../../../hooks/teams'
import { useDebounce } from '../../../hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '../../ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover'
import { cn } from '../../../lib/utils'
import { sel } from '../../../lib/test'

interface TeamSelectorProps {
  selectedTeamId: string | null
  onTeamChange: (teamId: string | null) => void
  bypassMode: boolean
  disabled?: boolean
}

/**
 * TeamSelector - Dropdown para seleccionar team context
 *
 * Modes:
 * - Normal mode: Simple Select with user's teams only
 * - Bypass mode: Searchable Combobox with ALL teams + "Cross-team (all)" option
 */
export function TeamSelector({
  selectedTeamId,
  onTeamChange,
  bypassMode,
  disabled = false,
}: TeamSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearch = useDebounce(searchValue, 300)

  // User's teams (for normal mode)
  const { teams: userTeams, isLoading: isLoadingUserTeams } = useUserTeams()

  // All teams (for bypass mode) - using new hook
  const {
    teams: allTeams,
    totalCount,
    isLoading: isLoadingAllTeams,
  } = useTeamSearch(debouncedSearch, bypassMode)

  // Get selected team info
  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null
    // Search in both lists
    const fromUser = userTeams.find((t) => t.id === selectedTeamId)
    if (fromUser) return fromUser
    const fromAll = allTeams.find((t) => t.id === selectedTeamId)
    if (fromAll) return { id: fromAll.id, name: fromAll.name, slug: '' }
    return null
  }, [selectedTeamId, userTeams, allTeams])

  // Handle team selection
  const handleSelect = useCallback(
    (teamId: string | null) => {
      onTeamChange(teamId)
      setOpen(false)
      setSearchValue('')
    },
    [onTeamChange]
  )

  // Loading state
  if (!bypassMode && isLoadingUserTeams) {
    return <Skeleton className="h-9 w-full" data-cy={sel('devtools.apiExplorer.team.loading')} />
  }

  // === NORMAL MODE: Simple Select with user's teams ===
  if (!bypassMode) {
    return (
      <div className="space-y-1.5" data-cy={sel('devtools.apiExplorer.team.container')}>
        <label className="text-xs font-medium text-muted-foreground">Team Context</label>
        <Select
          value={selectedTeamId || 'none'}
          onValueChange={(value) => onTeamChange(value === 'none' ? null : value)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full" data-cy={sel('devtools.apiExplorer.team.trigger')}>
            <SelectValue placeholder="Select team..." />
          </SelectTrigger>
          <SelectContent>
            {userTeams.map((team) => (
              <SelectItem key={team.id} value={team.id} data-cy={sel('devtools.apiExplorer.team.option', { slug: team.slug })}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{team.name}</span>
                  <span className="text-xs text-muted-foreground">({team.slug})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!selectedTeamId && (
          <p className="text-xs text-destructive" data-cy={sel('devtools.apiExplorer.team.error')}>
            Team required for non-bypass requests
          </p>
        )}
      </div>
    )
  }

  // === BYPASS MODE: Searchable Combobox with ALL teams ===
  return (
    <div className="space-y-1.5" data-cy={sel('devtools.apiExplorer.team.container')}>
      <label className="text-xs font-medium text-muted-foreground">
        Filter by Team (optional)
        {totalCount > 0 && (
          <span className="ml-2 text-muted-foreground/70">
            {totalCount} teams available
          </span>
        )}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={disabled}
            data-cy={sel('devtools.apiExplorer.team.bypassTrigger')}
          >
            {selectedTeamId === null ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>Cross-team (all teams)</span>
              </div>
            ) : selectedTeam ? (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{selectedTeam.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select team to filter...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search teams by name or owner..."
              value={searchValue}
              onValueChange={setSearchValue}
              data-cy={sel('devtools.apiExplorer.team.search')}
            />
            {isLoadingAllTeams ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Searching teams...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-2 text-sm">
                    <Search className="h-4 w-4 mx-auto mb-2 opacity-50" />
                    <p>No teams found</p>
                    {debouncedSearch && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {/* Cross-team option */}
                  <CommandItem
                    value="cross-team"
                    onSelect={() => handleSelect(null)}
                    data-cy={sel('devtools.apiExplorer.team.crossTeam')}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedTeamId === null ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Cross-team (all teams)</span>
                      <span className="text-xs text-muted-foreground">
                        Access data from all teams without filtering
                      </span>
                    </div>
                  </CommandItem>

                  {allTeams.length > 0 && <CommandSeparator className="my-1" />}

                  {/* Team options */}
                  {allTeams.map((team) => (
                    <CommandItem
                      key={team.id}
                      value={team.id}
                      onSelect={() => handleSelect(team.id)}
                      data-cy={sel('devtools.apiExplorer.team.bypassOption', { id: team.id })}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedTeamId === team.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{team.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {team.owner.name} · {team.memberCount} members
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
