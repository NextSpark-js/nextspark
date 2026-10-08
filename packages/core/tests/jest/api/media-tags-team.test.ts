/**
 * POST and PUT /api/v1/media/:id/tags: a tag of another team answers 404, as another team's post category does, and
 * the service gets the media item's team to check it against.
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', user: { id: 'owna' } }),
  createAuthFailureResponse: jest.fn(),
  resolveTeamContext: jest.fn().mockResolvedValue('team-a'),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: jest.fn().mockResolvedValue(true) }))
const tagNotFound = Object.assign(new Error('Tag not found'), { code: 'TAG_NOT_FOUND' })
const mockMedia = {
  getById: jest.fn().mockResolvedValue({ id: 'media-a', teamId: 'team-a' }),
  addTag: jest.fn().mockRejectedValue(tagNotFound),
  setTags: jest.fn().mockRejectedValue(tagNotFound),
  getMediaTags: jest.fn().mockResolvedValue([]),
}
jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({ MediaService: mockMedia }))

import { POST, PUT } from '../../../src/routes/api/v1/media/[id]/tags/route'

const send = (method: string, body: unknown) =>
  new NextRequest('http://localhost:3000/api/v1/media/media-a/tags', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const ctx = { params: Promise.resolve({ id: 'media-a' }) }

it('POST with another team\'s tag answers 404 and names the media item\'s team to the service', async () => {
  const response = await POST(send('POST', { tagId: 'tag-b' }), ctx)
  expect(response.status).toBe(404)
  expect(mockMedia.addTag).toHaveBeenCalledWith('media-a', 'tag-b', 'owna', 'team-a')
})

it('PUT with another team\'s tag answers 404', async () => {
  const response = await PUT(send('PUT', { tagIds: ['tag-a', 'tag-b'] }), ctx)
  expect(response.status).toBe(404)
  expect(mockMedia.setTags).toHaveBeenCalledWith('media-a', ['tag-a', 'tag-b'], 'owna', 'team-a')
})
