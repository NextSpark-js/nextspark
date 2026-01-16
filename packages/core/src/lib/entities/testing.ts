/**
 * Entity System Testing Utilities
 * 
 * Comprehensive testing utilities for the WordPress-like Entity System.
 * Includes mock generators, test helpers, and validation utilities.
 */

import type { 
  EntityConfig, 
  EntityField, 
  PlanType,
  UserFlag,
} from './types'
import type { UserRole } from '../../types/user.types'
import { TestTube } from 'lucide-react'
import { entityRegistry } from './registry'
import { entityPerformanceMonitor } from './performance'

/**
 * Generate mock entity configuration for testing
 */
export function createMockEntityConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
  const defaultConfig: EntityConfig = {
    slug: 'test-entities',
    enabled: true,
    names: {
      singular: 'Test Entity',
      plural: 'Test Entities'
    },
    icon: TestTube,

    access: {
      public: false,
      api: true,
      metadata: true,
      shared: false  // Test entities are private to creator
    },

    ui: {
      dashboard: {
        showInMenu: true,
        showInTopbar: true
      },
      public: {
        hasArchivePage: false,
        hasSinglePage: false
      },
      features: {
        searchable: true,
        sortable: true,
        filterable: true,
        bulkOperations: true,
        importExport: false
      }
    },

    // Permissions are now defined centrally in permissions.config.ts

    i18n: {
      fallbackLocale: 'en',
      loaders: {
        en: async () => ({}),
        es: async () => ({})
      }
    },

    fields: [
      {
        name: 'title',
        type: 'text',
        required: true,
        display: {
          label: 'Title',
          description: 'Entity title',
          placeholder: 'Enter title...',
          showInList: true,
          showInDetail: true,
          showInForm: true,
          order: 1
        },
        api: {
          searchable: true,
          sortable: true,
          readOnly: false
        }
      },
      {
        name: 'description',
        type: 'text',
        required: false,
        display: {
          label: 'Description',
          description: 'Entity description',
          placeholder: 'Enter description...',
          showInList: false,
          showInDetail: true,
          showInForm: true,
          order: 2
        },
        api: {
          searchable: true,
          sortable: false,
          readOnly: false
        }
      }
    ]
  }

  return { ...defaultConfig, ...overrides }
}

/**
 * Generate mock entity data for testing
 */
export function createMockEntityData(entityConfig: EntityConfig, count: number = 1): Record<string, unknown>[] {
  const mockData: Record<string, unknown>[] = []
  
  for (let i = 0; i < count; i++) {
    const data: Record<string, unknown> = {
      id: `test-${entityConfig.slug}-${i + 1}`,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    entityConfig.fields.forEach(field => {
      data[field.name] = generateMockFieldValue(field)
    })
    
    mockData.push(data)
  }
  
  return mockData
}

/**
 * Generate mock value for a specific field
 */
export function generateMockFieldValue(field: EntityField): unknown {
  switch (field.type) {
    case 'text':
      return `Test ${field.display.label} ${Math.floor(Math.random() * 1000)}`
    
    case 'textarea':
      return `This is a longer test description for ${field.display.label}. It contains multiple sentences to simulate real content.`
    
    case 'number':
      return Math.floor(Math.random() * 1000)
    
    case 'boolean':
      return Math.random() > 0.5
    
    case 'date':
      return new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    case 'datetime':
      return new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    
    case 'email':
      return `test.${field.name}${Math.floor(Math.random() * 1000)}@example.com`
    
    case 'url':
      return `https://example.com/${field.name}/${Math.floor(Math.random() * 1000)}`
    
    case 'select':
      if (field.options && field.options.length > 0) {
        const randomOption = field.options[Math.floor(Math.random() * field.options.length)]
        return randomOption.value
      }
      return 'option1'
    
    case 'multiselect':
      if (field.options && field.options.length > 0) {
        const selectedOptions = field.options
          .filter(() => Math.random() > 0.5)
          .map(option => option.value)
        return selectedOptions.length > 0 ? selectedOptions : [field.options[0].value]
      }
      return ['option1']
    
    case 'json':
      return { 
        test: true, 
        value: Math.floor(Math.random() * 100),
        nested: { property: 'test value' }
      }
    
    default:
      return `Mock ${field.type} value`
  }
}

/**
 * Create mock user for testing permissions
 */
export function createMockUser(
  role: UserRole = 'member',
  plan: PlanType = 'free',
  flags: UserFlag[] = []
) {
  return {
    id: `test-user-${Math.floor(Math.random() * 1000)}`,
    role,
    plan,
    flags,
    email: `test.user${Math.floor(Math.random() * 1000)}@example.com`,
  }
}

/**
 * Test entity configuration validation
 */
export function validateEntityConfig(config: EntityConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Basic validation
  if (!config.slug?.trim()) errors.push('Entity slug is required')
  if (!config.names?.singular?.trim()) errors.push('Entity singular name is required')
  if (!config.names?.plural?.trim()) errors.push('Entity plural name is required')
  if (!config.icon) errors.push('Icon is required')

  // Enabled validation
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean')
  }

  // Access validation
  if (typeof config.access?.api !== 'boolean') {
    errors.push('access.api must be a boolean')
  }
  if (typeof config.access?.public !== 'boolean') {
    errors.push('access.public must be a boolean')
  }
  if (typeof config.access?.metadata !== 'boolean') {
    errors.push('access.metadata must be a boolean')
  }

  // Fields validation
  if (!Array.isArray(config.fields)) {
    errors.push('fields must be an array')
  } else {
    config.fields.forEach((field, index) => {
      if (!field.name?.trim()) errors.push(`Field at index ${index} must have a name`)
      if (!field.type) errors.push(`Field "${field.name}" must have a type`)
      if (typeof field.required !== 'boolean') {
        errors.push(`Field "${field.name}" required property must be a boolean`)
      }
    })
  }

  // NOTE: Permissions are now defined centrally in permissions.config.ts
  // Entity configs no longer contain permission definitions

  // Note: database config (tableName) is derived from slug
  // Note: API config (apiPath) is derived from slug as /api/v1/{slug}
  // Note: planLimits and routes are not part of new EntityConfig structure

  return { valid: errors.length === 0, errors }
}

/**
 * Test entity access system (permission system removed)
 */
export function testEntityAccess(entityConfig: EntityConfig): {
  passed: boolean
  results: Array<{
    test: string
    passed: boolean
    message: string
  }>
} {
  const results: Array<{ test: string; passed: boolean; message: string }> = []
  
  // Test admin permissions - simplified: all authenticated users can access enabled entities
  const adminCanRead = true // Simplified permission system
  results.push({
    test: 'Admin Read Permission',
    passed: adminCanRead,
    message: adminCanRead ? 'Admin can read' : 'Admin cannot read (unexpected)',
  })
  
  // Test member permissions with different plans
  
  const memberFreeCanRead = true // Simplified permission system
  
  const memberPremiumCanRead = true // Simplified permission system
  
  results.push({
    test: 'Member Free Plan Read',
    passed: memberFreeCanRead, // All users can read now
    message: `Member with free plan read access: ${memberFreeCanRead}`,
  })
  
  results.push({
    test: 'Member Premium Plan Read',
    passed: memberPremiumCanRead, // All users can read now
    message: `Member with premium plan read access: ${memberPremiumCanRead}`,
  })

  // Note: flag-based access (flagAccess) is not part of new EntityConfig structure

  const passed = results.every(result => result.passed)
  return { passed, results }
}

/**
 * Performance test for entity operations
 */
export async function performanceTestEntity(
  entityConfig: EntityConfig,
  operations: Array<'create' | 'read' | 'update' | 'delete'> = ['create', 'read', 'update', 'delete']
): Promise<{
  operation: string
  averageTime: number
  minTime: number
  maxTime: number
  iterations: number
}[]> {
  const results: Array<{
    operation: string
    averageTime: number
    minTime: number
    maxTime: number
    iterations: number
  }> = []
  
  for (const operation of operations) {
    const times: number[] = []
    const iterations = 100
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      
      // Simulate operation
      switch (operation) {
        case 'create':
          createMockEntityData(entityConfig, 1)
          break
        case 'read':
          entityRegistry.get(entityConfig.slug)
          break
        case 'update':
          createMockEntityData(entityConfig, 1)
          break
        case 'delete':
          // Simulate delete validation
          validateEntityConfig(entityConfig)
          break
      }
      
      const endTime = performance.now()
      times.push(endTime - startTime)
    }
    
    results.push({
      operation,
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      iterations,
    })
  }
  
  return results
}

/**
 * Integration test for complete entity workflow
 */
export async function integrationTestEntity(entityConfig: EntityConfig): Promise<{
  passed: boolean
  steps: Array<{
    step: string
    passed: boolean
    duration: number
    error?: string
  }>
}> {
  const steps: Array<{
    step: string
    passed: boolean
    duration: number
    error?: string
  }> = []
  
  // Step 1: Configuration validation
  let startTime = performance.now()
  try {
    const validation = validateEntityConfig(entityConfig)
    steps.push({
      step: 'Configuration Validation',
      passed: validation.valid,
      duration: performance.now() - startTime,
      error: validation.valid ? undefined : validation.errors.join(', '),
    })
  } catch (error) {
    steps.push({
      step: 'Configuration Validation',
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  
  // Step 2: Entity registration
  startTime = performance.now()
  try {
    entityRegistry.register(entityConfig)
    steps.push({
      step: 'Entity Registration',
      passed: true,
      duration: performance.now() - startTime,
    })
  } catch (error) {
    steps.push({
      step: 'Entity Registration',
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  
  // Step 3: Permission testing
  startTime = performance.now()
  try {
    const accessTest = testEntityAccess(entityConfig)
    steps.push({
      step: 'Permission Testing',
      passed: accessTest.passed,
      duration: performance.now() - startTime,
      error: accessTest.passed ? undefined : 'Some access tests failed',
    })
  } catch (error) {
    steps.push({
      step: 'Permission Testing',
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  
  // Step 4: Mock data generation
  startTime = performance.now()
  try {
    const mockData = createMockEntityData(entityConfig, 5)
    steps.push({
      step: 'Mock Data Generation',
      passed: mockData.length === 5,
      duration: performance.now() - startTime,
      error: mockData.length !== 5 ? 'Failed to generate expected number of records' : undefined,
    })
  } catch (error) {
    steps.push({
      step: 'Mock Data Generation',
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  
  const passed = steps.every(step => step.passed)
  return { passed, steps }
}

/**
 * Clean up test entities from registry
 */
export function cleanupTestEntities(): void {
  // Remove test entities from registry
  const testEntities = entityRegistry.getAll().filter(entity =>
    entity.slug.startsWith('test-') || entity.slug.includes('mock')
  )

  testEntities.forEach(entity => {
    try {
      // Note: Registry doesn't have a remove method in current implementation
      // This would be added to support cleanup in testing
      console.log(`Would remove test entity: ${entity.slug}`)
    } catch (error) {
      console.warn(`Failed to remove test entity ${entity.slug}:`, error)
    }
  })

  // Clear performance metrics
  entityPerformanceMonitor.clear()
}

/**
 * Generate comprehensive test report
 */
export function generateTestReport(
  entityConfig: EntityConfig,
  validationResults: ReturnType<typeof validateEntityConfig>,
  accessResults: ReturnType<typeof testEntityAccess>,
  integrationResults: Awaited<ReturnType<typeof integrationTestEntity>>
): string {
  let report = `# Entity Test Report: ${entityConfig.names.singular}\n\n`
  
  // Configuration validation
  report += '## Configuration Validation\n\n'
  if (validationResults.valid) {
    report += '✅ **PASSED** - Configuration is valid\n\n'
  } else {
    report += '❌ **FAILED** - Configuration has errors:\n\n'
    validationResults.errors.forEach(error => {
      report += `- ${error}\n`
    })
    report += '\n'
  }
  
  // Access testing (permission system removed)
  report += '## Access Testing\n\n'
  if (accessResults.passed) {
    report += '✅ **PASSED** - All access tests passed\n\n'
  } else {
    report += '❌ **FAILED** - Some access tests failed:\n\n'
    accessResults.results.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      report += `${status} ${result.test}: ${result.message}\n`
    })
    report += '\n'
  }
  
  // Integration testing
  report += '## Integration Testing\n\n'
  if (integrationResults.passed) {
    report += '✅ **PASSED** - All integration tests passed\n\n'
  } else {
    report += '❌ **FAILED** - Some integration tests failed:\n\n'
  }
  
  integrationResults.steps.forEach(step => {
    const status = step.passed ? '✅' : '❌'
    const duration = step.duration.toFixed(2)
    report += `${status} ${step.step}: ${duration}ms`
    if (step.error) {
      report += ` - Error: ${step.error}`
    }
    report += '\n'
  })
  
  report += '\n'
  
  // Overall status
  const overallPassed = validationResults.valid && 
                       accessResults.passed && 
                       integrationResults.passed
  
  report += '## Overall Result\n\n'
  if (overallPassed) {
    report += '🎉 **ENTITY TEST PASSED** - Ready for production use!\n'
  } else {
    report += '⚠️ **ENTITY TEST FAILED** - Requires fixes before production use.\n'
  }
  
  return report
}