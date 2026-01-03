---
title: Pricing Strategies
description: SaaS pricing model examples and configuration patterns
---

# Pricing Strategies

This guide shows how to configure different SaaS pricing strategies using the billing system.

## Overview

The billing system supports various pricing models:

| Model | Description | Best For |
|-------|-------------|----------|
| **Freemium** | Free tier + paid upgrades | Consumer apps, high volume |
| **Feature-Gated** | Features unlock by tier | Product differentiation |
| **Usage-Based** | Pay for what you use | APIs, infrastructure |
| **Hybrid** | Tiers + usage limits | Balanced approach |

---

## Example 1: Project Management SaaS (Freemium + Feature-Gated)

A Trello/Asana-like tool with feature-based differentiation.

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  features: {
    basic_boards: { name: 'billing.features.basic_boards' },
    unlimited_boards: { name: 'billing.features.unlimited_boards' },
    file_attachments: { name: 'billing.features.file_attachments' },
    timeline_view: { name: 'billing.features.timeline_view' },
    automations: { name: 'billing.features.automations' },
    admin_controls: { name: 'billing.features.admin_controls' },
    sso: { name: 'billing.features.sso' },
    priority_support: { name: 'billing.features.priority_support' },
  },

  limits: {
    boards: { name: 'billing.limits.boards', unit: 'count', resetPeriod: 'never' },
    team_members: { name: 'billing.limits.team_members', unit: 'count', resetPeriod: 'never' },
    storage_mb: { name: 'billing.limits.storage', unit: 'bytes', resetPeriod: 'never' },
    automations_month: { name: 'billing.limits.automations', unit: 'count', resetPeriod: 'monthly' },
  },

  plans: [
    {
      slug: 'free',
      name: 'Free',
      type: 'free',
      features: ['basic_boards'],
      limits: {
        boards: 5,
        team_members: 3,
        storage_mb: 100,
        automations_month: 0,
      },
    },
    {
      slug: 'starter',
      name: 'Starter',
      type: 'paid',
      price: { monthly: 1000, yearly: 10000 },  // $10/mo, $100/yr
      trialDays: 14,
      features: ['basic_boards', 'unlimited_boards', 'file_attachments'],
      limits: {
        boards: -1,  // Unlimited
        team_members: 10,
        storage_mb: 5000,
        automations_month: 50,
      },
    },
    {
      slug: 'business',
      name: 'Business',
      type: 'paid',
      price: { monthly: 2500, yearly: 25000 },  // $25/mo
      trialDays: 14,
      features: ['basic_boards', 'unlimited_boards', 'file_attachments', 'timeline_view', 'automations', 'admin_controls'],
      limits: {
        boards: -1,
        team_members: 50,
        storage_mb: 50000,
        automations_month: 500,
      },
    },
    {
      slug: 'enterprise',
      name: 'Enterprise',
      type: 'enterprise',
      visibility: 'hidden',
      features: ['*'],
      limits: {
        boards: -1,
        team_members: -1,
        storage_mb: -1,
        automations_month: -1,
      },
    },
  ],

  actionMappings: {
    features: {
      'boards.create_unlimited': 'unlimited_boards',
      'files.attach': 'file_attachments',
      'views.timeline': 'timeline_view',
      'automations.create': 'automations',
    },
    limits: {
      'boards.create': 'boards',
      'team.invite': 'team_members',
      'files.upload': 'storage_mb',
      'automations.run': 'automations_month',
    },
  },
}
```

**Key Patterns:**
- Free tier with hard limits creates upgrade pressure
- Unlimited boards in paid tiers (value driver)
- Monthly automation limit prevents abuse
- Enterprise with `features: ['*']` for custom deals

---

## Example 2: API Platform (Usage-Based)

A Stripe/Twilio-like API with usage-based pricing.

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'developer',

  features: {
    api_access: { name: 'billing.features.api_access' },
    webhooks: { name: 'billing.features.webhooks' },
    analytics: { name: 'billing.features.analytics' },
    dedicated_support: { name: 'billing.features.dedicated_support' },
    sla_99_9: { name: 'billing.features.sla_99_9' },
    custom_integrations: { name: 'billing.features.custom_integrations' },
  },

  limits: {
    api_calls: { name: 'billing.limits.api_calls', unit: 'calls', resetPeriod: 'monthly' },
    webhooks: { name: 'billing.limits.webhooks', unit: 'count', resetPeriod: 'never' },
    rate_limit_rpm: { name: 'billing.limits.rate_limit', unit: 'count', resetPeriod: 'never' },
    data_retention_days: { name: 'billing.limits.retention', unit: 'count', resetPeriod: 'never' },
  },

  plans: [
    {
      slug: 'developer',
      name: 'Developer',
      type: 'free',
      features: ['api_access'],
      limits: {
        api_calls: 1000,          // 1K calls/month free
        webhooks: 2,
        rate_limit_rpm: 60,       // 60 requests/minute
        data_retention_days: 7,
      },
    },
    {
      slug: 'startup',
      name: 'Startup',
      type: 'paid',
      price: { monthly: 4900, yearly: 49000 },  // $49/mo
      trialDays: 0,  // No trial for API products
      features: ['api_access', 'webhooks', 'analytics'],
      limits: {
        api_calls: 100000,        // 100K calls/month
        webhooks: 10,
        rate_limit_rpm: 600,
        data_retention_days: 30,
      },
    },
    {
      slug: 'growth',
      name: 'Growth',
      type: 'paid',
      price: { monthly: 19900, yearly: 199000 },  // $199/mo
      features: ['api_access', 'webhooks', 'analytics', 'dedicated_support'],
      limits: {
        api_calls: 1000000,       // 1M calls/month
        webhooks: 50,
        rate_limit_rpm: 3000,
        data_retention_days: 90,
      },
    },
    {
      slug: 'enterprise',
      name: 'Enterprise',
      type: 'enterprise',
      visibility: 'hidden',
      features: ['*'],
      limits: {
        api_calls: -1,
        webhooks: -1,
        rate_limit_rpm: -1,
        data_retention_days: 365,
      },
    },
  ],

  actionMappings: {
    features: {
      'webhooks.configure': 'webhooks',
      'analytics.view': 'analytics',
      'support.priority': 'dedicated_support',
    },
    limits: {
      'api.call': 'api_calls',
      'webhooks.create': 'webhooks',
    },
  },
}
```

**Key Patterns:**
- No trial for API products (developers test with free tier)
- Monthly API call limits as primary differentiator
- Rate limiting as a soft upsell driver
- Data retention as enterprise value

---

## Example 3: Team Collaboration Tool (Per-Seat Simulation)

A Slack/Notion-like tool with team-size based pricing.

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  features: {
    messaging: { name: 'billing.features.messaging' },
    file_sharing: { name: 'billing.features.file_sharing' },
    video_calls: { name: 'billing.features.video_calls' },
    screen_sharing: { name: 'billing.features.screen_sharing' },
    message_history: { name: 'billing.features.message_history' },
    guest_access: { name: 'billing.features.guest_access' },
    compliance_exports: { name: 'billing.features.compliance_exports' },
    sso_saml: { name: 'billing.features.sso_saml' },
  },

  limits: {
    team_members: { name: 'billing.limits.team_members', unit: 'count', resetPeriod: 'never' },
    guests: { name: 'billing.limits.guests', unit: 'count', resetPeriod: 'never' },
    storage_gb: { name: 'billing.limits.storage', unit: 'bytes', resetPeriod: 'never' },
    message_history_days: { name: 'billing.limits.history', unit: 'count', resetPeriod: 'never' },
    integrations: { name: 'billing.limits.integrations', unit: 'count', resetPeriod: 'never' },
  },

  plans: [
    {
      slug: 'free',
      name: 'Free',
      type: 'free',
      features: ['messaging', 'file_sharing'],
      limits: {
        team_members: 10,
        guests: 0,
        storage_gb: 5,
        message_history_days: 90,
        integrations: 3,
      },
    },
    {
      slug: 'pro',
      name: 'Pro',
      type: 'paid',
      price: { monthly: 800, yearly: 7500 },  // $8/user/mo equivalent
      trialDays: 30,
      features: ['messaging', 'file_sharing', 'video_calls', 'screen_sharing', 'message_history', 'guest_access'],
      limits: {
        team_members: 50,
        guests: 10,
        storage_gb: 50,
        message_history_days: -1,  // Unlimited history
        integrations: -1,
      },
    },
    {
      slug: 'business_plus',
      name: 'Business+',
      type: 'paid',
      price: { monthly: 1500, yearly: 14400 },  // $15/user/mo equivalent
      trialDays: 30,
      features: ['messaging', 'file_sharing', 'video_calls', 'screen_sharing', 'message_history', 'guest_access', 'compliance_exports', 'sso_saml'],
      limits: {
        team_members: 500,
        guests: 100,
        storage_gb: 500,
        message_history_days: -1,
        integrations: -1,
      },
    },
    {
      slug: 'enterprise_grid',
      name: 'Enterprise Grid',
      type: 'enterprise',
      visibility: 'hidden',
      features: ['*'],
      limits: {
        team_members: -1,
        guests: -1,
        storage_gb: -1,
        message_history_days: -1,
        integrations: -1,
      },
    },
  ],

  actionMappings: {
    features: {
      'calls.video': 'video_calls',
      'calls.screen_share': 'screen_sharing',
      'history.search_all': 'message_history',
      'guests.invite': 'guest_access',
      'compliance.export': 'compliance_exports',
      'auth.sso': 'sso_saml',
    },
    limits: {
      'team.invite': 'team_members',
      'guests.add': 'guests',
      'files.upload': 'storage_gb',
      'integrations.add': 'integrations',
    },
  },
}
```

**Key Patterns:**
- Team size limits simulate per-seat pricing
- Message history limit creates urgency on free tier
- Enterprise features (SSO, compliance) gated to Business+
- Generous trial (30 days) for collaboration tools

---

## Example 4: Content Platform (Creator Economy)

A Substack/Patreon-like platform for content creators.

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'creator_free',

  features: {
    basic_publishing: { name: 'billing.features.basic_publishing' },
    custom_domain: { name: 'billing.features.custom_domain' },
    premium_themes: { name: 'billing.features.premium_themes' },
    email_newsletters: { name: 'billing.features.email_newsletters' },
    paid_subscriptions: { name: 'billing.features.paid_subscriptions' },
    analytics_advanced: { name: 'billing.features.analytics_advanced' },
    team_accounts: { name: 'billing.features.team_accounts' },
    api_access: { name: 'billing.features.api_access' },
    white_label: { name: 'billing.features.white_label' },
  },

  limits: {
    posts_month: { name: 'billing.limits.posts', unit: 'count', resetPeriod: 'monthly' },
    subscribers: { name: 'billing.limits.subscribers', unit: 'count', resetPeriod: 'never' },
    emails_month: { name: 'billing.limits.emails', unit: 'count', resetPeriod: 'monthly' },
    storage_gb: { name: 'billing.limits.storage', unit: 'bytes', resetPeriod: 'never' },
    team_members: { name: 'billing.limits.team', unit: 'count', resetPeriod: 'never' },
  },

  plans: [
    {
      slug: 'creator_free',
      name: 'Free',
      type: 'free',
      features: ['basic_publishing'],
      limits: {
        posts_month: 10,
        subscribers: 500,
        emails_month: 1000,
        storage_gb: 1,
        team_members: 1,
      },
    },
    {
      slug: 'creator_pro',
      name: 'Pro Creator',
      type: 'paid',
      price: { monthly: 1200, yearly: 10800 },  // $12/mo
      trialDays: 14,
      features: ['basic_publishing', 'custom_domain', 'premium_themes', 'email_newsletters', 'paid_subscriptions'],
      limits: {
        posts_month: -1,
        subscribers: 10000,
        emails_month: 25000,
        storage_gb: 25,
        team_members: 1,
      },
    },
    {
      slug: 'business',
      name: 'Business',
      type: 'paid',
      price: { monthly: 4900, yearly: 47000 },  // $49/mo
      trialDays: 14,
      features: ['basic_publishing', 'custom_domain', 'premium_themes', 'email_newsletters', 'paid_subscriptions', 'analytics_advanced', 'team_accounts', 'api_access'],
      limits: {
        posts_month: -1,
        subscribers: 100000,
        emails_month: 250000,
        storage_gb: 100,
        team_members: 5,
      },
    },
    {
      slug: 'publisher',
      name: 'Publisher',
      type: 'enterprise',
      visibility: 'hidden',
      features: ['*'],
      limits: {
        posts_month: -1,
        subscribers: -1,
        emails_month: -1,
        storage_gb: -1,
        team_members: -1,
      },
    },
  ],

  actionMappings: {
    features: {
      'domain.custom': 'custom_domain',
      'themes.premium': 'premium_themes',
      'newsletters.send': 'email_newsletters',
      'monetization.enable': 'paid_subscriptions',
      'analytics.advanced': 'analytics_advanced',
      'api.access': 'api_access',
    },
    limits: {
      'posts.publish': 'posts_month',
      'subscribers.add': 'subscribers',
      'emails.send': 'emails_month',
      'files.upload': 'storage_gb',
      'team.invite': 'team_members',
    },
  },
}
```

**Key Patterns:**
- Subscriber limits as growth driver
- Monthly email limits for cost control
- Paid subscription feature gates monetization
- White label for high-value publishers

---

## Choosing Your Strategy

| If Your Product... | Consider |
|--------------------|----------|
| Has viral potential | Freemium with feature limits |
| Sells to enterprises | Feature-gated with SSO/compliance |
| Is usage-based (API) | Usage limits with overage |
| Grows with team size | Team member limits |
| Is content/creator focused | Subscriber/email limits |

## Tips

### 1. Start Simple

Begin with 3 plans: Free, Pro, Enterprise. Add complexity later.

### 2. Use Trials Strategically

- **14 days:** Standard for most SaaS
- **30 days:** Complex products needing onboarding
- **0 days:** API products (use free tier instead)

### 3. Price Anchor with Enterprise

Hidden enterprise plan makes Business look affordable.

### 4. Limit the Right Things

- **Limit what matters:** Resources that cost you money or create value
- **Don't limit basics:** Core functionality should work on all plans

### 5. Annual Discounts

Standard: 15-20% discount for annual billing (2 months free).

## Related

- [Configuration](./02-configuration.md) - Implementing plans
- [Usage Tracking](./06-usage-tracking.md) - Quota enforcement
- [Payment Integration](./05-payment-integration.md) - Stripe setup
