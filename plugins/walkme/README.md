# @nextsparkjs/plugin-walkme

Guided tours and onboarding system for NextSpark applications. Supports declarative tour definitions, multiple step types (tooltip, modal, spotlight, beacon), cross-page navigation, conditional triggers, localStorage persistence, full keyboard accessibility, and i18n.

## Installation

The plugin is available as an npm package or can be copied directly into your project.

### npm (recommended)

```bash
pnpm add @nextsparkjs/plugin-walkme
```

### Manual

Copy the `plugins/walkme/` directory to `contents/plugins/walkme/` in your NextSpark project.

### Register the plugin

Add `'walkme'` to your theme configuration:

```typescript
// contents/themes/<your-theme>/config/theme.config.ts
export const themeConfig: ThemeConfig = {
  plugins: ['walkme'],
}
```

Rebuild the registry:

```bash
node core/scripts/build/registry.mjs
```

## Quick Start

### 1. Define a tour

```typescript
import type { Tour } from '@nextsparkjs/plugin-walkme/types/walkme.types'

const onboardingTour: Tour = {
  id: 'getting-started',
  name: 'Getting Started',
  trigger: { type: 'onFirstVisit', delay: 1000 },
  steps: [
    {
      id: 'welcome',
      type: 'modal',
      title: 'Welcome!',
      content: 'Let us show you around the application.',
      actions: ['next', 'skip'],
    },
    {
      id: 'sidebar',
      type: 'tooltip',
      target: '[data-cy="sidebar-nav"]',
      title: 'Navigation',
      content: 'Use the sidebar to navigate between sections.',
      position: 'right',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'create',
      type: 'spotlight',
      target: '[data-cy="create-button"]',
      title: 'Create New Item',
      content: 'Click here to create your first item.',
      actions: ['complete', 'prev'],
    },
  ],
}
```

### 2. Wrap your app with the provider

```tsx
import { WalkmeProvider } from '@nextsparkjs/plugin-walkme/components/WalkmeProvider'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WalkmeProvider tours={[onboardingTour]} autoStart>
      {children}
    </WalkmeProvider>
  )
}
```

### 3. (Optional) Control tours programmatically

```tsx
import { useWalkme } from '@nextsparkjs/plugin-walkme/hooks/useWalkme'

function HelpButton() {
  const { startTour, isActive } = useWalkme()

  return (
    <button onClick={() => startTour('getting-started')} disabled={isActive}>
      Start Tour
    </button>
  )
}
```

## Configuration

### Tour

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Human-readable name |
| `description` | `string` | No | Tour description |
| `trigger` | `TourTrigger` | Yes | When and how the tour activates |
| `conditions` | `TourConditions` | No | Conditions that must be met to show the tour |
| `steps` | `TourStep[]` | Yes | Ordered list of steps (minimum 1) |
| `onComplete` | `() => void` | No | Callback on tour completion |
| `onSkip` | `() => void` | No | Callback on tour skip |
| `priority` | `number` | No | Auto-trigger ordering (lower = higher priority) |

### TourStep

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique step identifier |
| `type` | `StepType` | Yes | `'tooltip'` \| `'modal'` \| `'spotlight'` \| `'beacon'` \| `'floating'` |
| `title` | `string` | Yes | Step title |
| `content` | `string` | Yes | Step body text |
| `target` | `string` | Conditional | CSS selector or `data-walkme-target` value. Required for tooltip, spotlight, beacon |
| `route` | `string` | No | Route path for cross-page steps |
| `position` | `StepPosition` | No | `'top'` \| `'bottom'` \| `'left'` \| `'right'` \| `'auto'`. Default: `'auto'` |
| `actions` | `StepAction[]` | Yes | Available actions: `'next'`, `'prev'`, `'skip'`, `'complete'`, `'close'` |
| `delay` | `number` | No | Delay in ms before showing |
| `autoAdvance` | `number` | No | Auto-advance after this many ms |
| `beforeShow` | `() => void` | No | Callback before the step renders |
| `afterShow` | `() => void` | No | Callback after the step renders |

### Step Types

- **`modal`** - Centered overlay modal. No target element required. Use for welcome screens and informational messages.
- **`tooltip`** - Anchored tooltip positioned next to a target element. Requires `target`.
- **`spotlight`** - Overlay with a cutout around the target element plus a tooltip. Requires `target`.
- **`beacon`** - Pulsing indicator on a target element that expands on click. Requires `target`.
- **`floating`** - Same as modal. Alias for centered content without a target.

### TourTrigger

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `TriggerType` | Yes | `'onFirstVisit'` \| `'onRouteEnter'` \| `'onEvent'` \| `'manual'` \| `'scheduled'` |
| `delay` | `number` | No | Delay in ms before activating |
| `route` | `string` | No | Route pattern for `onRouteEnter` (supports `*` and `**` wildcards) |
| `event` | `string` | No | Event name for `onEvent` trigger |
| `afterVisits` | `number` | No | Activate after N visits (for `scheduled`) |
| `afterDays` | `number` | No | Activate after N days since first visit (for `scheduled`) |

**Trigger types:**

- `onFirstVisit` - Fires on the user's first page visit (visitCount === 1).
- `onRouteEnter` - Fires when the user navigates to a matching route. Supports exact matches (`/dashboard`), wildcard (`/admin/*`), and glob (`/docs/**`).
- `onEvent` - Fires when a custom event is emitted via `emitEvent()`.
- `manual` - Never auto-triggers. Start programmatically with `startTour(tourId)`.
- `scheduled` - Fires after a number of visits (`afterVisits`) or days since first visit (`afterDays`).

### TourConditions

All conditions use AND logic. Every specified condition must pass.

| Property | Type | Description |
|---|---|---|
| `userRole` | `string[]` | User must have one of these roles |
| `featureFlags` | `string[]` | All specified flags must be active |
| `completedTours` | `string[]` | All specified tours must be completed first |
| `notCompletedTours` | `string[]` | None of these tours should be completed |
| `custom` | `(ctx: ConditionContext) => boolean` | Custom condition function |

## WalkmeProvider Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tours` | `Tour[]` | Required | Array of tour definitions (validated with Zod at runtime) |
| `children` | `ReactNode` | Required | Application content |
| `debug` | `boolean` | `false` | Enable debug logging to console |
| `autoStart` | `boolean` | `true` | Auto-start eligible tours based on triggers |
| `autoStartDelay` | `number` | `1000` | Default delay before auto-starting tours (ms) |
| `persistState` | `boolean` | `true` | Persist tour state in localStorage |
| `onTourStart` | `(event: TourEvent) => void` | - | Callback when a tour starts |
| `onTourComplete` | `(event: TourEvent) => void` | - | Callback when a tour completes |
| `onTourSkip` | `(event: TourEvent) => void` | - | Callback when a tour is skipped |
| `onStepChange` | `(event: TourEvent) => void` | - | Callback when the active step changes |
| `conditionContext` | `Partial<ConditionContext>` | - | External context for condition evaluation (userRole, featureFlags) |

## Hooks

### `useWalkme()`

Main hook for controlling tours. Must be used within a `<WalkmeProvider>`.

```tsx
const {
  // Tour control
  startTour,      // (tourId: string) => void
  pauseTour,      // () => void
  resumeTour,     // () => void
  skipTour,       // () => void
  completeTour,   // () => void
  resetTour,      // (tourId: string) => void
  resetAllTours,  // () => void

  // Step navigation
  nextStep,       // () => void
  prevStep,       // () => void
  goToStep,       // (stepIndex: number) => void

  // State
  isActive,       // boolean - whether any tour is active
  activeTourId,   // string | null
  currentStepIndex, // number

  // Queries
  getActiveTour,  // () => Tour | null
  getActiveStep,  // () => TourStep | null
  isTourCompleted, // (tourId: string) => boolean
  isTourActive,   // (tourId: string) => boolean

  // Events
  emitEvent,      // (eventName: string) => void
} = useWalkme()
```

### `useTour(tourId)`

Hook for tracking the state of a specific tour.

```tsx
const {
  tour,           // Tour | null - full tour definition
  isActive,       // boolean
  isCompleted,    // boolean
  isSkipped,      // boolean
  currentStep,    // number (-1 if not active)
  totalSteps,     // number
  progress,       // number (0-100)
  start,          // () => void - start this tour
  reset,          // () => void - reset this tour
} = useTour('getting-started')
```

### `useTourProgress()`

Hook for tracking global completion progress across all tours.

```tsx
const {
  completedTours,   // number
  totalTours,       // number
  percentage,       // number (0-100)
  completedTourIds, // string[]
  skippedTourIds,   // string[]
  remainingTours,   // number
} = useTourProgress()
```

## Examples

### Single-Page Tour

A basic onboarding flow on one page:

```typescript
const basicTour: Tour = {
  id: 'getting-started',
  name: 'Getting Started',
  trigger: { type: 'onFirstVisit', delay: 1000 },
  steps: [
    {
      id: 'welcome',
      type: 'modal',
      title: 'Welcome!',
      content: 'Let us show you around.',
      actions: ['next', 'skip'],
    },
    {
      id: 'sidebar',
      type: 'tooltip',
      target: '[data-cy="sidebar-nav"]',
      title: 'Navigation',
      content: 'Use the sidebar to navigate.',
      position: 'right',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'create',
      type: 'spotlight',
      target: '[data-cy="create-button"]',
      title: 'Create Item',
      content: 'Click here to create your first item.',
      actions: ['complete', 'prev'],
    },
  ],
}
```

### Cross-Page Tour

Navigate users between pages during a tour:

```typescript
const crossPageTour: Tour = {
  id: 'explore-app',
  name: 'Explore the App',
  trigger: { type: 'manual' },
  conditions: { completedTours: ['getting-started'] },
  steps: [
    {
      id: 'dashboard',
      type: 'tooltip',
      target: '[data-cy="dashboard-stats"]',
      title: 'Your Stats',
      content: 'Key metrics at a glance.',
      position: 'bottom',
      route: '/dashboard',
      actions: ['next', 'skip'],
    },
    {
      id: 'profile',
      type: 'spotlight',
      target: '[data-cy="profile-form"]',
      title: 'Your Profile',
      content: 'Complete your profile.',
      route: '/settings/profile',
      actions: ['complete', 'prev'],
    },
  ],
}
```

When the tour reaches a step with a `route` that differs from the current page, the provider automatically navigates using `router.push()` and waits for the target element to appear.

### Conditional Tour

Show tours only to specific user roles or when feature flags are active:

```typescript
const adminTour: Tour = {
  id: 'admin-features',
  name: 'Admin Features',
  priority: 10,
  trigger: { type: 'onRouteEnter', route: '/admin/*', delay: 500 },
  conditions: {
    userRole: ['admin', 'superadmin'],
    completedTours: ['getting-started'],
    featureFlags: ['admin-panel-v2'],
  },
  steps: [
    {
      id: 'admin-welcome',
      type: 'modal',
      title: 'Admin Dashboard',
      content: 'Here are the key admin features.',
      actions: ['next', 'skip'],
    },
    // ...more steps
  ],
}
```

Pass the user context to the provider:

```tsx
<WalkmeProvider
  tours={[adminTour]}
  conditionContext={{
    userRole: currentUser.role,
    featureFlags: activeFlags,
  }}
>
  <App />
</WalkmeProvider>
```

### Programmatic Tour Control

Start tours on demand and track completion:

```tsx
function OnboardingDashboard() {
  const { startTour } = useWalkme()
  const { completedTours, totalTours, percentage } = useTourProgress()
  const intro = useTour('getting-started')

  return (
    <div>
      <h2>Onboarding Progress: {percentage}%</h2>
      <p>{completedTours} of {totalTours} tours completed</p>

      {!intro.isCompleted && (
        <button onClick={intro.start}>Start Getting Started Tour</button>
      )}

      <button onClick={() => startTour('advanced-features')}>
        Show Advanced Features
      </button>
    </div>
  )
}
```

### Analytics Integration

Track tour events for analytics:

```tsx
<WalkmeProvider
  tours={tours}
  onTourStart={(event) => {
    analytics.track('tour_started', {
      tourId: event.tourId,
      tourName: event.tourName,
    })
  }}
  onTourComplete={(event) => {
    analytics.track('tour_completed', {
      tourId: event.tourId,
      totalSteps: event.totalSteps,
    })
  }}
  onTourSkip={(event) => {
    analytics.track('tour_skipped', {
      tourId: event.tourId,
      stepIndex: event.stepIndex,
    })
  }}
  onStepChange={(event) => {
    analytics.track('step_changed', {
      tourId: event.tourId,
      stepId: event.stepId,
      stepIndex: event.stepIndex,
    })
  }}
>
```

## Customization

### Element Targeting

Steps can target elements using:

1. **CSS selectors** - `#my-id`, `.my-class`, `[data-cy="value"]`
2. **data-walkme-target** - Add `data-walkme-target="name"` to any element, then reference as `target: "name"` (plain string without special CSS chars)
3. **data-cy** - Standard test selectors: `target: '[data-cy="create-button"]'`

If the target element is not found within 5 seconds, the step renders without an anchor and a warning is logged in debug mode.

### Internationalization

The plugin ships with English and Spanish translations under `plugins/walkme/messages/`. To add more languages, create a JSON file following the same structure:

```json
{
  "walkme": {
    "next": "Next",
    "prev": "Previous",
    "skip": "Skip tour",
    "complete": "Complete",
    "close": "Close",
    "progress": "Step {current} of {total}",
    "tourAvailable": "Tour available",
    "beaconLabel": "Click to start guided tour",
    "modalTitle": "Guided Tour",
    "tooltipLabel": "Tour step",
    "spotlightLabel": "Highlighted element",
    "keyboardHint": "Press Arrow Right for next step, Escape to skip",
    "tourCompleted": "Tour completed!",
    "tourSkipped": "Tour skipped",
    "errorTargetNotFound": "Element not found, skipping step",
    "resumeTour": "Resume tour",
    "restartTour": "Restart tour"
  }
}
```

### Keyboard Navigation

When a tour is active:

| Key | Action |
|---|---|
| Arrow Right | Next step |
| Arrow Left | Previous step |
| Escape | Skip tour |
| Tab | Cycle focus within modals (focus trap) |

### Accessibility

- All interactive elements have ARIA labels and roles
- Focus is trapped within modals
- Focus is restored to the previously focused element when a tour ends
- Progress bar uses `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
- Keyboard navigation is fully supported

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WALKME_ENABLED` | `true` | Enable/disable the plugin |
| `WALKME_DEBUG` | `false` | Debug mode |
| `WALKME_AUTO_START` | `true` | Auto-start tours on first visit |
| `WALKME_AUTO_START_DELAY` | `1000` | Delay before auto-starting (ms) |
| `WALKME_PERSIST_STATE` | `true` | Persist state in localStorage |
| `WALKME_ANALYTICS_ENABLED` | `false` | Enable analytics event emission |

## Troubleshooting

### Tour does not start automatically

1. Check that `autoStart` is `true` on the provider (default).
2. Verify the trigger type matches the situation (e.g., `onFirstVisit` only fires when `visitCount === 1`).
3. Check that all conditions are met (role, feature flags, completed tours).
4. Open debug mode (`debug={true}`) to see console logs.
5. If using `persistState`, the tour may already be marked as completed or skipped in localStorage. Call `resetTour(tourId)` or clear `walkme-state` from localStorage.

### Target element not found

1. Ensure the target selector is correct and the element exists in the DOM.
2. For dynamically rendered elements, the plugin waits up to 5 seconds using MutationObserver + polling.
3. Use `data-walkme-target="name"` for elements that are hard to select with CSS.
4. Enable debug mode to see warnings about missing targets.

### Cross-page navigation not working

1. Verify the `route` property on each step matches the actual path.
2. The provider uses `router.push()` from `next/navigation`. Ensure you are using the App Router.
3. If navigation fails, the step is automatically skipped and the tour advances.

### State not persisting

1. Check that `persistState` is `true` (default).
2. Verify localStorage is available (not in private browsing mode or incognito with storage disabled).
3. The state is stored under the key `walkme-state` in localStorage.

## File Structure

```
plugins/walkme/
  plugin.config.ts          # Plugin configuration
  package.json              # Dependencies and metadata
  .env.example              # Environment variable template
  types/
    walkme.types.ts         # All TypeScript type definitions
  lib/
    core.ts                 # Pure-function state machine (reducer + helpers)
    validation.ts           # Zod schemas for tour config validation
    storage.ts              # localStorage persistence adapter
    targeting.ts            # DOM element targeting (CSS, data-walkme, data-cy)
    positioning.ts          # @floating-ui/react wrapper for smart positioning
    triggers.ts             # Tour trigger evaluation
    conditions.ts           # Tour condition evaluation (AND logic)
    plugin-env.ts           # Environment variable loader
  hooks/
    useWalkme.ts            # Main public hook (tour control + navigation)
    useTour.ts              # Per-tour state hook
    useTourProgress.ts      # Global completion progress hook
    useTourState.ts         # Internal: state machine + localStorage sync
  providers/
    walkme-context.ts       # React Context definition
  components/
    WalkmeProvider.tsx      # Main provider (state, triggers, rendering)
    WalkmeOverlay.tsx       # Semi-transparent backdrop overlay
    WalkmeTooltip.tsx       # Positioned tooltip step
    WalkmeModal.tsx         # Centered modal step with focus trap
    WalkmeSpotlight.tsx     # Overlay with cutout + tooltip
    WalkmeBeacon.tsx        # Pulsing indicator
    WalkmeProgress.tsx      # Progress bar
    WalkmeControls.tsx      # Navigation buttons (Next/Prev/Skip/Complete)
  messages/
    en.json                 # English translations
    es.json                 # Spanish translations
  examples/
    basic-tour.ts           # Single-page tour example
    cross-window-tour.ts    # Multi-page tour example
    conditional-tour.ts     # Role-based conditional tour example
  tests/
    setup.ts                # Jest test setup
    tsconfig.json           # Test-specific TypeScript config
    lib/                    # Unit tests for all lib modules (165 tests)
  jest.config.cjs           # Jest configuration
```

## Dependencies

- **`@floating-ui/react`** ^0.27.0 - Smart positioning for tooltips and popovers

Peer dependencies (provided by the host project): `react`, `react-dom`, `next`, `zod`, `next-intl`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.
