/**
 * Who can read /docs, decided from the `docs` block of a theme's app.config.ts.
 *
 * `docs.publicAccess` is the setting: `false` asks for a session, anything
 * else serves /docs to everyone. `docs.public` holds the sidebar settings of
 * that category (`{ enabled, open, label }`), not access.
 *
 * App configs written before `publicAccess` existed said `public: false` for
 * private docs. That boolean is still read as `publicAccess: false`, and
 * either one set to `false` makes /docs private: this decides who can read
 * the docs, so a leftover `public: false` next to `publicAccess: true` keeps
 * asking for a session rather than opening them.
 */
import type { DocsCategoryConfig } from '../config/types'

type DocsConfigInput = { publicAccess?: unknown; public?: unknown } | null | undefined

/** Whether /docs is served without a session. */
export function isDocsPublic(docs: DocsConfigInput): boolean {
  return docs?.publicAccess !== false && docs?.public !== false
}

/** The sidebar settings under `docs.public`, or undefined when there are
 * none — including when `public` is the access boolean of the older shape. */
export function getPublicDocsCategory(docs: DocsConfigInput): DocsCategoryConfig | undefined {
  const category = docs?.public
  return category && typeof category === 'object' ? (category as DocsCategoryConfig) : undefined
}

/** What to change when `docs.public` is still the older access boolean, or
 * null when the block already uses `publicAccess`. */
export function legacyDocsAccessMessage(docs: DocsConfigInput): string | null {
  if (typeof docs?.public !== 'boolean') return null
  return (
    `app.config.ts sets docs.public to ${docs.public}, the older way to say whether /docs needs a session. ` +
    `Write docs.publicAccess: ${docs.public} instead, and use docs.public for the sidebar settings ` +
    `({ enabled, open, label }).`
  )
}
