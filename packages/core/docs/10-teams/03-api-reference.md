---
title: API Reference
description: Complete reference for Teams API endpoints
---

# Teams API Reference

All Teams endpoints support dual authentication (session + API key) and include CORS headers.

## Authentication

All endpoints require authentication via one of:

1. **Session Cookie** - For browser-based requests
2. **API Key** - Via `Authorization: Bearer <api-key>` header

## Base URL

```text
/api/v1/teams
```

---

## Teams CRUD

### List User's Teams

Returns all teams the authenticated user is a member of.

```http
GET /api/v1/teams
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | - | Search in name and description |
| `sort` | string | `createdAt` | Sort field: `createdAt`, `updatedAt`, `name` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "team_abc123",
      "name": "My Team",
      "slug": "my-team",
      "description": "A collaborative workspace",
      "ownerId": "user_123",
      "avatarUrl": null,
      "settings": {},
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z",
      "userRole": "owner",
      "memberCount": 3
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasMore": false
  }
}
```

### Create Team

Creates a new team. The authenticated user becomes the owner.

> **Mode Restriction**: This endpoint is only available in `multi-tenant` mode. In other modes, it returns `403 Forbidden` with error code `TEAM_CREATION_DISABLED`.

```http
POST /api/v1/teams
```

**Mode Availability:**

| Mode | Create Team Available |
|------|----------------------|
| `single-user` | ❌ Returns 403 |
| `single-tenant` | ❌ Returns 403 |
| `multi-tenant` | ✅ Available (controlled by `allowCreateTeams` option) |

**Request Body:**

```json
{
  "name": "My Team",
  "slug": "my-team",
  "description": "Optional description"
}
```

**Validation Rules:**

| Field | Rules |
|-------|-------|
| `name` | Required, 2-100 characters |
| `slug` | Required, lowercase alphanumeric with hyphens, unique |
| `description` | Optional, max 500 characters |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "team_abc123",
    "name": "My Team",
    "slug": "my-team",
    "description": "Optional description",
    "ownerId": "user_123",
    "memberCount": 1
  },
  "meta": {
    "created": true
  }
}
```

**Error Responses:**

- `403 Forbidden` - Team creation disabled for this mode (`TEAM_CREATION_DISABLED`)
- `409 Conflict` - Slug already exists (`SLUG_EXISTS`)
- `400 Bad Request` - Validation error (`VALIDATION_ERROR`)

### Get Team Details

```http
GET /api/v1/teams/:teamId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "team_abc123",
    "name": "My Team",
    "slug": "my-team",
    "description": "A collaborative workspace",
    "ownerId": "user_123",
    "avatarUrl": null,
    "settings": {},
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z",
    "memberCount": 3,
    "userRole": "owner"
  }
}
```

### Update Team

Update team details. Requires `owner` or `admin` role.

```http
PATCH /api/v1/teams/:teamId
```

**Request Body:**

```json
{
  "name": "Updated Team Name",
  "description": "New description",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "team_abc123",
    "name": "Updated Team Name",
    "description": "New description",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

### Delete Team

Delete a team. Only the owner can delete.

```http
DELETE /api/v1/teams/:teamId
```

**Response (204 No Content):**

Empty response on success.

**Error Responses:**

- `403 Forbidden` - Not team owner

---

## Team Members

### List Team Members

```http
GET /api/v1/teams/:teamId/members
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |
| `role` | string | - | Filter by role |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "member_123",
      "teamId": "team_abc123",
      "userId": "user_123",
      "role": "owner",
      "joinedAt": "2025-01-15T10:30:00Z",
      "user": {
        "id": "user_123",
        "email": "owner@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "image": null
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 3
  }
}
```

### Invite Member

Send an invitation to join the team. Requires `owner` or `admin` role.

```http
POST /api/v1/teams/:teamId/members
```

**Request Body:**

```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Valid Roles for Invitation:**

- `admin`
- `member`
- `viewer`

Note: Cannot invite as `owner`.

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "inv_123",
    "teamId": "team_abc123",
    "email": "newmember@example.com",
    "role": "member",
    "status": "pending",
    "token": "uuid-v4-token",
    "expiresAt": "2025-01-22T10:30:00Z"
  },
  "meta": {
    "emailSent": true
  }
}
```

**Error Responses:**

- `400 Bad Request` - User already a member (`ALREADY_MEMBER`)
- `400 Bad Request` - Pending invitation exists (`INVITATION_EXISTS`)
- `403 Forbidden` - Not authorized to invite

### Update Member Role

Change a member's role. Requires `owner` or `admin` role.

```http
PATCH /api/v1/teams/:teamId/members/:memberId
```

**Request Body:**

```json
{
  "role": "admin"
}
```

**Rules:**

- Cannot change owner's role
- Only owner can promote to admin
- Cannot demote yourself

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "member_123",
    "role": "admin",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

### Remove Member

Remove a member from the team. Requires `owner` or `admin` role.

```http
DELETE /api/v1/teams/:teamId/members/:memberId
```

**Rules:**

- Cannot remove the owner
- Cannot remove yourself

**Response (204 No Content):**

Empty response on success.

---

## Team Invitations

### List Pending Invitations (User)

Get all pending invitations for the authenticated user.

```http
GET /api/v1/team-invitations
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "inv_123",
      "teamId": "team_abc123",
      "email": "user@example.com",
      "role": "member",
      "status": "pending",
      "expiresAt": "2025-01-22T10:30:00Z",
      "team": {
        "id": "team_abc123",
        "name": "Great Team",
        "slug": "great-team"
      },
      "invitedByUser": {
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

### Accept Invitation

Accept a pending invitation using the token.

```http
POST /api/v1/team-invitations/:token/accept
```

**Response:**

```json
{
  "success": true,
  "data": {
    "teamId": "team_abc123",
    "role": "member",
    "joinedAt": "2025-01-15T12:00:00Z"
  },
  "meta": {
    "redirectTo": "/dashboard"
  }
}
```

**Error Responses:**

- `404 Not Found` - Invalid token (`INVITATION_NOT_FOUND`)
- `400 Bad Request` - Invitation expired (`INVITATION_EXPIRED`)
- `400 Bad Request` - Already a member (`ALREADY_MEMBER`)

### Decline Invitation

Decline a pending invitation.

```http
POST /api/v1/team-invitations/:token/decline
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "declined"
  }
}
```

### Cancel Invitation (Admin)

Cancel a pending invitation. Requires `owner` or `admin` role.

```http
DELETE /api/v1/team-invitations/:invitationId
```

**Response (204 No Content):**

Empty response on success.

---

## Team Switching

### Switch Active Team

Update the user's active team context.

```http
POST /api/v1/teams/switch
```

**Request Body:**

```json
{
  "teamId": "team_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "activeTeamId": "team_abc123"
  }
}
```

This endpoint:
1. Validates user is a member of the team
2. Updates session context
3. Returns the new active team ID

---

## Special Endpoints

### Signup with Invitation

Create account and automatically join team (skips email verification).

```http
POST /api/v1/auth/signup-with-invite
```

**Mode-Specific Behavior:**

| Mode | Signup Behavior |
|------|-----------------|
| `single-user` | Standard signup, user gets isolated team |
| `single-tenant` | **Required** - public signup blocked after first user |
| `multi-tenant` | Join team specified in invitation |

> **Single-Tenant Mode**: In `single-tenant` mode, public signup (`/api/auth/signup`) is blocked after the first user creates the global team. All subsequent users **must** use this endpoint with a valid invitation token. Attempting public signup returns `403 Forbidden` with `PUBLIC_SIGNUP_RESTRICTED`.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "inviteToken": "uuid-v4-token"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_456",
      "email": "newuser@example.com"
    },
    "teamId": "team_abc123"
  },
  "meta": {
    "redirectTo": "/dashboard",
    "emailVerified": true
  }
}
```

**Single-Tenant First User Flow:**

The first user in `single-tenant` mode uses regular signup (`/api/auth/signup`):

1. User signs up via `/api/auth/signup`
2. System creates global team automatically
3. User becomes team owner
4. All subsequent signups require invitation

```json
// First user signup response (single-tenant)
{
  "success": true,
  "data": {
    "user": { "id": "user_001" },
    "team": {
      "id": "team_global",
      "name": "Organization"
    }
  },
  "meta": {
    "isFirstUser": true,
    "teamCreated": true
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_FAILED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `SLUG_EXISTS` | 409 | Team slug already in use |
| `ALREADY_MEMBER` | 400 | User is already a team member |
| `INVITATION_EXISTS` | 400 | Pending invitation already exists |
| `INVITATION_NOT_FOUND` | 404 | Invalid invitation token |
| `INVITATION_EXPIRED` | 400 | Invitation has expired |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `TEAM_CREATION_DISABLED` | 403 | Team creation not allowed in current mode |
| `PUBLIC_SIGNUP_RESTRICTED` | 403 | Public signup blocked (single-tenant mode after first user) |
| `INVITATIONS_DISABLED` | 403 | Invitations not allowed in current mode (single-user) |

## Rate Limiting

API key requests are subject to rate limiting based on the key's tier:

| Tier | Requests/minute |
|------|-----------------|
| Free | 60 |
| Pro | 300 |
| Enterprise | 1000 |

Session-based requests have a higher default limit.

---

## Team Billing Endpoints

> **Note:** These endpoints are part of the Billing system but operate on team context. See [Billing API Reference](../19-billing/04-api-reference.md) for full billing documentation.

### Get Team Subscription

```http
GET /api/v1/teams/{teamId}/subscription
```

Returns the active subscription for the team.

### Get Team Usage

```http
GET /api/v1/teams/{teamId}/usage/{limitSlug}
```

Returns current usage for a specific limit (e.g., `projects`, `team_members`).

### Get Team Invoices

```http
GET /api/v1/teams/{teamId}/invoices
```

Returns billing invoices for the team.

---

## Related Documentation

- [React Integration](./04-react-integration.md) - Using hooks and context
- [Permissions System](./06-permissions.md) - Role-based access
- [Database Schema](./02-database-schema.md) - Tables and RLS
- [Billing API](../19-billing/04-api-reference.md) - Subscription and usage endpoints
