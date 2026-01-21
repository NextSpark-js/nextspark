# DevTools API

Development and debugging utilities for the NextSpark framework.

## Overview

The DevTools API provides endpoints for development-time utilities including documentation serving, feature registry access, scheduled action management, test flows, and block metadata. These endpoints are restricted to superadmin and developer users.

## Authentication

All endpoints require authentication via:
- **Session cookie** with superadmin or developer role
- **API Key** header with appropriate permissions

Only superadmin and developer users can access these endpoints.

## Endpoints

### Get Documentation
`GET /api/v1/devtools/docs?path={path}`

Serves markdown documentation files for API endpoints. Used by the API Explorer to display endpoint documentation.

**Query Parameters:**
- `path` (string, required): Path to the markdown file

**Valid Path Patterns:**
- `themes/{theme}/entities/{entity}/api/docs.md`
- `themes/{theme}/app/api/.../docs.md`
- `packages/core/templates/app/api/.../docs.md`
- `node_modules/@nextsparkjs/core/templates/app/api/.../docs.md`

**Example Request:**
```
GET /api/v1/devtools/docs?path=packages/core/templates/app/api/v1/teams/docs.md
```

**Response:**
```json
{
  "content": "# Teams API\n\nManage teams..."
}
```

### List Features
`GET /api/v1/devtools/features`

Returns the feature registry with test coverage information.

**Response:**
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "id": "auth-login",
        "name": "User Login",
        "category": "auth",
        "hasTests": true,
        "testFile": "auth/login.cy.ts"
      }
    ],
    "summary": {
      "total": 25,
      "withTests": 20,
      "withoutTests": 5
    },
    "meta": {
      "theme": "default",
      "generatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### List Blocks
`GET /api/v1/devtools/blocks`

Returns block registry metadata for development inspection.

**Response:**
```json
{
  "success": true,
  "data": {
    "blocks": [
      {
        "slug": "hero-simple",
        "name": "Simple Hero",
        "category": "hero",
        "hasPreview": true
      }
    ],
    "categories": ["hero", "content", "cta", "faq"],
    "total": 15
  }
}
```

### List Test Flows
`GET /api/v1/devtools/flows`

Returns test flows for end-to-end testing scenarios.

**Response:**
```json
{
  "success": true,
  "data": {
    "flows": [
      {
        "id": "user-onboarding",
        "name": "User Onboarding Flow",
        "steps": ["signup", "verify-email", "complete-profile"],
        "testFile": "flows/onboarding.cy.ts"
      }
    ]
  }
}
```

### List Scheduled Actions
`GET /api/v1/devtools/scheduled-actions`

Returns scheduled actions with filtering and pagination.

**Query Parameters:**
- `status` (string, optional): Filter by status (pending, running, completed, failed)
- `action_type` (string, optional): Filter by action type
- `page` (number, optional): Page number. Default: 1
- `limit` (number, optional): Items per page. Default: 20

**Response:**
```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "action_123",
        "actionType": "send-email",
        "status": "completed",
        "payload": { "to": "user@example.com" },
        "scheduledAt": "2024-01-15T10:00:00Z",
        "completedAt": "2024-01-15T10:00:05Z",
        "attempts": 1
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    },
    "meta": {
      "registeredActionTypes": ["send-email", "cleanup-expired", "sync-data"]
    }
  }
}
```

### Testing Information
`GET /api/v1/devtools/testing`

Returns testing configuration and utilities information.

**Response:**
```json
{
  "success": true,
  "data": {
    "cypress": {
      "baseUrl": "http://localhost:5173",
      "specPattern": "cypress/e2e/**/*.cy.ts"
    },
    "testUsers": [
      { "email": "superadmin@test.com", "role": "superadmin" },
      { "email": "admin@test.com", "role": "admin" }
    ],
    "coverage": {
      "enabled": true,
      "threshold": 80
    }
  }
}
```

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Missing or invalid path parameter |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Requires superadmin or developer role |
| 404 | Not Found - Document or resource not found |
| 500 | Server Error - Failed to read or process request |

## Security Notes

- Path traversal (`..`) is blocked to prevent unauthorized file access
- Only `.md` files are allowed for documentation endpoints
- All endpoints validate user role before processing
- DevTools API is only accessible in development environments by default
