# Theme API

Access theme metadata and route theme-specific endpoints.

## Overview

The Theme API provides endpoints to list installed themes and their API capabilities. Theme-specific endpoints are routed through `/api/v1/theme/{themeName}/...`.

## Authentication

- **GET /api/v1/theme** (list themes) is public
- Theme-specific routes may have their own authentication requirements

## Endpoints

### List Themes
`GET /api/v1/theme`

Returns all registered themes with their API status and endpoints.

**Response:**
```json
{
  "success": true,
  "themes": [
    {
      "name": "default",
      "displayName": "Default Theme",
      "version": "1.0.0",
      "description": "The default NextSpark theme",
      "hasAPI": true,
      "apiEndpoints": [
        {
          "path": "/config",
          "methods": ["GET"],
          "description": "Get theme configuration"
        }
      ],
      "baseUrl": "/api/v1/theme/default"
    }
  ],
  "totalThemes": 2,
  "activeTheme": "default",
  "themesWithAPI": 1
}
```

### Theme-Specific Routes
`* /api/v1/theme/{themeName}/...`

Each theme can define its own API routes. These are handled by the catch-all route and forwarded to the theme's route handlers.

**Example:**
- `GET /api/v1/theme/default/config` - Get theme config
- `GET /api/v1/theme/blog/categories` - Get blog categories

## Theme Structure

Themes can expose:
- **API Routes**: Custom endpoints under `/api/v1/theme/{name}/`
- **Entities**: Custom entity types with their own APIs
- **Blocks**: Page builder blocks
- **Layouts**: Custom page layouts

## Active Theme

The active theme is determined by `NEXT_PUBLIC_ACTIVE_THEME` environment variable. Only the active theme's routes are accessible.

## Error Responses

| Status | Description |
|--------|-------------|
| 404 | Theme not found or route doesn't exist |
| 500 | Server Error - Failed to list themes |
