/**
 * The social accounts a user can assign: the user's own social_accounts rows, plus the Facebook Pages and Instagram
 * Business accounts that Graph returns for a stored Meta token. Each comes with its decrypted token, for the server
 * only: the accounts route lists them without it, and the assign route takes the token of the account it is asked for.
 */

import { TokenEncryption } from '@nextsparkjs/core/lib/oauth/encryption'
import { mutateWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'
import { FacebookAPI } from './providers/facebook'

interface StoredSocialAccount {
  id: string
  platform: string
  platformAccountId: string
  username: string
  accessToken: string
  tokenExpiresAt: string
  permissions: string
  accountMetadata: string
}

export interface UserAccount {
  platform: string
  platformAccountId: string
  username: string
  /** Decrypted token: never sent to the client */
  accessToken: string
  tokenExpiresAt: string
  permissions: string[]
  accountMetadata: Record<string, unknown>
  /** The social_accounts row: the account's own, or for one found through Graph the row whose token found it */
  socialAccountId: string
  /** Whether the account has its own social_accounts row */
  stored: boolean
}

/**
 * What a user is told when a platform account they connect or assign already has a social_accounts row of another
 * user: saveOwnSocialAccount changes only the user's own row, so that row is left as it is and no row comes back.
 */
export const ACCOUNT_CONNECTED_ELSEWHERE = 'This account is already connected by another user'

export interface SocialAccountWrite {
  platform: string
  platformAccountId: string
  username: string
  /** Decrypted: stored encrypted */
  accessToken: string
  tokenExpiresAt: Date
  permissions: unknown
  accountMetadata: unknown
}

/**
 * Stores a platform account in the user's social_accounts row: a new row, or the user's own row for that account
 * updated (its token, expiry, permissions and metadata, active again). A row of another user is left as it is and
 * null comes back.
 *
 * Two statements, not `INSERT ... ON CONFLICT DO UPDATE ... WHERE "userId" = ...`: on the app's connection PostgreSQL
 * checks the conflicting row against the UPDATE policy before that WHERE (15.20, 16.16, 17.12, 18.7 and later), so
 * another user's row raises an error there instead of being skipped. The insert does nothing on a conflict, and the
 * update only matches the user's own row, so neither reads nor changes another user's.
 */
export async function saveOwnSocialAccount<T = { id: string }>(userId: string, account: SocialAccountWrite): Promise<T | null> {
  const encrypted = await TokenEncryption.encrypt(account.accessToken)
  const token = `${encrypted.encrypted}:${encrypted.iv}:${encrypted.keyId}`
  const tokenExpiresAt = account.tokenExpiresAt.toISOString()
  const permissions = JSON.stringify(account.permissions)
  const accountMetadata = JSON.stringify(account.accountMetadata)

  const inserted = await mutateWithRLS<T>(
    `INSERT INTO "social_accounts"
      ("userId", platform, "platformAccountId", "username", "accessToken", "tokenExpiresAt", permissions, "accountMetadata", "isActive")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     ON CONFLICT ("platformAccountId") DO NOTHING
     RETURNING *`,
    [userId, account.platform, account.platformAccountId, account.username, token, tokenExpiresAt, permissions, accountMetadata],
    userId
  )
  if (inserted.rows[0]) return inserted.rows[0]

  const updated = await mutateWithRLS<T>(
    `UPDATE "social_accounts" SET
       "accessToken" = $3,
       "tokenExpiresAt" = $4,
       permissions = $5,
       "accountMetadata" = $6,
       "isActive" = true,
       "updatedAt" = CURRENT_TIMESTAMP
     WHERE "platformAccountId" = $2 AND "userId" = $1
     RETURNING *`,
    [userId, account.platformAccountId, token, tokenExpiresAt, permissions, accountMetadata],
    userId
  )
  return updated.rows[0] ?? null
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) || fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function listUserAccounts(userId: string, platformFilter?: string | null): Promise<UserAccount[]> {
  let query = `
    SELECT id, platform, "platformAccountId", username, "accessToken", "tokenExpiresAt", permissions, "accountMetadata"
    FROM "social_accounts"
    WHERE "userId" = $1
      AND "isActive" = true
      AND "accessToken" IS NOT NULL
      AND "accessToken" != ''
  `
  const params: unknown[] = [userId]
  if (platformFilter) {
    query += ` AND platform = $2`
    params.push(platformFilter)
  }

  const storedAccounts = (await queryWithRLS<StoredSocialAccount>(query, params, userId)) || []
  const accounts: UserAccount[] = []
  const seen = new Set<string>()

  for (const account of storedAccounts) {
    if (new Date(account.tokenExpiresAt) < new Date()) {
      console.log(`[social-accounts] Token expired for ${account.username}, skipping`)
      continue
    }
    if (seen.has(account.platformAccountId)) continue
    seen.add(account.platformAccountId)

    try {
      const tokenParts = account.accessToken.split(':')
      if (tokenParts.length !== 3) {
        console.log(`[social-accounts] Invalid token format for ${account.username}, skipping`)
        continue
      }
      const decrypted = await TokenEncryption.decrypt(tokenParts[0], tokenParts[1], tokenParts[2])

      accounts.push({
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        username: account.username,
        accessToken: decrypted,
        tokenExpiresAt: account.tokenExpiresAt,
        permissions: parseJson<string[]>(account.permissions, []),
        accountMetadata: parseJson<Record<string, unknown>>(account.accountMetadata, {}),
        socialAccountId: account.id,
        stored: true,
      })
    } catch (error) {
      console.error(`[social-accounts] Failed to process account ${account.username}:`, error)
    }
  }

  // Then the Pages and Instagram accounts Graph returns for each stored Meta token. The user's own rows are all listed
  // first, so an account the user has a row for keeps that row and its token.
  for (const own of accounts.filter(a => a.platform === 'instagram_business' || a.platform === 'facebook_page')) {
    const decrypted = own.accessToken
    const account = { id: own.socialAccountId, tokenExpiresAt: own.tokenExpiresAt }
    try {
      const pages = await FacebookAPI.getUserPages(decrypted)
      for (const page of pages) {
        if ((!platformFilter || platformFilter === 'facebook_page') && !seen.has(page.id)) {
          seen.add(page.id)
          const pageInfo = await FacebookAPI.getPageInfo(page.id, page.accessToken)
          accounts.push({
            platform: 'facebook_page',
            platformAccountId: page.id,
            username: page.name,
            accessToken: page.accessToken,
            tokenExpiresAt: account.tokenExpiresAt,
            permissions: page.tasks || [],
            accountMetadata: {
              category: page.category,
              profilePictureUrl: page.pictureUrl || pageInfo.profilePictureUrl,
              fanCount: pageInfo.fanCount,
              about: pageInfo.about,
              link: pageInfo.link,
              lastSyncedAt: new Date().toISOString(),
            },
            socialAccountId: account.id,
            stored: false,
          })
        }

        if (!platformFilter || platformFilter === 'instagram_business') {
          try {
            const igAccount = await FacebookAPI.getInstagramBusinessAccount(page.id, page.accessToken)
            if (igAccount && !seen.has(igAccount.id)) {
              seen.add(igAccount.id)
              accounts.push({
                platform: 'instagram_business',
                platformAccountId: igAccount.id,
                username: igAccount.username,
                accessToken: page.accessToken,
                tokenExpiresAt: account.tokenExpiresAt,
                permissions: [
                  'instagram_basic',
                  'instagram_content_publish',
                  'instagram_manage_comments',
                  'pages_show_list',
                  'pages_manage_posts',
                  'pages_read_engagement',
                ],
                accountMetadata: {
                  username: igAccount.username,
                  name: igAccount.name,
                  profilePictureUrl: igAccount.profilePictureUrl,
                  followersCount: igAccount.followersCount,
                  followsCount: igAccount.followsCount,
                  mediaCount: igAccount.mediaCount,
                  biography: igAccount.biography,
                  website: igAccount.website,
                  lastSyncedAt: new Date().toISOString(),
                  facebookPageId: page.id,
                  facebookPageName: page.name,
                },
                socialAccountId: account.id,
                stored: false,
              })
            }
          } catch {
            // No Instagram account for this page
          }
        }
      }
    } catch (error) {
      console.error('[social-accounts] Error fetching from Meta API:', error)
      // Keep what is stored
    }
  }

  return accounts
}
