'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'
import type { Tour, WalkmeState, WalkmeAction } from '../types/walkme.types'
import { createInitialState, walkmeReducer } from '../lib/core'
import { createStorageAdapter } from '../lib/storage'

interface UseTourStateOptions {
  persistState: boolean
  debug: boolean
  userId?: string
}

/**
 * Internal hook that manages the core WalkMe state machine.
 * Handles useReducer, localStorage persistence, and initial state loading.
 */
export function useTourState(tours: Tour[], options: UseTourStateOptions) {
  const { persistState, debug, userId } = options
  const [state, dispatch] = useReducer(walkmeReducer, createInitialState())
  const storageRef = useRef(createStorageAdapter(userId))
  const initialized = useRef(false)
  const prevUserIdRef = useRef(userId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-create storage adapter when userId changes (e.g. session loads async)
  useEffect(() => {
    if (prevUserIdRef.current === userId) return
    prevUserIdRef.current = userId
    storageRef.current = createStorageAdapter(userId)

    // Re-restore persisted state from the new user-scoped storage
    if (persistState) {
      const saved = storageRef.current.load()
      if (saved) {
        dispatch({
          type: 'RESTORE_STATE',
          completedTours: saved.completedTours,
          skippedTours: saved.skippedTours,
          tourHistory: saved.tourHistory,
          activeTour: saved.activeTour,
        })
      } else {
        // New user with no state — reset to clean slate
        dispatch({ type: 'RESET_ALL' })
      }
    }
  }, [userId, persistState])

  // Initialize tours and restore persisted state on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Initialize with tour definitions
    dispatch({ type: 'INITIALIZE', tours })

    if (debug) {
      dispatch({ type: 'SET_DEBUG', enabled: true })
    }

    // Restore persisted state
    if (persistState) {
      const storage = storageRef.current
      const saved = storage.load()

      if (saved) {
        storage.incrementVisitCount()

        dispatch({
          type: 'RESTORE_STATE',
          completedTours: saved.completedTours,
          skippedTours: saved.skippedTours,
          tourHistory: saved.tourHistory,
          activeTour: saved.activeTour,
        })
      } else {
        // First visit - initialize storage
        storage.incrementVisitCount()
        storage.setFirstVisitDate(new Date().toISOString())
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-register tour definitions when they change after initialization.
  // This handles the case where tours arrive asynchronously (e.g. after API fetch)
  // and the provider was already mounted with an empty tours array.
  useEffect(() => {
    if (!initialized.current) return
    if (tours.length === 0) return
    dispatch({ type: 'UPDATE_TOURS', tours })
  }, [tours]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state changes to localStorage (debounced)
  useEffect(() => {
    if (!persistState || !state.initialized) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const storage = storageRef.current
      const existing = storage.load()

      storage.save({
        version: 1,
        completedTours: state.completedTours,
        skippedTours: state.skippedTours,
        activeTour: state.activeTour,
        tourHistory: state.tourHistory,
        visitCount: existing?.visitCount ?? 1,
        firstVisitDate: existing?.firstVisitDate ?? new Date().toISOString(),
      })
    }, 100)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [
    persistState,
    state.initialized,
    state.completedTours,
    state.skippedTours,
    state.activeTour,
    state.tourHistory,
  ])

  const stableDispatch = useCallback(
    (action: WalkmeAction) => {
      if (debug) {
        console.log('[WalkMe]', action.type, action)
      }
      dispatch(action)
    },
    [debug],
  )

  return {
    state,
    dispatch: stableDispatch,
    storage: storageRef.current,
  }
}
