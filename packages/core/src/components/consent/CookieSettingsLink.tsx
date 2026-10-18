'use client'

import { CONSENT_OPEN_EVENT } from '../../lib/consent/cookie'

/** The footer link that reopens the consent settings. Rendered only when consent is enabled. */
export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT))}
      data-cy="consent-open"
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </button>
  )
}
