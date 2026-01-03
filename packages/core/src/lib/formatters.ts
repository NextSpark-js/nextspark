import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

const locales = {
  es,
  en: enUS
}

export function formatDate(date: Date | string, locale: 'en' | 'es' = 'es', formatStr: string = 'PPP') {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: locales[locale] })
}

export function formatDateTime(date: Date | string, locale: 'en' | 'es' = 'es') {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'PPP p', { locale: locales[locale] })
}

export function formatRelativeTime(date: Date | string, locale: 'en' | 'es' = 'es') {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'PPp', { locale: locales[locale] })
}

export function formatNumber(number: number, locale: 'en' | 'es' = 'es', options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', options).format(number)
}

export function formatCurrency(amount: number, locale: 'en' | 'es' = 'es', currency: string = 'USD') {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency
  }).format(amount)
}

export function formatPercentage(value: number, locale: 'en' | 'es' = 'es') {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value / 100)
}
