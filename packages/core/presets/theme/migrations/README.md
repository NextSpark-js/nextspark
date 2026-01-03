# Theme Migrations

This directory contains SQL migrations specific to this theme.

## Naming Convention

```
{order}_{description}.sql
```

- `001_` - `099_`: Schema migrations (tables, indexes, RLS)
- `100_` - `199_`: Sample data migrations

## Examples

- `001_example_table.sql` - Create main entity table
- `002_custom_team_roles.sql` - Add custom team roles to ENUM
- `003_example_metas.sql` - Create metadata table
- `100_example_sample_data.sql` - Insert sample data

## Adding Custom Team Roles

To add custom team roles (like `editor`, `moderator`, etc.):

1. **Config**: Add to `teamRoles.additionalTeamRoles` in `app.config.ts`
2. **Translations**: Add to `teams.roles.{role}` in `messages/{locale}.json`
3. **Migration**: Add `ALTER TYPE team_role ADD VALUE` in `002_custom_team_roles.sql`

See `002_custom_team_roles.sql` for the migration pattern.

## Migration Structure

Each migration should include:

1. **DROP existing objects** (for idempotency)
2. **CREATE TABLE** with all fields
3. **COMMENTS** on table and columns
4. **TRIGGER** for updatedAt
5. **INDEXES** for performance
6. **RLS** policies for security

## Running Migrations

```bash
# Run all pending migrations
pnpm db:migrate

# Verify table structure
pnpm db:verify
```

## Important Notes

- Always include `userId` and `teamId` for team isolation
- Enable RLS on all tables
- Use `gen_random_uuid()::text` for ID generation
- Include proper constraints and checks
