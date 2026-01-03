# Database Migrations

Este directorio contiene las migraciones principales del sistema de autenticación y configuración base.

## Estructura de Migraciones

### Migraciones del Core (este directorio)
1. `001_auth_and_user_metas.sql` - Sistema de autenticación y metadatos de usuario
2. `002_meta_functions_simplified.sql` - Funciones simplificadas para metadatos
3. `003_test_users.sql` - Usuarios de prueba para testing
4. `004_api_key.sql` - Sistema de API Keys
5. `005_create_contents_entity.sql` - Entidad Contents (tabla + metas + RLS)
6. `006_sample_data_contents.sql` - Datos de ejemplo para Contents

### Migraciones de Entidades (`contents/entities/*/migrations/`)
Las migraciones de entidades están organizadas por entidad:
- `contents/entities/clients/migrations/001_clients_table.sql`
- `contents/entities/orders/migrations/001_orders_table.sql`
- `contents/entities/products/migrations/001_products_table.sql`
- `contents/entities/tasks/migrations/001_tasks_table.sql`

Cada entidad incluye también sus datos de muestra:
- `contents/entities/*/migrations/002_sample_data_*.sql`

## How to Run Migrations

### Option 1: Using Node.js Script

```bash
node scripts/run-migrations.mjs
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of the migration file
4. Click "Run"

### Option 3: Using psql CLI

```bash
# Run all migrations
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mblmyxznaztgsxxojqpv.supabase.co:5432/postgres" -f migrations/001_better_auth_initial.sql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mblmyxznaztgsxxojqpv.supabase.co:5432/postgres" -f migrations/002_enable_rls.sql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mblmyxznaztgsxxojqpv.supabase.co:5432/postgres" -f migrations/003_todo.sql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mblmyxznaztgsxxojqpv.supabase.co:5432/postgres" -f migrations/004_todo_rls.sql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mblmyxznaztgsxxojqpv.supabase.co:5432/postgres" -f migrations/005_api_keys_system.sql
```

## Environment Variables

Make sure these are set in your `.env` file:

```env
# For application use (pooler connection)
DATABASE_URL="postgresql://postgres.mblmyxznaztgsxxojqpv:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

## Migration History

| Version | Date | Description |
|---------|------|-------------|
| 001 | 2025-01-12 | Initial Better Auth tables for email/password and Google OAuth with user roles |
| 002 | 2025-01-13 | Enable Row Level Security on auth tables |
| 003 | 2025-01-12 | Todo list functionality with user association |
| 004 | 2025-01-17 | Enable Row Level Security on todo table |
| 005 | 2025-01-17 | Complete API Keys system for external API access with security features |
| 006 | 2025-01-19 | Contents entity - content management system with metadata support |
| 007 | 2025-01-19 | Sample data for Contents entity (2 example records with metadata) |

## Notes

- Always backup your database before running migrations
- Test migrations in a development environment first
- The migrations include indexes and triggers for optimal performance
- The `updatedAt` field is automatically updated via database triggers
- Migrations are tracked in the `_migrations` table to prevent duplicate execution

## Rollback Instructions

To remove specific tables if needed:

```sql
-- To remove API Keys functionality
DROP TABLE IF EXISTS "api_audit_log" CASCADE;
DROP TABLE IF EXISTS "api_key" CASCADE;
DROP FUNCTION IF EXISTS handle_failed_api_key_attempt(TEXT, TEXT);
DROP FUNCTION IF EXISTS is_ip_allowed(TEXT, TEXT);
DROP FUNCTION IF EXISTS cleanup_expired_locks();
DROP FUNCTION IF EXISTS cleanup_old_api_logs();

-- To remove todo functionality
DROP TABLE IF EXISTS "todo" CASCADE;

-- To remove all auth tables (warning: this removes all users!)
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
```