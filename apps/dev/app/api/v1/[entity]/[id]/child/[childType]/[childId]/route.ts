/**
 * API endpoint for individual child entity operations
 * PUT /api/v1/[entity]/[id]/child/[childType]/[childId]
 * DELETE /api/v1/[entity]/[id]/child/[childType]/[childId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { resolveEntityFromUrl } from '@nextsparkjs/core/lib/api/entity/resolver'
import { getChildEntities, getEntity, type EntityName } from '@nextsparkjs/core/lib/entities/queries'

interface RouteParams {
  entity: string
  id: string
  childType: string
  childId: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { entity, id, childType, childId } = await params

  try {
    const body = await request.json()

    // Resolve entity from URL (handles plural to singular conversion)
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)
    if (!resolution.isValidEntity || !resolution.entityConfig) {
      return NextResponse.json(
        { error: `Entity "${entity}" not found` },
        { status: 404 }
      )
    }

    // Get child entities for this parent entity from registry
    const childEntities = getChildEntities(resolution.entityName as EntityName)
    const childEntity = childEntities.find(child => child.name === childType)

    if (!childEntity) {
      return NextResponse.json(
        { error: `Child entity "${childType}" not found for "${entity}"` },
        { status: 404 }
      )
    }

    // Get child entity configuration from registry
    const childConfig = getEntity(childType as EntityName)
    if (!childConfig) {
      return NextResponse.json(
        { error: `Child entity configuration "${childType}" not found` },
        { status: 404 }
      )
    }

    // Prepare data
    const childTable = childEntity.tableName
    const parentIdColumn = 'parentId' // Use consistent naming

    // Extract field names and values for update (exclude system fields)
    const systemFields = ['id', 'parentId', 'createdAt', 'updatedAt']
    const userFields = childConfig.fields.filter(field => !systemFields.includes(field.name))
    const fieldNames = userFields.map(field => field.name)
    const updateClauses = fieldNames
      .filter(name => body[name] !== undefined)
      .map(name => {
        const value = body[name]
        if (value === null) {
          return `"${name}" = NULL`
        }
        
        const field = childConfig.fields.find(f => f.name === name)
        
        // Handle relation fields specially - extract single ID from array or object
        if (field?.type === 'relation') {
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0]
            const relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
            return `"${name}" = '${String(relationId).replace(/'/g, "''")}'`
          } else if (typeof value === 'object' && value && 'id' in value) {
            return `"${name}" = '${String((value as { id: unknown }).id).replace(/'/g, "''")}'`
          } else if (typeof value === 'string') {
            return `"${name}" = '${String(value).replace(/'/g, "''")}'`
          }
          return `"${name}" = NULL`
        }
        
        // Handle relation-multi fields - store as JSONB array of IDs
        if (field?.type === 'relation-multi') {
          let relationIds = []
          if (Array.isArray(value)) {
            relationIds = value.map(item => 
              typeof item === 'object' && item && 'id' in item ? item.id : item
            ).filter(id => id && String(id).trim() !== '')
          }
          return `"${name}" = '${JSON.stringify(relationIds).replace(/'/g, "''")}'::jsonb`
        }
        
        // Handle multiselect, user, and other complex types as JSONB
        if (field?.type === 'multiselect' || field?.type === 'user' || 
            Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          return `"${name}" = '${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
        }
        
        return `"${name}" = '${String(value).replace(/'/g, "''")}'`
      })
    
    // Add updatedAt
    updateClauses.push(`"updatedAt" = NOW()`)
    
    const query = `
      UPDATE "${childTable}" 
      SET ${updateClauses.join(', ')}
      WHERE "id" = $1 AND "${parentIdColumn}" = $2
      RETURNING *
    `
    
    const result = await queryWithRLS<Record<string, unknown>>(query, [childId, id], 'system')
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Child entity not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: result[0],
      info: {
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error(`Error updating child entity:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { entity, id, childType, childId } = await params

    // Resolve entity from URL (handles plural to singular conversion)
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)
    if (!resolution.isValidEntity || !resolution.entityConfig) {
      return NextResponse.json(
        { error: `Entity "${entity}" not found` },
        { status: 404 }
      )
    }

    // Get child entities for this parent entity from registry
    const childEntities = getChildEntities(resolution.entityName as EntityName)
    const childEntity = childEntities.find(child => child.name === childType)

    if (!childEntity) {
      return NextResponse.json(
        { error: `Child entity "${childType}" not found for "${entity}"` },
        { status: 404 }
      )
    }

    // Delete child entity
    const childTable = childEntity.tableName
    const parentIdColumn = 'parentId' // Use consistent naming
    
    const query = `
      DELETE FROM "${childTable}" 
      WHERE "id" = $1 AND "${parentIdColumn}" = $2
      RETURNING id
    `
    
    const result = await queryWithRLS<{ id: string }>(query, [childId, id], 'system')
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Child entity not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Child entity deleted successfully',
      id: result[0].id 
    })
  } catch (error) {
    console.error(`Error deleting child entity:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
