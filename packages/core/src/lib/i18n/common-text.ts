/**
 * Texts for the UI primitives and the shared inputs (Sheet, Dialog, Toaster, the form widgets): they render with no
 * `NextIntlClientProvider` above them too (a test, a story, another package), where `useTranslations` throws, and in
 * route groups whose client messages may not carry their namespace. Every other component reads its texts with
 * `useTranslations`, with no English written next to the call (#413).
 */
import { useLocale, useMessages } from 'next-intl'
import { useMemo } from 'react'

/** The messages in scope, or undefined with no provider. */
function useOptionalMessages(): unknown {
  try {
    // Without a provider the hook throws right after its one `useContext`, in every render alike, so hook order holds.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMessages()
  } catch {
    return undefined
  }
}

/** `messages.common[section][key]` when it is a string, else undefined. */
export function readCommonText(messages: unknown, section: string, key: string): string | undefined {
  const value = (messages as Record<string, Record<string, Record<string, unknown>> | undefined> | null | undefined)?.common?.[section]?.[key]
  return typeof value === 'string' ? value : undefined
}

/** `messages.<a>.<b>...` for a dotted path (`superadmin.pagination.noResults`) when it is a string, else undefined. */
export function readMessageText(messages: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), messages)
  return typeof value === 'string' ? value : undefined
}

/** `{name}` placeholders replaced literally, as the `a11y` texts with a name are (no ICU, so it also runs with no provider). */
export function fillText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole))
}

/** Like `useCommonText` for any namespace: the text at a dotted `path` in the messages in scope, else `fallback`. */
export function useMessageText(path: string, fallback: string): string {
  return readMessageText(useOptionalMessages(), path) ?? fallback
}

/**
 * The texts of a section of the messages in scope (`useSectionText('entities.fileUpload', { dragHere: 'Drag files here or' })`):
 * each key of `defaults` takes the text at `<path>.<key>`, else the default (English, as the component always had).
 * A component outside a `NextIntlClientProvider` gets its defaults instead of an error.
 */
export function useSectionText<T extends Record<string, string>>(path: string, defaults: T): T {
  const messages = useOptionalMessages()
  const entries = Object.entries(defaults).map(([key, fallback]) => [key, readMessageText(messages, `${path}.${key}`) ?? fallback] as const)
  // The object keeps its identity while its texts do not change, so a memo or an effect can depend on it even when the
  // messages object is a new one on every render (a mock, a provider that rebuilds it). The defaults are literals in the
  // component, so the number of texts is the same on every render of one call site.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => Object.fromEntries(entries) as T, entries.map(([, text]) => text))
}

/** The active locale, or undefined (the browser's) when there is no provider. */
export function useActiveLocale(): string | undefined {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useLocale()
  } catch {
    return undefined
  }
}

/** `override`, else the text in the messages in scope, else `fallback` (English, as the component always had). */
export function useCommonText(section: string, key: string, fallback: string, override?: string): string {
  return override ?? readCommonText(useOptionalMessages(), section, key) ?? fallback
}
