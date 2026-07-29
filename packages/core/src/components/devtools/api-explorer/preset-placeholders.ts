/**
 * Placeholders a preset payload can carry, resolved when the preset is APPLIED.
 *
 * A write preset is usually single-use: it creates something with an email, a reference or a
 * slug that cannot be reused, so the second press either replays the first or is refused, and
 * whoever is testing has to hand-edit the values before every run.
 *
 * Some presets need the opposite, though: one proving an idempotent replay has to send the value
 * the previous request sent, and one proving that a reference cannot be reused across two buyers
 * has to reuse it. Resolve a token per REQUEST and those stop testing anything while still
 * answering 200, which reads as a pass.
 *
 * So there are two kinds of token, and which one a preset wants depends on what it is proving:
 *
 * - `{{UNIQUE}}` is fresh on every apply. This is the default for a preset that creates
 *   something: press play, get values nobody has used, press play again, get another set. Two
 *   people testing at the same time never collide with each other either.
 * - `{{RUN}}` is stable until someone starts a new run, and shared by every preset of the
 *   endpoint. This is for the rarer case where two DIFFERENT presets have to meet on the same
 *   value — a reference one preset creates and another tries to reuse.
 *
 * Resolution happens when the preset is APPLIED, not when the request is sent, and that is what
 * lets a single preset prove an idempotent replay even with `{{UNIQUE}}`: apply once, then send
 * twice. The second send reuses the body already in the editor, which is exactly what a retried
 * webhook does.
 *
 * Every token resolves once per apply, so an email and a reference in the same payload agree
 * with each other.
 */

/** Token → value for a single apply. Built once so every occurrence resolves identically. */
export interface PresetPlaceholderValues {
  UNIQUE: string
  RUN: string
  TIMESTAMP: string
  UUID: string
  FIRST_TEAM_ID: string
}

export const PRESET_RUN_TOKEN_KEY = 'devtools.presetRunToken'

const PLACEHOLDER_PATTERN = /\{\{([A-Z_]+)\}\}/g

/**
 * Base36 of the clock plus four random characters: short enough to sit inside an email local
 * part, ordered so a newer value sorts after an older one, and unique even between two clicks
 * inside the same millisecond or two people testing at once.
 */
function mintToken(): string {
  const random = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
  return `${Date.now().toString(36)}${random}`
}

/** The current run token, minting one on first use. Survives reloads: a run outlives a refresh. */
export function readPresetRunToken(): string {
  if (typeof window === 'undefined') return 'run'
  const stored = window.localStorage.getItem(PRESET_RUN_TOKEN_KEY)
  if (stored) return stored
  const minted = mintToken()
  window.localStorage.setItem(PRESET_RUN_TOKEN_KEY, minted)
  return minted
}

/** Starts a new run. Presets applied from here on get values nothing has used before. */
export function regeneratePresetRunToken(): string {
  const minted = mintToken()
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PRESET_RUN_TOKEN_KEY, minted)
  }
  return minted
}

function readFirstTeamId(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('firstTeamId') || window.localStorage.getItem('activeTeamId') || ''
}

export function createPresetPlaceholderValues(): PresetPlaceholderValues {
  return {
    // Minted here, so every apply gets its own — that is the whole point of this one.
    UNIQUE: mintToken(),
    RUN: readPresetRunToken(),
    TIMESTAMP: String(Date.now()),
    UUID: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : mintToken(),
    FIRST_TEAM_ID: readFirstTeamId(),
  }
}

/**
 * Replaces every known token inside a preset value, walking strings, arrays and objects.
 *
 * An unknown token is left exactly as written rather than blanked: a preset that names something
 * this version does not provide should show that in the editor, where it can be read and fixed,
 * instead of silently sending an empty string that the endpoint then rejects for the wrong reason.
 */
export function resolvePresetPlaceholders<T>(
  value: T,
  values: PresetPlaceholderValues = createPresetPlaceholderValues()
): T {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_PATTERN, (whole, token: string) =>
      token in values ? values[token as keyof PresetPlaceholderValues] : whole
    ) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolvePresetPlaceholders(item, values)) as unknown as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolvePresetPlaceholders(item, values),
      ])
    ) as unknown as T
  }
  return value
}
