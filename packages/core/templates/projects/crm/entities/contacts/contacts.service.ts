/**
 * Contacts Service
 *
 * Provides data access methods for contacts.
 * Contacts is a private entity - users only see contacts in their team.
 *
 * All methods require authentication (use RLS with userId filter).
 *
 * @module ContactsService
 */

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

// Preferred channel type
export type PreferredChannel = 'email' | 'phone' | 'mobile' | 'linkedin' | 'twitter'

// Contact interface
export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  mobile?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  birthDate?: string
  linkedin?: string
  twitter?: string
  preferredChannel?: PreferredChannel
  timezone?: string
  lastContactedAt?: string
  createdAt: string
  updatedAt: string
}

// List options
export interface ContactListOptions {
  limit?: number
  offset?: number
  companyId?: string
  department?: string
  isPrimary?: boolean
  preferredChannel?: PreferredChannel
  orderBy?: 'firstName' | 'lastName' | 'lastContactedAt' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
  teamId?: string
}

// List result
export interface ContactListResult {
  contacts: Contact[]
  total: number
}

// Create data
export interface ContactCreateData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  mobile?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  birthDate?: string
  linkedin?: string
  twitter?: string
  preferredChannel?: PreferredChannel
  timezone?: string
  lastContactedAt?: string
  teamId: string
}

// Update data
export interface ContactUpdateData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  birthDate?: string
  linkedin?: string
  twitter?: string
  preferredChannel?: PreferredChannel
  timezone?: string
  lastContactedAt?: string
}

// Database row type
interface DbContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  mobile: string | null
  companyId: string | null
  position: string | null
  department: string | null
  isPrimary: boolean | null
  birthDate: string | null
  linkedin: string | null
  twitter: string | null
  preferredChannel: PreferredChannel | null
  timezone: string | null
  lastContactedAt: string | null
  createdAt: string
  updatedAt: string
}

export class ContactsService {
  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get a contact by ID
   */
  static async getById(id: string, userId: string): Promise<Contact | null> {
    try {
      if (!id?.trim()) throw new Error('Contact ID is required')
      if (!userId?.trim()) throw new Error('User ID is required')

      const contact = await queryOneWithRLS<DbContact>(
        `SELECT id, "firstName", "lastName", email, phone, mobile, "companyId", position, department, "isPrimary", "birthDate", linkedin, twitter, "preferredChannel", timezone, "lastContactedAt", "createdAt", "updatedAt"
         FROM contacts WHERE id = $1`,
        [id],
        userId
      )

      if (!contact) return null

      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone ?? undefined,
        mobile: contact.mobile ?? undefined,
        companyId: contact.companyId ?? undefined,
        position: contact.position ?? undefined,
        department: contact.department ?? undefined,
        isPrimary: contact.isPrimary ?? undefined,
        birthDate: contact.birthDate ?? undefined,
        linkedin: contact.linkedin ?? undefined,
        twitter: contact.twitter ?? undefined,
        preferredChannel: contact.preferredChannel ?? undefined,
        timezone: contact.timezone ?? undefined,
        lastContactedAt: contact.lastContactedAt ?? undefined,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      }
    } catch (error) {
      console.error('ContactsService.getById error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch contact')
    }
  }

  /**
   * List contacts with pagination and filtering
   */
  static async list(userId: string, options: ContactListOptions = {}): Promise<ContactListResult> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')

      const {
        limit = 10,
        offset = 0,
        companyId,
        department,
        isPrimary,
        preferredChannel,
        orderBy = 'createdAt',
        orderDir = 'desc',
        teamId,
      } = options

      // Build WHERE clause
      const conditions: string[] = []
      const params: unknown[] = []
      let paramIndex = 1

      if (companyId) {
        conditions.push(`"companyId" = $${paramIndex++}`)
        params.push(companyId)
      }

      if (department) {
        conditions.push(`department = $${paramIndex++}`)
        params.push(department)
      }

      if (isPrimary !== undefined) {
        conditions.push(`"isPrimary" = $${paramIndex++}`)
        params.push(isPrimary)
      }

      if (preferredChannel) {
        conditions.push(`"preferredChannel" = $${paramIndex++}`)
        params.push(preferredChannel)
      }

      if (teamId) {
        conditions.push(`"teamId" = $${paramIndex++}`)
        params.push(teamId)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Validate orderBy
      const validOrderBy = ['firstName', 'lastName', 'lastContactedAt', 'createdAt', 'updatedAt'].includes(orderBy) ? orderBy : 'createdAt'
      const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
      const orderColumnMap: Record<string, string> = {
        firstName: '"firstName"',
        lastName: '"lastName"',
        lastContactedAt: '"lastContactedAt"',
        createdAt: '"createdAt"',
        updatedAt: '"updatedAt"',
      }
      const orderColumn = orderColumnMap[validOrderBy] || '"createdAt"'

      // Get total count
      const countResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM contacts ${whereClause}`,
        params,
        userId
      )
      const total = parseInt(countResult[0]?.count || '0', 10)

      // Get contacts
      params.push(limit, offset)
      const contacts = await queryWithRLS<DbContact>(
        `SELECT id, "firstName", "lastName", email, phone, mobile, "companyId", position, department, "isPrimary", "birthDate", linkedin, twitter, "preferredChannel", timezone, "lastContactedAt", "createdAt", "updatedAt"
         FROM contacts ${whereClause}
         ORDER BY ${orderColumn} ${validOrderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
        userId
      )

      return {
        contacts: contacts.map((contact) => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone ?? undefined,
          mobile: contact.mobile ?? undefined,
          companyId: contact.companyId ?? undefined,
          position: contact.position ?? undefined,
          department: contact.department ?? undefined,
          isPrimary: contact.isPrimary ?? undefined,
          birthDate: contact.birthDate ?? undefined,
          linkedin: contact.linkedin ?? undefined,
          twitter: contact.twitter ?? undefined,
          preferredChannel: contact.preferredChannel ?? undefined,
          timezone: contact.timezone ?? undefined,
          lastContactedAt: contact.lastContactedAt ?? undefined,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        })),
        total,
      }
    } catch (error) {
      console.error('ContactsService.list error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to list contacts')
    }
  }

  /**
   * Get contacts by company
   */
  static async getByCompany(userId: string, companyId: string, limit = 50): Promise<Contact[]> {
    const { contacts } = await this.list(userId, {
      companyId,
      limit,
      orderBy: 'firstName',
      orderDir: 'asc',
    })
    return contacts
  }

  /**
   * Get primary contacts by company
   */
  static async getPrimaryByCompany(userId: string, companyId: string): Promise<Contact | null> {
    const { contacts } = await this.list(userId, {
      companyId,
      isPrimary: true,
      limit: 1,
    })
    return contacts[0] || null
  }

  // ============================================
  // WRITE METHODS
  // ============================================

  /**
   * Create a new contact
   */
  static async create(userId: string, data: ContactCreateData): Promise<Contact> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!data.firstName?.trim()) throw new Error('First name is required')
      if (!data.lastName?.trim()) throw new Error('Last name is required')
      if (!data.email?.trim()) throw new Error('Email is required')
      if (!data.teamId?.trim()) throw new Error('Team ID is required')

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const result = await mutateWithRLS<DbContact>(
        `INSERT INTO contacts (id, "userId", "teamId", "firstName", "lastName", email, phone, mobile, "companyId", position, department, "isPrimary", "birthDate", linkedin, twitter, "preferredChannel", timezone, "lastContactedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING id, "firstName", "lastName", email, phone, mobile, "companyId", position, department, "isPrimary", "birthDate", linkedin, twitter, "preferredChannel", timezone, "lastContactedAt", "createdAt", "updatedAt"`,
        [
          id,
          userId,
          data.teamId,
          data.firstName,
          data.lastName,
          data.email,
          data.phone || null,
          data.mobile || null,
          data.companyId || null,
          data.position || null,
          data.department || null,
          data.isPrimary || false,
          data.birthDate || null,
          data.linkedin || null,
          data.twitter || null,
          data.preferredChannel || null,
          data.timezone || null,
          data.lastContactedAt || null,
          now,
          now,
        ],
        userId
      )

      if (!result.rows[0]) throw new Error('Failed to create contact')

      const contact = result.rows[0]
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone ?? undefined,
        mobile: contact.mobile ?? undefined,
        companyId: contact.companyId ?? undefined,
        position: contact.position ?? undefined,
        department: contact.department ?? undefined,
        isPrimary: contact.isPrimary ?? undefined,
        birthDate: contact.birthDate ?? undefined,
        linkedin: contact.linkedin ?? undefined,
        twitter: contact.twitter ?? undefined,
        preferredChannel: contact.preferredChannel ?? undefined,
        timezone: contact.timezone ?? undefined,
        lastContactedAt: contact.lastContactedAt ?? undefined,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      }
    } catch (error) {
      console.error('ContactsService.create error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to create contact')
    }
  }

  /**
   * Update an existing contact
   */
  static async update(userId: string, id: string, data: ContactUpdateData): Promise<Contact> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Contact ID is required')

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (data.firstName !== undefined) {
        updates.push(`"firstName" = $${paramIndex++}`)
        values.push(data.firstName)
      }
      if (data.lastName !== undefined) {
        updates.push(`"lastName" = $${paramIndex++}`)
        values.push(data.lastName)
      }
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`)
        values.push(data.email)
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`)
        values.push(data.phone || null)
      }
      if (data.mobile !== undefined) {
        updates.push(`mobile = $${paramIndex++}`)
        values.push(data.mobile || null)
      }
      if (data.companyId !== undefined) {
        updates.push(`"companyId" = $${paramIndex++}`)
        values.push(data.companyId || null)
      }
      if (data.position !== undefined) {
        updates.push(`position = $${paramIndex++}`)
        values.push(data.position || null)
      }
      if (data.department !== undefined) {
        updates.push(`department = $${paramIndex++}`)
        values.push(data.department || null)
      }
      if (data.isPrimary !== undefined) {
        updates.push(`"isPrimary" = $${paramIndex++}`)
        values.push(data.isPrimary)
      }
      if (data.birthDate !== undefined) {
        updates.push(`"birthDate" = $${paramIndex++}`)
        values.push(data.birthDate || null)
      }
      if (data.linkedin !== undefined) {
        updates.push(`linkedin = $${paramIndex++}`)
        values.push(data.linkedin || null)
      }
      if (data.twitter !== undefined) {
        updates.push(`twitter = $${paramIndex++}`)
        values.push(data.twitter || null)
      }
      if (data.preferredChannel !== undefined) {
        updates.push(`"preferredChannel" = $${paramIndex++}`)
        values.push(data.preferredChannel || null)
      }
      if (data.timezone !== undefined) {
        updates.push(`timezone = $${paramIndex++}`)
        values.push(data.timezone || null)
      }
      if (data.lastContactedAt !== undefined) {
        updates.push(`"lastContactedAt" = $${paramIndex++}`)
        values.push(data.lastContactedAt || null)
      }

      if (updates.length === 0) throw new Error('No fields to update')

      updates.push(`"updatedAt" = $${paramIndex++}`)
      values.push(new Date().toISOString())
      values.push(id)

      const result = await mutateWithRLS<DbContact>(
        `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, "firstName", "lastName", email, phone, mobile, "companyId", position, department, "isPrimary", "birthDate", linkedin, twitter, "preferredChannel", timezone, "lastContactedAt", "createdAt", "updatedAt"`,
        values,
        userId
      )

      if (!result.rows[0]) throw new Error('Contact not found or update failed')

      const contact = result.rows[0]
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone ?? undefined,
        mobile: contact.mobile ?? undefined,
        companyId: contact.companyId ?? undefined,
        position: contact.position ?? undefined,
        department: contact.department ?? undefined,
        isPrimary: contact.isPrimary ?? undefined,
        birthDate: contact.birthDate ?? undefined,
        linkedin: contact.linkedin ?? undefined,
        twitter: contact.twitter ?? undefined,
        preferredChannel: contact.preferredChannel ?? undefined,
        timezone: contact.timezone ?? undefined,
        lastContactedAt: contact.lastContactedAt ?? undefined,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      }
    } catch (error) {
      console.error('ContactsService.update error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to update contact')
    }
  }

  /**
   * Delete a contact
   */
  static async delete(userId: string, id: string): Promise<boolean> {
    try {
      if (!userId?.trim()) throw new Error('User ID is required')
      if (!id?.trim()) throw new Error('Contact ID is required')

      const result = await mutateWithRLS(`DELETE FROM contacts WHERE id = $1`, [id], userId)
      return result.rowCount > 0
    } catch (error) {
      console.error('ContactsService.delete error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete contact')
    }
  }
}
