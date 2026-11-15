/**
 * The page, sort and search of a list endpoint, asked of the server: `CRMDataTable` shows the rows of one page and the
 * API's `info.total` says how many there are in all.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import type { ServerTable, SortState } from '@/templates/shared/CRMDataTable'

interface Options<T> {
    endpoint: string
    pageSize: number
    /** False until the team is known */
    enabled: boolean
    /** Column key to the entity field the API sorts by; a column that is not here is not sortable */
    sortFields: Record<string, string>
    /** The one more field `search` matches besides name, title, slug and content (the API's `searchField`) */
    searchField?: string
    /** Adds what the API does not send (names of related rows) to the rows of the page */
    enrich?: (rows: T[]) => Promise<T[]>
}

export function useServerList<T>({ endpoint, pageSize, enabled, sortFields, searchField, enrich }: Options<T>) {
    const [rows, setRows] = useState<T[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<SortState>({ key: null, direction: null })
    // the answer of an older request must not replace the one of the latest
    const latest = useRef(0)
    const enrichRef = useRef(enrich)
    enrichRef.current = enrich

    useEffect(() => {
        if (!enabled) return
        const request = ++latest.current
        const query = new URLSearchParams({ page: String(page), limit: String(pageSize) })
        const field = sort.key ? sortFields[sort.key] : undefined
        if (field && sort.direction) {
            query.set('sortBy', field)
            query.set('sortOrder', sort.direction)
        }
        if (search.trim()) {
            query.set('search', search.trim())
            if (searchField) query.set('searchField', searchField)
        }
        setBusy(true)
        ;(async () => {
            try {
                const response = await fetchWithTeam(`${endpoint}?${query}`)
                if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`)
                const result = await response.json()
                let data: T[] = result.data || []
                if (enrichRef.current) data = await enrichRef.current(data)
                if (request !== latest.current) return
                setRows(data)
                setTotal(Number(result.info?.total) || data.length)
            } catch (error) {
                console.error(`Error loading ${endpoint}:`, error)
            } finally {
                if (request === latest.current) {
                    setIsLoading(false)
                    setBusy(false)
                }
            }
        })()
        // sortFields, endpoint and searchField are constants of the page
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, page, pageSize, search, sort])

    const server: ServerTable = {
        total,
        page,
        sort,
        busy,
        onPageChange: setPage,
        onSortChange: next => { setSort(next); setPage(1) },
        onSearchChange: next => { setSearch(next); setPage(1) },
    }
    return { rows, total, isLoading, server }
}

/**
 * Exact counts of a list that the API answers: one request per filter with `limit=1`, reading `info.total`. A count is
 * `undefined` until it arrives (or when its request fails). The API has no sums or averages: those stay per page.
 */
export function useExactCounts(endpoint: string, enabled: boolean, filters: Record<string, Record<string, string>>) {
    const [counts, setCounts] = useState<Record<string, number | undefined>>({})
    useEffect(() => {
        if (!enabled) return
        let current = true
        ;(async () => {
            const entries = await Promise.all(Object.entries(filters).map(async ([name, filter]) => {
                try {
                    const response = await fetchWithTeam(`${endpoint}?${new URLSearchParams({ ...filter, page: '1', limit: '1' })}`)
                    if (!response.ok) return [name, undefined] as const
                    const total = Number((await response.json()).info?.total)
                    return [name, Number.isFinite(total) ? total : undefined] as const
                } catch {
                    return [name, undefined] as const
                }
            }))
            if (current) setCounts(Object.fromEntries(entries))
        })()
        return () => { current = false }
        // the filters are constants of the page
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, endpoint])
    return counts
}
