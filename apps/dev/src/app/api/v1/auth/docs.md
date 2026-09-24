# Auth API

Authentication endpoints powered by Better Auth with NextSpark extensions.

## Overview

The Auth API provides authentication functionality including sign up, sign in, password reset, and specialized flows like invitation-based registration. Core auth endpoints are handled by Better Auth at `/api/auth/*`, while custom extensions are available at `/api/v1/auth/*`.

## Better Auth Endpoints

These endpoints are handled by Better Auth at `/api/auth/*`:

### Sign Up
`POST /api/auth/sign-up/email`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

### Sign In
`POST /api/auth/sign-in/email`

Authenticate with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Sign Out
`POST /api/auth/sign-out`

End the current session.

### Get Session
`GET /api/auth/session`

Get current user session.

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true
  },
  "session": {
    "id": "session_abc",
    "expiresAt": "2024-02-15T10:00:00Z"
  }
}
```

### Forgot Password
`POST /api/auth/forget-password`

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### Reset Password
`POST /api/auth/reset-password`

Reset password with token from email.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "newsecurepassword"
}
```

---

## NextSpark Extensions

### Sign Up with Invitation
`POST /api/v1/auth/signup-with-invite`

Create an account and automatically join a team via invitation. This is a single-step flow that:
1. Validates the invitation token
2. Creates the user account
3. Skips email verification (invitation proves ownership)
4. Adds user to the invited team with specified role

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "inviteToken": "invitation_token_from_email"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true
    },
    "teamId": "team_abc123",
    "redirectTo": "/dashboard/settings/teams"
  }
}
```

**Validation Rules:**
- Email must match the invitation recipient
- Password minimum 8 characters
- Invitation must be pending and not expired
- Email format validation

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_FIELDS | Required fields not provided |
| 400 | INVALID_EMAIL | Email format is invalid |
| 400 | INVALID_PASSWORD | Password doesn't meet requirements |
| 403 | EMAIL_MISMATCH | Email doesn't match invitation |
| 404 | INVITATION_NOT_FOUND | Invalid invitation token |
| 409 | USER_ALREADY_EXISTS | Account with email already exists |
| 409 | INVITATION_NOT_PENDING | Invitation already used or cancelled |
| 410 | INVITATION_EXPIRED | Invitation has expired |
| 500 | SIGNUP_FAILED | Account creation failed |

## OAuth Providers

If configured, these OAuth endpoints are available:

- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/github` - GitHub OAuth callback
- `GET /api/auth/callback/microsoft` - Microsoft OAuth callback

## Session Management

Sessions are managed via secure HTTP-only cookies. Session duration and refresh behavior are configured in the Better Auth settings.

## API Key Authentication

For server-to-server requests, API keys can be used instead of session cookies:

```
Authorization: Bearer sk_live_xxx
# or
x-api-key: sk_live_xxx
```

See the API Keys documentation for more information.

## Related APIs

- **[API Keys](/api/v1/api-keys)** - Create and manage API keys for server-to-server auth
- **[Teams](/api/v1/teams)** - Team management and invitation acceptance
- **[Team Invitations](/api/v1/team-invitations)** - Manage team invitations
- **[Users](/api/v1/users)** - User profile management after authentication
