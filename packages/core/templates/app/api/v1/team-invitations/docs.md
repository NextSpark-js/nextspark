# Team Invitations API

Manage team invitations for adding new members to teams.

## Overview

The Team Invitations API allows you to create, list, and manage pending invitations to join a team. Invitations are sent via email and can be accepted by the recipient.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### List Invitations
`GET /api/v1/team-invitations`

Returns all pending invitations for the current team.

**Example Response:**
```json
{
  "data": [
    {
      "id": "inv_123",
      "email": "newuser@example.com",
      "role": "member",
      "status": "pending",
      "expiresAt": "2024-02-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create Invitation
`POST /api/v1/team-invitations`

Send a new invitation to join the team.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

**Roles:**
- `member` - Basic team member
- `admin` - Can manage team settings and members
- `owner` - Full control (only one per team)

### Cancel Invitation
`DELETE /api/v1/team-invitations/[id]`

Cancel a pending invitation.

**Path Parameters:**
- `id` (string, required): Invitation ID

### Resend Invitation
`POST /api/v1/team-invitations/[id]/resend`

Resend the invitation email.

**Path Parameters:**
- `id` (string, required): Invitation ID

## Invitation Flow

1. Admin creates invitation with email and role
2. System sends invitation email with unique link
3. Recipient clicks link and signs up/signs in
4. User is automatically added to the team

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Invitation doesn't exist |
| 409 | Conflict - User already in team or invitation pending |
| 422 | Validation Error - Invalid email |
