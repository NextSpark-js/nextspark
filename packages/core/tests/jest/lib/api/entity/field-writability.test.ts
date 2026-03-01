/**
 * Field Writability Tests
 *
 * Verifies that `showInForm` (a UI concern) does NOT affect
 * whether a field is writable via the API. Only `api.readOnly`
 * should determine API writability.
 *
 * Related fix: generic-handler.ts decoupled showInForm from API PATCH/POST filtering
 */

import type { EntityField } from '../../../../../src/lib/entities/types'

/**
 * Replicates the field writability check used in generic-handler.ts
 * for both POST (create) and PATCH (update) operations.
 */
function isFieldWritable(field: EntityField | undefined): boolean {
  if (!field) return false
  return !field.api?.readOnly
}

describe('Field Writability (API write filtering)', () => {
  describe('isFieldWritable', () => {
    it('should allow field with no api config', () => {
      const field = {
        name: 'title',
        type: 'text',
        display: { showInForm: true },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(true)
    })

    it('should allow field with readOnly: false', () => {
      const field = {
        name: 'description',
        type: 'text',
        api: { readOnly: false },
        display: { showInForm: true },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(true)
    })

    it('should reject field with readOnly: true', () => {
      const field = {
        name: 'createdAt',
        type: 'date',
        api: { readOnly: true },
        display: { showInForm: false },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(false)
    })

    it('should allow field with showInForm: false and readOnly not set (the key fix)', () => {
      // This is the core scenario: a field like `deletedAt` for soft delete
      // that should be writable via API but not shown in auto-generated forms.
      const field = {
        name: 'deletedAt',
        type: 'date',
        display: { showInForm: false },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(true)
    })

    it('should allow field with showInForm: false and readOnly: false', () => {
      const field = {
        name: 'status',
        type: 'text',
        api: { readOnly: false },
        display: { showInForm: false },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(true)
    })

    it('should reject field with showInForm: true but readOnly: true', () => {
      // Even if shown in forms, readOnly should block API writes
      const field = {
        name: 'systemField',
        type: 'text',
        api: { readOnly: true },
        display: { showInForm: true },
      } as unknown as EntityField

      expect(isFieldWritable(field)).toBe(false)
    })

    it('should return false for undefined field', () => {
      expect(isFieldWritable(undefined)).toBe(false)
    })
  })

  describe('field filtering for entity operations', () => {
    const entityFields: EntityField[] = [
      {
        name: 'title',
        type: 'text',
        display: { showInForm: true },
      },
      {
        name: 'deletedAt',
        type: 'date',
        api: { readOnly: false },
        display: { showInForm: false },
      },
      {
        name: 'createdAt',
        type: 'date',
        api: { readOnly: true },
        display: { showInForm: false },
      },
      {
        name: 'internalNote',
        type: 'text',
        display: { showInForm: false },
      },
    ] as unknown as EntityField[]

    it('should include showInForm:false fields that are not readOnly in writable set', () => {
      const writableFields = entityFields.filter(isFieldWritable)
      const writableNames = writableFields.map((f) => f.name)

      expect(writableNames).toContain('title')
      expect(writableNames).toContain('deletedAt')
      expect(writableNames).toContain('internalNote')
      expect(writableNames).not.toContain('createdAt')
    })

    it('should only exclude readOnly fields from writable set', () => {
      const writableFields = entityFields.filter(isFieldWritable)
      expect(writableFields).toHaveLength(3)

      const readOnlyFields = entityFields.filter((f) => !isFieldWritable(f))
      expect(readOnlyFields).toHaveLength(1)
      expect(readOnlyFields[0].name).toBe('createdAt')
    })
  })
})
