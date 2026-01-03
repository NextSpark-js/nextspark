/**
 * Webhook Scheduled Action Handler - Multi-Endpoint Support
 *
 * This handler supports multiple webhook endpoints configured in app.config.ts.
 * Each endpoint can be:
 * 1. Explicitly called by key (webhookKey in payload)
 * 2. Auto-matched by event pattern (e.g., 'task:created' -> 'tasks' endpoint)
 * 3. Fallback to default endpoint
 * 4. Legacy single webhookUrl support for backward compatibility
 *
 * @module contents/themes/default/lib/scheduled-actions/webhook
 */

import { registerScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions'
import type { ScheduledAction } from '@nextsparkjs/core/lib/scheduled-actions'
import { APP_CONFIG_OVERRIDES } from '@/themes/default/config/app.config'
import type { WebhookEndpointConfig } from '@nextsparkjs/core/lib/config/types'

/**
 * Webhook payload interface with optional explicit key
 */
interface WebhookPayload {
  /** Event type (e.g., 'created', 'updated', 'deleted', 'renewed') */
  eventType: string
  /** Entity type (e.g., 'task', 'subscription') */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Full entity data */
  data: unknown
  /** Team ID context */
  teamId?: string
  /** Explicit webhook endpoint key (overrides pattern matching) */
  webhookKey?: string
}

/**
 * Resolved webhook endpoint
 */
interface ResolvedWebhook {
  url: string
  key: string
}

/**
 * Get typed scheduledActions config from APP_CONFIG_OVERRIDES
 */
function getScheduledActionsConfig() {
  return APP_CONFIG_OVERRIDES.scheduledActions as {
    webhookUrl?: string
    webhooks?: {
      endpoints: Record<string, WebhookEndpointConfig>
      defaultEndpoint?: string
    }
  } | undefined
}

/**
 * Resolve webhook URL based on payload
 *
 * Resolution priority:
 * 1. Explicit webhookKey in payload
 * 2. Pattern matching based on entityType:eventType
 * 3. Default endpoint
 * 4. Legacy webhookUrl (backward compatibility)
 *
 * @param payload - Webhook payload with event info
 * @returns Resolved webhook with URL and key, or null if no match
 */
function resolveWebhookUrl(payload: WebhookPayload): ResolvedWebhook | null {
  const config = getScheduledActionsConfig()
  const webhooksConfig = config?.webhooks
  const legacyUrl = config?.webhookUrl

  // 1. Explicit webhook key provided
  if (payload.webhookKey && webhooksConfig?.endpoints[payload.webhookKey]) {
    const endpoint = webhooksConfig.endpoints[payload.webhookKey]
    if (endpoint.enabled !== false) {
      const url = process.env[endpoint.envVar]
      if (url) {
        return { url, key: payload.webhookKey }
      }
      console.warn(`[webhook:send] Endpoint '${payload.webhookKey}' envVar '${endpoint.envVar}' not set`)
    }
  }

  // 2. Pattern matching
  if (webhooksConfig?.endpoints) {
    const eventPattern = `${payload.entityType}:${payload.eventType}`

    for (const [key, endpoint] of Object.entries(webhooksConfig.endpoints)) {
      if (endpoint.enabled === false) continue
      if (!endpoint.patterns) continue

      for (const pattern of endpoint.patterns) {
        if (matchesPattern(eventPattern, pattern)) {
          const url = process.env[endpoint.envVar]
          if (url) {
            return { url, key }
          }
        }
      }
    }
  }

  // 3. Default endpoint
  if (webhooksConfig?.defaultEndpoint && webhooksConfig.endpoints[webhooksConfig.defaultEndpoint]) {
    const endpoint = webhooksConfig.endpoints[webhooksConfig.defaultEndpoint]
    if (endpoint.enabled !== false) {
      const url = process.env[endpoint.envVar]
      if (url) {
        return { url, key: webhooksConfig.defaultEndpoint }
      }
    }
  }

  // 4. Legacy webhookUrl (backward compatibility)
  if (legacyUrl) {
    return { url: legacyUrl, key: 'legacy' }
  }

  return null
}

/**
 * Pattern matching for event routing
 *
 * Supports wildcard patterns:
 * - 'task:*' matches 'task:created', 'task:updated', etc.
 * - '*:created' matches 'task:created', 'subscription:created', etc.
 * - '*:*' matches all events
 *
 * @param event - Actual event (e.g., 'task:created')
 * @param pattern - Pattern to match (e.g., 'task:*')
 * @returns True if pattern matches event
 */
function matchesPattern(event: string, pattern: string): boolean {
  const [eventEntity, eventAction] = event.split(':')
  const [patternEntity, patternAction] = pattern.split(':')

  const entityMatch = patternEntity === '*' || patternEntity === eventEntity
  const actionMatch = patternAction === '*' || patternAction === eventAction

  return entityMatch && actionMatch
}

/**
 * Register the webhook action handler
 *
 * This function registers the 'webhook:send' action handler that sends POST
 * requests to configured webhook endpoints.
 *
 * @example
 * // Register at app startup
 * registerWebhookAction()
 *
 * // Schedule a webhook with explicit key
 * await scheduleAction('webhook:send', {
 *   eventType: 'created',
 *   entityType: 'task',
 *   entityId: task.id,
 *   data: task,
 *   webhookKey: 'tasks', // Explicit routing
 * })
 *
 * // Schedule a webhook with auto-matching
 * await scheduleAction('webhook:send', {
 *   eventType: 'created',
 *   entityType: 'subscription',
 *   entityId: sub.id,
 *   data: sub,
 *   // Will auto-match to 'subscriptions' endpoint via pattern
 * })
 */
export function registerWebhookAction() {
  registerScheduledAction(
    'webhook:send',
    async (payload: unknown, action: ScheduledAction) => {
      const webhookPayload = payload as WebhookPayload

      // Validate required fields
      if (!webhookPayload.eventType || !webhookPayload.entityType || !webhookPayload.entityId) {
        throw new Error('Invalid webhook payload: missing required fields (eventType, entityType, entityId)')
      }

      // Resolve webhook URL
      const resolved = resolveWebhookUrl(webhookPayload)

      if (!resolved) {
        // No URL configured - skip silently (not an error, just not configured)
        console.log(`[webhook:send] No webhook URL configured for ${webhookPayload.entityType}:${webhookPayload.eventType}, skipping`)
        return
      }

      console.log(`[webhook:send] Sending to '${resolved.key}' for ${webhookPayload.entityType}:${webhookPayload.eventType}`)

      // Send webhook POST request
      const response = await fetch(resolved.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NextSpark-Webhook/1.0',
          'X-Webhook-Key': resolved.key,
        },
        body: JSON.stringify({
          event: webhookPayload.eventType,
          entity: webhookPayload.entityType,
          entityId: webhookPayload.entityId,
          data: webhookPayload.data,
          teamId: webhookPayload.teamId,
          timestamp: new Date().toISOString(),
          actionId: action.id,
        }),
      })

      // Check if webhook was successful
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Webhook '${resolved.key}' failed with status ${response.status}: ${errorText.substring(0, 200)}`
        )
      }

      console.log(`[webhook:send] Webhook '${resolved.key}' sent successfully (status: ${response.status})`)
    },
    {
      description: 'Send webhook notification to configured endpoint',
      timeout: 15000, // 15 seconds timeout for webhooks
    }
  )
}
