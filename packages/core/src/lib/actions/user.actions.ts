'use server'

/**
 * User Server Actions
 *
 * Server Actions for user profile management including profile updates,
 * avatar changes, and account deletion.
 *
 * SECURITY:
 * - Auth is obtained from session/cookies (NOT from client parameters)
 * - Users can only modify their own profile
 * - userId comes from getTypedSession()
 *
 * @example
 * ```typescript
 * // From a Client Component
 * 'use client'
 * import { updateProfile, updateAvatar, deleteAccount } from '@nextsparkjs/core/actions'
 *
 * // Update profile
 * const result = await updateProfile({ firstName: 'John', lastName: 'Doe' })
 *
 * // Update avatar (with FormData for file upload)
 * const formData = new FormData()
 * formData.append('avatar', file)
 * await updateAvatar(formData)
 *
 * // Delete account
 * await deleteAccount()
 * ```
 */

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getTypedSession } from '../auth'
import { UserService, type UpdateUserPayload } from '../services/user.service'
import type { EntityActionResult, EntityActionVoidResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Profile update data that can be passed to updateProfile
 */
export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  name?: string
  country?: string
  timezone?: string
  language?: string
}

/**
 * Result of profile update with user data
 */
export interface ProfileUpdateResult {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  image?: string
  country?: string
  timezone?: string
  language?: string
}

// ============================================================================
// UPDATE PROFILE
// ============================================================================

/**
 * Update the current user's profile information
 *
 * Auth is automatically obtained from session - users can only update their own profile.
 *
 * @param data - Profile fields to update
 * @returns Updated user data wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * const result = await updateProfile({
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   timezone: 'America/New_York'
 * })
 *
 * if (result.success) {
 *   console.log('Profile updated:', result.data)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 */
export async function updateProfile(
  data: UpdateProfileData
): Promise<EntityActionResult<ProfileUpdateResult>> {
  try {
    // 1. Get auth context from session
    const headersList = await headers()
    const session = await getTypedSession(headersList)

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const userId = session.user.id

    // 2. Validate input
    if (!data || Object.keys(data).length === 0) {
      return { success: false, error: 'No fields provided for update' }
    }

    // 3. Build update payload (filter to allowed fields only)
    const updatePayload: UpdateUserPayload = {}

    if (data.firstName !== undefined) updatePayload.firstName = data.firstName
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.country !== undefined) updatePayload.country = data.country
    if (data.timezone !== undefined) updatePayload.timezone = data.timezone
    if (data.language !== undefined) updatePayload.language = data.language

    if (Object.keys(updatePayload).length === 0) {
      return { success: false, error: 'No valid fields provided for update' }
    }

    // 4. Update user via service
    const updatedUser = await UserService.updateUser(userId, updatePayload, userId)

    // 5. Revalidate profile-related paths
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/settings/profile')

    return {
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name ?? undefined,
        firstName: updatedUser.firstName ?? undefined,
        lastName: updatedUser.lastName ?? undefined,
        image: updatedUser.image ?? undefined,
        country: updatedUser.country ?? undefined,
        timezone: updatedUser.timezone ?? undefined,
        language: updatedUser.language ?? undefined,
      },
    }
  } catch (error) {
    console.error('[updateProfile] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile',
    }
  }
}

// ============================================================================
// UPDATE AVATAR
// ============================================================================

/**
 * Update the current user's avatar image
 *
 * Accepts FormData with an 'avatar' or 'image' field containing the image URL or file path.
 * For actual file uploads, the file should be uploaded to storage first and the URL passed here.
 *
 * @param formData - FormData with 'avatar' or 'image' field containing the image URL
 * @returns Updated user data wrapped in EntityActionResult
 *
 * @example
 * ```typescript
 * // After uploading file to storage
 * const formData = new FormData()
 * formData.append('avatar', imageUrl)
 * const result = await updateAvatar(formData)
 *
 * if (result.success) {
 *   console.log('Avatar updated:', result.data.image)
 * }
 * ```
 */
export async function updateAvatar(
  formData: FormData
): Promise<EntityActionResult<ProfileUpdateResult>> {
  try {
    // 1. Get auth context from session
    const headersList = await headers()
    const session = await getTypedSession(headersList)

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const userId = session.user.id

    // 2. Extract avatar URL from FormData
    const avatarValue = formData.get('avatar') ?? formData.get('image')

    if (!avatarValue) {
      return { success: false, error: 'Avatar image is required' }
    }

    // Handle both string URLs and potential file references
    let imageUrl: string
    if (typeof avatarValue === 'string') {
      imageUrl = avatarValue
    } else {
      // If it's a File, it should have been uploaded first
      // This action expects the URL, not the file itself
      return {
        success: false,
        error: 'Please upload the image first and pass the URL',
      }
    }

    // 3. Validate URL format (basic validation)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('/')) {
      return { success: false, error: 'Invalid image URL format' }
    }

    // 4. Update user via service
    const updatedUser = await UserService.updateUser(
      userId,
      { image: imageUrl },
      userId
    )

    // 5. Revalidate profile-related paths
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/settings/profile')
    revalidatePath('/dashboard') // Avatar may appear in header

    return {
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name ?? undefined,
        firstName: updatedUser.firstName ?? undefined,
        lastName: updatedUser.lastName ?? undefined,
        image: updatedUser.image ?? undefined,
        country: updatedUser.country ?? undefined,
        timezone: updatedUser.timezone ?? undefined,
        language: updatedUser.language ?? undefined,
      },
    }
  } catch (error) {
    console.error('[updateAvatar] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update avatar',
    }
  }
}

// ============================================================================
// DELETE ACCOUNT
// ============================================================================

/**
 * Delete the current user's account
 *
 * This is a destructive operation that:
 * - Removes the user from all teams
 * - Deletes user metadata
 * - Deletes the user account
 *
 * Teams owned by the user must have ownership transferred first or be deleted.
 *
 * @returns Success status
 *
 * @example
 * ```typescript
 * // Show confirmation dialog first!
 * const confirmed = window.confirm('Are you sure? This cannot be undone.')
 * if (confirmed) {
 *   const result = await deleteAccount()
 *   if (result.success) {
 *     // Redirect to goodbye page or login
 *     router.push('/goodbye')
 *   }
 * }
 * ```
 */
export async function deleteAccount(): Promise<EntityActionVoidResult> {
  try {
    // 1. Get auth context from session
    const headersList = await headers()
    const session = await getTypedSession(headersList)

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const userId = session.user.id

    // 2. Check if user owns any teams
    // Import TeamService dynamically to avoid circular dependency
    const { TeamService } = await import('../services/team.service')
    const ownedTeams = await TeamService.getByOwnerId(userId)

    if (ownedTeams.length > 0) {
      return {
        success: false,
        error: 'Cannot delete account while owning teams. Transfer ownership or delete teams first.',
      }
    }

    // 3. Delete user metadata first
    await UserService.deleteAllUserMetas(userId, userId)

    // 4. Delete user account
    // Note: Team memberships should cascade delete via foreign key
    // The actual user deletion requires direct database access
    // For now, we'll use a raw query through the db module
    const { mutateWithRLS } = await import('../db')

    const result = await mutateWithRLS(
      'DELETE FROM "users" WHERE id = $1',
      [userId],
      userId
    )

    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' }
    }

    // 5. Revalidate paths (user will be logged out anyway)
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('[deleteAccount] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account',
    }
  }
}
