# /session:doc:feature

Generate comprehensive documentation for a completed feature.

---

## Required Skills

**[MANDATORY]** Read before executing:
- `.claude/skills/documentation/SKILL.md` - Documentation structure and format

---

## Syntax

```
/session:doc:feature [--format <format>]
```

---

## Behavior

Creates feature documentation by analyzing session files and implementation.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:doc:feature                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     - requirements.md                                           │
│     - plan.md                                                   │
│     - scope.json                                                │
│     ↓                                                           │
│  2. Analyze implementation                                      │
│     - Read modified files                                       │
│     - Extract key patterns                                      │
│     ↓                                                           │
│  3. Generate documentation                                      │
│     - Overview                                                  │
│     - API reference                                             │
│     - Usage examples                                            │
│     - Configuration                                             │
│     ↓                                                           │
│  4. Add to documentation system                                 │
│     ↓                                                           │
│  5. Update navigation                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
📚 GENERATE FEATURE DOCUMENTATION

Session: stories/2026-01-11-new-products-entity
Feature: Products Management

─────────────────────────────────────────

🔍 ANALYZING SESSION

From requirements.md:
├─ 5 Acceptance Criteria
└─ 3 PM Decisions

From scope.json:
├─ 12 files modified
├─ API: 5 endpoints
└─ UI: 4 components

─────────────────────────────────────────

📝 GENERATING DOCUMENTATION

File: docs/features/products.md

```markdown
---
title: Products Management
description: Complete guide to the products entity and management system
category: features
order: 5
---

# Products Management

The products system provides complete CRUD functionality for
managing products with categories, images, and team isolation.

## Overview

Products are team-scoped entities that support:
- Basic information (name, description, price)
- Category assignment
- Image uploads (max 5)
- Active/inactive status

## Quick Start

### Creating a Product

```typescript
// Using the API
const response = await fetch('/api/v1/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    name: 'My Product',
    price: 99.99,
    categoryId: 'cat-uuid'
  })
});
```

### Using the UI

1. Navigate to Dashboard > Products
2. Click "New Product"
3. Fill in the required fields
4. Upload images (optional)
5. Click "Save"

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/products | List products |
| GET | /api/v1/products/:id | Get product |
| POST | /api/v1/products | Create product |
| PATCH | /api/v1/products/:id | Update product |
| DELETE | /api/v1/products/:id | Delete product |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| categoryId | uuid | Filter by category |
| isActive | boolean | Filter by status |

## Configuration

### Entity Config

Location: `core/config/entities/products.ts`

```typescript
export const productsEntity: EntityConfig = {
  name: 'products',
  displayName: 'Products',
  icon: 'Package',
  fields: {
    // Field definitions
  }
};
```

## Permissions

| Role | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| Admin | ✓ | ✓ | ✓ | ✓ |
| Member | - | ✓ | - | - |
| Viewer | - | ✓ | - | - |
```

─────────────────────────────────────────

📁 FILE CREATED

Location: docs/features/products.md
Words: 450
Sections: 6

Updating navigation...
✓ Added to docs sidebar

─────────────────────────────────────────

Preview: http://localhost:3000/docs/features/products

✓ Documentation generated successfully
```

---

## Options

| Option | Description |
|--------|-------------|
| `--format <format>` | md, mdx, or notion |
| `--api-only` | Only API documentation |
| `--no-examples` | Skip code examples |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:doc:read` | Read existing docs |
| `/session:doc:bdd` | Generate BDD docs |
| `/session:close` | Close session |
