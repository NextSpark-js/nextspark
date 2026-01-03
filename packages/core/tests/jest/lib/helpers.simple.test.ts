/**
 * Simplified helpers tests
 * Testing basic imports and function definitions
 */

describe('Entity Meta Helpers - Basic Tests', () => {
  test('should import helper functions correctly', () => {
    const helpers = require('@/core/lib/helpers/entity-meta.helpers');
    
    expect(helpers.validateBasicMetas).toBeDefined();
    expect(typeof helpers.validateBasicMetas).toBe('function');
    
    expect(helpers.copyEntityMetas).toBeDefined();
    expect(typeof helpers.copyEntityMetas).toBe('function');
    
    expect(helpers.withMeta).toBeDefined();
    expect(typeof helpers.withMeta).toBe('function');
  });

  test('should have correct function signatures', () => {
    const { validateBasicMetas, copyEntityMetas, withMeta } = require('@/core/lib/helpers/entity-meta.helpers');
    
    // validateBasicMetas es función sync
    expect(typeof validateBasicMetas).toBe('function');
    
    // Verificar que las funciones async son async
    expect(copyEntityMetas.constructor.name).toBe('AsyncFunction');
    expect(withMeta.constructor.name).toBe('AsyncFunction');
  });

  test('should validate metadata types structure', () => {
    const types = require('@/core/types/meta.types');

    // Verificar que tenemos los tipos básicos
    expect(types.CORE_ENTITY_CONFIGS).toBeDefined();
    expect(typeof types.CORE_ENTITY_CONFIGS).toBe('object');

    // Verificar configuración de user
    const userConfig = types.CORE_ENTITY_CONFIGS.user;
    expect(userConfig).toBeDefined();
    expect(userConfig.entityType).toBe('user');
    expect(userConfig.metaTableName).toBe('users_metas');
    expect(userConfig.idColumn).toBe('userId');
    expect(userConfig.apiPath).toBe('users');

    // Test dynamic entity config generation
    // Dynamic entities use 'entityId' (not entity-specific like 'taskId')
    // This is intentional - all theme entity metas tables use generic 'entityId' column
    const taskConfig = types.getEntityMetaConfig('task');
    expect(taskConfig).toBeDefined();
    expect(taskConfig.entityType).toBe('task');
    expect(taskConfig.metaTableName).toBe('task_metas');
    expect(taskConfig.idColumn).toBe('entityId');  // Dynamic entities use generic 'entityId'
    expect(taskConfig.apiPath).toBe('tasks');
  });
});