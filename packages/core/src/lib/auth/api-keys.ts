/**
 * API Key Authentication System
 * 
 * Handles API key validation, scopes, and permissions for external APIs.
 */

export interface APIKeyValidation {
  valid: boolean
  apiKeyId?: string
  clientId?: string
  userId?: string
  scopes?: string[]
  reason?: string
  metadata?: Record<string, unknown>
}

export interface APIKeyValidationOptions {
  requiredScopes?: string[]
  entityName?: string
  allowInactive?: boolean
}

interface APIKeyData {
  id: string
  clientId: string
  userId?: string
  scopes: string[]
  active: boolean
  name: string
  lastUsed?: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

// Mock API keys store - in production this would be a database
const mockAPIKeys: Record<string, APIKeyData> = {
  'test_key_12345': {
    id: 'api_key_1',
    clientId: 'client_123',
    userId: 'user_456',
    scopes: ['task:read', 'task:create', 'task:update', 'task:delete', 'user:read'],
    active: true,
    name: 'Development Key',
    lastUsed: new Date().toISOString(),
    metadata: {
      environment: 'development',
      rateLimit: 1000
    }
  },
  'prod_key_67890': {
    id: 'api_key_2',
    clientId: 'client_789',
    scopes: ['task:read', 'task:create', 'user:read'],
    active: true,
    name: 'Production Key',
    lastUsed: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    metadata: {
      environment: 'production',
      rateLimit: 10000
    }
  },
  'inactive_key': {
    id: 'api_key_3',
    clientId: 'client_inactive',
    scopes: ['task:read'],
    active: false,
    name: 'Inactive Key',
    metadata: {
      reason: 'Deactivated for security reasons'
    }
  }
}

/**
 * Validate API key and check permissions
 */
export async function validateAPIKey(
  apiKey: string,
  options: APIKeyValidationOptions = {}
): Promise<APIKeyValidation> {
  const {
    requiredScopes = [],
    entityName,
    allowInactive = false
  } = options

  // Basic format validation
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      valid: false,
      reason: 'API key is required'
    }
  }

  // Look up API key
  const keyData = mockAPIKeys[apiKey]
  if (!keyData) {
    return {
      valid: false,
      reason: 'Invalid API key'
    }
  }

  // Check if key is active
  if (!keyData.active && !allowInactive) {
    return {
      valid: false,
      reason: 'API key is inactive',
      apiKeyId: keyData.id,
      clientId: keyData.clientId
    }
  }

  // Check expiration
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return {
      valid: false,
      reason: 'API key has expired',
      apiKeyId: keyData.id,
      clientId: keyData.clientId
    }
  }

  // Check required scopes
  const hasRequiredScopes = requiredScopes.every(scope => 
    keyData.scopes.includes(scope) || 
    keyData.scopes.includes('*') ||
    (entityName && keyData.scopes.includes(`${entityName}:*`))
  )

  if (!hasRequiredScopes) {
    return {
      valid: false,
      reason: 'Insufficient permissions',
      apiKeyId: keyData.id,
      clientId: keyData.clientId,
      scopes: keyData.scopes
    }
  }

  // Update last used timestamp (in production this would be async)
  keyData.lastUsed = new Date().toISOString()

  return {
    valid: true,
    apiKeyId: keyData.id,
    clientId: keyData.clientId,
    userId: keyData.userId,
    scopes: keyData.scopes,
    metadata: keyData.metadata
  }
}

/**
 * Generate scope name for entity and action
 */
export function generateScope(entityName: string, action: 'read' | 'create' | 'update' | 'delete'): string {
  return `${entityName}:${action}`
}

/**
 * Check if API key has specific scope
 */
export function hasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope) || 
         scopes.includes('*') ||
         scopes.includes(requiredScope.split(':')[0] + ':*')
}

/**
 * Create API key (mock implementation)
 */
export async function createAPIKey(data: {
  clientId: string
  userId?: string
  scopes: string[]
  name: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}): Promise<{ apiKey: string; keyData: APIKeyData }> {
  const apiKey = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const keyData: APIKeyData = {
    id: `api_key_${Date.now()}`,
    active: true,
    lastUsed: new Date().toISOString(),
    ...data
  }
  
  mockAPIKeys[apiKey] = keyData
  
  return { apiKey, keyData }
}

/**
 * Revoke API key
 */
export async function revokeAPIKey(apiKey: string): Promise<boolean> {
  const keyData = mockAPIKeys[apiKey]
  if (!keyData) {
    return false
  }
  
  keyData.active = false
  return true
}

/**
 * List API keys for a client
 */
export async function listAPIKeys(clientId: string): Promise<APIKeyData[]> {
  return Object.values(mockAPIKeys).filter(key => key.clientId === clientId)
}

/**
 * Get API key analytics
 */
export async function getAPIKeyAnalytics(apiKey: string): Promise<{
  requests: number
  lastUsed?: string
  scopes: string[]
  active: boolean
} | null> {
  const keyData = mockAPIKeys[apiKey]
  if (!keyData) {
    return null
  }
  
  return {
    requests: 0, // In production, track actual request count
    lastUsed: keyData.lastUsed,
    scopes: keyData.scopes,
    active: keyData.active
  }
}