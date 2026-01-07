/**
 * API endpoint for child entities
 * GET /api/v1/[entity]/[id]/child/[childType]
 * POST /api/v1/[entity]/[id]/child/[childType]
 */

// CRITICAL: Initialize entity registry for API routes
// This import is processed by webpack which resolves the @nextsparkjs alias
// The setEntityRegistry call happens at module load time
import { setEntityRegistry, isRegistryInitialized, getChildEntities, getEntity } from '@nextsparkjs/core/lib/entities/queries'
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
if (!isRegistryInitialized()) {
  setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)
}

import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { resolveEntityFromUrl } from '@nextsparkjs/core/lib/api/entity/resolver'


interface RouteParams {
  entity: string
  id: string
  childType: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { entity, id, childType } = await params

  try {

    // Resolve entity from URL (handles plural to singular conversion)
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)
    if (!resolution.isValidEntity || !resolution.entityConfig) {
      return NextResponse.json(
        { error: `Entity "${entity}" not found` },
        { status: 404 }
      )
    }

    // Check if child entity exists using the new registry system
    const childEntities = getChildEntities(resolution.entityName as string)
    const childEntity = childEntities.find(child => child.name === childType)

    if (!childEntity) {
      return NextResponse.json(
        { error: `Child entity "${childType}" not found for "${entity}"` },
        { status: 404 }
      )
    }

    // Get child config from registry
    const childConfig = getEntity(childType as string)
    if (!childConfig) {
      return NextResponse.json(
        { error: `Child entity configuration "${childType}" not found` },
        { status: 404 }
      )
    }

    // Query child entities
    const childTable = childEntity.tableName
    const parentIdColumn = 'parentId' // Child entities use 'parentId' as foreign key
    
    const query = `
      SELECT * FROM "${childTable}" 
      WHERE "${parentIdColumn}" = $1 
      ORDER BY "createdAt" DESC
    `
    
    const childRows = await queryWithRLS<Record<string, unknown>>(query, [id], 'system')

    return NextResponse.json({
      success: true,
      data: childRows,
      info: {
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error(`Error loading child entities for ${entity}/${id}/${childType}:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { entity, id, childType } = await params
  
  try {
    console.log(`[ChildAPI] POST ${entity}/${id}/child/${childType}`)
    const body = await request.json()
    console.log(`[ChildAPI] Request body:`, body)

    // Resolve entity from URL (handles plural to singular conversion)
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)
    console.log(`[ChildAPI] Resolution:`, resolution)
    if (!resolution.isValidEntity || !resolution.entityConfig) {
      return NextResponse.json(
        { error: `Entity "${entity}" not found` },
        { status: 404 }
      )
    }

    // Check if child entity exists using the new registry system
    const childEntities = getChildEntities(resolution.entityName as string)
    const childEntity = childEntities.find(child => child.name === childType)
    console.log(`[ChildAPI] Found child entities for ${entity}:`, childEntities.map(c => c.name))
    console.log(`[ChildAPI] Looking for childType:`, childType)
    console.log(`[ChildAPI] Found child entity:`, childEntity)

    if (!childEntity) {
      return NextResponse.json(
        { error: `Child entity "${childType}" not found for "${entity}"` },
        { status: 404 }
      )
    }

    // Get child config from registry
    const childConfig = getEntity(childType as string)
    console.log(`[ChildAPI] Child config for ${childType}:`, childConfig)
    if (!childConfig) {
      return NextResponse.json(
        { error: `Child entity configuration "${childType}" not found` },
        { status: 404 }
      )
    }

    // Prepare data
    const childTable = childEntity.tableName
    const parentIdColumn = 'parentId' // Child entities use 'parentId' as foreign key

    // Extract field names and values (exclude system fields that we'll add separately)
    const systemFields = ['id', 'parentId', 'createdAt', 'updatedAt']
    const userFields = childConfig.fields.filter(field => !systemFields.includes(field.name))
    const fieldNames = userFields.map(field => field.name)
    const fieldValues = fieldNames.map(name => body[name])

    // Determine ID generation strategy (default: uuid)
    const idStrategy = childConfig.idStrategy?.type || 'uuid'

    // Add parent ID and system fields based on ID strategy
    let allFields: string[]
    let allValues: string[]

    if (idStrategy === 'serial') {
      // SERIAL: Let database generate ID via DEFAULT/SERIAL
      allFields = [parentIdColumn, ...fieldNames, 'createdAt', 'updatedAt']
      allValues = [
        `'${id}'`, // parentId
        ...fieldValues.map((value, index) => {

        if (value === null || value === undefined) {
          return 'NULL'
        }
        
        const fieldName = fieldNames[index]
        const field = childConfig.fields.find(f => f.name === fieldName)

        // Handle number fields - convert empty strings to NULL
        if (field?.type === 'number') {
          if (typeof value === 'string' && value.trim() === '') {
            return 'NULL'
          }
          // Convert to number and validate
          const numValue = Number(value)
          if (isNaN(numValue)) {
            return 'NULL'
          }
          return String(numValue)
        }

        // Handle relation fields specially - extract single ID from array or object
        if (field?.type === 'relation') {
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0]
            const relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
            // Check if relationId is empty string or null/undefined
            if (!relationId || String(relationId).trim() === '') {
              return 'NULL'
            }
            return `'${String(relationId).replace(/'/g, "''")}'`
          } else if (typeof value === 'object' && value && 'id' in value) {
            const relationId = (value as { id: unknown }).id
            // Check if relationId is empty string or null/undefined
            if (!relationId || String(relationId).trim() === '') {
              return 'NULL'
            }
            return `'${String(relationId).replace(/'/g, "''")}'`
          } else if (typeof value === 'string') {
            // Check if string is empty or just whitespace
            if (value.trim() === '') {
              return 'NULL'
            }
            return `'${String(value).replace(/'/g, "''")}'`
          }
          return 'NULL'
        }
        
        // Handle relation-multi fields - store as JSONB array of IDs
        if (field?.type === 'relation-multi') {
          let relationIds = []
          if (Array.isArray(value)) {
            relationIds = value.map(item => 
              typeof item === 'object' && item && 'id' in item ? item.id : item
            ).filter(id => id && String(id).trim() !== '')
          }
          return `'${JSON.stringify(relationIds).replace(/'/g, "''")}'::jsonb`
        }
        
        // Handle multiselect, user, and other complex types as JSONB
        if (field?.type === 'multiselect' || field?.type === 'user' || 
            Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
        }
        
        return `'${String(value).replace(/'/g, "''")}'`
      }), // properly handle null values and complex types
      'NOW()', // createdAt
      'NOW()' // updatedAt
    ]
    } else {
      // UUID: Generate ID and include in INSERT
      allFields = ['id', parentIdColumn, ...fieldNames, 'createdAt', 'updatedAt']
      allValues = [
        `gen_random_uuid()::TEXT`, // id
        `'${id}'`, // parentId
        ...fieldValues.map((value, index) => {
        if (value === null || value === undefined) {
          return 'NULL'
        }

        const fieldName = fieldNames[index]
        const field = childConfig.fields.find(f => f.name === fieldName)

        // Handle number fields - convert empty strings to NULL
        if (field?.type === 'number') {
          if (typeof value === 'string' && value.trim() === '') {
            return 'NULL'
          }
          // Convert to number and validate
          const numValue = Number(value)
          if (isNaN(numValue)) {
            return 'NULL'
          }
          return String(numValue)
        }

        // Handle relation fields specially - extract single ID from array or object
        if (field?.type === 'relation') {
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0]
            const relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
            // Check if relationId is empty string or null/undefined
            if (!relationId || String(relationId).trim() === '') {
              return 'NULL'
            }
            return `'${String(relationId).replace(/'/g, "''")}'`
          } else if (typeof value === 'object' && value && 'id' in value) {
            const relationId = (value as { id: unknown }).id
            // Check if relationId is empty string or null/undefined
            if (!relationId || String(relationId).trim() === '') {
              return 'NULL'
            }
            return `'${String(relationId).replace(/'/g, "''")}'`
          } else if (typeof value === 'string') {
            // Check if string is empty or just whitespace
            if (value.trim() === '') {
              return 'NULL'
            }
            return `'${String(value).replace(/'/g, "''")}'`
          }
          return 'NULL'
        }

        // Handle relation-multi fields - store as JSONB array of IDs
        if (field?.type === 'relation-multi') {
          let relationIds = []
          if (Array.isArray(value)) {
            relationIds = value.map(item =>
              typeof item === 'object' && item && 'id' in item ? item.id : item
            ).filter(id => id && String(id).trim() !== '')
          }
          return `'${JSON.stringify(relationIds).replace(/'/g, "''")}'::jsonb`
        }

        // Handle multiselect, user, and other complex types as JSONB
        if (field?.type === 'multiselect' || field?.type === 'user' ||
            Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
        }

        return `'${String(value).replace(/'/g, "''")}'`
      }), // properly handle null values and complex types
      'NOW()', // createdAt
      'NOW()' // updatedAt
    ]
    }
    
    const query = `
      INSERT INTO "${childTable}" (${allFields.map(f => `"${f}"`).join(', ')})
      VALUES (${allValues.join(', ')})
      RETURNING *
    `
    
    const result = await queryWithRLS<Record<string, unknown>>(query, [], 'system')
    
    return NextResponse.json({
      success: true,
      data: result[0],
      info: {
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error(`[ChildAPI] Error creating child entity for ${entity}/${id}/${childType}:`, error)
    console.error(`[ChildAPI] Error stack:`, error instanceof Error ? error.stack : 'No stack available')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
