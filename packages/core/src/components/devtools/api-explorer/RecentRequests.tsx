'use client'

import { useTranslations } from 'next-intl'
import { History } from 'lucide-react'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { queryToSearch, type RecentRequest } from './explorer-helpers'

interface RecentRequestsProps {
  items: readonly RecentRequest[]
  onOpen: (item: RecentRequest) => void
  onClear: () => void
}

/** The last requests sent from this browser: pick one to reopen its endpoint with the same params and body. */
export function RecentRequests({ items, onOpen, onClear }: RecentRequestsProps) {
  const t = useTranslations('devtools.apiTester.recent')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-cy="devtools-api-recent">
          <History className="h-4 w-4 mr-2" />
          {t('title')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">{t('title')}</p>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
              {t('clear')}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="max-h-72 overflow-auto py-1">
            {items.map((item) => {
              const label = `${item.path}${queryToSearch(item.query.map((q) => ({ id: q.key, enabled: true, ...q })))}`
              return (
                <li key={`${item.method}-${label}-${item.at}`}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50"
                    title={label}
                  >
                    <span className="w-14 shrink-0 font-mono font-medium">{item.method}</span>
                    <span className="flex-1 truncate font-mono text-muted-foreground">{label}</span>
                    <span className={item.status !== null && item.status < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                      {item.status ?? t('failed')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
