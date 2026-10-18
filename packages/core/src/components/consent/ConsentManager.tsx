'use client'

/**
 * The cookie consent banner and the analytics loaders (#272). The root layout renders it only when `consent.enabled`.
 *
 * A fixed bar at the bottom: it takes no space in the page (no layout shift) and does not block it, so it is not a
 * modal and does not trap focus. Reject all and Accept all are the same button. "Settings" opens the per-category
 * switches. `openConsentSettings()` (or the footer link) reopens it later: focus moves to the bar, Escape closes it
 * and focus goes back to where it was.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { CONSENT_CONFIG } from '../../lib/config/public-config-client'
import { CONSENT_OPEN_EVENT, useConsent, type ConsentOptionalCategory } from '../../lib/consent'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { GoogleAnalyticsLoader, PlausibleLoader } from './loaders'

const never = () => () => {}

export function ConsentManager({ nonce, openOnMount = false }: { nonce?: string; openOnMount?: boolean }) {
  const { categories, hasChosen, accept, reject, update } = useConsent()
  const t = useTranslations('consent')
  const id = useId()
  const mounted = useSyncExternalStore(never, () => true, () => false)
  const [reopened, setReopened] = useState(false)
  const [settings, setSettings] = useState(false)
  const [draft, setDraft] = useState<Record<ConsentOptionalCategory, boolean>>({ analytics: false, marketing: false })
  const region = useRef<HTMLElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const current = useRef(categories)
  current.current = categories

  useEffect(() => {
    const reopen = () => {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setDraft({ analytics: current.current.analytics, marketing: current.current.marketing })
      setSettings(true)
      setReopened(true)
    }
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    if (openOnMount) reopen()
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  // openOnMount is read once: a click that came in before this chunk was loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (reopened) region.current?.focus()
  }, [reopened])

  const close = () => {
    setReopened(false)
    setSettings(false)
    returnTo.current?.focus()
    returnTo.current = null
  }
  const choose = (apply: () => void) => () => {
    apply()
    close()
  }
  const { loaders, categories: offered } = CONSENT_CONFIG

  return (
    <>
      {mounted && (!hasChosen || reopened) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <section
            ref={region}
            tabIndex={-1}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
            onKeyDown={(e) => reopened && e.key === 'Escape' && close()}
            data-cy="consent-banner"
            className="pointer-events-auto mx-auto max-h-[85vh] max-w-3xl overflow-y-auto rounded-lg border bg-background p-4 text-foreground shadow-lg outline-none sm:p-6"
          >
            <h2 id={`${id}-title`} className="text-base font-semibold">{t('title')}</h2>
            <p id={`${id}-description`} className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

            {settings && (
              <div id={`${id}-settings`} className="mt-4 space-y-4" data-cy="consent-settings">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor={`${id}-necessary`}>{t('necessary.title')}</Label>
                    <p className="text-sm text-muted-foreground">{t('necessary.description')}</p>
                  </div>
                  <Switch id={`${id}-necessary`} checked disabled aria-label={`${t('necessary.title')}: ${t('alwaysOn')}`} />
                </div>
                {offered.map((category) => (
                  <div key={category} className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor={`${id}-${category}`}>{t(`${category}.title`)}</Label>
                      <p className="text-sm text-muted-foreground">{t(`${category}.description`)}</p>
                    </div>
                    <Switch
                      id={`${id}-${category}`}
                      checked={draft[category]}
                      onCheckedChange={(on) => setDraft((d) => ({ ...d, [category]: on }))}
                      data-cy={`consent-switch-${category}`}
                    />
                  </div>
                ))}
                <Button onClick={choose(() => update(draft))} data-cy="consent-save">{t('save')}</Button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={choose(reject)} data-cy="consent-reject">{t('rejectAll')}</Button>
              <Button onClick={choose(accept)} data-cy="consent-accept">{t('acceptAll')}</Button>
              <Button
                variant="outline"
                aria-expanded={settings}
                aria-controls={`${id}-settings`}
                onClick={() => {
                  setDraft({ analytics: categories.analytics, marketing: categories.marketing })
                  setSettings((open) => !open)
                }}
                data-cy="consent-settings-toggle"
              >
                {t('settings')}
              </Button>
              {reopened && <Button variant="ghost" onClick={close} data-cy="consent-close">{t('close')}</Button>}
            </div>
          </section>
        </div>
      )}
      {loaders.plausible?.domain && <PlausibleLoader {...loaders.plausible} nonce={nonce} />}
      {loaders.googleAnalytics?.measurementId && <GoogleAnalyticsLoader {...loaders.googleAnalytics} nonce={nonce} />}
    </>
  )
}
