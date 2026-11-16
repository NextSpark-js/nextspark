# @nextsparkjs/plugin-walkme

Guided tours and onboarding for NextSpark applications: declarative tour definitions, four step types (tooltip, modal, spotlight, beacon), cross-page navigation, conditional triggers, persistence in `localStorage`, keyboard navigation and i18n.

> **Stability: experimental.** The first-party plugins are not part of the stable 1.0 surface and may change in a minor release without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## Installation

1. Add the package, enable it and tell Next.js to compile it:

   ```bash
   pnpm add @nextsparkjs/plugin-walkme
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-walkme'] })
   ```

   The package ships TypeScript source, so add it to `transpilePackages` in your Next config, next to `@nextsparkjs/core`; `nextspark prepare` stops with `NS_PLUGIN_TRANSPILE_MISSING` until you do:

   ```js
   transpilePackages: ['@nextsparkjs/core', '@nextsparkjs/plugin-walkme'],
   ```

   `pnpm exec nextspark add:plugin @nextsparkjs/plugin-walkme` is an experimental helper that adds a plugin to a project.

2. Generate the registries: `pnpm build:registries` (`pnpm dev` and `pnpm build` do it too).

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.192`, with Next.js `~16.4.5` and React `^19.2.0`
- Dependencies the plugin installs itself: `@floating-ui/react` and `@phosphor-icons/react`
- Peer dependency: `zod` `^4.6.6`
- Node.js 22.x (22.14.0 or later) or 24.x (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- The App Router: cross-page steps navigate with `router.push()` from `next/navigation`

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
| `labels` | `Partial<WalkmeLabels>` | English | Translated UI labels |
| `userId` | `string` | - | Scopes the `localStorage` state per user |
| `serverSyncUrl` | `string` | - | URL for server-side state (cross-device sync); it must answer `GET` (fetch) and `POST` (save). Without it only `localStorage` is used |

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

The package ships three complete tours in [`examples/`](./examples): [a single-page tour](./examples/basic-tour.ts), [a cross-page tour](./examples/cross-window-tour.ts) (steps with `route`) and [a conditional tour](./examples/conditional-tour.ts) (role and feature flag conditions).

A tour with `conditions` needs the user's context from the provider:

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

The plugin ships English and Spanish messages in `messages/`, under the `walkme` namespace, and `WalkmeProvider` takes a `labels` prop to override or translate them. The keys:

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

### CSS Variables (Theming)

All walkme components use CSS custom properties for styling. Override them in your global CSS or scoped styles:

```css
:root {
  --walkme-bg: #ffffff;
  --walkme-text: #111827;
  --walkme-text-muted: #6b7280;
  --walkme-primary: #3b82f6;
  --walkme-border: #e5e7eb;
  --walkme-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --walkme-beacon-color: #3b82f6;
  --walkme-overlay-bg: rgba(0, 0, 0, 0.5);
}

/* Dark mode */
.dark {
  --walkme-bg: #1f2937;
  --walkme-text: #f9fafb;
  --walkme-text-muted: #9ca3af;
  --walkme-primary: #60a5fa;
  --walkme-border: #374151;
  --walkme-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --walkme-beacon-color: #60a5fa;
  --walkme-overlay-bg: rgba(0, 0, 0, 0.7);
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

No environment variable is needed: the configuration is the `WalkmeProvider` props (`debug`, `autoStart`, `autoStartDelay`, `persistState`). The package also has a loader for the `WALKME_*` variables listed in `.env.example` (`lib/plugin-env.ts`), but the components do not read it.

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
3. The state is stored under the key `walkme-state` in localStorage (`walkme-state-<userId>` when the provider has a `userId`).

## Documentation

- [`examples/`](./examples) in this package, and the types in [`types/walkme.types.ts`](./types/walkme.types.ts)
- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation

## License

MIT
