'use client'

/**
 * The publication date of a post in the active locale.
 * A client component only because the locale comes from next-intl's client context; it still renders on the server.
 */

import { useLocale } from 'next-intl'

export function PostDate({ value }: { value: Date | string | null }) {
  const locale = useLocale()
  if (!value) return <time>Not published</time>
  const date = new Date(value)
  return (
    <time dateTime={date.toISOString()}>
      {date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
    </time>
  )
}
