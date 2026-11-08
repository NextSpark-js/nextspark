/**
 * Texts of `common.<section>.<key>` for the UI primitives (Sheet, Dialog, Toaster): they render with no
 * `NextIntlClientProvider` above them too (a test, a story, another package), where `useTranslations` throws, and in
 * route groups whose client messages may not carry `common`.
 */
import { useMessages } from 'next-intl'

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
  let messages: unknown
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    messages = useMessages()
  } catch {
    // no provider
  }
  return readMessageText(messages, path) ?? fallback
}

/** `override`, else the text in the messages in scope, else `fallback` (English, as the component always had). */
export function useCommonText(section: string, key: string, fallback: string, override?: string): string {
  let messages: unknown
  try {
    // Without a provider the hook throws right after its one `useContext`, in every render alike, so hook order holds.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    messages = useMessages()
  } catch {
    // no provider
  }
  return override ?? readCommonText(messages, section, key) ?? fallback
}
