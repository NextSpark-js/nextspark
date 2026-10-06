# Users API

Manage user profiles and account settings.

## Overview

The Users API allows you to view and update user profile information. Users can read and update their own profile; a superadmin can manage any user.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** (for server-to-server requests), sent as `x-api-key: <key>` or `Authorization: Bearer <key>`: it needs the `users:read` scope to read and `users:write` to update, and it answers as the key's owner

A user can read and update only themselves; a superadmin can manage any user. Anything else answers `403`.

## Endpoints

### Get Current User
`GET /api/v1/users/me`

Returns the signed-in user, with a session cookie or an API key. It is `GET /api/v1/users/:id` for the caller's own id, so it takes the same `metas` query parameters and answers with the same fields.

```bash
curl -H "Cookie: <session cookie>" https://yourdomain.com/api/v1/users/me
curl -H "Authorization: Bearer <api key>" https://yourdomain.com/api/v1/users/me
curl -H "x-api-key: <api key>" https://yourdomain.com/api/v1/users/me
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "john@example.com",
    "name": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "image": "/uploads/avatar.png",
    "country": null,
    "timezone": null,
    "language": "en",
    "role": "member",
    "emailVerified": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Update Current User
`PATCH /api/v1/users/me`

Update the signed-in user. It is `PATCH /api/v1/users/:id` for the caller's own id, with the same rules: only `firstName`, `lastName`, `language` and `metas` are accepted, and `role` is a superadmin's to change (anyone else gets `403`).

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "metas": { "preferences": { "theme": "dark" } }
}
```

To store per-user settings (the mobile client's preferences), use the user's metadata: `GET`/`PUT /api/v1/users/:id/meta/:key`.

### List Team Members
`GET /api/v1/users`

Returns all users in the current team.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `search` (string, optional): Search by name or email

### Get User by ID
`GET /api/v1/users/[id]`

Returns a specific user's profile. Only that user or a superadmin can read it; `403` otherwise.

**Path Parameters:**
- `id` (string, required): User ID

## User Roles

Team-level roles determine permissions:
- `member` - Basic team member
- `admin` - Can manage team settings and members
- `owner` - Full control of the team

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - User doesn't exist |
| 422 | Validation Error - Invalid data |

## Related APIs

- **[Auth](/api/v1/auth)** - Authentication and session management
- **[Teams](/api/v1/teams)** - Team membership and roles
- **[Team Invitations](/api/v1/team-invitations)** - Invite users to teams
- **[API Keys](/api/v1/api-keys)** - Manage programmatic access
