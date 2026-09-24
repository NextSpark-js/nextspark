/**
 * API Presets for Auth
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * Note: Core Better Auth endpoints are at /api/auth/*, not /api/v1/auth/*
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/auth',
  summary: 'Authentication with Better Auth and NextSpark extensions',
  presets: [
    // NextSpark extension: signup with invite
    {
      id: 'signup-with-invite',
      title: 'Sign Up with Invitation',
      description: 'Create account and join team via invitation token',
      method: 'POST',
      path: '/signup-with-invite',
      payload: {
        email: 'newuser@example.com',
        password: 'Test1234',
        firstName: 'John',
        lastName: 'Doe',
        inviteToken: 'invitation_token_here'
      },
      tags: ['write', 'signup']
    },
    {
      id: 'signup-with-invite-minimal',
      title: 'Sign Up (Minimal)',
      description: 'Sign up with only required fields',
      method: 'POST',
      path: '/signup-with-invite',
      payload: {
        email: 'user@example.com',
        password: 'SecurePass123',
        inviteToken: 'invitation_token_here'
      },
      tags: ['write', 'signup']
    }
  ]
})
