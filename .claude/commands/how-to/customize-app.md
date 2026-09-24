# /how-to:customize-app

Interactive guide to configure application-level settings in NextSpark.

---

## Syntax

```
/how-to:customize-app
```

---

## Behavior

Guides the user through configuring app-level settings like authentication, email, storage, and environment.

---

## Tutorial Structure

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding App Configuration
        └── Configuration layers

Step 2: Configure app.config.ts
        └── Core application settings

Step 3: Configure Environment
        └── Environment variables

Step 4: Advanced Settings
        └── Team mode, onboarding, etc.
```

---

## Step 1: Understanding App Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CUSTOMIZE APP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding App Configuration

NextSpark uses layered configuration:

┌─────────────────────────────────────────────┐
│  CONFIGURATION LAYERS                       │
│  ─────────────────────────────────────────  │
│                                             │
│  1. CORE DEFAULTS                           │
│     core/config/*.ts                        │
│     → Base settings, always available       │
│                                             │
│  2. THEME OVERRIDES                         │
│     config/*.ts                             │
│     → Theme-specific customizations         │
│                                             │
│  3. ENVIRONMENT                             │
│     .env / .env.local                       │
│     → Secrets and environment-specific      │
│                                             │
└─────────────────────────────────────────────┘

Theme config overrides core. Env overrides both.
```

**📂 Configuration Files:**

```
config/
├── app.config.ts           # Core app settings
├── auth.config.ts          # Authentication settings
├── dashboard.config.ts     # Dashboard layout
├── navigation.config.ts    # Navigation menus
├── billing.config.ts       # Plans and billing
├── permissions.config.ts   # RBAC permissions
└── theme.config.ts         # Theme appearance
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (App Config)
[2] Show me the full config structure
[3] How do I access config in code?
```

---

## Step 2: Configure app.config.ts

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Configure app.config.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Core application settings:
```

**📋 app.config.ts Example:**

```typescript
// config/app.config.ts
import type { AppConfig } from '@/core/types/app'

export const appConfig: AppConfig = {
  // App Identity
  name: 'My SaaS App',
  description: 'The best SaaS for managing your business',
  version: '1.0.0',

  // URLs
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL,

  // Internationalization
  defaultLocale: 'en',
  locales: ['en', 'es', 'pt'],
  localeLabels: {
    en: 'English',
    es: 'Español',
    pt: 'Português',
  },

  // Team Mode (multi-tenant)
  teamMode: {
    enabled: true,
    createOnSignup: true,          // Auto-create team on signup
    allowMultipleTeams: true,      // User can join multiple teams
    requireTeamForAccess: true,    // Must have team to use dashboard
    defaultTeamName: '{userName}\'s Team',
  },

  // User Settings
  user: {
    allowNameChange: true,
    allowEmailChange: false,       // Usually false for security
    allowAvatarUpload: true,
    requireEmailVerification: true,
    deleteAccountEnabled: true,
  },

  // Registration Settings
  registration: {
    enabled: true,
    requireInvite: false,          // Only invited users can register
    allowedDomains: [],            // ['mycompany.com'] to restrict
    defaultRole: 'member',
  },

  // Session Settings
  session: {
    maxAge: 7 * 24 * 60 * 60,      // 7 days in seconds
    updateAge: 24 * 60 * 60,       // Refresh every 24 hours
  },

  // Feature Flags
  features: {
    pageBuilder: true,
    apiKeys: true,
    webhooks: true,
    activityLog: true,
    dataExport: true,
  },

  // Onboarding
  onboarding: {
    enabled: true,
    steps: [
      'profile',
      'team',
      'invite-members',
      'preferences',
    ],
    skipEnabled: true,             // Allow skipping onboarding
  },

  // Support
  support: {
    email: 'support@myapp.com',
    docsUrl: 'https://docs.myapp.com',
    chatEnabled: true,
  },

  // Legal
  legal: {
    termsUrl: '/terms',
    privacyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
  },
}

export default appConfig
```

**📋 Access Config in Code:**

```typescript
// Server-side
import { getAppConfig } from '@/core/lib/config'

const config = getAppConfig()
if (config.teamMode.enabled) {
  // Team mode logic
}

// Client-side
import { useAppConfig } from '@/core/lib/hooks/useAppConfig'

function MyComponent() {
  const config = useAppConfig()
  return <div>{config.name}</div>
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Environment)
[2] Show me auth.config.ts options
[3] What is Team Mode?
```

---

## Step 3: Configure Environment

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Configure Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Essential environment variables:
```

**📋 Environment Variables (.env.local):**

```env
# .env.local (development)
# .env.production (production)

# ============================================
# DATABASE
# ============================================
DATABASE_URL="postgresql://user:pass@localhost:5432/myapp"

# ============================================
# AUTHENTICATION (Better Auth)
# ============================================
BETTER_AUTH_SECRET="your-secret-at-least-32-characters"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# ============================================
# APPLICATION
# ============================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="My SaaS App"

# project

# ============================================
# EMAIL (Resend)
# ============================================
RESEND_API_KEY=""
EMAIL_FROM="noreply@myapp.com"

# ============================================
# FILE STORAGE (S3/R2)
# ============================================
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_ENDPOINT=""  # For Cloudflare R2

# ============================================
# PAYMENTS (Stripe)
# ============================================
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""

# ============================================
# BACKGROUND JOBS
# ============================================
CRON_SECRET="your-cron-secret"

# ============================================
# DEVELOPMENT
# ============================================
# Dev mode for superadmin bypass
DEV_USER_ID=""
DEV_TEAM_ID=""
```

**📋 Environment Files:**

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Template with all vars | ✓ Committed |
| `.env` | Default values | ✗ Ignored |
| `.env.local` | Local development | ✗ Ignored |
| `.env.production` | Production values | ✗ Ignored |

**📋 Validate Environment:**

```bash
# Check for missing required variables
pnpm run env:check

# Generate new secrets
openssl rand -base64 32  # For BETTER_AUTH_SECRET
openssl rand -hex 16     # For CRON_SECRET
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Advanced)
[2] How do I set up OAuth providers?
[3] Show me production deployment env
```

---

## Step 4: Advanced Settings

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Advanced Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Team Mode Configuration:**

```typescript
// For single-user apps (no teams)
teamMode: {
  enabled: false,
}

// For personal workspaces (one team per user)
teamMode: {
  enabled: true,
  createOnSignup: true,
  allowMultipleTeams: false,
  requireTeamForAccess: true,
}

// For collaborative SaaS (multiple teams)
teamMode: {
  enabled: true,
  createOnSignup: true,
  allowMultipleTeams: true,
  requireTeamForAccess: true,
}
```

**📋 Custom Onboarding Flow:**

```typescript
// config/onboarding.config.ts
export const onboardingConfig = {
  enabled: true,

  steps: [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Tell us a bit about yourself',
      component: 'ProfileStep',
      required: true,
    },
    {
      id: 'team',
      title: 'Create Your Team',
      description: 'Set up your workspace',
      component: 'TeamStep',
      required: true,
    },
    {
      id: 'invite',
      title: 'Invite Team Members',
      description: 'Collaborate with your team',
      component: 'InviteStep',
      required: false,
      skippable: true,
    },
    {
      id: 'preferences',
      title: 'Set Preferences',
      description: 'Customize your experience',
      component: 'PreferencesStep',
      required: false,
    },
  ],

  // Redirect after completion
  completedRedirect: '/dashboard',

  // Allow skipping entire onboarding
  skipEnabled: true,
}
```

**📋 Maintenance Mode:**

```typescript
// app.config.ts
export const appConfig: AppConfig = {
  maintenance: {
    enabled: false,
    message: 'We are performing scheduled maintenance.',
    allowedIPs: ['127.0.0.1'],  // IPs that can access
    estimatedEnd: '2024-01-15T10:00:00Z',
  },
}
```

**📋 Rate Limiting:**

```typescript
// app.config.ts
export const appConfig: AppConfig = {
  rateLimiting: {
    enabled: true,
    window: 60,           // Seconds
    maxRequests: 100,     // Per window
    byIP: true,
    byUser: true,
    excludePaths: ['/api/health', '/api/webhooks'],
  },
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've configured:
• Core application settings
• Environment variables
• Team mode options
• Advanced features

📚 Related tutorials:
   • /how-to:setup-authentication - Auth configuration
   • /how-to:customize-dashboard - Dashboard settings
   • /how-to:customize-theme - Visual customization

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:setup-authentication` | Auth setup |
| `/how-to:customize-theme` | Theme customization |
