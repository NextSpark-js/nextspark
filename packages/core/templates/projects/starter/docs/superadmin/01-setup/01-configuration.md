# Admin Configuration

This guide covers the configuration options available to administrators.

## Environment Variables

Configure your application through environment variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication
BETTER_AUTH_SECRET="your-secret"

# Application
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## Configuration Files

Customize your application through config files in `config/`:

- `app.config.ts` - Main application settings
- `permissions.config.ts` - Roles and permissions
- `billing.config.ts` - Subscription plans
- `dev.config.ts` - Development settings

## Next Steps

Refer to the main documentation for detailed guides on each configuration area.
