# @nextsparkjs/plugin-amplitude

Amplitude analytics for the web app of a NextSpark project: a provider that initializes Amplitude, hooks to track events, identify users and run experiments and session replay, a consent manager and monitoring components. It works on the client; it has no API routes and no database tables.

> **Stability: experimental.** The first-party plugins are not part of the stable 1.0 surface and may change in a minor release without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

> **No event reaches Amplitude yet.** `AmplitudeCore` (`lib/amplitude-core.ts`) simulates the Amplitude client: `init` logs and waits, and the batch send only logs and waits. The hooks, consent handling, queue and components work around that simulated client. Do not use the plugin to collect real analytics until the client is connected.

## Installation

1. Add the package, enable it and tell Next.js to compile it:

   ```bash
   pnpm add @nextsparkjs/plugin-amplitude
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-amplitude'] })
   ```

   The package ships TypeScript source, so add `'@nextsparkjs/plugin-amplitude'` to `transpilePackages` in your Next config, next to `@nextsparkjs/core`; `nextspark prepare` stops and tells you if it is missing. `pnpm exec nextspark add:plugin @nextsparkjs/plugin-amplitude` is an experimental helper that adds a plugin to a project.

2. Wrap your app with the provider and pass its configuration in `overrideConfig`:

   ```tsx
   import { AmplitudeProvider } from '@nextsparkjs/plugin-amplitude/providers/AmplitudeProvider'

   const config = {
     apiKey: 'your-32-character-amplitude-api-key', // from your Amplitude project; 32 letters and digits
     serverZone: 'US', // or 'EU'
   }

   export default function Layout({ children }: { children: React.ReactNode }) {
     return <AmplitudeProvider overrideConfig={config}>{children}</AmplitudeProvider>
   }
   ```

   `overrideConfig` is the only source of configuration today: the provider does not read the Zod schema in `plugin.config.ts`, and without `overrideConfig` it does not initialize.

3. Track events from a component:

   ```tsx
   import { useAmplitude } from '@nextsparkjs/plugin-amplitude/hooks/useAmplitude'

   const { track, identify, isInitialized } = useAmplitude()
   await track('Button Clicked', { buttonId: 'cta-signup' })
   await identify(userId, { plan: 'premium' })
   ```

## Configuration

The options of `overrideConfig`, with the defaults of the schema in `plugin.config.ts`. These take effect:

| Option | Default | Purpose |
| --- | --- | --- |
| `apiKey` | required | Amplitude API key: 32 letters and digits |
| `enableSessionReplay` | `false` | Turns on `useSessionReplay` |
| `enableABTesting` | `false` | Turns on `useExperiment` |
| `piiMaskingEnabled` | `true` | Mask personal data patterns in event properties |
| `errorRetryAttempts`, `errorRetryDelayMs` | `3`, `1000` | Retries of a failed initialization and the delay in ms. The provider uses `|| 3` and `|| 1000`, so `0` also gives 3 retries and 1000 ms |

The schema also declares `sampleRate`, `serverZone`, `enableConsentManagement`, `batchSize`, `flushInterval`, `debugMode` and `rateLimitEventsPerMinute`, but nothing reads them yet: the queue and the rate limiter use their own defaults, and session replay samples at a fixed 0.1 (`privacyControls.recordingSampleRate`).

## Cookie consent

With `consent: { enabled: true }` in `config/app.config.ts`, the plugin reads the same consent as the core banner (`useConsent()` from `@nextsparkjs/core/lib/consent`): it does not initialize before `analytics` is granted, initializes when it is, and opts out when it is revoked, dropping events and emptying its queue, with no second initialization if it is granted again. With consent off in the config, initialization does not wait for the banner. The plugin also has its own consent categories (`analytics`, `sessionReplay`, `experiments`, `performance`), all off until granted, stored in `localStorage` under `amplitude_consent`, and a `ConsentManager` component to grant them; `track` and `identify` need `analytics` there. When the core consent is enabled, its `analytics` replaces the plugin's own.

## Hooks

| Hook | Returns |
| --- | --- |
| `useAmplitude()` | `track`, `identify`, `setUserProperties`, `reset`, `isInitialized`, `context` (`config`, `consent`, `error`) and `lastError`. `track` and `identify` skip the call without `analytics` consent |
| `useExperiment()` | `getVariant`, `trackExposure`, `trackConversion`, `isInExperiment`, `registerExperiment`, `canRunExperiments`, and the `experiments`, `exposures` and `conversions` state |
| `useSessionReplay()` | `startRecording`, `stopRecording`, `pauseRecording`, `resumeRecording`, `isRecording`, `canRecord`, `recordingState`, `privacyControls` and `updatePrivacyControls` |
| `useAmplitudeEvents()` | Automatic page view and click tracking. It uses `next/router`, so page views are tracked on the Pages Router only |
| `useConsent()` (from `components/ConsentManager`) | `consent`, `updateConsent`, `hasConsent`, `getConsentStatus` and the state of the consent modal |
| `useAmplitudeContext()` | The provider's context: `amplitude`, `isInitialized`, `config`, `consent`, `updateConsent` and `error` |

## Components

| Component | Purpose |
| --- | --- |
| `ConsentManager` | Consent panel with a badge; props `onConsentChange`, `initialConsent`, `showBadge`, `position`, `theme`, `compactMode` |
| `ExperimentWrapper`, `ABTest`, `MultivariateTest`, `FeatureFlag` | Render by experiment variant or feature flag, in `components/ExperimentWrapper`; `ExperimentWrapper` can track the exposure on mount or when visible |
| `AnalyticsDashboard` | Metrics dashboard; props `refreshInterval`, `showAdvancedMetrics`, `timeRange` (`'1h'`, `'24h'`, `'7d'`, `'30d'`), `compactMode`, `onAlert` |
| `PerformanceMonitor` | Performance metrics and alerts; props `refreshInterval`, `showAlerts`, `showCharts`, `compactMode`, `alertThresholds`, `onAlert` |

The modules under `lib/` (`security`, `performance`, `queue`, `cache`) and the types in `types/amplitude.types.ts` can be imported by path.

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.199`, with Next.js `~16.4.2` and React `^19.2.0`
- Peer dependency: `zod` `^4.6.6`
- Node.js 22.x (22.14.0 or later) or 24.x (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- An Amplitude project and its API key

## Documentation

- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation
- The types in [`types/amplitude.types.ts`](./types/amplitude.types.ts) and the tests in [`__tests__/`](./__tests__)

## License

MIT
