# Blocks API

Access and validate page builder blocks registered in the application.

## Overview

The Blocks API provides read-only access to block metadata from the block registry. Blocks are reusable content components used in the page builder. This API allows you to list available blocks, retrieve individual block details, and validate block properties against their schemas.

## Authentication

These endpoints are **public** (no authentication required) as block metadata is not sensitive.

## Endpoints

### List Blocks
`GET /api/v1/blocks`

Returns all registered blocks with their metadata.

**Query Parameters:**
- `category` (string, optional): Filter by block category (e.g., "hero", "content", "cta")
- `scope` (string, optional): Filter by allowed scope (e.g., "pages", "posts")

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "slug": "hero-simple",
      "name": "Simple Hero",
      "description": "A simple hero block with title and subtitle",
      "category": "hero",
      "icon": "Layout",
      "thumbnail": "/blocks/hero-simple.png",
      "scope": ["pages"],
      "fieldDefinitions": [
        {
          "name": "title",
          "type": "text",
          "label": "Title",
          "required": true
        },
        {
          "name": "subtitle",
          "type": "text",
          "label": "Subtitle"
        }
      ]
    }
  ],
  "meta": {
    "categories": ["hero", "content", "cta", "testimonials", "faq"],
    "total": 15
  }
}
```

### Get Block by Slug
`GET /api/v1/blocks/[slug]`

Returns detailed metadata for a specific block.

**Path Parameters:**
- `slug` (string, required): The block identifier (e.g., "hero-simple", "faq-accordion")

**Example Response:**
```json
{
  "slug": "faq-accordion",
  "name": "FAQ Accordion",
  "description": "Expandable FAQ section with questions and answers",
  "category": "faq",
  "icon": "HelpCircle",
  "thumbnail": "/blocks/faq-accordion.png",
  "fieldDefinitions": [
    {
      "name": "title",
      "type": "text",
      "label": "Section Title"
    },
    {
      "name": "items",
      "type": "repeater",
      "label": "FAQ Items",
      "fields": [
        { "name": "question", "type": "text", "label": "Question" },
        { "name": "answer", "type": "richtext", "label": "Answer" }
      ]
    }
  ]
}
```

### Validate Block Props
`POST /api/v1/blocks/validate`

Validates block properties against the block's Zod schema.

**Request Body:**
```json
{
  "blockSlug": "hero-simple",
  "props": {
    "title": "Welcome to Our Site",
    "subtitle": "Discover what we offer"
  }
}
```

**Success Response:**
```json
{
  "valid": true
}
```

**Validation Error Response (400):**
```json
{
  "valid": false,
  "errors": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["title"],
      "message": "Required"
    }
  ]
}
```

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid request body or validation failed |
| 404 | Not Found - Block with specified slug not found |
| 500 | Server Error - Internal error or missing schema |

## Block Categories

Common block categories include:
- `hero` - Hero sections and page headers
- `content` - General content blocks (text, images, galleries)
- `cta` - Call-to-action sections
- `testimonials` - Customer testimonials and reviews
- `faq` - Frequently asked questions
- `pricing` - Pricing tables and plans
- `features` - Feature lists and grids
- `contact` - Contact forms and information

## Field Types

Block field definitions use these types:
- `text` - Single line text input
- `textarea` - Multi-line text
- `richtext` - Rich text editor (HTML)
- `number` - Numeric input
- `select` - Dropdown selection
- `checkbox` - Boolean toggle
- `image` - Image upload/selection
- `link` - URL with label
- `repeater` - Repeatable group of fields
- `group` - Nested field group

## Usage Notes

- Block slugs are unique identifiers in kebab-case
- Field definitions describe the editable properties of each block
- The `scope` property indicates where blocks can be used (pages, posts, etc.)
- Use the validate endpoint before saving block content to ensure data integrity
