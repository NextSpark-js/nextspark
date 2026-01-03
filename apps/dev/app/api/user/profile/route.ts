import { NextResponse } from 'next/server'
import { auth } from '@nextsparkjs/core/lib/auth'
import { headers } from 'next/headers'
import { queryOneWithRLS, mutateWithRLS, queryOne } from '@nextsparkjs/core/lib/db'
import { profileSchema } from '@nextsparkjs/core/lib/validation'
import { MetaService } from '@nextsparkjs/core/lib/services/meta.service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const includeMeta = url.searchParams.get('includeMeta') === 'true'
  try {
    const sessionHeaders = await headers()
    const session = await auth.api.getSession({ headers: sessionHeaders })
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user profile data including the new fields
    const user = await queryOneWithRLS(
      'SELECT id, email, "firstName", "lastName", country, timezone, language, image, "emailVerified", "createdAt", "updatedAt" FROM "users" WHERE id = $1',
      [session.user.id],
      session.user.id
    )
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Get auth method (check if user has password or uses OAuth) - using direct query for auth table
    const account = await queryOne<{ providerId: string }>(
      'SELECT "providerId" FROM "account" WHERE "userId" = $1',
      [session.user.id]
    )
    
    const authMethod = account 
      ? account.providerId === 'credential' ? 'Email' : 'Google'
      : 'Email'
    
    let result: Record<string, unknown> = { 
      ...user,
      authMethod
    }

    // Include metadata if requested
    if (includeMeta) {
      const metadata = await MetaService.getEntityMetas('user', session.user.id, session.user.id, true)
      result = { ...result, meta: metadata }
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionHeaders = await headers()
    const session = await auth.api.getSession({ headers: sessionHeaders })
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { meta, ...profileData } = body
    
    // Handle metadata-only updates (formato anidado)
    if (meta && Object.keys(profileData).length === 0) {
      // Procesar cada grupo de metadata por separado
      for (const [metaKey, metaValue] of Object.entries(meta)) {
        if (metaValue && typeof metaValue === 'object') {
          await MetaService.setEntityMeta('user', session.user.id, metaKey, metaValue, session.user.id)
        }
      }
      
      return NextResponse.json({ 
        message: 'Settings updated successfully',
        success: true
      })
    }
    
    // Handle profile data updates
    if (Object.keys(profileData).length > 0) {
      // Validate the request body
      const validationResult = profileSchema.safeParse(profileData)
      if (!validationResult.success) {
        return NextResponse.json({ 
          error: 'Invalid data', 
          details: validationResult.error.issues 
        }, { status: 400 })
      }
      
      const { firstName, lastName, country, timezone, language } = validationResult.data
      
      // Update user profile
      const result = await mutateWithRLS(
        `UPDATE "users"
         SET "firstName" = $1, "lastName" = $2, country = $3, timezone = $4, language = $5, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, email, "firstName", "lastName", country, timezone, language, image, "emailVerified", "createdAt", "updatedAt"`,
        [firstName, lastName, country, timezone, language, session.user.id],
        session.user.id
      )
      
      const updatedUser = result.rows[0]
      
      if (!updatedUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Handle metadata updates if provided (formato anidado)
    if (meta) {
      // Procesar cada grupo de metadata por separado
      for (const [metaKey, metaValue] of Object.entries(meta)) {
        if (metaValue && typeof metaValue === 'object') {
          await MetaService.setEntityMeta('user', session.user.id, metaKey, metaValue, session.user.id)
        }
      }
    }
    
    return NextResponse.json({ 
      message: 'Profile updated successfully',
      success: true
    })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}