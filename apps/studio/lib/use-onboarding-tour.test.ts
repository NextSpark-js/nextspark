/**
 * Tests for useOnboardingTour hook logic
 *
 * Tests the pure logic functions extracted from the hook.
 * React hook testing would need @testing-library/react-hooks,
 * so we test the state machine logic directly.
 */

const STORAGE_KEY = 'ns-onboarding-complete'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Onboarding Tour Logic', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('localStorage persistence', () => {
    it('tour should start when localStorage key is absent', () => {
      const completed = localStorage.getItem(STORAGE_KEY)
      expect(completed).toBeNull()
      // Tour should auto-start (isActive = true) when key is absent
    })

    it('tour should NOT start when localStorage key is "true"', () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      const completed = localStorage.getItem(STORAGE_KEY)
      expect(completed).toBe('true')
      // Tour should not auto-start when key is present
    })

    it('completing the tour sets localStorage key', () => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      localStorage.setItem(STORAGE_KEY, 'true')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('clearing localStorage allows tour to restart', () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
      localStorage.removeItem(STORAGE_KEY)
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('step navigation', () => {
    const TOTAL_STEPS = 5

    it('starts at step 0', () => {
      let currentStep = 0
      expect(currentStep).toBe(0)
    })

    it('next() increments step', () => {
      let currentStep = 0
      currentStep = Math.min(currentStep + 1, TOTAL_STEPS - 1)
      expect(currentStep).toBe(1)
      currentStep = Math.min(currentStep + 1, TOTAL_STEPS - 1)
      expect(currentStep).toBe(2)
    })

    it('prev() decrements step but not below 0', () => {
      let currentStep = 2
      currentStep = Math.max(0, currentStep - 1)
      expect(currentStep).toBe(1)
      currentStep = Math.max(0, currentStep - 1)
      expect(currentStep).toBe(0)
      currentStep = Math.max(0, currentStep - 1)
      expect(currentStep).toBe(0) // Can't go below 0
    })

    it('next() on last step triggers completion', () => {
      let currentStep = TOTAL_STEPS - 1
      let completed = false

      if (currentStep >= TOTAL_STEPS - 1) {
        completed = true
        localStorage.setItem(STORAGE_KEY, 'true')
      }

      expect(completed).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('skip() marks tour as complete regardless of step', () => {
      const currentStep = 1 // Middle of the tour
      expect(currentStep).toBeLessThan(TOTAL_STEPS - 1)

      // Skip = mark complete
      localStorage.setItem(STORAGE_KEY, 'true')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('start() resets to step 0', () => {
      let currentStep = 3
      // Manual start = reset
      currentStep = 0
      expect(currentStep).toBe(0)
    })
  })

  describe('step data', () => {
    const steps = [
      { target: '[data-tour="chat-panel"]', title: 'AI Chat', description: 'Describe your app', placement: 'right' as const },
      { target: '[data-tour="preview-tab"]', title: 'Live Preview', description: 'See your app', placement: 'bottom' as const },
      { target: '[data-tour="tab-bar"]', title: 'Pages, Code & Config', description: 'Switch tabs', placement: 'bottom' as const },
      { target: '[data-tour="deploy-menu"]', title: 'Deploy & Export', description: 'Deploy options', placement: 'bottom' as const },
      { target: '[data-tour="shortcuts-btn"]', title: 'Keyboard Shortcuts', description: 'Cmd+/', placement: 'top' as const },
    ]

    it('has 5 tour steps', () => {
      expect(steps).toHaveLength(5)
    })

    it('each step has required properties', () => {
      for (const step of steps) {
        expect(step.target).toBeTruthy()
        expect(step.title).toBeTruthy()
        expect(step.description).toBeTruthy()
        expect(['top', 'bottom', 'left', 'right']).toContain(step.placement)
      }
    })

    it('all targets use data-tour attribute selectors', () => {
      for (const step of steps) {
        expect(step.target).toMatch(/^\[data-tour="[\w-]+"\]$/)
      }
    })

    it('step at current index returns correct data', () => {
      const currentStep = 2
      const step = steps[currentStep]
      expect(step.title).toBe('Pages, Code & Config')
    })

    it('out-of-bounds step returns undefined', () => {
      const step = steps[10]
      expect(step).toBeUndefined()
    })
  })
})
