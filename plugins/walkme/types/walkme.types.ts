/**
 * WalkMe Plugin - Type Definitions
 *
 * Complete type system for the guided tour and onboarding plugin.
 * All types are exported from this single file as the source of truth.
 */

// ---------------------------------------------------------------------------
// Enums / Literal Unions
// ---------------------------------------------------------------------------

/** Tour lifecycle states */
export type TourStatus = 'idle' | 'active' | 'paused' | 'completed' | 'skipped'

/** Visual step types */
export type StepType = 'tooltip' | 'modal' | 'spotlight' | 'beacon' | 'floating'

/** Tooltip positioning relative to target */
export type StepPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto'

/** How a tour is activated */
export type TriggerType = 'onFirstVisit' | 'onRouteEnter' | 'onEvent' | 'manual' | 'scheduled'

/** User actions available within a step */
export type StepAction = 'next' | 'prev' | 'skip' | 'complete' | 'close'

// ---------------------------------------------------------------------------
// Tour Configuration
// ---------------------------------------------------------------------------

/** Defines a complete guided tour */
export interface Tour {
  /** Unique identifier for the tour */
  id: string
  /** Human-readable name */
  name: string
  /** Optional description */
  description?: string
  /** How and when the tour should be triggered */
  trigger: TourTrigger
  /** Optional conditions that must be met to show the tour */
  conditions?: TourConditions
  /** Ordered list of steps in the tour */
  steps: TourStep[]
  /** Callback when the tour is completed */
  onComplete?: () => void
  /** Callback when the tour is skipped */
  onSkip?: () => void
  /** Priority for auto-trigger ordering (lower = higher priority) */
  priority?: number
}

/** Defines a single step within a tour */
export interface TourStep {
  /** Unique identifier for the step */
  id: string
  /** Visual type of the step */
  type: StepType
  /** Step title */
  title: string
  /** Step content / description */
  content: string
  /** CSS selector or data-walkme-target value to anchor to */
  target?: string
  /** Route path for cross-page tours (triggers navigation if different from current) */
  route?: string
  /** Positioning for tooltip/spotlight types */
  position?: StepPosition
  /** Available user actions for this step */
  actions: StepAction[]
  /** Delay in ms before showing this step */
  delay?: number
  /** Auto-advance to next step after this many ms */
  autoAdvance?: number
  /** Callback before the step is shown */
  beforeShow?: () => Promise<void> | void
  /** Callback after the step is shown */
  afterShow?: () => Promise<void> | void
}

/** Defines when a tour should be activated */
export interface TourTrigger {
  /** Trigger mechanism */
  type: TriggerType
  /** Delay in ms before activating after trigger condition is met */
  delay?: number
  /** Route pattern for onRouteEnter trigger */
  route?: string
  /** Event name for onEvent trigger */
  event?: string
  /** Activate after this many visits (for scheduled trigger) */
  afterVisits?: number
  /** Activate after this many days since first visit (for scheduled trigger) */
  afterDays?: number
}

/** Conditions that must be met before a tour can start */
export interface TourConditions {
  /** User must have one of these roles */
  userRole?: string[]
  /** All of these feature flags must be active */
  featureFlags?: string[]
  /** All of these tours must be completed first */
  completedTours?: string[]
  /** None of these tours should be completed */
  notCompletedTours?: string[]
  /** Custom condition function */
  custom?: (context: ConditionContext) => boolean
}

/** Context passed to condition evaluators */
export interface ConditionContext {
  /** Current user role */
  userRole?: string
  /** Active feature flags */
  featureFlags?: string[]
  /** IDs of completed tours */
  completedTourIds: string[]
  /** Total number of page visits */
  visitCount: number
  /** ISO date string of first visit */
  firstVisitDate?: string
}

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/** Runtime state for a single tour */
export interface TourState {
  /** Tour identifier */
  tourId: string
  /** Current status */
  status: TourStatus
  /** Index of the current step */
  currentStepIndex: number
  /** ISO timestamp when the tour was started */
  startedAt: string
  /** ISO timestamp when completed */
  completedAt?: string
  /** ISO timestamp when skipped */
  skippedAt?: string
}

/** Global state for the WalkMe system */
export interface WalkmeState {
  /** Map of registered tours by ID */
  tours: Record<string, Tour>
  /** Currently active tour state (null if no tour is active) */
  activeTour: TourState | null
  /** IDs of completed tours */
  completedTours: string[]
  /** IDs of skipped tours */
  skippedTours: string[]
  /** Historical state of all tours */
  tourHistory: Record<string, TourState>
  /** Whether the system has been initialized */
  initialized: boolean
  /** Debug mode flag */
  debug: boolean
}

/** Discriminated union of all reducer actions */
export type WalkmeAction =
  | { type: 'INITIALIZE'; tours: Tour[] }
  | { type: 'START_TOUR'; tourId: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SKIP_TOUR' }
  | { type: 'COMPLETE_TOUR' }
  | { type: 'PAUSE_TOUR' }
  | { type: 'RESUME_TOUR' }
  | { type: 'RESET_TOUR'; tourId: string }
  | { type: 'RESET_ALL' }
  | { type: 'NAVIGATE_TO_STEP'; stepIndex: number }
  | { type: 'SET_DEBUG'; enabled: boolean }
  | { type: 'RESTORE_STATE'; completedTours: string[]; skippedTours: string[]; tourHistory: Record<string, TourState>; activeTour: TourState | null }

// ---------------------------------------------------------------------------
// Labels / i18n
// ---------------------------------------------------------------------------

/** Translatable UI strings for walkme components */
export interface WalkmeLabels {
  /** "Next" button text */
  next: string
  /** "Previous" button text */
  prev: string
  /** "Skip tour" button text */
  skip: string
  /** "Complete" button text */
  complete: string
  /** "Close" button aria-label */
  close: string
  /** Progress text template, receives {current} and {total} */
  progress: string
  /** Beacon fallback aria-label */
  tourAvailable: string
}

// ---------------------------------------------------------------------------
// Context / Provider
// ---------------------------------------------------------------------------

/** Value exposed by WalkmeContext to consumers */
export interface WalkmeContextValue {
  /** Current global state */
  state: WalkmeState
  /** Start a specific tour by ID */
  startTour: (tourId: string) => void
  /** Pause the active tour */
  pauseTour: () => void
  /** Resume a paused tour */
  resumeTour: () => void
  /** Skip the active tour */
  skipTour: () => void
  /** Complete the active tour */
  completeTour: () => void
  /** Reset a specific tour (remove from completed/skipped) */
  resetTour: (tourId: string) => void
  /** Reset all tours to initial state */
  resetAllTours: () => void
  /** Advance to the next step */
  nextStep: () => void
  /** Go back to the previous step */
  prevStep: () => void
  /** Jump to a specific step index */
  goToStep: (stepIndex: number) => void
  /** Check if a tour has been completed */
  isTourCompleted: (tourId: string) => boolean
  /** Check if a tour is currently active */
  isTourActive: (tourId: string) => boolean
  /** Get the full Tour object for the active tour */
  getActiveTour: () => Tour | null
  /** Get the current TourStep for the active tour */
  getActiveStep: () => TourStep | null
  /** Emit a custom event (for onEvent triggers) */
  emitEvent: (eventName: string) => void
}

/** Props for the WalkmeProvider component */
export interface WalkmeProviderProps {
  /** Array of tour definitions */
  tours: Tour[]
  /** React children */
  children: React.ReactNode
  /** Enable debug logging */
  debug?: boolean
  /** Auto-start eligible tours */
  autoStart?: boolean
  /** Delay before auto-starting tours (ms) */
  autoStartDelay?: number
  /** Persist tour state in localStorage */
  persistState?: boolean
  /** Callback when a tour starts */
  onTourStart?: (event: TourEvent) => void
  /** Callback when a tour is completed */
  onTourComplete?: (event: TourEvent) => void
  /** Callback when a tour is skipped */
  onTourSkip?: (event: TourEvent) => void
  /** Callback when a step changes */
  onStepChange?: (event: TourEvent) => void
  /** Context for evaluating tour conditions */
  conditionContext?: Omit<ConditionContext, 'completedTourIds' | 'visitCount' | 'firstVisitDate'>
  /** Translated UI labels (defaults to English if not provided) */
  labels?: Partial<WalkmeLabels>
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Schema for localStorage persistence */
export interface StorageSchema {
  /** Schema version for migrations */
  version: number
  /** IDs of completed tours */
  completedTours: string[]
  /** IDs of skipped tours */
  skippedTours: string[]
  /** Currently active tour state */
  activeTour: TourState | null
  /** Historical state of all tours */
  tourHistory: Record<string, TourState>
  /** Total page visit count */
  visitCount: number
  /** ISO date string of first visit */
  firstVisitDate: string
}

// ---------------------------------------------------------------------------
// Events / Analytics
// ---------------------------------------------------------------------------

/** Event emitted for analytics tracking */
export interface TourEvent {
  /** Event type */
  type: 'tour_started' | 'tour_completed' | 'tour_skipped' | 'step_changed' | 'step_completed'
  /** Tour identifier */
  tourId: string
  /** Tour human-readable name */
  tourName: string
  /** Current step identifier */
  stepId?: string
  /** Current step index */
  stepIndex?: number
  /** Total steps in the tour */
  totalSteps?: number
  /** Unix timestamp */
  timestamp: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}
