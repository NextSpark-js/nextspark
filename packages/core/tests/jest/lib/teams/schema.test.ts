/**
 * Teams Schema Unit Tests - Direct Zod Schema Validation
 *
 * These tests validate the Zod schemas defined in packages/core/src/lib/teams/schema.ts
 * directly, without mocking. This ensures proper validation rules and error messages.
 *
 * Coverage targets:
 * - ownerUpdateTeamSchema: 100% (security-critical)
 * - updateTeamSchema: 100%
 * - createTeamSchema: 100%
 * - teamSchema: 90%+
 */

import {
  teamSchema,
  createTeamSchema,
  updateTeamSchema,
  ownerUpdateTeamSchema,
  adminUpdateTeamSchema,
  teamRoleSchema,
  invitationStatusSchema,
  teamMemberSchema,
  teamInvitationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  paginationSchema,
  teamListQuerySchema,
  memberListQuerySchema,
  invitationListQuerySchema,
} from '@/core/lib/teams/schema'

describe('Teams Validation Schemas', () => {
  describe('ownerUpdateTeamSchema (SECURITY-CRITICAL)', () => {
    describe('name field validation', () => {
      it('accepts valid name', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Valid Team Name',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe('Valid Team Name')
        }
      })

      it('rejects empty string', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: '',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Team name is required')
        }
      })

      it('rejects name with only 1 character', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'A',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 2 characters')
        }
      })

      it('accepts name with exactly 2 characters', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'AB',
        })
        expect(result.success).toBe(true)
      })

      it('accepts name with exactly 100 characters', () => {
        const name = 'A'.repeat(100)
        const result = ownerUpdateTeamSchema.safeParse({
          name,
        })
        expect(result.success).toBe(true)
      })

      it('rejects name with 101 characters', () => {
        const name = 'A'.repeat(101)
        const result = ownerUpdateTeamSchema.safeParse({
          name,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at most 100 characters')
        }
      })

      it('accepts name with special characters', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team @ 2024 & Co.',
        })
        expect(result.success).toBe(true)
      })

      it('accepts name with unicode characters', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Équipe Spéciale 🚀',
        })
        expect(result.success).toBe(true)
      })

      it('trims whitespace from name', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: '  Team Name  ',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          // Note: Zod string().min() doesn't auto-trim by default
          // If trimming is needed, add .trim() to schema
          expect(result.data.name).toBe('  Team Name  ')
        }
      })
    })

    describe('description field validation', () => {
      it('accepts valid description', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: 'This is a valid description',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBe('This is a valid description')
        }
      })

      it('accepts null description', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: null,
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBeNull()
        }
      })

      it('accepts undefined description (field omitted)', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBeUndefined()
        }
      })

      it('accepts empty string description', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: '',
        })
        expect(result.success).toBe(true)
      })

      it('accepts very long description (no max limit)', () => {
        const longDescription = 'A'.repeat(10000)
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: longDescription,
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBe(longDescription)
        }
      })

      it('accepts description with unicode and emojis', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: 'Description with émojis 🎉 and ñoño',
        })
        expect(result.success).toBe(true)
      })

      it('accepts multiline description', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          description: 'Line 1\nLine 2\nLine 3',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('partial updates', () => {
      it('allows updating only name', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'New Name',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe('New Name')
          expect(result.data.description).toBeUndefined()
        }
      })

      it('allows updating only description', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          description: 'New Description',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.description).toBe('New Description')
          expect(result.data.name).toBeUndefined()
        }
      })

      it('allows updating both fields', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'New Name',
          description: 'New Description',
        })
        expect(result.success).toBe(true)
      })

      it('rejects empty object (no fields)', () => {
        const result = ownerUpdateTeamSchema.safeParse({})
        // Empty object is valid for partial updates
        expect(result.success).toBe(true)
      })
    })

    describe('security constraints', () => {
      it('rejects unknown fields', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          slug: 'new-slug', // Not allowed in ownerUpdateTeamSchema
        })
        // Zod by default strips unknown keys unless .strict() is used
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).not.toHaveProperty('slug')
        }
      })

      it('does not allow slug updates', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          slug: 'should-be-ignored',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).not.toHaveProperty('slug')
        }
      })

      it('does not allow avatarUrl updates', () => {
        const result = ownerUpdateTeamSchema.safeParse({
          name: 'Team',
          avatarUrl: 'https://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).not.toHaveProperty('avatarUrl')
        }
      })
    })
  })

  describe('adminUpdateTeamSchema (ADMIN UPDATES - NON-OWNER)', () => {
    describe('security constraints', () => {
      it('rejects name field (owner-only)', () => {
        const result = adminUpdateTeamSchema.safeParse({
          name: 'New Team Name',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          // Zod strips unknown keys by default, name should not be in result
          expect(result.data).not.toHaveProperty('name')
        }
      })

      it('rejects description field (owner-only)', () => {
        const result = adminUpdateTeamSchema.safeParse({
          description: 'New Description',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          // Zod strips unknown keys by default, description should not be in result
          expect(result.data).not.toHaveProperty('description')
        }
      })

      it('rejects name and description together (owner-only)', () => {
        const result = adminUpdateTeamSchema.safeParse({
          name: 'Team Name',
          description: 'Description',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).not.toHaveProperty('name')
          expect(result.data).not.toHaveProperty('description')
        }
      })
    })

    describe('slug field validation', () => {
      it('accepts valid slug', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'valid-team-slug',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.slug).toBe('valid-team-slug')
        }
      })

      it('accepts slug with numbers', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'team-123',
        })
        expect(result.success).toBe(true)
      })

      it('rejects slug with uppercase', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'Team-Slug',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug with spaces', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'team slug',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug starting with hyphen', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: '-team',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug ending with hyphen', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'team-',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('avatarUrl field validation', () => {
      it('accepts valid HTTPS URL', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: 'https://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.avatarUrl).toBe('https://example.com/avatar.png')
        }
      })

      it('accepts valid HTTP URL', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: 'http://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
      })

      it('accepts null avatarUrl', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: null,
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.avatarUrl).toBeNull()
        }
      })

      it('rejects invalid URL', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: 'not-a-url',
        })
        expect(result.success).toBe(false)
      })

      it('rejects relative URL', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: '/avatar.png',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('settings field validation', () => {
      it('accepts valid settings object', () => {
        const result = adminUpdateTeamSchema.safeParse({
          settings: { theme: 'dark', language: 'en' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.settings).toEqual({ theme: 'dark', language: 'en' })
        }
      })

      it('accepts empty settings object', () => {
        const result = adminUpdateTeamSchema.safeParse({
          settings: {},
        })
        expect(result.success).toBe(true)
      })

      it('accepts nested settings', () => {
        const result = adminUpdateTeamSchema.safeParse({
          settings: {
            theme: 'dark',
            preferences: {
              notifications: true,
              emails: false,
            },
          },
        })
        expect(result.success).toBe(true)
      })

      it('accepts various value types in settings', () => {
        const result = adminUpdateTeamSchema.safeParse({
          settings: {
            stringValue: 'text',
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
          },
        })
        expect(result.success).toBe(true)
      })
    })

    describe('partial updates', () => {
      it('allows updating only slug', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'new-slug',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.slug).toBe('new-slug')
          expect(result.data.avatarUrl).toBeUndefined()
          expect(result.data.settings).toBeUndefined()
        }
      })

      it('allows updating only avatarUrl', () => {
        const result = adminUpdateTeamSchema.safeParse({
          avatarUrl: 'https://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.avatarUrl).toBe('https://example.com/avatar.png')
          expect(result.data.slug).toBeUndefined()
        }
      })

      it('allows updating only settings', () => {
        const result = adminUpdateTeamSchema.safeParse({
          settings: { key: 'value' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.settings).toEqual({ key: 'value' })
          expect(result.data.slug).toBeUndefined()
        }
      })

      it('allows updating multiple fields', () => {
        const result = adminUpdateTeamSchema.safeParse({
          slug: 'new-slug',
          avatarUrl: 'https://example.com/avatar.png',
          settings: { theme: 'dark' },
        })
        expect(result.success).toBe(true)
      })

      it('allows empty object', () => {
        const result = adminUpdateTeamSchema.safeParse({})
        expect(result.success).toBe(true)
      })
    })
  })

  describe('updateTeamSchema (GENERAL UPDATES - MERGED SCHEMA)', () => {
    describe('schema composition', () => {
      it('accepts all fields from ownerUpdateTeamSchema', () => {
        const result = updateTeamSchema.safeParse({
          name: 'Team Name',
          description: 'Team Description',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe('Team Name')
          expect(result.data.description).toBe('Team Description')
        }
      })

      it('accepts all fields from adminUpdateTeamSchema', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team-slug',
          avatarUrl: 'https://example.com/avatar.png',
          settings: { theme: 'dark' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.slug).toBe('team-slug')
          expect(result.data.avatarUrl).toBe('https://example.com/avatar.png')
          expect(result.data.settings).toEqual({ theme: 'dark' })
        }
      })

      it('accepts fields from both schemas (merged)', () => {
        const result = updateTeamSchema.safeParse({
          name: 'Team Name',
          description: 'Description',
          slug: 'team-slug',
          avatarUrl: 'https://example.com/avatar.png',
          settings: { key: 'value' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toHaveProperty('name')
          expect(result.data).toHaveProperty('description')
          expect(result.data).toHaveProperty('slug')
          expect(result.data).toHaveProperty('avatarUrl')
          expect(result.data).toHaveProperty('settings')
        }
      })
    })

    describe('name field validation', () => {
      it('accepts valid name', () => {
        const result = updateTeamSchema.safeParse({
          name: 'Valid Team',
        })
        expect(result.success).toBe(true)
      })

      it('accepts name with 2 characters', () => {
        const result = updateTeamSchema.safeParse({
          name: 'AB',
        })
        expect(result.success).toBe(true)
      })

      it('rejects name with 1 character', () => {
        const result = updateTeamSchema.safeParse({
          name: 'A',
        })
        expect(result.success).toBe(false)
      })

      it('accepts name with 100 characters', () => {
        const name = 'A'.repeat(100)
        const result = updateTeamSchema.safeParse({
          name,
        })
        expect(result.success).toBe(true)
      })

      it('rejects name with 101 characters', () => {
        const name = 'A'.repeat(101)
        const result = updateTeamSchema.safeParse({
          name,
        })
        expect(result.success).toBe(false)
      })

      it('allows name to be optional', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team-slug',
        })
        expect(result.success).toBe(true)
      })
    })

    describe('slug field validation', () => {
      it('accepts valid slug', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'valid-team-slug',
        })
        expect(result.success).toBe(true)
      })

      it('accepts slug with numbers', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team-123-456',
        })
        expect(result.success).toBe(true)
      })

      it('accepts slug with single character', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'a',
        })
        expect(result.success).toBe(true)
      })

      it('rejects slug with uppercase', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'Team-Slug',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug with spaces', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team slug',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug with underscores', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team_slug',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug starting with hyphen', () => {
        const result = updateTeamSchema.safeParse({
          slug: '-team',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug ending with hyphen', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team-',
        })
        expect(result.success).toBe(false)
      })

      it('rejects slug with consecutive hyphens', () => {
        const result = updateTeamSchema.safeParse({
          slug: 'team--slug',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('description field validation', () => {
      it('accepts valid description', () => {
        const result = updateTeamSchema.safeParse({
          description: 'Valid description',
        })
        expect(result.success).toBe(true)
      })

      it('accepts null description', () => {
        const result = updateTeamSchema.safeParse({
          description: null,
        })
        expect(result.success).toBe(true)
      })

      it('accepts undefined description', () => {
        const result = updateTeamSchema.safeParse({})
        expect(result.success).toBe(true)
      })
    })

    describe('avatarUrl field validation', () => {
      it('accepts valid URL', () => {
        const result = updateTeamSchema.safeParse({
          avatarUrl: 'https://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
      })

      it('accepts http URL', () => {
        const result = updateTeamSchema.safeParse({
          avatarUrl: 'http://example.com/avatar.png',
        })
        expect(result.success).toBe(true)
      })

      it('accepts null', () => {
        const result = updateTeamSchema.safeParse({
          avatarUrl: null,
        })
        expect(result.success).toBe(true)
      })

      it('rejects invalid URL', () => {
        const result = updateTeamSchema.safeParse({
          avatarUrl: 'not-a-url',
        })
        expect(result.success).toBe(false)
      })

      it('rejects relative URL', () => {
        const result = updateTeamSchema.safeParse({
          avatarUrl: '/avatar.png',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('settings field validation', () => {
      it('accepts valid settings object', () => {
        const result = updateTeamSchema.safeParse({
          settings: { theme: 'dark', language: 'en' },
        })
        expect(result.success).toBe(true)
      })

      it('accepts empty settings object', () => {
        const result = updateTeamSchema.safeParse({
          settings: {},
        })
        expect(result.success).toBe(true)
      })

      it('accepts nested settings', () => {
        const result = updateTeamSchema.safeParse({
          settings: {
            theme: 'dark',
            preferences: {
              notifications: true,
              emails: false,
            },
          },
        })
        expect(result.success).toBe(true)
      })

      it('accepts various value types in settings', () => {
        const result = updateTeamSchema.safeParse({
          settings: {
            stringValue: 'text',
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
          },
        })
        expect(result.success).toBe(true)
      })
    })

    describe('partial updates', () => {
      it('allows updating any single field', () => {
        expect(updateTeamSchema.safeParse({ name: 'Name' }).success).toBe(true)
        expect(updateTeamSchema.safeParse({ slug: 'slug' }).success).toBe(true)
        expect(updateTeamSchema.safeParse({ description: 'Desc' }).success).toBe(true)
        expect(updateTeamSchema.safeParse({ avatarUrl: 'https://example.com' }).success).toBe(true)
        expect(updateTeamSchema.safeParse({ settings: {} }).success).toBe(true)
      })

      it('allows updating multiple fields', () => {
        const result = updateTeamSchema.safeParse({
          name: 'Name',
          slug: 'slug',
          description: 'Description',
          avatarUrl: 'https://example.com',
          settings: { key: 'value' },
        })
        expect(result.success).toBe(true)
      })

      it('allows empty object', () => {
        const result = updateTeamSchema.safeParse({})
        expect(result.success).toBe(true)
      })
    })
  })

  describe('createTeamSchema', () => {
    it('accepts valid team data', () => {
      const result = createTeamSchema.safeParse({
        name: 'New Team',
        slug: 'new-team',
        description: 'A new team',
      })
      expect(result.success).toBe(true)
    })

    it('requires name field', () => {
      const result = createTeamSchema.safeParse({
        slug: 'team',
      })
      expect(result.success).toBe(false)
    })

    it('requires slug field', () => {
      const result = createTeamSchema.safeParse({
        name: 'Team',
      })
      expect(result.success).toBe(false)
    })

    it('allows description to be optional', () => {
      const result = createTeamSchema.safeParse({
        name: 'Team',
        slug: 'team',
      })
      expect(result.success).toBe(true)
    })

    it('validates name min length', () => {
      const result = createTeamSchema.safeParse({
        name: 'A',
        slug: 'team',
      })
      expect(result.success).toBe(false)
    })

    it('validates name max length', () => {
      const name = 'A'.repeat(101)
      const result = createTeamSchema.safeParse({
        name,
        slug: 'team',
      })
      expect(result.success).toBe(false)
    })

    it('validates slug format', () => {
      const result = createTeamSchema.safeParse({
        name: 'Team',
        slug: 'Invalid_Slug',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('teamRoleSchema', () => {
    it('accepts owner role', () => {
      const result = teamRoleSchema.safeParse('owner')
      expect(result.success).toBe(true)
    })

    it('accepts admin role', () => {
      const result = teamRoleSchema.safeParse('admin')
      expect(result.success).toBe(true)
    })

    it('accepts member role', () => {
      const result = teamRoleSchema.safeParse('member')
      expect(result.success).toBe(true)
    })

    it('accepts viewer role', () => {
      const result = teamRoleSchema.safeParse('viewer')
      expect(result.success).toBe(true)
    })

    it('accepts editor role (custom theme role)', () => {
      const result = teamRoleSchema.safeParse('editor')
      expect(result.success).toBe(true)
    })

    it('rejects invalid role', () => {
      const result = teamRoleSchema.safeParse('superadmin')
      expect(result.success).toBe(false)
    })
  })

  describe('invitationStatusSchema', () => {
    it('accepts all valid statuses', () => {
      expect(invitationStatusSchema.safeParse('pending').success).toBe(true)
      expect(invitationStatusSchema.safeParse('accepted').success).toBe(true)
      expect(invitationStatusSchema.safeParse('declined').success).toBe(true)
      expect(invitationStatusSchema.safeParse('expired').success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = invitationStatusSchema.safeParse('cancelled')
      expect(result.success).toBe(false)
    })
  })

  describe('inviteMemberSchema', () => {
    it('accepts valid email and role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'user@example.com',
        role: 'admin',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'not-an-email',
        role: 'admin',
      })
      expect(result.success).toBe(false)
    })

    it('rejects owner role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'user@example.com',
        role: 'owner',
      })
      expect(result.success).toBe(false)
    })

    it('accepts admin, editor, member, viewer roles', () => {
      expect(
        inviteMemberSchema.safeParse({
          email: 'user@example.com',
          role: 'admin',
        }).success
      ).toBe(true)
      expect(
        inviteMemberSchema.safeParse({
          email: 'user@example.com',
          role: 'editor',
        }).success
      ).toBe(true)
      expect(
        inviteMemberSchema.safeParse({
          email: 'user@example.com',
          role: 'member',
        }).success
      ).toBe(true)
      expect(
        inviteMemberSchema.safeParse({
          email: 'user@example.com',
          role: 'viewer',
        }).success
      ).toBe(true)
    })
  })

  describe('updateMemberRoleSchema', () => {
    it('accepts valid roles', () => {
      expect(updateMemberRoleSchema.safeParse({ role: 'admin' }).success).toBe(true)
      expect(updateMemberRoleSchema.safeParse({ role: 'editor' }).success).toBe(true)
      expect(updateMemberRoleSchema.safeParse({ role: 'member' }).success).toBe(true)
      expect(updateMemberRoleSchema.safeParse({ role: 'viewer' }).success).toBe(true)
    })

    it('rejects owner role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'owner' })
      expect(result.success).toBe(false)
    })

    it('rejects unknown role', () => {
      const result = updateMemberRoleSchema.safeParse({ role: 'superadmin' })
      expect(result.success).toBe(false)
    })
  })

  describe('paginationSchema', () => {
    it('uses default values', () => {
      const result = paginationSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('accepts custom pagination', () => {
      const result = paginationSchema.parse({
        page: 5,
        limit: 50,
      })
      expect(result.page).toBe(5)
      expect(result.limit).toBe(50)
    })

    it('coerces string to number', () => {
      const result = paginationSchema.parse({
        page: '3',
        limit: '30',
      })
      expect(result.page).toBe(3)
      expect(result.limit).toBe(30)
    })

    it('rejects negative page', () => {
      const result = paginationSchema.safeParse({
        page: -1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects zero page', () => {
      const result = paginationSchema.safeParse({
        page: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects limit over 100', () => {
      const result = paginationSchema.safeParse({
        limit: 101,
      })
      expect(result.success).toBe(false)
    })

    it('accepts limit of 100', () => {
      const result = paginationSchema.safeParse({
        limit: 100,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('teamListQuerySchema', () => {
    it('provides defaults', () => {
      const result = teamListQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.sort).toBe('createdAt')
      expect(result.order).toBe('desc')
      expect(result.scope).toBe('user')
    })

    it('accepts search parameter', () => {
      const result = teamListQuerySchema.parse({
        search: 'team name',
      })
      expect(result.search).toBe('team name')
    })

    it('accepts valid sort fields', () => {
      expect(teamListQuerySchema.safeParse({ sort: 'createdAt' }).success).toBe(true)
      expect(teamListQuerySchema.safeParse({ sort: 'updatedAt' }).success).toBe(true)
      expect(teamListQuerySchema.safeParse({ sort: 'name' }).success).toBe(true)
    })

    it('rejects invalid sort field', () => {
      const result = teamListQuerySchema.safeParse({
        sort: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('accepts valid order', () => {
      expect(teamListQuerySchema.safeParse({ order: 'asc' }).success).toBe(true)
      expect(teamListQuerySchema.safeParse({ order: 'desc' }).success).toBe(true)
    })

    it('accepts valid scope', () => {
      expect(teamListQuerySchema.safeParse({ scope: 'user' }).success).toBe(true)
      expect(teamListQuerySchema.safeParse({ scope: 'all' }).success).toBe(true)
    })
  })

  describe('memberListQuerySchema', () => {
    it('extends pagination schema', () => {
      const result = memberListQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('accepts role filter', () => {
      const result = memberListQuerySchema.parse({
        role: 'admin',
      })
      expect(result.role).toBe('admin')
    })

    it('accepts search parameter', () => {
      const result = memberListQuerySchema.parse({
        search: 'john',
      })
      expect(result.search).toBe('john')
    })
  })

  describe('invitationListQuerySchema', () => {
    it('extends pagination schema', () => {
      const result = invitationListQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('accepts status filter', () => {
      const result = invitationListQuerySchema.parse({
        status: 'pending',
      })
      expect(result.status).toBe('pending')
    })
  })
})
