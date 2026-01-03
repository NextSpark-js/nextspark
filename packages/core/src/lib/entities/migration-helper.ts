/**
 * Migration Helper System
 * 
 * Automatically generates database migrations, RLS policies, and optimized indexes
 * from entity configurations including child entities and relationships.
 */

import type { EntityConfig, EntityField, ChildEntityDefinition } from './types'

export interface MigrationOptions {
  includeRLS?: boolean
  includeIndexes?: boolean
  includeChildEntities?: boolean
  includeConstraints?: boolean
  includeComments?: boolean
  softDelete?: boolean
  timestamps?: boolean
}

export interface GeneratedMigration {
  up: string
  down: string
  filename: string
  description: string
  dependencies?: string[]
}

export interface TableDefinition {
  tableName: string
  columns: ColumnDefinition[]
  indexes: IndexDefinition[]
  constraints: ConstraintDefinition[]
  rlsPolicies: RLSPolicyDefinition[]
}

export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  primaryKey?: boolean
  unique?: boolean
  comment?: string
}

export interface IndexDefinition {
  name: string
  columns: string[]
  unique?: boolean
  partial?: string
  method?: 'btree' | 'gin' | 'gist' | 'hash'
  comment?: string
}

export interface ConstraintDefinition {
  name: string
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK'
  definition: string
  comment?: string
}

export interface RLSPolicyDefinition {
  name: string
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
  role?: string
  using?: string
  withCheck?: string
  comment?: string
}

/**
 * Generate complete migration for an entity
 */
export function generateEntityMigration(
  entityConfig: EntityConfig,
  options: MigrationOptions = {}
): GeneratedMigration {
  const {
    includeRLS = true,
    includeIndexes = true,
    includeChildEntities = true,
    includeConstraints = true,
    includeComments = true,
    softDelete = false, // Default to hard delete unless specified
    timestamps = true   // Default to including timestamps (created_at, updated_at)
  } = options

  const tableDef = generateTableDefinition(entityConfig, {
    softDelete,
    timestamps,
    includeIndexes,
    includeConstraints,
    includeRLS,
    includeComments
  })

  let upSQL = generateCreateTableSQL(tableDef)
  let downSQL = generateDropTableSQL(tableDef.tableName)

  // Add child entities
  if (includeChildEntities && entityConfig.childEntities) {
    const childMigrations = generateChildEntityMigrations(entityConfig, options)
    
    childMigrations.forEach(childMigration => {
      upSQL += '\n\n' + childMigration.up
      downSQL = childMigration.down + '\n\n' + downSQL // Reverse order for down
    })
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const filename = `${timestamp}_create_${entityConfig.slug}_entity.sql`

  return {
    up: upSQL,
    down: downSQL,
    filename,
    description: `Create ${entityConfig.names.singular} entity with related tables and policies`,
    dependencies: []
  }
}

/**
 * Generate table definition from entity config
 */
function generateTableDefinition(
  entityConfig: EntityConfig,
  options: {
    softDelete: boolean
    timestamps: boolean
    includeIndexes: boolean
    includeConstraints: boolean
    includeRLS: boolean
    includeComments: boolean
  }
): TableDefinition {
  // Derive database config from slug (as per EntityConfig design)
  const tableName = entityConfig.slug
  const primaryKey = 'id' // Standard primary key name

  // Generate columns
  const columns: ColumnDefinition[] = []

  // Primary key column
  columns.push({
    name: primaryKey,
    type: 'UUID',
    nullable: false,
    primaryKey: true,
    defaultValue: 'gen_random_uuid()',
    comment: options.includeComments ? `Primary key for ${entityConfig.names.singular}` : undefined
  })

  // Entity fields
  entityConfig.fields.forEach(field => {
    if (field.name !== primaryKey) {
      const column = generateColumnFromField(field, options.includeComments)
      columns.push(column)
    }
  })

  // Timestamp columns
  if (options.timestamps) {
    columns.push({
      name: 'created_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP',
      comment: options.includeComments ? 'When the record was created' : undefined
    })

    columns.push({
      name: 'updated_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP',
      comment: options.includeComments ? 'When the record was last updated' : undefined
    })
  }

  // Soft delete column
  if (options.softDelete) {
    columns.push({
      name: 'deleted_at',
      type: 'TIMESTAMPTZ',
      nullable: true,
      comment: options.includeComments ? 'When the record was deleted (NULL if not deleted)' : undefined
    })

    columns.push({
      name: 'deleted_by',
      type: 'UUID',
      nullable: true,
      comment: options.includeComments ? 'User who deleted the record' : undefined
    })
  }

  // User tracking columns
  const hasUserField = entityConfig.fields.some(f => f.name === 'userId' || f.name === 'user_id')
  if (hasUserField && !columns.some(c => c.name === 'user_id')) {
    columns.push({
      name: 'user_id',
      type: 'UUID',
      nullable: false,
      comment: options.includeComments ? 'User who owns this record' : undefined
    })
  }

  // Generate indexes
  const indexes: IndexDefinition[] = []
  if (options.includeIndexes) {
    indexes.push(...generateIndexes(entityConfig, tableName, options.includeComments, options.softDelete))
  }

  // Generate constraints
  const constraints: ConstraintDefinition[] = []
  if (options.includeConstraints) {
    constraints.push(...generateConstraints(entityConfig, tableName, hasUserField, primaryKey))
  }

  // Generate RLS policies
  const rlsPolicies: RLSPolicyDefinition[] = []
  if (options.includeRLS) {
    rlsPolicies.push(...generateRLSPolicies(entityConfig, tableName, options.includeComments))
  }

  return {
    tableName,
    columns,
    indexes,
    constraints,
    rlsPolicies
  }
}

/**
 * Generate column definition from entity field
 */
function generateColumnFromField(field: EntityField, includeComments: boolean): ColumnDefinition {
  let sqlType: string
  let defaultValue: string | undefined

  switch (field.type) {
    case 'text':
      // Default to VARCHAR(255) for text fields
      sqlType = 'VARCHAR(255)'
      break
    case 'textarea':
      sqlType = 'TEXT'
      break
    case 'email':
      sqlType = 'VARCHAR(255)'
      break
    case 'url':
      sqlType = 'TEXT'
      break
    case 'number':
      // Default to DECIMAL for number fields  
      sqlType = 'DECIMAL'
      break
    case 'boolean':
      sqlType = 'BOOLEAN'
      if (field.defaultValue !== undefined) {
        defaultValue = field.defaultValue ? 'TRUE' : 'FALSE'
      }
      break
    case 'date':
      sqlType = 'DATE'
      break
    case 'datetime':
      sqlType = 'TIMESTAMPTZ'
      break
    case 'select':
      if (field.options && field.options.length > 0) {
        const enumValues = field.options.map(opt => `'${opt.value}'`).join(', ')
        sqlType = `VARCHAR(100) CHECK (${field.name} IN (${enumValues}))`
      } else {
        sqlType = 'VARCHAR(100)'
      }
      break
    case 'multiselect':
      sqlType = 'TEXT[]'
      break
    case 'json':
      sqlType = 'JSONB'
      break
    default:
      sqlType = 'TEXT'
  }

  return {
    name: field.name,
    type: sqlType,
    nullable: !field.required,
    defaultValue,
    unique: false, // Default to false for unique constraint
    comment: includeComments ? field.display.description || field.display.label : undefined
  }
}

/**
 * Generate indexes for entity table
 */
function generateIndexes(
  entityConfig: EntityConfig,
  tableName: string,
  includeComments: boolean,
  softDelete: boolean
): IndexDefinition[] {
  const indexes: IndexDefinition[] = []

  // Auto-generate indexes for commonly queried fields
  entityConfig.fields.forEach(field => {
    // Index searchable fields
    if (field.api.searchable && (field.type === 'text' || field.type === 'textarea')) {
      indexes.push({
        name: `idx_${tableName}_${field.name}_search`,
        columns: [field.name],
        method: 'gin',
        comment: includeComments ? `GIN index for text search on ${field.name}` : undefined
      })
    }

    // Index sortable fields
    if (field.api.sortable && !indexes.some(idx => idx.columns.includes(field.name))) {
      indexes.push({
        name: `idx_${tableName}_${field.name}`,
        columns: [field.name],
        comment: includeComments ? `Index for sorting on ${field.name}` : undefined
      })
    }

    // Index foreign key fields
    if (field.name.endsWith('_id') || field.name.endsWith('Id')) {
      indexes.push({
        name: `idx_${tableName}_${field.name}`,
        columns: [field.name],
        comment: includeComments ? `Foreign key index on ${field.name}` : undefined
      })
    }
  })

  // Composite indexes for common query patterns
  const userIdField = entityConfig.fields.find(f => f.name === 'userId' || f.name === 'user_id')
  if (userIdField) {
    // User + created_at for user's recent items
    indexes.push({
      name: `idx_${tableName}_user_created`,
      columns: ['user_id', 'created_at'],
      comment: includeComments ? 'Composite index for user\'s items ordered by creation date' : undefined
    })

    // User + soft delete filter
    if (softDelete) {
      indexes.push({
        name: `idx_${tableName}_user_active`,
        columns: ['user_id'],
        partial: 'deleted_at IS NULL',
        comment: includeComments ? 'Partial index for user\'s non-deleted items' : undefined
      })
    }
  }

  // Soft delete index
  if (softDelete) {
    indexes.push({
      name: `idx_${tableName}_deleted_at`,
      columns: ['deleted_at'],
      comment: includeComments ? 'Index for soft delete filtering' : undefined
    })
  }

  return indexes
}

/**
 * Generate constraints for entity table
 */
function generateConstraints(
  entityConfig: EntityConfig,
  tableName: string,
  hasUserField: boolean,
  primaryKey: string = 'id'
): ConstraintDefinition[] {
  const constraints: ConstraintDefinition[] = []

  // Primary key constraint
  constraints.push({
    name: `pk_${tableName}`,
    type: 'PRIMARY KEY',
    definition: `(${primaryKey})`
  })

  // Foreign key to users table
  if (hasUserField) {
    constraints.push({
      name: `fk_${tableName}_user`,
      type: 'FOREIGN KEY',
      definition: '(user_id) REFERENCES "user"(id) ON DELETE CASCADE'
    })
  }

  // Unique constraints from field validations
  // Note: Unique constraints would need to be configured separately
  // since field.validation doesn't have a unique property in the current ZodSchema

  // Check constraints for field validations
  // Note: Field validations are currently handled at the application level
  // Database-level constraints would need to be configured separately

  return constraints
}

/**
 * Generate RLS policies for entity table
 */
function generateRLSPolicies(
  entityConfig: EntityConfig,
  tableName: string,
  includeComments: boolean
): RLSPolicyDefinition[] {
  const policies: RLSPolicyDefinition[] = []
  const hasUserField = entityConfig.fields.some(f => f.name === 'userId' || f.name === 'user_id')

  // Enable RLS
  policies.push({
    name: 'enable_rls',
    action: 'ALL',
    using: 'TRUE', // This will be converted to ALTER TABLE statement
    comment: includeComments ? 'Enable Row Level Security' : undefined
  })

  // Owner access policy (users can access their own records)
  if (hasUserField) {
    policies.push({
      name: `${tableName}_owner_access`,
      action: 'ALL',
      using: 'auth.uid() = user_id',
      comment: includeComments ? 'Users can access their own records' : undefined
    })
  }

  // Admin access policy
  policies.push({
    name: `${tableName}_admin_access`,
    action: 'ALL',
    role: 'service_role',
    using: 'TRUE',
    comment: includeComments ? 'Service role has full access' : undefined
  })

  // Role-based policies based on entity permissions (CRUD operations only)
  // NOTE: If no permissions defined, skip role-based policies (permissions are centralized)
  const crudActions = ['read', 'create', 'update', 'delete'] as const
  crudActions.forEach((action) => {
    // Find the action in permissions.actions array (if defined)
    const actionConfig = entityConfig.permissions?.actions?.find(a => a.action === action)
    const roles = actionConfig?.roles || []
    if (Array.isArray(roles)) {
      roles.forEach((role: string) => {
        if (role !== 'superadmin') { // superadmin handled by service_role
          const policyAction = action.toUpperCase() as RLSPolicyDefinition['action']
          policies.push({
            name: `${tableName}_${role}_${action}`,
            action: policyAction,
            using: hasUserField
              ? `auth.jwt() ->> 'role' = '${role}' AND (auth.uid() = user_id OR auth.jwt() ->> 'role' IN ('admin', 'superadmin'))`
              : `auth.jwt() ->> 'role' = '${role}'`,
            comment: includeComments ? `${role} can ${action} records` : undefined
          })
        }
      })
    }
  })

  return policies
}

/**
 * Generate child entity migrations
 */
function generateChildEntityMigrations(
  parentEntityConfig: EntityConfig,
  options: MigrationOptions
): GeneratedMigration[] {
  const migrations: GeneratedMigration[] = []

  if (!parentEntityConfig.childEntities) {
    return migrations
  }

  Object.entries(parentEntityConfig.childEntities).forEach(([childName, childConfig]) => {
    const migration = generateChildEntityMigration(
      parentEntityConfig.slug,
      childName,
      childConfig,
      options
    )
    migrations.push(migration)
  })

  return migrations
}

/**
 * Generate migration for a child entity
 */
function generateChildEntityMigration(
  parentEntityName: string,
  childName: string,
  childConfig: ChildEntityDefinition,
  options: MigrationOptions
): GeneratedMigration {
  const tableName = childConfig.table
  
  // Generate columns
  const columns: ColumnDefinition[] = []
  
  // Primary key
  columns.push({
    name: 'id',
    type: 'UUID',
    nullable: false,
    primaryKey: true,
    defaultValue: 'gen_random_uuid()'
  })

  // Parent reference
  columns.push({
    name: `${parentEntityName}_id`,
    type: 'UUID',
    nullable: false,
    comment: options.includeComments ? `Reference to parent ${parentEntityName}` : undefined
  })

  // Child fields
  childConfig.fields.forEach(field => {
    const column = generateColumnFromField(field as EntityField, options.includeComments || false)
    columns.push(column)
  })

  // Timestamps
  if (options.timestamps !== false) {
    columns.push({
      name: 'created_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP'
    })

    columns.push({
      name: 'updated_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'CURRENT_TIMESTAMP'
    })
  }

  // Soft delete
  if (options.softDelete !== false) {
    columns.push({
      name: 'deleted_at',
      type: 'TIMESTAMPTZ',
      nullable: true
    })
  }

  // User tracking
  columns.push({
    name: 'created_by',
    type: 'UUID',
    nullable: true
  })

  // Generate constraints
  const constraints: ConstraintDefinition[] = [
    {
      name: `pk_${tableName}`,
      type: 'PRIMARY KEY',
      definition: '(id)'
    },
    {
      name: `fk_${tableName}_${parentEntityName}`,
      type: 'FOREIGN KEY',
      definition: `(${parentEntityName}_id) REFERENCES "${parentEntityName}"(id) ON DELETE CASCADE`
    }
  ]

  // Generate indexes
  const indexes: IndexDefinition[] = [
    {
      name: `idx_${tableName}_${parentEntityName}_id`,
      columns: [`${parentEntityName}_id`]
    }
  ]

  if (options.softDelete !== false) {
    indexes.push({
      name: `idx_${tableName}_deleted_at`,
      columns: ['deleted_at']
    })
  }

  const tableDef: TableDefinition = {
    tableName,
    columns,
    indexes,
    constraints,
    rlsPolicies: []
  }

  const upSQL = generateCreateTableSQL(tableDef)
  const downSQL = generateDropTableSQL(tableName)

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const filename = `${timestamp}_create_${childName}_child_entity.sql`

  return {
    up: upSQL,
    down: downSQL,
    filename,
    description: `Create ${childName} child entity for ${parentEntityName}`,
    dependencies: [`*_create_${parentEntityName}_entity.sql`]
  }
}

/**
 * Generate CREATE TABLE SQL
 */
function generateCreateTableSQL(tableDef: TableDefinition): string {
  const { tableName, columns, indexes, constraints, rlsPolicies } = tableDef

  let sql = `-- Create ${tableName} table\n`
  sql += `CREATE TABLE "${tableName}" (\n`

  // Columns
  const columnDefs = columns.map(col => {
    let def = `  "${col.name}" ${col.type}`
    
    if (col.primaryKey) {
      def += ' PRIMARY KEY'
    } else if (!col.nullable) {
      def += ' NOT NULL'
    }
    
    if (col.defaultValue) {
      def += ` DEFAULT ${col.defaultValue}`
    }
    
    if (col.unique && !col.primaryKey) {
      def += ' UNIQUE'
    }
    
    return def
  })

  sql += columnDefs.join(',\n')
  sql += '\n);\n\n'

  // Comments
  columns.forEach(col => {
    if (col.comment) {
      sql += `COMMENT ON COLUMN "${tableName}"."${col.name}" IS '${col.comment}';\n`
    }
  })
  if (columns.some(col => col.comment)) {
    sql += '\n'
  }

  // Constraints (additional ones, primary key already included in column definition)
  constraints.forEach(constraint => {
    if (constraint.type !== 'PRIMARY KEY') {
      sql += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraint.name}" ${constraint.type} ${constraint.definition};\n`
    }
  })
  if (constraints.length > 1) { // More than just primary key
    sql += '\n'
  }

  // Indexes
  indexes.forEach(index => {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : ''
    const methodClause = index.method ? ` USING ${index.method}` : ''
    const partialClause = index.partial ? ` WHERE ${index.partial}` : ''
    
    sql += `CREATE ${uniqueKeyword}INDEX "${index.name}" ON "${tableName}"${methodClause} (${index.columns.map(c => `"${c}"`).join(', ')})${partialClause};\n`
  })
  if (indexes.length > 0) {
    sql += '\n'
  }

  // RLS policies
  if (rlsPolicies.length > 0) {
    sql += `-- Enable Row Level Security\n`
    sql += `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;\n\n`

    rlsPolicies.forEach(policy => {
      if (policy.name === 'enable_rls') return // Already handled above

      sql += `CREATE POLICY "${policy.name}" ON "${tableName}"\n`
      sql += `  FOR ${policy.action}`
      
      if (policy.role) {
        sql += ` TO ${policy.role}`
      }
      
      if (policy.using) {
        sql += `\n  USING (${policy.using})`
      }
      
      if (policy.withCheck) {
        sql += `\n  WITH CHECK (${policy.withCheck})`
      }
      
      sql += ';\n'
      
      if (policy.comment) {
        sql += `COMMENT ON POLICY "${policy.name}" ON "${tableName}" IS '${policy.comment}';\n`
      }
      
      sql += '\n'
    })
  }

  return sql.trim()
}

/**
 * Generate DROP TABLE SQL
 */
function generateDropTableSQL(tableName: string): string {
  return `-- Drop ${tableName} table\nDROP TABLE IF EXISTS "${tableName}" CASCADE;`
}

/**
 * Generate migration boilerplate for a new entity
 */
export function generateMigrationBoilerplate(entityName: string): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const filename = `${timestamp}_create_${entityName}_entity.sql`
  
  return `-- Migration: ${filename}
-- Description: Create ${entityName} entity
-- Generated: ${new Date().toISOString()}

-- Up Migration
BEGIN;

-- Create ${entityName} table
CREATE TABLE "${entityName}" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX "idx_${entityName}_created_at" ON "${entityName}" ("created_at");
CREATE INDEX "idx_${entityName}_deleted_at" ON "${entityName}" ("deleted_at");

-- Enable Row Level Security
ALTER TABLE "${entityName}" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "${entityName}_admin_access" ON "${entityName}"
  FOR ALL TO service_role
  USING (TRUE);

COMMIT;

-- Down Migration (commented out for safety)
-- BEGIN;
-- DROP TABLE IF EXISTS "${entityName}" CASCADE;
-- COMMIT;
`
}

/**
 * Validate entity configuration for migration generation
 */
export function validateEntityForMigration(entityConfig: EntityConfig): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!entityConfig.slug) {
    errors.push('Entity slug is required (used to derive table name)')
  }

  if (!entityConfig.names?.singular) {
    errors.push('Entity singular name is required')
  }

  // Check field types
  entityConfig.fields.forEach(field => {
    if (!field.name) {
      errors.push(`Field name is required`)
    }

    if (!field.type) {
      errors.push(`Field type is required for field: ${field.name}`)
    }

    // Check for potential SQL injection in field names
    if (field.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
      errors.push(`Invalid field name: ${field.name}. Must be valid SQL identifier`)
    }
  })

  // Check child entities
  if (entityConfig.childEntities) {
    Object.entries(entityConfig.childEntities).forEach(([childName, childConfig]) => {
      if (!childConfig.table) {
        errors.push(`Child entity ${childName} missing table name`)
      }

      if (!childConfig.fields || childConfig.fields.length === 0) {
        warnings.push(`Child entity ${childName} has no fields defined`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}