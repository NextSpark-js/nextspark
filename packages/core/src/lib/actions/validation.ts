/**
 * Shared helpers for the Server Actions that validate their arguments with zod.
 * Not a 'use server' module: it exports no action.
 */

import type { ZodError } from 'zod'

/** One line for a ZodError: the first issue, prefixed with its field when it has one */
export function formatZodError(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Validation error'
  const field = issue.path.join('.')
  return field ? `${field}: ${issue.message}` : issue.message
}
