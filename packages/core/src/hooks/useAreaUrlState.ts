'use client'

/**
 * useAreaUrlState
 *
 * Keeps a screen's search, filters, tab, page and sort in the URL query so a reload, a shared link and a "Back"
 * from a detail land on the same view. Used only by the devtools and superadmin screens (the dashboard has its own
 * `useUrlFilters`).
 *
 * - The state is local (the screen answers at once) and mirrored to the query with `router.replace` after a short
 *   debounce, so typing or paging never adds history entries and a burst of changes is one navigation.
 * - A value that is missing or not valid for its key falls back to the default; defaults are not written, so the
 *   URL of an untouched screen stays clean. Params the screen does not own are kept.
 * - When the query changes from outside (a sidebar link to the same screen, browser back/forward) the state follows.
 * - The last query of each screen is remembered for the session, so a detail's "Back" can return to it
 *   (`useListBackHref`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** One owned param: its default, and the values it accepts (a list or a predicate); anything else is the default. */
export interface UrlStateField {
  default: string
  allowed?: readonly string[] | ((value: string) => boolean)
}
export type UrlStateSpec = Record<string, UrlStateField>
export type UrlState<S extends UrlStateSpec> = { [K in keyof S]: string }

const isAllowed = (field: UrlStateField, value: string) =>
  !field.allowed || (typeof field.allowed === 'function' ? field.allowed(value) : field.allowed.includes(value))

export function readUrlState<S extends UrlStateSpec>(spec: S, params: URLSearchParams | { get(name: string): string | null }): UrlState<S> {
  const state = {} as UrlState<S>
  for (const key of Object.keys(spec) as (keyof S & string)[]) {
    const raw = params.get(key)
    state[key] = raw !== null && isAllowed(spec[key], raw) ? raw : spec[key].default
  }
  return state
}

/** The query for `state`: `base` (the params the screen does not own) plus every owned value that is not its default. */
export function buildUrlQuery<S extends UrlStateSpec>(spec: S, state: UrlState<S>, base: URLSearchParams = new URLSearchParams()): string {
  const params = new URLSearchParams(base)
  for (const key of Object.keys(spec)) params.delete(key)
  for (const key of Object.keys(spec) as (keyof S & string)[]) {
    if (state[key] !== spec[key].default) params.set(key, state[key])
  }
  return params.toString()
}

const STORAGE_PREFIX = 'nextspark:list-query:'

function rememberQuery(pathname: string, query: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + pathname, query)
  } catch {
    // storage blocked: Back falls back to the bare list
  }
}

export function useAreaUrlState<S extends UrlStateSpec>(spec: S, options: { debounceMs?: number } = {}) {
  const { debounceMs = 250 } = options
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [state, setLocal] = useState<UrlState<S>>(() => readUrlState(spec, searchParams))
  const stateRef = useRef(state)
  // the owned part of the query the state corresponds to: what we last wrote, or last read from outside
  const syncedQuery = useRef(buildUrlQuery(spec, state))
  const paramsRef = useRef(searchParams)
  paramsRef.current = searchParams
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // the owned queries we sent that have not landed yet
  const inFlight = useRef(new Set<string>())

  // the query changed from outside (link to this same screen, back/forward): the state follows it
  const ownedQuery = buildUrlQuery(spec, readUrlState(spec, searchParams))
  useEffect(() => {
    if (ownedQuery === syncedQuery.current) { inFlight.current.clear(); return }
    // one of our own earlier writes landing late: not a navigation
    if (inFlight.current.has(ownedQuery)) return
    // a navigation (sidebar link, back/forward): it wins over a pending write
    clearTimeout(timer.current)
    timer.current = undefined
    inFlight.current.clear()
    syncedQuery.current = ownedQuery
    rememberQuery(pathname, ownedQuery)
    const next = readUrlState(spec, paramsRef.current)
    stateRef.current = next
    setLocal(next)
  }, [ownedQuery, spec, pathname])

  useEffect(() => {
    rememberQuery(pathname, syncedQuery.current)
    return () => clearTimeout(timer.current)
  }, [pathname])

  /** Merge `patch` into the state (e.g. `{ search: 'x', page: '1' }`): one render, one URL write. */
  const update = useCallback(
    (patch: Partial<UrlState<S>>) => {
      const next = { ...stateRef.current }
      for (const key of Object.keys(patch) as (keyof S & string)[]) {
        const value = patch[key]
        next[key] = value !== undefined && isAllowed(spec[key], value) ? value : spec[key].default
      }
      stateRef.current = next
      setLocal(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = undefined
        const query = buildUrlQuery(spec, next, new URLSearchParams(paramsRef.current.toString()))
        const owned = buildUrlQuery(spec, next)
        syncedQuery.current = owned
        inFlight.current.add(owned)
        rememberQuery(pathname, owned)
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      }, debounceMs)
    },
    [spec, pathname, router, debounceMs]
  )

  return [state, update] as const
}

/**
 * Where a detail's "Back" goes: the list with the query it had (`/superadmin/users?tab=superadmins`), or the bare
 * list on first paint and when nothing was remembered, so the server and the client render the same link.
 */
export function useListBackHref(listPath: string): string {
  const [href, setHref] = useState(listPath)
  useEffect(() => {
    try {
      const query = sessionStorage.getItem(STORAGE_PREFIX + listPath)
      setHref(query ? `${listPath}?${query}` : listPath)
    } catch {
      setHref(listPath)
    }
  }, [listPath])
  return href
}
