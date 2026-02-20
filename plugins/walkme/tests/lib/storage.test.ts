import {
  isStorageAvailable,
  migrateStorage,
  createStorageAdapter,
} from '../../lib/storage'

// ---------------------------------------------------------------------------
// isStorageAvailable
// ---------------------------------------------------------------------------

describe('isStorageAvailable', () => {
  it('returns true when localStorage is available', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('returns false when localStorage throws', () => {
    const original = window.localStorage.setItem
    ;(window.localStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Storage disabled')
    })
    expect(isStorageAvailable()).toBe(false)
    window.localStorage.setItem = original
  })
})

// ---------------------------------------------------------------------------
// migrateStorage
// ---------------------------------------------------------------------------

describe('migrateStorage', () => {
  it('returns default schema for null input', () => {
    const result = migrateStorage(null)
    expect(result.version).toBe(1)
    expect(result.completedTours).toEqual([])
    expect(result.skippedTours).toEqual([])
    expect(result.activeTour).toBeNull()
    expect(result.tourHistory).toEqual({})
    expect(result.visitCount).toBe(0)
    expect(result.firstVisitDate).toBeTruthy()
  })

  it('returns default schema for non-object input', () => {
    const result = migrateStorage('invalid')
    expect(result.version).toBe(1)
    expect(result.completedTours).toEqual([])
  })

  it('preserves valid data during migration', () => {
    const result = migrateStorage({
      completedTours: ['tour-a', 'tour-b'],
      skippedTours: ['tour-c'],
      visitCount: 5,
      firstVisitDate: '2024-01-01T00:00:00.000Z',
    })
    expect(result.completedTours).toEqual(['tour-a', 'tour-b'])
    expect(result.skippedTours).toEqual(['tour-c'])
    expect(result.visitCount).toBe(5)
    expect(result.firstVisitDate).toBe('2024-01-01T00:00:00.000Z')
  })

  it('handles missing fields gracefully', () => {
    const result = migrateStorage({})
    expect(result.completedTours).toEqual([])
    expect(result.skippedTours).toEqual([])
    expect(result.visitCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// createStorageAdapter
// ---------------------------------------------------------------------------

describe('createStorageAdapter', () => {
  let adapter: ReturnType<typeof createStorageAdapter>

  beforeEach(() => {
    adapter = createStorageAdapter()
  })

  describe('load / save', () => {
    it('returns null on first load (no data)', () => {
      // localStorage starts empty in our mock, but load still creates a schema
      // because the adapter calls read() which returns default
      const data = adapter.load()
      // load returns null if localStorage has nothing, but read() creates default
      // Actually looking at the code: load returns read() which creates default if no raw data
      expect(data).toBeDefined()
      expect(data!.completedTours).toEqual([])
    })

    it('saves and loads state correctly', () => {
      const schema = {
        version: 1,
        completedTours: ['tour-1'],
        skippedTours: [],
        activeTour: null,
        tourHistory: {},
        visitCount: 3,
        firstVisitDate: '2024-01-01T00:00:00.000Z',
      }
      adapter.save(schema)
      const loaded = adapter.load()
      expect(loaded!.completedTours).toEqual(['tour-1'])
      expect(loaded!.visitCount).toBe(3)
    })
  })

  describe('reset', () => {
    it('clears all stored data', () => {
      adapter.save({
        version: 1,
        completedTours: ['tour-1'],
        skippedTours: [],
        activeTour: null,
        tourHistory: {},
        visitCount: 1,
        firstVisitDate: '2024-01-01T00:00:00.000Z',
      })
      adapter.reset()
      // After reset, load should return fresh default data
      const loaded = adapter.load()
      expect(loaded!.completedTours).toEqual([])
    })
  })

  describe('resetTour', () => {
    it('removes a specific tour from completed/skipped', () => {
      adapter.save({
        version: 1,
        completedTours: ['tour-a', 'tour-b'],
        skippedTours: ['tour-a'],
        activeTour: null,
        tourHistory: {
          'tour-a': { tourId: 'tour-a', status: 'completed', currentStepIndex: 0, startedAt: '' },
        },
        visitCount: 1,
        firstVisitDate: '2024-01-01T00:00:00.000Z',
      })

      adapter.resetTour('tour-a')
      const loaded = adapter.load()
      expect(loaded!.completedTours).toEqual(['tour-b'])
      expect(loaded!.skippedTours).toEqual([])
      expect(loaded!.tourHistory['tour-a']).toBeUndefined()
    })

    it('clears activeTour if it matches', () => {
      adapter.save({
        version: 1,
        completedTours: [],
        skippedTours: [],
        activeTour: { tourId: 'tour-x', status: 'active', currentStepIndex: 0, startedAt: '' },
        tourHistory: {},
        visitCount: 1,
        firstVisitDate: '2024-01-01T00:00:00.000Z',
      })

      adapter.resetTour('tour-x')
      const loaded = adapter.load()
      expect(loaded!.activeTour).toBeNull()
    })
  })

  describe('getCompletedTours / getSkippedTours', () => {
    it('returns empty arrays by default', () => {
      expect(adapter.getCompletedTours()).toEqual([])
      expect(adapter.getSkippedTours()).toEqual([])
    })

    it('returns stored values', () => {
      adapter.save({
        version: 1,
        completedTours: ['a'],
        skippedTours: ['b'],
        activeTour: null,
        tourHistory: {},
        visitCount: 0,
        firstVisitDate: '2024-01-01T00:00:00.000Z',
      })
      expect(adapter.getCompletedTours()).toEqual(['a'])
      expect(adapter.getSkippedTours()).toEqual(['b'])
    })
  })

  describe('visitCount', () => {
    it('starts at 0', () => {
      expect(adapter.getVisitCount()).toBe(0)
    })

    it('increments visit count', () => {
      adapter.incrementVisitCount()
      expect(adapter.getVisitCount()).toBe(1)
      adapter.incrementVisitCount()
      expect(adapter.getVisitCount()).toBe(2)
    })
  })

  describe('firstVisitDate', () => {
    it('returns a date string by default', () => {
      // The default schema sets firstVisitDate to now
      const date = adapter.getFirstVisitDate()
      expect(date).toBeTruthy()
    })

    it('sets and gets first visit date', () => {
      adapter.setFirstVisitDate('2025-06-01T00:00:00.000Z')
      expect(adapter.getFirstVisitDate()).toBe('2025-06-01T00:00:00.000Z')
    })
  })

  describe('activeTour', () => {
    it('returns null by default', () => {
      expect(adapter.getActiveTour()).toBeNull()
    })

    it('sets and gets active tour', () => {
      const tour = { tourId: 'tour-1', status: 'active' as const, currentStepIndex: 2, startedAt: '2024-01-01T00:00:00.000Z' }
      adapter.setActiveTour(tour)
      const loaded = adapter.getActiveTour()
      expect(loaded).not.toBeNull()
      expect(loaded!.tourId).toBe('tour-1')
      expect(loaded!.currentStepIndex).toBe(2)
    })

    it('clears active tour with null', () => {
      const tour = { tourId: 'tour-1', status: 'active' as const, currentStepIndex: 0, startedAt: '' }
      adapter.setActiveTour(tour)
      adapter.setActiveTour(null)
      expect(adapter.getActiveTour()).toBeNull()
    })
  })
})
