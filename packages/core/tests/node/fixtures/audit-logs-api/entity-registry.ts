/** The registry of the audit-logs API test: social-media-publisher's real audit-logs entity config, as a plugin entity. */
import { auditLogsEntityConfig as config } from '../../../../../../plugins/social-media-publisher/entities/audit-logs/audit-logs.config'

export const ENTITY_REGISTRY: Record<string, any> = {
  'audit-logs': { name: 'audit-logs', config, tableName: config.tableName, parent: null, children: [], depth: 0, source: 'plugin' },
}

export const ENTITY_METADATA = { totalEntities: 1, maxDepth: 0, generatedAt: '2026-11-12T00:00:00.000Z' }
