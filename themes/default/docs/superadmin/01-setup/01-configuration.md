# Configuration Guide

This guide covers the configuration options available to administrators for setting up and customizing your NextSpark application.

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Authentication
BETTER_AUTH_SECRET="your-secret-key"

# Application
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### Optional Variables

```bash
# Email (for notifications)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASSWORD="password"

# Billing (Stripe)
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
```

## Configuration Files

### app.config.ts

The main application configuration file located at `config/app.config.ts`:

```typescript
export const APP_CONFIG_OVERRIDES = {
  app: {
    name: 'Your App Name',
    version: '1.0.0',
  },
  teams: {
    mode: 'multi-tenant', // or 'single-tenant', 'single-user'
  },
  i18n: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'en',
  },
}
```

### permissions.config.ts

Define roles and permissions in `config/permissions.config.ts`:

```typescript
export const PERMISSIONS_CONFIG = {
  roles: {
    additionalRoles: ['editor'],
    hierarchy: { editor: 5 },
  },
  // ... permissions
}
```

## Next Steps

- [Deployment Guide](./02-deployment.md)
- [User Management](../02-management/01-users.md)
