/**
 * Users - Zod Validation Schemas
 *
 * The profile fields a user may change on their own account. `PATCH /api/v1/users/:id` and the `updateProfile` /
 * `updateAvatar` Server Actions parse their input with these, so a value is accepted or refused the same way on
 * every path.
 *
 * @module core/lib/users/schema
 */

import * as z from 'zod'

const isTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  // A language tag such as "en" or "pt-BR"
  language: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Invalid language').optional(),
  // ISO 3166-1 alpha-2, as the country select stores it
  country: z.string().regex(/^[A-Za-z]{2}$/, 'Invalid country code').optional(),
  timezone: z.string().max(64).refine(isTimezone, 'Invalid timezone').optional(),
})

/** An avatar is an http(s) URL or a path on this app (`/uploads/a.png`); `//host/x` (protocol-relative) is not a path */
export const avatarImageSchema = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      value.startsWith('/')
        ? !value.startsWith('//') && !value.startsWith('/\\')
        : z.url({ protocol: /^https?$/ }).safeParse(value).success,
    'Invalid image URL format'
  )

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>
