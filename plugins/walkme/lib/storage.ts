/**
 * WalkMe Storage Module
 *
 * localStorage persistence adapter for tour state.
 * Handles save/load, schema versioning, and graceful SSR fallbacks.
 */

import type { TourState, StorageSchema } from '../types/walkme.types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'walkme-state'
const STORAGE_VERSION = 1

/** Build the localStorage key, optionally scoped to a userId */
function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  load(): StorageSchema | null
  save(state: StorageSchema): void
  reset(): void
  resetTour(tourId: string): void
  getCompletedTours(): string[]
  getSkippedTours(): string[]
  getVisitCount(): number
  incrementVisitCount(): void
  getFirstVisitDate(): string | null
  setFirstVisitDate(date: string): void
  getActiveTour(): TourState | null
  setActiveTour(tour: TourState | null): void
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Check if localStorage is available */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const testKey = '__walkme_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/** Create a default empty storage schema */
function createDefaultSchema(): StorageSchema {
  return {
    version: STORAGE_VERSION,
    completedTours: [],
    skippedTours: [],
    activeTour: null,
    tourHistory: {},
    visitCount: 0,
    firstVisitDate: new Date().toISOString(),
  }
}

/** Migrate storage data from older versions */
export function migrateStorage(data: unknown): StorageSchema {
  if (!data || typeof data !== 'object') {
    return createDefaultSchema()
  }

  const record = data as Record<string, unknown>

  // Version 1 (current) - no migration needed, just validate shape
  return {
    version: STORAGE_VERSION,
    completedTours: Array.isArray(record.completedTours)
      ? (record.completedTours as string[])
      : [],
    skippedTours: Array.isArray(record.skippedTours)
      ? (record.skippedTours as string[])
      : [],
    activeTour: record.activeTour as TourState | null ?? null,
    tourHistory:
      (record.tourHistory as Record<string, TourState>) ?? {},
    visitCount:
      typeof record.visitCount === 'number' ? record.visitCount : 0,
    firstVisitDate:
      typeof record.firstVisitDate === 'string'
        ? record.firstVisitDate
        : new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a storage adapter backed by localStorage, optionally scoped to a user */
export function createStorageAdapter(userId?: string): StorageAdapter {
  const available = isStorageAvailable()
  const storageKey = getStorageKey(userId)

  function read(): StorageSchema {
    if (!available) return createDefaultSchema()

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return createDefaultSchema()

      const parsed = JSON.parse(raw)
      return migrateStorage(parsed)
    } catch {
      return createDefaultSchema()
    }
  }

  function write(schema: StorageSchema): void {
    if (!available) return

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(schema))
    } catch {
      // Storage full or unavailable - silently ignore
    }
  }

  return {
    load(): StorageSchema | null {
      if (!available) return null
      return read()
    },

    save(state: StorageSchema): void {
      write(state)
    },

    reset(): void {
      if (!available) return
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Ignore
      }
    },

    resetTour(tourId: string): void {
      const state = read()
      state.completedTours = state.completedTours.filter((id) => id !== tourId)
      state.skippedTours = state.skippedTours.filter((id) => id !== tourId)
      const { [tourId]: _, ...remainingHistory } = state.tourHistory
      state.tourHistory = remainingHistory
      if (state.activeTour?.tourId === tourId) {
        state.activeTour = null
      }
      write(state)
    },

    getCompletedTours(): string[] {
      return read().completedTours
    },

    getSkippedTours(): string[] {
      return read().skippedTours
    },

    getVisitCount(): number {
      return read().visitCount
    },

    incrementVisitCount(): void {
      const state = read()
      state.visitCount += 1
      write(state)
    },

    getFirstVisitDate(): string | null {
      const state = read()
      return state.firstVisitDate || null
    },

    setFirstVisitDate(date: string): void {
      const state = read()
      state.firstVisitDate = date
      write(state)
    },

    getActiveTour(): TourState | null {
      return read().activeTour
    },

    setActiveTour(tour: TourState | null): void {
      const state = read()
      state.activeTour = tour
      write(state)
    },
  }
}
