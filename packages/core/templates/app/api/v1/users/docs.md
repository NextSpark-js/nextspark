# Users API

Manage user profiles and account settings.

## Overview

The Users API allows you to view and update user profile information. Users can update their own profile, while admins can manage other users within their team.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

## Endpoints

### Get Current User
`GET /api/v1/users/me`

Returns the currently authenticated user's profile.

**Example Response:**
```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "/uploads/avatar.png",
  "createdAt": "2024-01-15T10:30:00Z",
  "teams": [
    {
      "id": "team_456",
      "name": "Acme Corp",
      "role": "admin"
    }
  ]
}
```

### Update Current User
`PATCH /api/v1/users/me`

Update the current user's profile.

**Request Body:**
```json
{
  "name": "John Smith",
  "image": "/uploads/new-avatar.png"
}
```

### List Team Members
`GET /api/v1/users`

Returns all users in the current team.

**Query Parameters:**
- `limit` (number, optional): Maximum records to return. Default: 20
- `offset` (number, optional): Number of records to skip. Default: 0
- `search` (string, optional): Search by name or email

### Get User by ID
`GET /api/v1/users/[id]`

Returns a specific user's profile (within the same team).

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
