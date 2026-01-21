# Teams API

Manage teams, members, subscriptions, and multi-tenancy features.

## Overview

The Teams API provides comprehensive team management including CRUD operations, member management, invitations, subscriptions, and usage tracking. Teams are the organizational unit for multi-tenancy, and resources are scoped to teams via Row Level Security (RLS).

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Team Endpoints

### List Teams
`GET /api/v1/teams`

Returns teams the current user belongs to.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team_abc123",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "avatarUrl": "/uploads/team-logo.png",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

### Create Team
`POST /api/v1/teams`

Create a new team. The creating user becomes the team owner.

**Request Body:**
```json
{
  "name": "New Team",
  "slug": "new-team"
}
```

### Get Team Details
`GET /api/v1/teams/[teamId]`

Returns detailed information about a specific team including member count.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "team_abc123",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "description": "Our main team",
    "avatarUrl": "/uploads/logo.png",
    "memberCount": 5,
    "userRole": "owner",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Update Team
`PATCH /api/v1/teams/[teamId]`

Update team settings. Requires `teams.update` permission (owner/admin).

**Request Body (partial update):**
```json
{
  "name": "Updated Team Name",
  "description": "New description",
  "avatarUrl": "/uploads/new-logo.png"
}
```

### Delete Team
`DELETE /api/v1/teams/[teamId]`

Delete a team. Requires owner role. Personal teams cannot be deleted.

---

## Member Endpoints

### List Team Members
`GET /api/v1/teams/[teamId]/members`

Returns all members of a team with pagination.

**Query Parameters:**
- `page` (number, optional): Page number. Default: 1
- `limit` (number, optional): Items per page. Default: 20
- `role` (string, optional): Filter by role (owner, admin, member, viewer)
- `search` (string, optional): Search by name or email

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member_123",
      "userId": "user_456",
      "teamId": "team_abc",
      "role": "admin",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "userImage": "/avatars/john.png",
      "joinedAt": "2024-01-20T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Invite Member
`POST /api/v1/teams/[teamId]/members`

Create an invitation for a new team member. Requires `members.invite` permission.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

**Role Hierarchy:** Users can only invite to roles at or below their own level.

### Update Member Role
`PATCH /api/v1/teams/[teamId]/members/[memberId]`

Update a team member's role. Requires admin+ permissions.

**Request Body:**
```json
{
  "role": "admin"
}
```

### Remove Member
`DELETE /api/v1/teams/[teamId]/members/[memberId]`

Remove a member from the team. Cannot remove the last owner.

---

## Invitation Endpoints

### List Team Invitations
`GET /api/v1/teams/[teamId]/invitations`

Returns pending invitations for a team.

**Query Parameters:**
- `status` (string, optional): Filter by status (pending, accepted, expired)

### Create Invitation
`POST /api/v1/teams/[teamId]/invitations`

Same as POST /members - creates a new invitation.

---

## Subscription Endpoints

### Get Team Subscription
`GET /api/v1/teams/[teamId]/subscription`

Returns the team's active subscription details. Requires `billing.view` permission.

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "planId": "plan_pro",
      "planName": "Pro",
      "status": "active",
      "currentPeriodEnd": "2024-03-01T00:00:00Z",
      "cancelAtPeriodEnd": false
    }
  }
}
```

---

## Usage & Quota Endpoints

### Check Usage Limit
`GET /api/v1/teams/[teamId]/usage/[limitSlug]`

Check current usage against plan limits.

**Path Parameters:**
- `limitSlug`: The limit identifier (e.g., "team_members", "storage_gb", "api_calls")

**Response:**
```json
{
  "success": true,
  "data": {
    "limit": "team_members",
    "current": 4,
    "max": 10,
    "remaining": 6,
    "percentage": 40
  }
}
```

---

## Invoice Endpoints

### List Team Invoices
`GET /api/v1/teams/[teamId]/invoices`

Returns billing invoices for the team.

**Query Parameters:**
- `limit` (number): Number of invoices to return
- `status` (string): Filter by status (paid, open, void)

### Get Invoice
`GET /api/v1/teams/[teamId]/invoices/[invoiceNumber]`

Returns a specific invoice with download URL.

---

## Utility Endpoints

### Switch Active Team
`POST /api/v1/teams/switch`

Switch the user's active team context. Sets a cookie for server-side access.

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
    "success": true,
    "teamId": "team_abc123",
    "message": "Active team switched successfully"
  }
}
```

---

## Team Roles

| Role | Permissions |
|------|------------|
| **owner** | Full access, billing, delete team, transfer ownership |
| **admin** | Manage members, update team settings, view billing |
| **member** | Access team resources, standard operations |
| **viewer** | Read-only access to team resources |

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid parameters or request body |
| 401 | AUTHENTICATION_FAILED | Missing or invalid authentication |
| 403 | INSUFFICIENT_PERMISSIONS | User lacks required permissions |
| 403 | ROLE_HIERARCHY_VIOLATION | Cannot invite to higher role |
| 403 | NOT_TEAM_MEMBER | User is not a member of the team |
| 403 | PERSONAL_TEAM_DELETE_FORBIDDEN | Cannot delete personal teams |
| 404 | TEAM_NOT_FOUND | Team not found or no access |
| 409 | ALREADY_MEMBER | User is already a team member |
| 409 | INVITATION_EXISTS | Pending invitation already exists |
| 409 | SLUG_EXISTS | Team slug already taken |

## Related APIs

- **[Users](/api/v1/users)** - User profiles and team membership
- **[Team Invitations](/api/v1/team-invitations)** - Manage pending invitations
- **[Billing](/api/v1/billing)** - Subscription management and checkout
- **[API Keys](/api/v1/api-keys)** - Team-scoped API keys
- **[Dynamic Entities](/api/v1/{entity})** - Team-scoped entity data
