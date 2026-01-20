# Plugin API

Access plugin metadata and route plugin-specific endpoints.

## Overview

The Plugin API provides endpoints to list installed plugins and their API capabilities. Plugin-specific endpoints are routed through `/api/v1/plugin/{pluginName}/...`.

## Authentication

- **GET /api/v1/plugin** (list plugins) is public
- Plugin-specific routes may have their own authentication requirements

## Endpoints

### List Plugins
`GET /api/v1/plugin`

Returns all registered plugins with their API status and endpoints.

**Response:**
```json
{
  "success": true,
  "plugins": [
    {
      "name": "email-notifications",
      "displayName": "Email Notifications",
      "version": "1.0.0",
      "description": "Send email notifications for various events",
      "enabled": true,
      "hasAPI": true,
      "apiEndpoints": [
        {
          "path": "/send",
          "methods": ["POST"],
          "description": "Route file endpoint"
        }
      ],
      "baseUrl": "/api/v1/plugins/email-notifications",
      "components": ["NotificationSettings", "EmailPreview"],
      "services": ["EmailService"]
    }
  ],
  "totalPlugins": 5,
  "enabledPlugins": 4,
  "pluginsWithAPI": 3
}
```

### Plugin-Specific Routes
`* /api/v1/plugin/{pluginName}/...`

Each plugin can define its own API routes. These are handled by the catch-all route and forwarded to the plugin's route handlers.

**Example:**
- `POST /api/v1/plugin/email-notifications/send` - Send notification
- `GET /api/v1/plugin/analytics/stats` - Get analytics data

## Plugin Structure

Plugins can expose:
- **API Routes**: Custom endpoints under `/api/v1/plugin/{name}/`
- **Components**: React components for UI
- **Services**: Business logic services

## Plugin Registry

The plugin registry (`PLUGIN_REGISTRY`) contains metadata about each plugin:
- `hasAPI`: Whether the plugin has API routes
- `routeFiles`: List of available route endpoints
- `enabled`: Whether the plugin is active

## Error Responses

| Status | Description |
|--------|-------------|
| 404 | Plugin not found or route doesn't exist |
| 500 | Server Error - Failed to list plugins |
