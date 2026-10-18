# Cookie Consent

Core ships a cookie consent banner, a small consent API and loaders for Plausible and Google Analytics. It is **off by default**.

- Three categories: `necessary` (always on, cannot be turned off), `analytics` and `marketing`.
- **Opt-in everywhere**: until the visitor chooses, `analytics` and `marketing` are off. There is no geolocation.
- The banner offers **Accept all**, **Reject all** (the same button, at the same level) and **Settings** (one switch per category).
- The choice lives in a first-party cookie and can be reopened from the public footer or from code.

## Turn it on

```typescript
// config/app.config.ts
export const APP_CONFIG_OVERRIDES = {
  consent: {
    enabled: true,
    // everything below is optional
    cookieName: 'nextspark_consent', // default
    maxAgeDays: 180,                 // default; kept between 180 and 365 (6 to 12 months)
    version: 1,                      // bump it to ask everyone again
    categories: ['analytics', 'marketing'], // the optional categories the banner offers
    loaders: {
      plausible: { domain: 'example.com', scriptUrl: 'https://stats.example.com/js/script.js' }, // scriptUrl: self-hosted only
      googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    },
  },
}
```

| Option | Default | |
| --- | --- | --- |
| `enabled` | `false`; `NEXT_PUBLIC_CONSENT_ENABLED=true` is only its default, so a value in `app.config.ts` wins | Without it there is no banner and no loader, and `useConsent()` reports everything as granted. |
| `cookieName` | `nextspark_consent` | |
| `maxAgeDays` | `180` | Held between 180 and 365. |
| `version` | `1` | A change of `version`, or of the offered `categories`, makes the stored choice invalid and asks again. |
| `categories` | `['analytics', 'marketing']` | Drop `marketing` if the project has nothing to put behind it. |
| `loaders.plausible.domain` / `.scriptUrl` | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` / `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` | Without a domain there is no Plausible loader. `scriptUrl` defaults to `https://plausible.io/js/script.js`. |
| `loaders.googleAnalytics.measurementId` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Without it there is no Google Analytics loader. |

The values are read when the app is built.

The `NEXT_PUBLIC_*` loader variables are the loaders' source: `next.config.mjs` reads the same variables to put the vendors' origins in the CSP. A loader value set in `app.config.ts` overrides the variable, and then its origins must be added to the CSP by hand. The variables add their CSP origins **even with consent off**, so leave them unset if you do not use the loaders.

The banner is shown on public, authentication and dashboard pages alike: analytics may run anywhere, so the choice is asked wherever the visitor lands. It is a bar fixed at the bottom of the window. It takes no space in the page, does not cover it with an overlay and does not trap focus.

The root layout renders **one small client component** (the banner and the loaders) only when `consent.enabled` is on. The `consent` messages (all six locales) are sent to the browser only then, and the footer link is rendered only then.

## The cookie

First party, `Path=/`, `SameSite=Lax`, `Secure` when the page is served over HTTPS in production, `Max-Age` of `maxAgeDays`. The value is URI-encoded JSON:

```
nextspark_consent={"v":"1:analytics+marketing","g":["analytics"],"t":1760000000000}
```

`v` is the version (the configured `version` and the offered categories), `g` the optional categories granted and `t` when the choice was made. A cookie that is missing, malformed, of another version or older than `maxAgeDays` counts as "no choice": nothing optional is granted and the banner asks again.

## The API

### In the browser

```typescript
import { useConsent, getConsentState, openConsentSettings } from '@nextsparkjs/core/lib/consent'

const { categories, hasChosen, accept, reject, update, enabled } = useConsent()
// categories: { necessary: true, analytics: boolean, marketing: boolean }
accept()                          // every offered category on
reject()                          // every optional category off
update({ marketing: true })       // change some, keep the rest

openConsentSettings()             // reopen the banner on its settings (a link of your own)
getConsentState()                 // the same state, outside React
```

`accept`, `reject` and `update` store the cookie and fire a `nextspark:consent` event on `window`; the hook re-renders every consumer.

```typescript
window.addEventListener('nextspark:consent', (event) => {
  const { categories, hasChosen } = (event as CustomEvent).detail
  if (categories.marketing) initMyPixel()
})
```

On the server, before the first render, the state is "nothing optional granted"; the event fires on every change, so read `getConsentState()` once and then listen.

With `consent.enabled` off, `useConsent()` returns every category as granted, `hasChosen: true` and `enabled: false`, and the actions do nothing. A plugin can gate on `categories.analytics` without checking whether consent is on.

### On the server

```typescript
import { getConsent } from '@nextsparkjs/core/lib/consent/server'

export default async function Page() {
  const { categories } = await getConsent()  // reads the cookie from the request headers
  return <>{categories.marketing && <MarketingPixel />}</>
}
```

`getConsent()` reads the current request's headers, which makes the page render per request. It also takes a `Headers` object, a `Request` or `NextRequest`, or a `Cookie` header string: `getConsent(request)`.

### The footer link

The public footer shows a "Cookie settings" link when consent is enabled, and so does the dashboard's user menu, so a choice made in the dashboard can be withdrawn there. A project footer or menu can call `openConsentSettings()` from its own button. A click before the banner's chunk has loaded is kept: the banner opens on its settings as soon as it is there.

## Loaders

`PlausibleLoader` and `GoogleAnalyticsLoader` render nothing and load no script until `analytics` is granted. Once it is, each adds its script to the page with the request CSP nonce (see below). Both are configured as above; nothing needs to be rendered by the project.

- **Plausible** loads `script.js` with `data-domain`.
- **Google Analytics** loads `gtag.js` with consent mode set (`analytics_storage` follows `analytics`; `ad_storage`, `ad_user_data` and `ad_personalization` follow `marketing`).

### What revoking can and cannot undo

Revoking `analytics` stops further tracking at once:

- **Plausible**: core sets Plausible's own ignore flag (`localStorage.plausible_ignore`), which the script checks before every event.
- **Google Analytics**: core sets consent mode to `denied` with a consent `update`, which is Google's documented runtime switch, and deletes the `_ga` and `_ga_*` cookies of the site (host-only and for every parent domain of the host, where gtag.js sets them). It also sets `window['ga-disable-<id>']`: Google documents that flag as set before any `gtag()` call on each page, so it is fully effective from the next page load, where nothing is loaded anyway. Until that reload the loaded tag may still send consent-mode cookieless pings.
- **Amplitude**: the plugin opts out (below).

It cannot undo what was already sent, and it cannot unload a script that already ran: it stays in memory until the next page load, where it is not loaded again. Granting `analytics` again lifts the flags without a second initialisation. Cookies that a vendor set on its own domain are not reachable from the page.

## CSP

**Core's own policy** (`next.config.mjs`) names a vendor only when its loader is configured. It reads the same `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` variables as the defaults of `consent.loaders`, and adds:

| Loader | `script-src` | `connect-src` | `img-src` |
| --- | --- | --- | --- |
| Plausible | `https://plausible.io` (or the origin of `scriptUrl`) | the same | |
| Google Analytics | `https://www.googletagmanager.com` | `https://www.google-analytics.com`, `https://*.google-analytics.com`, `https://*.analytics.google.com`, `https://*.googletagmanager.com` | `https://www.google-analytics.com`, `https://*.google-analytics.com`, `https://*.googletagmanager.com` |

If you set a loader in `app.config.ts` only, add those origins to the directives yourself: `next.config.mjs` cannot read a TypeScript config.

**A strict nonce policy** (`script-src 'nonce-…' 'strict-dynamic'`, see [Middleware](../10-backend/06-middleware.md)) works with the loaders when the root layout can read the nonce: set `security: { cspNonce: true }` in `app.config.ts`, and turn `cacheComponents` off, because a prerendered layout cannot carry a per-request nonce. The layout then gives the nonce to the banner component, and the loaders put it on the scripts they add. If your policy also sets `connect-src` or `img-src`, add the origins in the table above to it: `strict-dynamic` covers scripts, not connections.

With Cache Components (the default) the banner and the loaders work, with no nonce: use core's policy above, or a hash-based one. The root layout is prerendered there, so the banner's text is in the default locale.

The banner itself needs nothing from the policy: it adds no inline script and no inline style.

## What a project must do for its own scripts

Core gates only what it loads. Anything else you add (a chat widget, an ads pixel, a session recorder) is yours to hold back:

1. Decide which category it belongs to: `analytics` or `marketing`. Anything the app cannot work without is `necessary`.
2. Do not load it before consent. In a client component: `const { categories } = useConsent()` and load it in an effect once `categories.marketing` is true. In a server component: `const { categories } = await getConsent()` and render the tag only then.
3. Handle revoking: listen to `nextspark:consent` (or `useConsent()`) and use the vendor's opt-out call. A script that was loaded cannot be unloaded.
4. Put the nonce on the script if you use a nonce policy: `headers().get('x-nonce')` in a server component.
5. Bump `consent.version` when you add a category's worth of new processing, so everybody is asked again.

## Amplitude

The Amplitude plugin reads the same signal. With consent enabled it does not initialise before `analytics` is granted, initialises on the grant, and opts out (drops every event and discards the queue) when `analytics` is revoked. Granting it again opts back in without a second initialisation. With consent disabled it behaves as before. The plugin needs a core version that has `@nextsparkjs/core/lib/consent`.

## Translations

The banner strings are in the `consent` namespace, and the footer link is `footer.cookieSettings`, in `en`, `es`, `fr`, `de`, `it` and `pt`. Override them like any other core message.
