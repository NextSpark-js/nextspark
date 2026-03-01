---
disable-model-invocation: true
---

# /session:db:sample

Generate coherent sample data for database entities.

---

## Required Skills

**[MANDATORY]** Read before executing:
- `.claude/skills/database-migrations/SKILL.md` - Understand sample data patterns

---

## Syntax

```
/session:db:sample <entity-name> [--count <n>]
```

---

## Behavior

Creates realistic sample data that respects foreign keys and business rules.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:db:sample                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Read entity schema                                          │
│     - Fields and types                                          │
│     - Foreign key relationships                                 │
│     ↓                                                           │
│  2. Analyze existing data                                       │
│     - Reference tables for FKs                                  │
│     - Available team/user IDs                                   │
│     ↓                                                           │
│  3. Generate sample data                                        │
│     - Realistic names/values                                    │
│     - Valid FK references                                       │
│     - Varied data distribution                                  │
│     ↓                                                           │
│  4. Create SQL insert statements                                │
│     ↓                                                           │
│  5. Add to migration or seed file                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🌱 GENERATE SAMPLE DATA

Entity: products
Count: 20 records

─────────────────────────────────────────

🔍 ANALYZING SCHEMA

Fields:
├─ name: VARCHAR(255) NOT NULL
├─ description: TEXT
├─ price: DECIMAL(10,2) NOT NULL
├─ categoryId: UUID FK → categories
├─ isActive: BOOLEAN
├─ teamId: UUID FK → teams
└─ createdById: UUID FK → user

Foreign Keys:
├─ categories: 5 existing records
├─ teams: 3 existing records
└─ user: 10 existing records

─────────────────────────────────────────

📝 GENERATED DATA

File: core/db/seeds/008_products_sample.sql

```sql
-- ============================================
-- Sample Data: products
-- Count: 20 records
-- Generated: 2026-01-11
-- ============================================

-- Using existing references
-- Teams: team_alpha, team_beta, team_gamma
-- Categories: Electronics, Clothing, Home, Sports, Books

INSERT INTO products (
    id, name, description, price, categoryId,
    isActive, teamId, createdById
) VALUES
    -- Team Alpha products (Electronics focus)
    (
        'prod-001-uuid',
        'Wireless Bluetooth Headphones',
        'Premium noise-cancelling headphones with 30h battery',
        149.99,
        (SELECT id FROM categories WHERE name = 'Electronics'),
        true,
        (SELECT id FROM teams WHERE name = 'Team Alpha'),
        (SELECT id FROM "user" WHERE email = 'admin@test.com')
    ),
    (
        'prod-002-uuid',
        'Smart Watch Pro',
        'Fitness tracker with heart rate monitor',
        299.99,
        (SELECT id FROM categories WHERE name = 'Electronics'),
        true,
        (SELECT id FROM teams WHERE name = 'Team Alpha'),
        (SELECT id FROM "user" WHERE email = 'admin@test.com')
    ),
    -- ... 18 more records with varied data
    (
        'prod-020-uuid',
        'Yoga Mat Premium',
        'Non-slip eco-friendly yoga mat',
        45.00,
        (SELECT id FROM categories WHERE name = 'Sports'),
        true,
        (SELECT id FROM teams WHERE name = 'Team Gamma'),
        (SELECT id FROM "user" WHERE email = 'member@test.com')
    );
```

─────────────────────────────────────────

📊 DATA DISTRIBUTION

By Team:
├─ Team Alpha: 8 products
├─ Team Beta: 7 products
└─ Team Gamma: 5 products

By Category:
├─ Electronics: 6 products
├─ Clothing: 4 products
├─ Home: 4 products
├─ Sports: 4 products
└─ Books: 2 products

Price Range: $15.00 - $499.99
Active: 18 | Inactive: 2

─────────────────────────────────────────

✓ Sample data created: 008_products_sample.sql

Run migration to insert data.
```

---

## With Test Users

Generates data distributed across test users from devKeyring:

```
/session:db:sample products --with-devkeyring
```

```sql
-- Data for DevKeyring users
INSERT INTO products (teamId, createdById, ...)
VALUES
    -- superadmin@test.com (sees all)
    (..., (SELECT id FROM "user" WHERE email = 'superadmin@test.com')),

    -- admin@test.com (Team Alpha)
    (..., (SELECT id FROM "user" WHERE email = 'admin@test.com')),

    -- member@test.com (Team Beta, limited role)
    (..., (SELECT id FROM "user" WHERE email = 'member@test.com'));
```

---

## Options

| Option | Description |
|--------|-------------|
| `--count <n>` | Number of records (default: 20) |
| `--with-devkeyring` | Use test users from devKeyring |
| `--append` | Add to existing seed file |
| `--dry-run` | Show SQL without creating |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:db:entity` | Create entity migration |
| `/session:db:fix` | Fix data issues |
