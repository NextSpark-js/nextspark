/**
 * Facebook Graph API Wrapper
 *
 * Provides methods for publishing to Facebook Pages
 * Uses Facebook Graph API v21.0
 *
 * @see https://developers.facebook.com/docs/graph-api
 */

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export interface FacebookPublishOptions {
  pageId: string
  pageAccessToken: string
  message: string
  imageUrl?: string
  imageUrls?: string[] // For carousels
  videoUrl?: string
  link?: string
}

export interface FacebookPublishResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  errorDetails?: unknown
}

export interface FacebookPageInfo {
  id: string
  name: string
  category: string
  accessToken: string
  tasks: string[]
  pictureUrl?: string
}

export interface FacebookInsights {
  impressions: number
  reach: number
  engagement: number
  reactions: number
  comments: number
  shares: number
}

export interface FacebookPageStats {
  id: string
  name: string
  fanCount: number
  about?: string
  category?: string
  profilePictureUrl?: string
  coverPhotoUrl?: string
  link?: string
}

interface FacebookAPIResponse<T> {
  data?: T[]
  paging?: {
    next?: string
    previous?: string
  }
  error?: {
    message: string
    type: string
    code: number
  }
}

interface FacebookPageData {
  id: string
  name: string
  category: string
  access_token: string
  tasks?: string[]
  picture?: {
    data?: {
      url: string
    }
  }
}

export class FacebookAPI {
  /**
   * Publish a text post to Facebook Page
   */
  static async publishTextPost(options: FacebookPublishOptions): Promise<FacebookPublishResult> {
    try {
      const response: Response = await fetch(`${GRAPH_API_BASE}/${options.pageId}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: options.message,
          access_token: options.pageAccessToken,
        }),
      })

      const data: any = await response.json()

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
          errorDetails: data.error,
        }
      }

      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${data.id}`,
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
   * Publish a photo post to Facebook Page
   */
  static async publishPhotoPost(options: FacebookPublishOptions): Promise<FacebookPublishResult> {
    if (!options.imageUrl) {
      return {
        success: false,
        error: 'Image URL is required for photo posts',
      }
    }

    try {
      const response: Response = await fetch(`${GRAPH_API_BASE}/${options.pageId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: options.imageUrl,
          message: options.message,
          access_token: options.pageAccessToken,
        }),
      })

      const data: any = await response.json()

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
          errorDetails: data.error,
        }
      }

      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${data.post_id || data.id}`,
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
   * Publish a link post to Facebook Page
   */
  static async publishLinkPost(options: FacebookPublishOptions): Promise<FacebookPublishResult> {
    if (!options.link) {
      return {
        success: false,
        error: 'Link URL is required for link posts',
      }
    }

    try {
      const response: Response = await fetch(`${GRAPH_API_BASE}/${options.pageId}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: options.message,
          link: options.link,
          access_token: options.pageAccessToken,
        }),
      })

      const data: any = await response.json()

      if (data.error) {
        return {
          success: false,
          error: data.error.message,
          errorDetails: data.error,
        }
      }

      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${data.id}`,
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
   * Get Facebook Pages managed by user
   */
  static async getUserPages(userAccessToken: string): Promise<FacebookPageInfo[]> {
    try {
      console.log('[FacebookAPI] 🔍 Fetching user pages...')
      let allPages: FacebookPageInfo[] = []
      let nextUrl: string | null = `${GRAPH_API_BASE}/me/accounts?fields=id,name,category,access_token,tasks,picture&access_token=${userAccessToken}`
      let pageCount = 0

      // Fetch all pages following pagination
      while (nextUrl && pageCount < 10) { // Safety limit of 10 pages
        pageCount++
        console.log(`[FacebookAPI] 🔍 Fetching page batch ${pageCount}...`)

        const response: Response = await fetch(nextUrl)
        const data: FacebookAPIResponse<FacebookPageData> = await response.json()

        if (data.error) {
          throw new Error(data.error.message)
        }

        // Map and add pages from this batch
        const batchPages = (data.data || []).map((page: any) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          accessToken: page.access_token,
          tasks: page.tasks || [],
          pictureUrl: page.picture?.data?.url,
        }))

        allPages = allPages.concat(batchPages)
        console.log(`[FacebookAPI] 🔍 Batch ${pageCount}: Found ${batchPages.length} pages`)

        // Check for next page
        nextUrl = data.paging?.next || null
        if (nextUrl) {
          console.log(`[FacebookAPI] 🔍 Pagination detected - fetching next batch...`)
        }
      }

      console.log('[FacebookAPI] ✅ Total pages found across all batches:', allPages.length)
      console.log('[FacebookAPI] 🔍 Page names:', allPages.map((p: any) => p.name))

      return allPages
    } catch (error) {
      throw new Error(
        `Failed to fetch Facebook Pages: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get page insights (analytics)
   */
  static async getPageInsights(
    pageId: string,
    pageAccessToken: string
  ): Promise<FacebookInsights> {
    try {
      const response: Response = await fetch(
        `${GRAPH_API_BASE}/${pageId}/insights?` +
          `metric=page_impressions,page_engaged_users,page_views_total&` +
          `period=day&` +
          `access_token=${pageAccessToken}`
      )

      const data: any = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      // Extract metrics from response
      const insights: FacebookInsights = {
        impressions: 0,
        reach: 0,
        engagement: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
      }

      data.data?.forEach((metric: any) => {
        const value = metric.values?.[0]?.value || 0
        if (metric.name === 'page_impressions') {
          insights.impressions = value
        } else if (metric.name === 'page_engaged_users') {
          insights.engagement = value
        } else if (metric.name === 'page_views_total') {
          insights.reach = value
        }
      })

      return insights
    } catch (error) {
      throw new Error(
        `Failed to fetch page insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Validate page access token permissions
   */
  static async validatePagePermissions(
    pageId: string,
    pageAccessToken: string
  ): Promise<{ valid: boolean; permissions: string[]; missing: string[] }> {
    try {
      const response: Response = await fetch(
        `${GRAPH_API_BASE}/${pageId}?fields=tasks&access_token=${pageAccessToken}`
      )

      const data: any = await response.json()

      if (data.error) {
        return {
          valid: false,
          permissions: [],
          missing: ['pages_manage_posts', 'pages_read_engagement'],
        }
      }

      const requiredTasks = ['CREATE_CONTENT', 'MODERATE']
      const grantedTasks = data.tasks || []
      const missingTasks = requiredTasks.filter(task => !grantedTasks.includes(task))

      return {
        valid: missingTasks.length === 0,
        permissions: grantedTasks,
        missing: missingTasks,
      }
    } catch (error) {
      return {
        valid: false,
        permissions: [],
        missing: ['pages_manage_posts', 'pages_read_engagement'],
      }
    }
  }

  /**
   * Get Instagram Business Account connected to a Facebook Page
   *
   * IMPORTANT: This is Instagram Graph API (NOT Basic Display API)
   * - Requires Facebook Page to have Instagram Business Account linked
   * - Returns null if Page has no Instagram connected
   * - Requires instagram_basic + pages_show_list permissions
   *
   * @param pageId - Facebook Page ID
   * @param pageAccessToken - Page Access Token (NOT user token)
   * @returns Instagram Business Account info or null if not connected
   */
  static async getInstagramBusinessAccount(
    pageId: string,
    pageAccessToken: string
  ): Promise<{
    id: string
    username: string
    name?: string
    profilePictureUrl?: string
    followersCount?: number
    followsCount?: number
    mediaCount?: number
    biography?: string
    website?: string
  } | null> {
    try {
      console.log('[FacebookAPI] Checking if Page has Instagram Business Account...')
      console.log('[FacebookAPI] Page ID:', pageId)
      console.log('[FacebookAPI] Page Access Token (first 20 chars):', pageAccessToken.substring(0, 20) + '...')

      // Step 0: Check Page Access Token permissions
      console.log('[FacebookAPI] 🔍 Checking Page Access Token permissions...')
      const debugResponse: Response = await fetch(
        `${GRAPH_API_BASE}/debug_token?input_token=${pageAccessToken}&access_token=${pageAccessToken}`
      )
      const debugData: any = await debugResponse.json()

      // Log token info in single lines for easier debugging
      if (debugData.data) {
        console.log('[FacebookAPI] 🔍 Token Type:', debugData.data.type)
        console.log('[FacebookAPI] 🔍 Token App ID:', debugData.data.app_id)
        console.log('[FacebookAPI] 🔍 Token Valid:', debugData.data.is_valid)
        console.log('[FacebookAPI] 🔍 Token Scopes:', JSON.stringify(debugData.data.scopes || []))
        console.log('[FacebookAPI] 🔍 Token Granular Scopes:', JSON.stringify(debugData.data.granular_scopes || []))
      } else if (debugData.error) {
        console.log('[FacebookAPI] ❌ Token Debug Error:', debugData.error.message)
      }

      // Step 1: Check if Page has Instagram Business Account linked
      const pageResponse: Response = await fetch(
        `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
      )

      const pageData: any = await pageResponse.json()

      // DEBUG: Log the full response
      console.log('[FacebookAPI] 🔍 Page API Response:', JSON.stringify(pageData, null, 2))
      console.log('[FacebookAPI] 🔍 Has instagram_business_account field?', !!pageData.instagram_business_account)
      console.log('[FacebookAPI] 🔍 Response status:', pageResponse.status)

      if (pageData.error) {
        console.error('[FacebookAPI] Error fetching Page data:', pageData.error)
        return null
      }

      if (!pageData.instagram_business_account) {
        console.log('[FacebookAPI] Page does not have Instagram Business Account linked')
        console.log('[FacebookAPI] Available fields in response:', Object.keys(pageData))
        return null
      }

      const igAccountId = pageData.instagram_business_account.id
      console.log('[FacebookAPI] Found Instagram Business Account:', igAccountId)

      // Step 2: Get Instagram Business Account details
      const igResponse: Response = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}?` +
        `fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website&` +
        `access_token=${pageAccessToken}`
      )

      const igData: any = await igResponse.json()

      if (igData.error) {
        console.error('[FacebookAPI] Error fetching Instagram data:', igData.error)
        throw new Error(igData.error.message)
      }

      console.log('[FacebookAPI] ✅ Instagram Business Account retrieved:', {
        id: igData.id,
        username: igData.username,
        followersCount: igData.followers_count
      })

      return {
        id: igData.id,
        username: igData.username,
        name: igData.name,
        profilePictureUrl: igData.profile_picture_url,
        followersCount: igData.followers_count,
        followsCount: igData.follows_count,
        mediaCount: igData.media_count,
        biography: igData.biography,
        website: igData.website,
      }
    } catch (error) {
      console.error('[FacebookAPI] Exception getting Instagram Business Account:', error)
      throw new Error(
        `Failed to fetch Instagram Business Account: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get Facebook Page statistics and information
   *
   * Similar to InstagramAPI.getAccountInfo(), this fetches public page data
   * including follower count, about info, and profile picture
   *
   * @param pageId - Facebook Page ID
   * @param pageAccessToken - Page Access Token
   * @returns Page statistics and info
   */
  static async getPageInfo(
    pageId: string,
    pageAccessToken: string
  ): Promise<FacebookPageStats> {
    try {
      console.log('[FacebookAPI] Fetching Page info and stats...')

      const response: Response = await fetch(
        `${GRAPH_API_BASE}/${pageId}?` +
        `fields=id,name,fan_count,about,category,picture{url},cover{source},link&` +
        `access_token=${pageAccessToken}`
      )

      const data: any = await response.json()

      if (data.error) {
        console.error('[FacebookAPI] ❌ API Error:', data.error)
        throw new Error(data.error.message || 'Failed to fetch Page info')
      }

      console.log('[FacebookAPI] ✅ Page info retrieved:', {
        id: data.id,
        name: data.name,
        fanCount: data.fan_count
      })

      return {
        id: data.id,
        name: data.name,
        fanCount: data.fan_count || 0,
        about: data.about,
        category: data.category,
        profilePictureUrl: data.picture?.url,
        coverPhotoUrl: data.cover?.source,
        link: data.link,
      }
    } catch (error) {
      console.error('[FacebookAPI] ❌ Exception while fetching Page info:', error)
      throw new Error(
        `Failed to fetch Facebook Page info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Publish a carousel post (multiple images) to Facebook Page
   *
   * Facebook carousel publishing is a 2-step process:
   * 1. Upload each photo as unpublished
   * 2. Create post with attached_media array
   */
  static async publishCarouselPost(options: FacebookPublishOptions): Promise<FacebookPublishResult> {
    const { pageId, pageAccessToken, message, imageUrls } = options

    // Validation
    if (!imageUrls || imageUrls.length < 2) {
      return {
        success: false,
        error: 'Carousel requires at least 2 images',
      }
    }

    try {
      console.log(`[FacebookAPI] Creating carousel with ${imageUrls.length} images...`)

      // Step 1: Upload each photo as unpublished
      const mediaFbIds: string[] = []
      const errors: { index: number; error: string }[] = []

      for (let i = 0; i < imageUrls.length; i++) {
        console.log(`[FacebookAPI] Uploading image ${i + 1}/${imageUrls.length}...`)

        const photoResult = await this.uploadUnpublishedPhoto(
          pageId,
          pageAccessToken,
          imageUrls[i],
          message // ✅ Pass caption to each image for better reach and UX
        )

        if (photoResult.success && photoResult.mediaFbId) {
          mediaFbIds.push(photoResult.mediaFbId)
          console.log(`[FacebookAPI] ✅ Image ${i + 1} uploaded: ${photoResult.mediaFbId}`)
        } else {
          console.error(`[FacebookAPI] ❌ Failed to upload image ${i + 1}: ${photoResult.error}`)
          errors.push({ index: i + 1, error: photoResult.error || 'Unknown error' })
        }
      }

      if (errors.length > 0) {
        const errorMessage = `Failed to upload images: ${errors.map(e => `#${e.index}: ${e.error}`).join(', ')}`
        console.error(`[FacebookAPI] ${errorMessage}`)
        return {
          success: false,
          error: errorMessage,
          errorDetails: errors,
        }
      }

      console.log(`[FacebookAPI] All ${mediaFbIds.length} images uploaded`)

      // Step 2: Create post with attached_media
      console.log('[FacebookAPI] Creating carousel post...')
      const attachedMedia = mediaFbIds.map(fbId => ({ media_fbid: fbId }))

      const response: Response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          attached_media: attachedMedia,
          access_token: pageAccessToken,
        }),
      })

      const data: any = await response.json()

      if (data.error) {
        console.error('[FacebookAPI] Carousel post creation failed:', data.error.message)
        return {
          success: false,
          error: data.error.message,
          errorDetails: data.error,
        }
      }

      console.log(`[FacebookAPI] ✅ Carousel published successfully: ${data.id}`)

      return {
        success: true,
        postId: data.id,
        postUrl: `https://www.facebook.com/${data.id}`,
      }
    } catch (error) {
      console.error('[FacebookAPI] Exception during carousel publish:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
      }
    }
  }

  /**
   * Upload a photo as unpublished (for carousel creation)
   * @private
   */
  private static async uploadUnpublishedPhoto(
    pageId: string,
    pageAccessToken: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; mediaFbId?: string; error?: string }> {
    try {
      const response: Response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: imageUrl,
          published: false,
          message: caption || '', // ✅ Add individual caption to each carousel image
          access_token: pageAccessToken,
        }),
      })

      const data: any = await response.json()

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, mediaFbId: data.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
