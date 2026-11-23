'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ChevronsUpDown, Loader2, UserRound, X } from 'lucide-react'
import { Button } from '../../ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { useDebounce } from '../../../hooks/useDebounce'
import { withBasePath } from '../../../lib/base-path'
import { toActAsUser, type ActAsUser, type SuperadminUserRow } from './explorer-helpers'

interface ActAsUserPickerProps {
  /** The user id sent as `x-act-as-user`; empty = the caller's own session. */
  userId: string
  /** What to show for `userId` (the email); falls back to the id when only an id was typed. */
  label: string
  onChange: (userId: string, label: string) => void
  /** Act-as is off on the server: the trigger cannot be opened. */
  disabled?: boolean
}

async function searchUsers(search: string): Promise<ActAsUser[]> {
  const params = new URLSearchParams({ tab: 'users', limit: '8' })
  if (search) params.set('search', search)
  const response = await fetch(withBasePath(`/api/superadmin/users?${params.toString()}`))
  if (!response.ok) throw new Error(String(response.status))
  const data = (await response.json()) as { regularUsers?: SuperadminUserRow[]; superadmins?: SuperadminUserRow[] }
  return [...(data.regularUsers ?? []), ...(data.superadmins ?? [])].slice(0, 10).map(toActAsUser)
}

/**
 * Picks the user a request is made as. The list comes from the superadmin users endpoint, which keeps its own
 * role check, so a caller without access just gets an empty list and can still paste an id.
 */
export function ActAsUserPicker({ userId, label, onChange, disabled = false }: ActAsUserPickerProps) {
  const t = useTranslations('devtools.apiTester.auth')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search.trim(), 300)
  const { data: users = [], isFetching, isError } = useQuery({
    queryKey: ['devtools-act-as-users', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: open && !disabled,
    staleTime: 30_000,
  })

  const choose = (id: string, name: string) => {
    onChange(id, name)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-1.5">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="flex-1 min-w-0 justify-between font-normal"
            data-cy="devtools-api-auth-act-as-user"
          >
            {userId ? (
              <span className="flex items-center gap-2 min-w-0">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-sm">{label || userId}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{t('actAsUserPlaceholder')}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {userId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange('', '')}
            aria-label={t('actAsUserClear')}
            title={t('actAsUserClear')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={t('actAsUserSearch')} value={search} onValueChange={setSearch} />
          {isFetching && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('actAsUserSearching')}
            </div>
          )}
          {!isFetching && (
            <>
              <CommandEmpty>
                <p className="py-2 text-sm">{isError ? t('actAsUserUnavailable') : t('actAsUserNone')}</p>
              </CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {users.map((user) => (
                  <CommandItem key={user.id} value={user.id} onSelect={() => choose(user.id, user.label)}>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{user.name || user.label}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user.name ? `${user.label} · ` : ''}
                        {user.role}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                {/* An id pasted as is keeps working, as it did with the old text box. */}
                {debounced && (
                  <CommandItem value={`id:${debounced}`} onSelect={() => choose(debounced, debounced)}>
                    <span className="text-sm">{t('actAsUserUseId', { id: debounced })}</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
