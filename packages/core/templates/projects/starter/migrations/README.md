# Theme Migrations

This folder contains database migrations specific to this theme.

## Migration Files

- `001_starter_users.sql` - Creates sample users for development

## Running Migrations

```bash
pnpm db:migrate
```

## Creating New Migrations

1. Create a new SQL file with the next number prefix
2. Follow the naming convention: `NNN_description.sql`
3. Include proper comments explaining the migration
