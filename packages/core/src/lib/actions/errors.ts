/**
 * What a Server Action tells the client when a call throws.
 * Not a 'use server' module: it exports no action.
 *
 * Like the REST routes' 500, the cause stays in the server log (each action logs it); the client gets a fixed
 * message, so database, policy and internal names never reach the browser. The few errors a service throws on
 * purpose for the user keep their message: validation, permission, and the owner/member rules.
 */

import type { ZodError } from 'zod'
import { formatZodError } from './validation'

/** `code` of the errors a service throws with a message written for the user */
const USER_FACING_CODES = new Set(['OWNS_TEAMS', 'NOT_OWNER', 'SAME_OWNER', 'NOT_A_MEMBER'])

const USER_FACING_MESSAGES = new Set([
  'Permission denied',
  'Entity not found or not authorized',
  'Operation cancelled by hook',
  'Team member not found',
  'User is already a member of this team',
  'Cannot remove team owner. Transfer ownership first.',
  'Cannot change owner role. Transfer ownership first.',
])

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  if (error.name === 'ZodError') return formatZodError(error as ZodError)
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && USER_FACING_CODES.has(code)) return error.message
  // 'Validation failed: ...' is what an entity's own validation hooks report
  if (USER_FACING_MESSAGES.has(error.message) || error.message.startsWith('Validation failed: ')) return error.message
  return fallback
}
