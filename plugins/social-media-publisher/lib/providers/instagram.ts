/**
 * Instagram Business API Wrapper
 *
 * Provides methods for publishing to Instagram Business Accounts via Facebook Graph API
 * Uses Facebook Page tokens to publish to Instagram Business Accounts
 *
 * @see https://developers.facebook.com/docs/instagram-api
 * @see https://developers.facebook.com/docs/instagram-platform
 */

const GRAPH_API_VERSION = 'v21.0'
// Instagram Graph API via Facebook - when using Page tokens, we must use Facebook Graph API
// The Instagram Business Account ID works with both endpoints, but Page tokens only work with graph.facebook.com
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// Legacy: Direct Instagram Platform API (requires Instagram Platform API tokens, not Page tokens)
const INSTAGRAM_DIRECT_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`

export interface InstagramPublishOptions {
  igAccountId: string
  accessToken: string
  imageUrl?: string
  videoUrl?: string
  caption?: string
  isCarousel?: boolean
  carouselItems?: string[] // Array of media URLs
}

interface InstagramCarouselItem {
  imageUrl: string
  containerId?: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  error?: string
}

export interface InstagramPublishResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  errorDetails?: unknown
}

export interface InstagramAccountInfo {
  id: string
  username: string
  accountType?: string // 'BUSINESS' or 'CREATOR'
  profilePictureUrl?: string
  followersCount?: number
  followsCount?: number
  mediaCount?: number
}

export interface InstagramInsights {
  impressions: number
  reach: number
  engagement: number
  likes: number
  comments: number
  saves: number
  profileViews: number
}

export class InstagramAPI {
  /**
   * Publish a photo to Instagram Business Account
   *
   * Instagram publishing is a 2-step process:
   * 1. Create media container
   * 2. Publish the container
   */
  static async publishPhoto(options: InstagramPublishOptions): Promise<InstagramPublishResult> {
    if (!options.imageUrl) {
      return {
        success: false,
        error: 'Image URL is required for photo posts',
      }
    }

    try {
      // Step 1: Create media container
      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${options.igAccountId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: options.imageUrl,
            caption: options.caption || '',
            access_token: options.accessToken,
          }),
        }
      )

      const containerData = await containerResponse.json()

      if (containerData.error) {
        console.error('[InstagramAPI] Container creation failed:', containerData.error.message)
        return {
          success: false,
          error: containerData.error.message,
          errorDetails: containerData.error,
        }
      }

      const creationId = containerData.id

      // Wait for Instagram to process the image (recommended: 2-5 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 2: Publish the container
      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${options.igAccountId}/media_publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creation_id: creationId,
            access_token: options.accessToken,
          }),
        }
      )

      const publishData = await publishResponse.json()

      if (publishData.error) {
        console.error('[InstagramAPI] Publishing failed:', publishData.error.message)
        return {
          success: false,
          error: publishData.error.message,
          errorDetails: publishData.error,
        }
      }

      // Fetch the actual permalink from Instagram API
      const postUrl = await this.getMediaPermalink(publishData.id, options.accessToken)

      return {
        success: true,
        postId: publishData.id,
        postUrl,
      }
    } catch (error) {
      console.error('[InstagramAPI] Exception during publish:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
      }
    }
  }

  /**
   * Publish a video to Instagram Business Account
   */
  static async publishVideo(options: InstagramPublishOptions): Promise<InstagramPublishResult> {
    if (!options.videoUrl) {
      return {
        success: false,
        error: 'Video URL is required for video posts',
      }
    }

    try {
      // Step 1: Create video container
      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${options.igAccountId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_type: 'VIDEO',
            video_url: options.videoUrl,
            caption: options.caption || '',
            access_token: options.accessToken,
          }),
        }
      )

      const containerData = await containerResponse.json()

      if (containerData.error) {
        return {
          success: false,
          error: containerData.error.message,
          errorDetails: containerData.error,
        }
      }

      const creationId = containerData.id

      // Poll for video processing status (videos take longer than images)
      const isReady = await this.waitForVideoProcessing(
        creationId,
        options.accessToken
      )

      if (!isReady) {
        return {
          success: false,
          error: 'Video processing timed out',
        }
      }

      // Step 2: Publish the container
      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${options.igAccountId}/media_publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creation_id: creationId,
            access_token: options.accessToken,
          }),
        }
      )

      const publishData = await publishResponse.json()

      if (publishData.error) {
        return {
          success: false,
          error: publishData.error.message,
          errorDetails: publishData.error,
        }
      }

      // Fetch the actual permalink from Instagram API
      const postUrl = await this.getMediaPermalink(publishData.id, options.accessToken)

      return {
        success: true,
        postId: publishData.id,
        postUrl,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
      }
    }
  }

  /**
   * Get Instagram Business Account info
   */
  static async getAccountInfo(
    igAccountId: string,
    accessToken: string
  ): Promise<InstagramAccountInfo> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}?` +
          `fields=id,username,profile_picture_url,followers_count,follows_count,media_count&` +
          `access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      return {
        id: data.id,
        username: data.username,
        profilePictureUrl: data.profile_picture_url,
        followersCount: data.followers_count,
        followsCount: data.follows_count,
        mediaCount: data.media_count,
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch Instagram account info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get Instagram account insights (analytics)
   */
  static async getAccountInsights(
    igAccountId: string,
    accessToken: string
  ): Promise<InstagramInsights> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/insights?` +
          `metric=impressions,reach,profile_views&` +
          `period=day&` +
          `access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const insights: InstagramInsights = {
        impressions: 0,
        reach: 0,
        engagement: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        profileViews: 0,
      }

      data.data?.forEach((metric: any) => {
        const value = metric.values?.[0]?.value || 0
        if (metric.name === 'impressions') {
          insights.impressions = value
        } else if (metric.name === 'reach') {
          insights.reach = value
        } else if (metric.name === 'profile_views') {
          insights.profileViews = value
        }
      })

      return insights
    } catch (error) {
      throw new Error(
        `Failed to fetch Instagram insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get Instagram media insights (post analytics)
   */
  static async getMediaInsights(
    mediaId: string,
    accessToken: string
  ): Promise<Partial<InstagramInsights>> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${mediaId}/insights?` +
          `metric=engagement,impressions,reach,saved&` +
          `access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const insights: Partial<InstagramInsights> = {}

      data.data?.forEach((metric: any) => {
        const value = metric.values?.[0]?.value || 0
        if (metric.name === 'engagement') {
          insights.engagement = value
        } else if (metric.name === 'impressions') {
          insights.impressions = value
        } else if (metric.name === 'reach') {
          insights.reach = value
        } else if (metric.name === 'saved') {
          insights.saves = value
        }
      })

      return insights
    } catch (error) {
      throw new Error(
        `Failed to fetch media insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get Instagram Business Account from Facebook Page (Legacy - for backward compatibility)
   *
   * @deprecated Use getAccountInfoFromToken for new Instagram Platform API (Direct Login)
   */
  static async getInstagramAccountFromPage(
    pageId: string,
    pageAccessToken: string
  ): Promise<{ id: string; username: string } | null> {
    try {
      console.log(`[InstagramAPI] Checking Page ${pageId} for Instagram Business account...`)

      const response = await fetch(
        `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
      )

      const data = await response.json()

      console.log(`[InstagramAPI] Page ${pageId} API response:`, JSON.stringify(data, null, 2))

      if (data.error) {
        console.error(`[InstagramAPI] ❌ API Error for Page ${pageId}:`, data.error)
        console.error(`  Error Code: ${data.error.code}`)
        console.error(`  Error Type: ${data.error.type}`)
        console.error(`  Error Message: ${data.error.message}`)
        if (data.error.error_subcode) {
          console.error(`  Error Subcode: ${data.error.error_subcode}`)
        }
        return null
      }

      if (!data.instagram_business_account) {
        console.log(`[InstagramAPI] ℹ️  Page ${pageId} has no instagram_business_account field (not linked)`)
        return null
      }

      console.log(`[InstagramAPI] ✅ Found Instagram Business Account ID: ${data.instagram_business_account.id}`)

      // Get username
      const accountResponse = await fetch(
        `${GRAPH_API_BASE}/${data.instagram_business_account.id}?fields=username&access_token=${pageAccessToken}`
      )

      const accountData = await accountResponse.json()

      if (accountData.error) {
        console.error(`[InstagramAPI] ❌ Failed to fetch username for IG account ${data.instagram_business_account.id}:`, accountData.error)
        return null
      }

      console.log(`[InstagramAPI] ✅ Username: @${accountData.username}`)

      return {
        id: data.instagram_business_account.id,
        username: accountData.username,
      }
    } catch (error) {
      console.error(`[InstagramAPI] ❌ Exception while checking Page ${pageId}:`, error)
      if (error instanceof Error) {
        console.error(`  Exception message: ${error.message}`)
        console.error(`  Stack trace:`, error.stack)
      }
      return null
    }
  }

  /**
   * Get Instagram account info from access token (Instagram Platform API - Direct Login)
   *
   * Uses the new Instagram Platform API that doesn't require Facebook Page connection
   * Works with Instagram Business and Creator accounts
   *
   * NOTE: This requires Instagram Platform API tokens (from direct Instagram OAuth),
   * NOT Facebook Page tokens. Use getInstagramAccountFromPage for Page token scenarios.
   *
   * @param accessToken - Long-lived Instagram Platform API access token
   * @returns Instagram account information
   */
  static async getAccountInfoFromToken(
    accessToken: string
  ): Promise<InstagramAccountInfo> {
    try {
      console.log('[InstagramAPI] Fetching account info using Instagram Platform API (Direct Login)...')

      const response = await fetch(
        `${INSTAGRAM_DIRECT_API_BASE}/me?` +
        `fields=id,username,account_type,media_count,profile_picture_url,followers_count,follows_count&` +
        `access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.error) {
        console.error('[InstagramAPI] ❌ API Error:', data.error)
        throw new Error(data.error.message || 'Failed to fetch Instagram account info')
      }

      console.log('[InstagramAPI] ✅ Account info retrieved:', {
        id: data.id,
        username: data.username,
        accountType: data.account_type,
        followersCount: data.followers_count
      })

      return {
        id: data.id,
        username: data.username,
        accountType: data.account_type, // 'BUSINESS' or 'CREATOR'
        mediaCount: data.media_count,
        profilePictureUrl: data.profile_picture_url,
        followersCount: data.followers_count,
        followsCount: data.follows_count,
      }
    } catch (error) {
      console.error('[InstagramAPI] ❌ Exception while fetching account info:', error)
      throw new Error(
        `Failed to fetch Instagram account info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Wait for video processing to complete
   * Polls status every 2 seconds, max 30 seconds
   */
  private static async waitForVideoProcessing(
    creationId: string,
    accessToken: string,
    maxAttempts: number = 15
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const response = await fetch(
        `${GRAPH_API_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.status_code === 'FINISHED') {
        return true
      }

      if (data.status_code === 'ERROR') {
        return false
      }

      // Continue polling if status is IN_PROGRESS
    }

    return false
  }

  /**
   * Get the permalink URL for a published Instagram media
   * Uses Instagram Graph API to fetch the actual permalink
   *
   * @param mediaId - The Instagram media ID returned from publish
   * @param accessToken - Access token for the API
   * @returns The full permalink URL (e.g., https://www.instagram.com/p/C1abc2DE3fg/)
   */
  private static async getMediaPermalink(
    mediaId: string,
    accessToken: string
  ): Promise<string | undefined> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`
      )

      const data = await response.json()

      if (data.error) {
        console.error('[InstagramAPI] Failed to fetch permalink:', data.error.message)
        // Return a fallback URL constructed from the ID (may not work but better than nothing)
        return `https://www.instagram.com/p/${mediaId}/`
      }

      console.log(`[InstagramAPI] ✅ Got permalink: ${data.permalink}`)
      return data.permalink
    } catch (error) {
      console.error('[InstagramAPI] Exception fetching permalink:', error)
      return `https://www.instagram.com/p/${mediaId}/`
    }
  }

  /**
   * Publish a carousel (multiple images) to Instagram Business Account
   *
   * Instagram carousel publishing is a 4-step process:
   * 1. Create container for each image with is_carousel_item=true
   * 2. Wait for all containers to finish processing
   * 3. Create carousel container with media_type=CAROUSEL
   * 4. Publish the carousel
   */
  static async publishCarousel(options: InstagramPublishOptions): Promise<InstagramPublishResult> {
    const { igAccountId, accessToken, carouselItems, caption } = options

    // Validation
    if (!carouselItems || carouselItems.length < 2) {
      return {
        success: false,
        error: 'Carousel requires at least 2 images',
      }
    }

    if (carouselItems.length > 10) {
      return {
        success: false,
        error: 'Instagram allows maximum 10 images per carousel',
      }
    }

    try {
      console.log(`[InstagramAPI] Creating carousel with ${carouselItems.length} images...`)

      // Step 1: Create containers for each image
      const containerIds: string[] = []
      const errors: { index: number; error: string }[] = []

      for (let i = 0; i < carouselItems.length; i++) {
        const imageUrl = carouselItems[i]
        console.log(`[InstagramAPI] Creating container for image ${i + 1}/${carouselItems.length}...`)

        const containerResult = await this.createCarouselItemContainer(
          igAccountId,
          accessToken,
          imageUrl
        )

        if (containerResult.success && containerResult.containerId) {
          containerIds.push(containerResult.containerId)
          console.log(`[InstagramAPI] ✅ Container created for image ${i + 1}: ${containerResult.containerId}`)
        } else {
          console.error(`[InstagramAPI] ❌ Failed to create container for image ${i + 1}: ${containerResult.error}`)
          errors.push({ index: i + 1, error: containerResult.error || 'Unknown error' })
        }
      }

      if (errors.length > 0) {
        const errorMessage = `Failed to create containers for images: ${errors.map(e => `#${e.index}: ${e.error}`).join(', ')}`
        console.error(`[InstagramAPI] ${errorMessage}`)
        return {
          success: false,
          error: errorMessage,
          errorDetails: errors,
        }
      }

      console.log(`[InstagramAPI] All ${containerIds.length} containers created, waiting for processing...`)

      // Step 2: Wait for all containers to be ready
      const readyContainers = await this.waitForCarouselContainers(containerIds, accessToken)

      if (!readyContainers.allReady) {
        const errorMessage = 'Some carousel images failed processing'
        console.error(`[InstagramAPI] ${errorMessage}`)
        console.error('[InstagramAPI] Container statuses:', readyContainers.statuses)
        return {
          success: false,
          error: errorMessage,
          errorDetails: readyContainers.statuses,
        }
      }

      console.log('[InstagramAPI] ✅ All containers ready')

      // ⚠️ CRITICAL WORKAROUND: Instagram API Race Condition (Error 2207027)
      // Even after status_code='FINISHED', Instagram needs 5-10 seconds to make containers
      // available for carousel creation. Without this delay, carousel creation fails with:
      // "Media ID is not available" (error_subcode: 2207027)
      // This is a known Instagram API bug where status_code doesn't reflect actual availability.
      console.log('[InstagramAPI] ⏳ Waiting 8 seconds for Instagram to sync containers (API race condition workaround)...')
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Step 3: Create carousel container
      console.log('[InstagramAPI] Creating carousel container...')
      const carouselContainerResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'CAROUSEL',
            caption: caption || '',
            children: containerIds,
            access_token: accessToken,
          }),
        }
      )

      const carouselContainerData = await carouselContainerResponse.json()

      if (carouselContainerData.error) {
        console.error('[InstagramAPI] Carousel container creation failed:', carouselContainerData.error.message)
        return {
          success: false,
          error: carouselContainerData.error.message,
          errorDetails: carouselContainerData.error,
        }
      }

      const carouselCreationId = carouselContainerData.id
      console.log(`[InstagramAPI] ✅ Carousel container created: ${carouselCreationId}`)

      // Step 4: Publish carousel
      console.log('[InstagramAPI] Publishing carousel...')
      const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: carouselCreationId,
            access_token: accessToken,
          }),
        }
      )

      const publishData = await publishResponse.json()

      if (publishData.error) {
        console.error('[InstagramAPI] Carousel publishing failed:', publishData.error.message)
        return {
          success: false,
          error: publishData.error.message,
          errorDetails: publishData.error,
        }
      }

      console.log(`[InstagramAPI] ✅ Carousel published successfully: ${publishData.id}`)

      // Fetch the actual permalink from Instagram API
      const postUrl = await this.getMediaPermalink(publishData.id, accessToken)

      return {
        success: true,
        postId: publishData.id,
        postUrl,
      }
    } catch (error) {
      console.error('[InstagramAPI] Exception during carousel publish:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
      }
    }
  }

  /**
   * Create a carousel item container
   * @private
   */
  private static async createCarouselItemContainer(
    igAccountId: string,
    accessToken: string,
    imageUrl: string
  ): Promise<{ success: boolean; containerId?: string; error?: string }> {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      )

      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, containerId: data.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Wait for carousel containers to finish processing
   * Polls status every 2 seconds, max 60 seconds
   * @private
   */
  private static async waitForCarouselContainers(
    containerIds: string[],
    accessToken: string,
    maxWaitMs: number = 60000 // 60 seconds max
  ): Promise<{ allReady: boolean; statuses: Record<string, string> }> {
    const startTime = Date.now()
    const statuses: Record<string, string> = {}

    while (Date.now() - startTime < maxWaitMs) {
      let allReady = true

      for (const containerId of containerIds) {
        try {
          const response = await fetch(
            `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
          )
          const data = await response.json()

          statuses[containerId] = data.status_code || 'UNKNOWN'

          if (data.status_code === 'ERROR') {
            console.error(`[InstagramAPI] Container ${containerId} failed with ERROR status`)
            return { allReady: false, statuses }
          }

          if (data.status_code !== 'FINISHED') {
            allReady = false
          }
        } catch (error) {
          console.error(`[InstagramAPI] Error checking container ${containerId}:`, error)
          statuses[containerId] = 'ERROR'
          return { allReady: false, statuses }
        }
      }

      if (allReady) {
        console.log('[InstagramAPI] All containers FINISHED')
        return { allReady: true, statuses }
      }

      // Wait 2 seconds before checking again
      console.log('[InstagramAPI] Containers still processing, waiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.error('[InstagramAPI] Timeout waiting for containers to process')
    return { allReady: false, statuses }
  }
}
