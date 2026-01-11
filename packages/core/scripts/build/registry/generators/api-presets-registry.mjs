/**
 * API Presets Registry Generator
 *
 * Generates:
 * - api-presets-registry.ts - Presets organized by endpoint
 * - api-docs-registry.ts - Documentation paths by endpoint
 *
 * @module core/scripts/build/registry/generators/api-presets-registry
 */

import { join } from 'path'
import { convertCorePath } from '../config.mjs'

/**
 * Escape string for use in TypeScript string literal
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

/**
 * Generate TypeScript representation of a preset object
 * @param {Object} preset - Preset object
 * @param {string} indent - Indentation string
 * @returns {string} TypeScript code
 */
function generatePresetCode(preset, indent = '      ') {
  const lines = [`${indent}{`]

  // Required fields
  lines.push(`${indent}  id: '${escapeString(preset.id)}',`)
  lines.push(`${indent}  title: '${escapeString(preset.title)}',`)
  lines.push(`${indent}  method: '${preset.method}',`)

  // Optional description
  if (preset.description) {
    lines.push(`${indent}  description: '${escapeString(preset.description)}',`)
  }

  // Optional pathParams
  if (preset.pathParams && Object.keys(preset.pathParams).length > 0) {
    lines.push(`${indent}  pathParams: ${JSON.stringify(preset.pathParams)},`)
  }

  // Optional params
  if (preset.params && Object.keys(preset.params).length > 0) {
    lines.push(`${indent}  params: ${JSON.stringify(preset.params)},`)
  }

  // Optional headers
  if (preset.headers && Object.keys(preset.headers).length > 0) {
    lines.push(`${indent}  headers: ${JSON.stringify(preset.headers)},`)
  }

  // Optional payload
  if (preset.payload && Object.keys(preset.payload).length > 0) {
    const payloadStr = JSON.stringify(preset.payload, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? line : `${indent}  ${line}`)
      .join('\n')
    lines.push(`${indent}  payload: ${payloadStr},`)
  }

  // Optional sessionConfig
  if (preset.sessionConfig && Object.keys(preset.sessionConfig).length > 0) {
    lines.push(`${indent}  sessionConfig: ${JSON.stringify(preset.sessionConfig)},`)
  }

  // Optional tags
  if (preset.tags && preset.tags.length > 0) {
    lines.push(`${indent}  tags: [${preset.tags.map(t => `'${escapeString(t)}'`).join(', ')}],`)
  }

  lines.push(`${indent}}`)
  return lines.join('\n')
}

/**
 * Generate the API presets registry file
 *
 * @param {{presets: Array, docs: Array}} data - Discovery data
 * @param {object} config - Configuration object
 * @returns {string} Generated TypeScript content
 */
export function generateApiPresetsRegistry(data, config) {
  const { presets } = data
  const outputFilePath = join(config.outputDir, 'api-presets-registry.ts')
  const themeName = config.activeTheme || 'unknown'

  // Calculate totals
  const totalPresets = presets.reduce((sum, p) => sum + (p.presets?.length || 0), 0)

  // Type import path
  const typesImportPath = convertCorePath('@/core/types/api-presets', outputFilePath, config)

  if (presets.length === 0) {
    return `/**
 * Auto-generated API Presets Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Total endpoints: 0
 * Total presets: 0
 *
 * To add presets, create files in:
 * contents/themes/${themeName}/devtools/api/*.presets.ts
 *
 * DO NOT EDIT - This file is auto-generated
 */

import type { ApiPresetsRegistryStructure, ApiEndpointPresets, ApiPreset } from '${typesImportPath}'

// Re-export types
export type { ApiPresetsRegistryStructure, ApiEndpointPresets, ApiPreset }

export const API_PRESETS_REGISTRY: ApiPresetsRegistryStructure = {
  endpoints: {},
  meta: {
    totalEndpoints: 0,
    totalPresets: 0,
    generatedAt: '${new Date().toISOString()}',
    themeName: '${themeName}'
  }
}

/**
 * Get presets for a specific endpoint
 */
export function getPresetsForEndpoint(endpoint: string): ApiEndpointPresets | undefined {
  return API_PRESETS_REGISTRY.endpoints[endpoint]
}

/**
 * Get presets filtered by endpoint and method
 */
export function getPresetsByMethod(endpoint: string, method: string): ApiPreset[] {
  const config = API_PRESETS_REGISTRY.endpoints[endpoint]
  if (!config) return []
  return config.presets.filter(p => p.method === method)
}

/**
 * Get all endpoint presets
 */
export function getAllPresets(): ApiEndpointPresets[] {
  return Object.values(API_PRESETS_REGISTRY.endpoints)
}

/**
 * Check if endpoint has presets
 */
export function hasPresets(endpoint: string): boolean {
  return !!API_PRESETS_REGISTRY.endpoints[endpoint]
}
`
  }

  // Build endpoints code
  const endpointsCode = presets.map(endpointConfig => {
    const presetsCode = (endpointConfig.presets || [])
      .map(preset => generatePresetCode(preset))
      .join(',\n')

    const source = endpointConfig.source || 'unknown'
    return `  '${endpointConfig.endpoint}': {
    endpoint: '${endpointConfig.endpoint}',
    summary: '${escapeString(endpointConfig.summary || '')}',
    sourcePath: '${endpointConfig.sourcePath}',
    source: '${source}',
    presets: [
${presetsCode}
    ]
  }`
  }).join(',\n')

  return `/**
 * Auto-generated API Presets Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Total endpoints: ${presets.length}
 * Total presets: ${totalPresets}
 *
 * DO NOT EDIT - This file is auto-generated
 */

import type { ApiPresetsRegistryStructure, ApiEndpointPresets, ApiPreset } from '${typesImportPath}'

// Re-export types
export type { ApiPresetsRegistryStructure, ApiEndpointPresets, ApiPreset }

export const API_PRESETS_REGISTRY: ApiPresetsRegistryStructure = {
  endpoints: {
${endpointsCode}
  },
  meta: {
    totalEndpoints: ${presets.length},
    totalPresets: ${totalPresets},
    generatedAt: '${new Date().toISOString()}',
    themeName: '${themeName}'
  }
}

/**
 * Get presets for a specific endpoint
 * Supports exact match and glob pattern matching
 */
export function getPresetsForEndpoint(endpoint: string): ApiEndpointPresets | undefined {
  // Try exact match first
  if (API_PRESETS_REGISTRY.endpoints[endpoint]) {
    return API_PRESETS_REGISTRY.endpoints[endpoint]
  }

  // Try glob pattern matching
  for (const [pattern, config] of Object.entries(API_PRESETS_REGISTRY.endpoints)) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\\*/g, '.*') + '$')
      if (regex.test(endpoint)) {
        return config
      }
    }
  }

  return undefined
}

/**
 * Get presets filtered by endpoint and method
 */
export function getPresetsByMethod(endpoint: string, method: string): ApiPreset[] {
  const config = getPresetsForEndpoint(endpoint)
  if (!config) return []
  return config.presets.filter(p => p.method === method)
}

/**
 * Get all endpoint presets
 */
export function getAllPresets(): ApiEndpointPresets[] {
  return Object.values(API_PRESETS_REGISTRY.endpoints)
}

/**
 * Check if endpoint has presets
 */
export function hasPresets(endpoint: string): boolean {
  return !!getPresetsForEndpoint(endpoint)
}
`
}

/**
 * Generate the API docs registry file
 *
 * @param {{presets: Array, docs: Array}} data - Discovery data
 * @param {object} config - Configuration object
 * @returns {string} Generated TypeScript content
 */
export function generateApiDocsRegistry(data, config) {
  const { docs } = data
  const outputFilePath = join(config.outputDir, 'api-docs-registry.ts')
  const themeName = config.activeTheme || 'unknown'

  // Type import path
  const typesImportPath = convertCorePath('@/core/types/api-presets', outputFilePath, config)

  if (docs.length === 0) {
    return `/**
 * Auto-generated API Docs Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Total docs: 0
 *
 * To add documentation, create files in:
 * contents/themes/${themeName}/devtools/api/*.md
 *
 * DO NOT EDIT - This file is auto-generated
 */

import type { ApiDocsRegistryStructure, ApiDocEntry } from '${typesImportPath}'

// Re-export types
export type { ApiDocsRegistryStructure, ApiDocEntry }

export const API_DOCS_REGISTRY: ApiDocsRegistryStructure = {
  docs: {},
  meta: {
    totalDocs: 0,
    generatedAt: '${new Date().toISOString()}',
    themeName: '${themeName}'
  }
}

/**
 * Get doc entry for a specific endpoint
 */
export function getDocForEndpoint(endpoint: string): ApiDocEntry | undefined {
  return API_DOCS_REGISTRY.docs[endpoint]
}

/**
 * Check if endpoint has documentation
 */
export function hasDoc(endpoint: string): boolean {
  return !!API_DOCS_REGISTRY.docs[endpoint]
}

/**
 * Get all documented endpoints
 */
export function getAllDocEndpoints(): string[] {
  return Object.keys(API_DOCS_REGISTRY.docs)
}
`
  }

  // Build docs code - use endpoint from discovery
  const docsCode = docs.map(doc => {
    const endpoint = doc.endpoint
    const source = doc.source || 'unknown'
    return `  '${endpoint}': {
    path: '${doc.filePath}',
    title: '${escapeString(doc.title)}',
    endpoint: '${endpoint}',
    source: '${source}'
  }`
  }).join(',\n')

  return `/**
 * Auto-generated API Docs Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Theme: ${themeName}
 * Total docs: ${docs.length}
 *
 * DO NOT EDIT - This file is auto-generated
 */

import type { ApiDocsRegistryStructure, ApiDocEntry } from '${typesImportPath}'

// Re-export types
export type { ApiDocsRegistryStructure, ApiDocEntry }

export const API_DOCS_REGISTRY: ApiDocsRegistryStructure = {
  docs: {
${docsCode}
  },
  meta: {
    totalDocs: ${docs.length},
    generatedAt: '${new Date().toISOString()}',
    themeName: '${themeName}'
  }
}

/**
 * Get doc entry for a specific endpoint
 * Also tries to match base endpoint for paths with parameters
 */
export function getDocForEndpoint(endpoint: string): ApiDocEntry | undefined {
  // Try exact match first
  if (API_DOCS_REGISTRY.docs[endpoint]) {
    return API_DOCS_REGISTRY.docs[endpoint]
  }

  // Try matching base endpoint (e.g., /api/v1/customers/123 -> /api/v1/customers)
  const baseEndpoint = endpoint.replace(/\\/[^/]+$/, '')
  if (API_DOCS_REGISTRY.docs[baseEndpoint]) {
    return API_DOCS_REGISTRY.docs[baseEndpoint]
  }

  return undefined
}

/**
 * Check if endpoint has documentation
 */
export function hasDoc(endpoint: string): boolean {
  return !!getDocForEndpoint(endpoint)
}

/**
 * Get all documented endpoints
 */
export function getAllDocEndpoints(): string[] {
  return Object.keys(API_DOCS_REGISTRY.docs)
}
`
}
