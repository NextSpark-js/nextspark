'use client'

import type { ReactNode } from 'react'
import { NextIntlClientProvider, useLocale, useTimeZone } from 'next-intl'
import { withBasePath } from '@nextsparkjs/core/lib/base-path'
import de from '../messages/de.json'
import en from '../messages/en.json'
import es from '../messages/es.json'
import fr from '../messages/fr.json'
import it from '../messages/it.json'
import pt from '../messages/pt.json'

// ponytail: all six catalogs ship with the page (a few KB); core does not load a plugin's messages/, so the plugin provides its own
const CATALOGS: Record<string, typeof en> = { de, en, es, fr, it, pt }

/** Gives the plugin's components its own catalog, in the app's language. */
export function MarketplaceMessages({ children }: { children: ReactNode }) {
  const locale = useLocale()
  const timeZone = useTimeZone()
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={CATALOGS[locale] ?? en}>
      {children}
    </NextIntlClientProvider>
  )
}

const API = '/api/plugins/marketplace-payments'

/** A JSON call to the plugin's API. It throws on an error status so the query or mutation shows it. */
export async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(`${API}${path}`), init)
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) throw new Error(`Request failed (${response.status})`)
  return body.data as T
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency })
  return format.format(cents / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2))
}

export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}
