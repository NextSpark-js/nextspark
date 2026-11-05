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
