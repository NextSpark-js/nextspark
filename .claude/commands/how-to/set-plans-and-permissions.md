# /how-to:set-plans-and-permissions

Interactive guide to configure subscription plans, features, and billing in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/billing-subscriptions/SKILL.md` - Multi-provider billing and Gateway Factory patterns
- `.claude/skills/permissions-system/SKILL.md` - Three-layer permission model

---

## Syntax

```
/how-to:set-plans-and-permissions
```

---

## Behavior

Guides the user through configuring subscription plans with features, usage limits, and payment provider integration.

---

## Tutorial Structure

```
STEPS OVERVIEW (6 steps)

Step 1: Understanding the Billing System
        └── Three-layer model: RBAC + Features + Quotas

Step 2: Define Features
        └── Feature flags for plan-gating

Step 3: Define Usage Limits (Quotas)
        └── Track and limit resource usage

Step 4: Configure Plans
        └── Create free, pro, enterprise plans

Step 5: Set Up Payment Provider
        └── Create products and prices (Stripe or Polar)

Step 6: Test the Checkout Flow
        └── Verify the complete flow
```

---

## Step 1: Understanding the Billing System

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SET PLANS AND PERMISSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 6: Understanding the Billing System

NextSpark uses a **three-layer permission model**:

┌─────────────────────────────────────────────┐
│  Layer 1: RBAC (Team Roles)                 │
│  "Can this role perform this action?"       │
│  → owner, admin, member, viewer             │
├─────────────────────────────────────────────┤
│  Layer 2: Features (Plan Gating)            │
│  "Does this plan include this feature?"     │
│  → advanced_analytics, api_access, etc.     │
├─────────────────────────────────────────────┤
│  Layer 3: Quotas (Usage Limits)             │
│  "Has this team exceeded their limit?"      │
│  → team_members: 5, projects: 10, etc.      │
└─────────────────────────────────────────────┘

RESULT = Permission ✓ AND Feature ✓ AND Quota ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Example Check:

User wants to: Create a new project

Layer 1: Does user have "projects.create" permission? ✓
Layer 2: Does plan include "unlimited_projects" feature? ✓
Layer 3: Is team under the projects limit? ✓

→ Action allowed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Define Features)
[2] I have a question about the model
[3] Show me how checks work in code
```

---

## Step 2: Define Features

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 6: Define Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Features are boolean flags that enable functionality per plan:

```typescript
// contents/themes/default/config/billing.config.ts
import type { BillingConfig } from '@/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // Define available features
  features: {
    // Analytics features
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    advanced_analytics: {
      name: 'billing.features.advanced_analytics',
      description: 'billing.features.advanced_analytics_description',
    },

    // API features
    api_access: {
      name: 'billing.features.api_access',
      description: 'billing.features.api_access_description',
    },
    webhooks: {
      name: 'billing.features.webhooks',
      description: 'billing.features.webhooks_description',
    },

    // Support features
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },

    // Advanced features
    custom_branding: {
      name: 'billing.features.custom_branding',
      description: 'billing.features.custom_branding_description',
    },
    white_label: {
      name: 'billing.features.white_label',
      description: 'billing.features.white_label_description',
    },
  },

  // ... rest of config
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Check Feature in Code:

```typescript
// Server-side
const membership = await MembershipService.get(userId, teamId)

if (membership.hasFeature('advanced_analytics')) {
  // Show advanced analytics dashboard
}

// Client-side (React)
import { useHasFeature } from '@/core/lib/billing/hooks'

function AnalyticsDashboard() {
  const hasAdvanced = useHasFeature('advanced_analytics')

  return hasAdvanced ? <AdvancedCharts /> : <BasicCharts />
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Quotas)
[2] What features should I define?
[3] How do I show upgrade prompts?
```

---

## Step 3: Define Usage Limits (Quotas)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 6: Define Usage Limits (Quotas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quotas track and limit resource usage per team:

```typescript
// contents/themes/default/config/billing.config.ts

export const billingConfig: BillingConfig = {
  // ... features ...

  // Define usage limits
  limits: {
    team_members: {
      name: 'billing.limits.team_members',
      unit: 'count',
      resetPeriod: 'never',  // Permanent limit
    },
    projects: {
      name: 'billing.limits.projects',
      unit: 'count',
      resetPeriod: 'never',
    },
    storage_gb: {
      name: 'billing.limits.storage',
      unit: 'GB',
      resetPeriod: 'never',
    },
    api_calls: {
      name: 'billing.limits.api_calls',
      unit: 'calls',
      resetPeriod: 'monthly',  // Resets each month
    },
    email_sends: {
      name: 'billing.limits.email_sends',
      unit: 'emails',
      resetPeriod: 'monthly',
    },
  },

  // Map actions to limits
  actionMappings: {
    limits: {
      'team.members.invite': 'team_members',
      'projects.create': 'projects',
      'api.call': 'api_calls',
      'email.send': 'email_sends',
    },
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Reset Periods:

• 'never'   - Permanent limit (team members, projects)
• 'monthly' - Resets on billing cycle (API calls)
• 'daily'   - Resets daily (rate limiting)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Check Quota in Code:

```typescript
// Server-side check
const membership = await MembershipService.get(userId, teamId)
const quota = membership.checkQuota('projects', 1)  // +1 project

if (!quota.allowed) {
  return Response.json({
    error: 'Project limit reached',
    current: quota.current,
    limit: quota.limit,
  }, { status: 403 })
}

// Track usage after successful operation
await UsageService.trackUsage(teamId, 'projects', 1)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Configure Plans)
[2] How does quota tracking work?
[3] Show me usage meter UI examples
```

---

## Step 4: Configure Plans

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 6: Configure Plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define your subscription plans:

```typescript
// contents/themes/default/config/billing.config.ts

export const billingConfig: BillingConfig = {
  // ... features, limits ...

  plans: [
    // FREE PLAN
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },  // In cents
      trialDays: 0,
      features: [
        'basic_analytics',
      ],
      limits: {
        team_members: 3,
        projects: 5,
        storage_gb: 1,
        api_calls: 1000,
        email_sends: 100,
      },
      // No price IDs for free plan
    },

    // PRO PLAN
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,    // $29.00
        yearly: 29000,    // $290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'webhooks',
        'priority_support',
      ],
      limits: {
        team_members: 15,
        projects: 50,
        storage_gb: 50,
        api_calls: 100000,
        email_sends: 5000,
      },
      providerPriceIds: {
        monthly: 'price_xxx_monthly',  // From your payment provider
        yearly: 'price_xxx_yearly',
      },
    },

    // ENTERPRISE PLAN
    {
      slug: 'enterprise',
      name: 'billing.plans.enterprise.name',
      description: 'billing.plans.enterprise.description',
      type: 'enterprise',
      visibility: 'hidden',  // Contact sales only
      features: ['*'],       // All features
      limits: {
        team_members: -1,    // -1 = Unlimited
        projects: -1,
        storage_gb: -1,
        api_calls: -1,
        email_sends: -1,
      },
    },
  ],
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Plan Types:

• 'free'       - No payment required
• 'paid'       - Requires payment subscription
• 'enterprise' - Custom pricing (contact sales)

📋 Visibility:

• 'public' - Shows on pricing page
• 'hidden' - Only via direct link or sales

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Payment Provider Setup)
[2] How do I add more plan tiers?
[3] Show me the pricing page component
```

---

## Step 5: Set Up Payment Provider

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 6: Set Up Payment Provider
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Create Products and Prices in your provider:

For Stripe (dashboard.stripe.com):
• Products → Add Product → "Pro Plan"
• Add Price → $29/month → Copy price_xxx_monthly
• Add Price → $290/year → Copy price_xxx_yearly

For Polar (polar.sh):
• Products → Create Product → Set pricing
• Copy the Product Price ID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2️⃣  Configure Environment Variables:

```env
# .env.local

# For Stripe:
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# For Polar:
POLAR_ACCESS_TOKEN=pat_xxx
POLAR_WEBHOOK_SECRET=whsec_xxx
POLAR_SERVER=sandbox
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣  Update Plan Price IDs:

```typescript
// In billing.config.ts
{
  slug: 'pro',
  // ...
  providerPriceIds: {
    monthly: 'price_1xxx',  // From your provider
    yearly: 'price_1yyy',
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4️⃣  Set Up Webhook:

For Stripe: Dashboard → Webhooks → Add endpoint
URL: https://your-domain.com/api/v1/billing/webhooks/stripe

For Polar: Organization Settings → Webhooks → Add endpoint
URL: https://your-domain.com/api/v1/billing/webhooks/polar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5️⃣  Test locally (Stripe example):

```bash
stripe listen --forward-to localhost:3000/api/v1/billing/webhooks/stripe
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 6 (Test Checkout)
[2] I have questions about provider setup
[3] Help me set up webhook forwarding
```

---

## Step 6: Test the Checkout Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 OF 6: Test the Checkout Flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Add Translations:

```json
// contents/themes/default/messages/en.json
{
  "billing": {
    "plans": {
      "free": {
        "name": "Free",
        "description": "Perfect for getting started"
      },
      "pro": {
        "name": "Pro",
        "description": "For growing teams and businesses"
      },
      "enterprise": {
        "name": "Enterprise",
        "description": "Custom solutions for large organizations"
      }
    },
    "features": {
      "basic_analytics": "Basic Analytics",
      "advanced_analytics": "Advanced Analytics",
      "api_access": "API Access",
      "priority_support": "Priority Support"
    },
    "limits": {
      "team_members": "Team Members",
      "projects": "Projects",
      "api_calls": "API Calls/month"
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2️⃣  Rebuild Registry:

```bash
node core/scripts/build/registry.mjs
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣  Test the Complete Flow:

• Go to /pricing (or /dashboard/settings/billing)
• Click "Upgrade to Pro"
• Use test card (Stripe): 4242 4242 4242 4242
• Complete checkout
• Verify webhook updates subscription
• Check features are now available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Test Cards:

• Success: 4242 4242 4242 4242
• Declined: 4000 0000 0000 0002
• 3D Secure: 4000 0027 6000 3184

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've configured:
• Feature flags for plan gating
• Usage limits and quotas
• Subscription plans with pricing
• Payment provider integration (Stripe or Polar)

📚 Related tutorials:
   • /how-to:set-user-roles-and-permissions - RBAC configuration
   • /how-to:create-api - Custom billing endpoints

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:set-user-roles-and-permissions` | Configure team roles |
