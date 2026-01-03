# Database Setup

## Introduction

Complete guide to setting up PostgreSQL database for NextSpark. Covers Supabase (recommended), local PostgreSQL, and Docker options.

---

## Option 1: Supabase (Recommended)

**Why Supabase:**
- ✅ Free tier (500MB, 2 databases)
- ✅ Managed hosting
- ✅ Connection pooling built-in
- ✅ Row-Level Security (RLS)
- ✅ Easy setup

### Step 1: Create Account

1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub or email
3. Verify email

### Step 2: Create Project

1. Click "New Project"
2. Fill in details:
   - **Name:** nextspark-dev
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to you
   - **Plan:** Free tier
3. Click "Create new project"
4. Wait 2-3 minutes for provisioning

### Step 3: Get Connection String

1. Go to **Settings** → **Database**
2. Scroll to **Connection pooling**
3. Copy **Connection string** (Transaction mode)
4. Replace `[YOUR-PASSWORD]` with your password

**Example:**
```text
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Important:**
- ✅ Use **pooler** connection (port `:6543`)
- ❌ Don't use direct connection (port `:5432`)

### Step 4: Add to .env.local

```bash
DATABASE_URL="postgresql://postgres.xxxxx:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

### Step 5: Test Connection

```bash
# Run migrations
pnpm db:migrate

# Should show:
# ✓ 001_initial_schema.sql
# ✓ 002_add_metadata.sql
# ... etc
```

---

## Option 2: Local PostgreSQL

### macOS

**Install:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Create database:**
```bash
createdb nextspark_dev
```

**Connection string:**
```bash
DATABASE_URL="postgresql://localhost:5432/nextspark_dev"
```

### Linux (Ubuntu/Debian)

**Install:**
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create database:**
```bash
sudo -u postgres createdb nextspark_dev
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'yourpassword';"
```

**Connection string:**
```bash
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/nextspark_dev"
```

### Windows

1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer
3. Use default settings
4. Remember password
5. Create database with pgAdmin

**Connection string:**
```bash
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/nextspark_dev"
```

---

## Option 3: Docker

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: nextspark_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: yourpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Start:**
```bash
docker-compose up -d
```

**Connection string:**
```bash
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/nextspark_dev"
```

---

## Migration System

### How It Works

**3 types of migrations:**
1. **Core migrations** (`core/migrations/`) - Core schema
2. **Entity migrations** (`contents/themes/*/entities/*/migrations/`) - Entity-specific
3. **Plugin migrations** (`contents/plugins/*/migrations/`) - Plugin-specific

### Run Migrations

```bash
pnpm db:migrate
```

**Output:**
```text
Running migrations from: core/migrations/
✓ 001_initial_schema.sql
✓ 002_add_metadata.sql
...

Running entity migrations...
✓ contents/themes/default/entities/tasks/migrations/001_create_tasks.sql

All migrations completed!
```

### Verify Tables

```bash
pnpm db:verify
```

**Shows:**
```text
✓ user
✓ session
✓ account
✓ verification
✓ api_keys
✓ meta
✓ tasks
✓ _migrations
```

---

## Row-Level Security (RLS)

**What is RLS:**
- Database-level data isolation
- Users can only access their own data
- Automatic enforcement

**Example policy:**
```sql
-- Users can only see their own tasks
CREATE POLICY tasks_user_isolation ON tasks
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

**See:** [Architecture Patterns → RLS](../01-fundamentals/04-architecture-patterns.md#row-level-security-rls-pattern)

---

## Connection Pooling

**Why pooling:**
- Serverless functions need efficient connections
- Prevents "too many connections" errors
- Faster connection times

**Supabase:**
- Built-in pooler (port :6543)
- Transaction mode recommended
- Max 15 connections (free tier)

**Local PostgreSQL:**
- Use PgBouncer for pooling
- Or connection limit in app

---

## Troubleshooting

**"Unable to connect":**
1. Check DATABASE_URL format
2. Test with `psql` command
3. Verify database is running
4. Check firewall/network

**"Too many connections":**
- Use pooler connection (:6543)
- Reduce connection limit
- Upgrade database plan

**"Password authentication failed":**
- Check password is correct
- URL-encode special characters
- Verify user exists

**See:** [Troubleshooting → Database](./08-troubleshooting.md#database-connection-errors)

---

## Summary

**Supabase (Recommended):**
- Free tier, managed, pooling built-in
- Use pooler connection (`:6543`)

**Local PostgreSQL:**
- Full control, no external deps
- Manual pooling setup needed

**Migrations:**
- Run with `pnpm db:migrate`
- Core + Entity + Plugin migrations
- RLS policies applied

**Next:** [Environment Configuration](./03-environment-configuration.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
