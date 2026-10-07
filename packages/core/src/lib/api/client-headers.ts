/**
 * The custom request headers core's own clients send to /api. The clients set them by these names and
 * CORS_ALLOW_HEADERS (cors-response.ts) is built from this list, so a listed origin's preflight allows
 * every header core's clients send. Client-safe: no imports.
 */
export const TEAM_ID_HEADER = 'x-team-id'
export const BUILDER_SOURCE_HEADER = 'x-builder-source'
export const SIGNUP_INTENT_HEADER = 'x-signup-intent'
export const VERIFY_FROM_UI_HEADER = 'x-verify-from-ui'

export const CLIENT_REQUEST_HEADERS = [TEAM_ID_HEADER, BUILDER_SOURCE_HEADER, SIGNUP_INTENT_HEADER, VERIFY_FROM_UI_HEADER] as const
