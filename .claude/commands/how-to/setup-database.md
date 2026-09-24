# /how-to:setup-database

Interactive guide to set up PostgreSQL database for NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/database-migrations/SKILL.md` - PostgreSQL migration patterns

---

## Syntax

```
/how-to:setup-database
```

---

## Behavior

Guides the user through setting up PostgreSQL, running migrations, and configuring database access.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Install PostgreSQL
        └── Local or cloud setup

Step 2: Configure Connection
        └── Environment variables

Step 3: Run Migrations
        └── Execute initial setup

Step 4: Verify Setup
        └── Test database connection
```

---

## Step 1: Install PostgreSQL

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SETUP DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Install PostgreSQL

Choose your setup option:

📋 Option A: Local PostgreSQL (macOS)

```bash
# Install with Homebrew
brew install postgresql@16

# Start PostgreSQL
brew services start postgresql@16

# Create database
createdb nextspark_dev
```

📋 Option B: Docker

```bash
# Run PostgreSQL in Docker
docker run --name nextspark-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=nextspark_dev \
  -p 5432:5432 \
  -d postgres:16

# Verify it's running
docker ps
```

📋 Option C: Cloud (Supabase/Neon)

1. Create account at supabase.com or neon.tech
2. Create new project
3. Copy connection string from dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What option would you like to use?
```

---

## Step 2: Configure Connection

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Configure Connection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add database connection to your environment:

```env
# .env.local

# Local PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nextspark_dev"

# Docker PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nextspark_dev"

# Supabase
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Neon
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Connection String Format:

```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?[OPTIONS]
```

• USER: Database username
• PASSWORD: Database password
• HOST: Server address (localhost for local)
• PORT: Default is 5432
• DATABASE: Database name
• OPTIONS: sslmode=require for cloud

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Test Connection:

```bash
# Using psql
psql $DATABASE_URL -c "SELECT 1"

# Or via the app
pnpm db:test
```
```

---

## Step 3: Run Migrations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Run Migrations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execute migrations to set up database schema:

```bash
# Run all migrations
pnpm db:migrate

# This executes:
# 1. Core migrations (core/migrations/)
# 2. Project entity migrations (entities/*/migrations/)
# 3. Plugin migrations (plugins/*/migrations/)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Migration Commands:

```bash
# Run migrations
pnpm db:migrate

# Create new migration
pnpm db:migrate:create "description"

# Rollback last migration
pnpm db:migrate:rollback

# Reset database (WARNING: destroys data)
pnpm db:reset

# Seed sample data
pnpm db:seed
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 What Migrations Create:

Core tables:
• user - User accounts
• session - Auth sessions
• team - Teams/organizations
• teamMembers - Team memberships
• account - OAuth accounts
• apiKey - API keys

Theme entities (from your config):
• products, customers, etc.
```

---

## Step 4: Verify Setup

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Verify Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify everything is working:

```bash
# 1. Test connection
pnpm db:test

# 2. List tables
psql $DATABASE_URL -c "\dt"

# 3. Start the app
pnpm dev

# 4. Try to sign up at http://localhost:3000
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Expected Tables:

After migration, you should see:
```
user
session
account
team
teamMembers
apiKey
[your entity tables]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

Your database is set up with:
• PostgreSQL connection
• Core schema tables
• Entity tables
• Sample data (if seeded)

📚 Related tutorials:
   • /how-to:create-entity - Create new entities
   • /how-to:create-migrations - Write migrations

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:create-entity` | Create entities |
| `/session:db:fix` | Fix migration issues |
