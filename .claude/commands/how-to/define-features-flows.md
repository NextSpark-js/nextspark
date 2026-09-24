# /how-to:define-features-flows

Interactive guide to understand and define Features & Flows for your NextSpark application.

**Aliases:** `/how-to:features`, `/how-to:flows`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/test-coverage/SKILL.md` - FEATURE_REGISTRY, FLOW_REGISTRY, TAGS_REGISTRY
- `.claude/skills/cypress-e2e/SKILL.md` - Test structure and tag usage
- `.claude/skills/documentation/SKILL.md` - About files and feature documentation

---

## Syntax

```
/how-to:define-features-flows
/how-to:define-features-flows --analyze
```

---

## Behavior

Guides the user through understanding the conceptual framework of Features & Flows, and helps them define their own based on their product strategy.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Features & Flows
        └── Conceptual framework, not technical

Step 2: Feature Strategy
        └── Entity-based + product-based features

Step 3: Flow Strategy
        └── User journeys and critical paths

Step 4: Document Your Features
        └── features.json and about files

Step 5: Connect with Testing
        └── Tags, coverage, and validation
```

---

## Step 1: Understanding Features & Flows

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: DEFINE FEATURES & FLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Features & Flows

⚠️ IMPORTANT: Features & Flows is a CONCEPTUAL
   framework, NOT a technical system.

This means:
• There's no "features table" in the database
• No code enforces what is or isn't a feature
• YOU define what makes sense for YOUR product
• The framework helps organize testing & docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 What is a Feature?**

A feature is a distinct capability or functionality in your application that provides value to users.

```
┌─────────────────────────────────────────────┐
│  FEATURE = A distinct capability            │
│  ─────────────────────────────────────────  │
│  • Has a clear purpose                      │
│  • Can be tested independently              │
│  • Provides user value                      │
│  • May have sub-components                  │
└─────────────────────────────────────────────┘
```

**📋 What is a Flow?**

A flow is a user journey that typically crosses multiple features to accomplish a goal.

```
┌─────────────────────────────────────────────┐
│  FLOW = A user journey across features      │
│  ─────────────────────────────────────────  │
│  • Multiple steps involved                  │
│  • Spans several features                   │
│  • Has a clear start and end                │
│  • Represents real user behavior            │
└─────────────────────────────────────────────┘
```

**📋 Example Comparison:**

```
FEATURE: Authentication
├── Login capability
├── Registration capability
├── Password reset
└── OAuth integration

FLOW: User Onboarding
├── Step 1: Register (uses Authentication)
├── Step 2: Verify email (uses Authentication)
├── Step 3: Create team (uses Teams)
├── Step 4: Invite members (uses Teams)
└── Step 5: Create first task (uses Tasks entity)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Feature Strategy)
[2] I have a question about the concept
[3] Show me real-world examples
```

---

## Step 2: Feature Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Feature Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How to identify features in YOUR application:
```

**📋 Rule #1: Every Entity is a Feature**

This is your starting point. If you have an entity, it's automatically a feature.

```typescript
// Entity "tasks" → Feature "tasks"
// Entity "customers" → Feature "customers"
// Entity "invoices" → Feature "invoices"
```

**📋 Rule #2: Core System Capabilities are Features**

Beyond entities, identify system-wide capabilities:

```
CORE FEATURES (typically present in all apps):

├── authentication     # Login, signup, OAuth
├── teams-management   # Team creation, switching, roles
├── permissions        # RBAC, access control
├── billing            # Plans, subscriptions, payments
├── notifications      # Email, in-app notifications
├── settings          # User/team preferences
└── superadmin        # Admin panel capabilities
```

**📋 Rule #3: Product-Specific Features**

Based on YOUR product, add domain-specific features:

```
EXAMPLE: Project Management App

├── projects           # Entity-based feature
├── tasks              # Entity-based feature
├── time-tracking      # Product feature
├── reporting          # Product feature
├── team-collaboration # Product feature
└── integrations       # Product feature (Slack, etc.)
```

```
EXAMPLE: E-commerce App

├── products           # Entity-based feature
├── orders             # Entity-based feature
├── cart               # Product feature
├── checkout           # Product feature
├── inventory          # Product feature
└── shipping           # Product feature
```

**📋 Feature Categories:**

Organize features into categories for clarity:

```typescript
type FeatureCategory =
  | 'core'       // Authentication, teams, permissions
  | 'entities'   // Your CRUD entities
  | 'content'    // Page builder, blog, CMS
  | 'settings'   // Configuration screens
  | 'admin'      // Superadmin capabilities
  | 'public'     // Public-facing pages
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Flow Strategy)
[2] Help me identify features for my app
[3] What if I'm not sure something is a feature?
```

---

## Step 3: Flow Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Flow Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flows represent real user journeys through your app.
```

**📋 Identifying Critical Flows:**

Ask yourself: "What are the most important things users do?"

```
CRITICAL FLOWS (highest priority):

1. User Onboarding
   └── Registration → Verification → First use

2. Core Value Flow
   └── The main thing your app does
   └── For task app: Create task → Assign → Complete

3. Payment Flow
   └── If you have billing: Select plan → Checkout → Access

4. Team Collaboration
   └── Invite → Accept → Collaborate
```

**📋 Flow Categories:**

```typescript
type FlowCategory =
  | 'acquisition'  // Getting new users
  | 'activation'   // First value moment
  | 'engagement'   // Daily usage patterns
  | 'retention'    // Keeping users active
  | 'revenue'      // Payment and billing
  | 'admin'        // Administrative tasks
```

**📋 Flow Structure:**

Each flow should define:

```json
{
  "id": "user-onboarding",
  "name": "User Onboarding",
  "description": "New user registration to first task",
  "category": "acquisition",
  "criticalPath": true,
  "steps": [
    "Register with email or Google",
    "Verify email address",
    "Create or join team",
    "Explore dashboard",
    "Create first task"
  ],
  "features": [
    "authentication",
    "teams-management",
    "tasks"
  ],
  "testTags": ["@flow-onboarding", "@smoke"]
}
```

**📋 Flow vs Feature Decision:**

```
┌─────────────────────────────────────────────┐
│  Is it a FEATURE or a FLOW?                 │
│  ─────────────────────────────────────────  │
│                                             │
│  FEATURE if:                                │
│  • It's a standalone capability             │
│  • Can be tested in isolation               │
│  • Doesn't require other features           │
│                                             │
│  FLOW if:                                   │
│  • Spans multiple features                  │
│  • Represents a user journey                │
│  • Has sequential steps                     │
│  • Tests integration between features       │
└─────────────────────────────────────────────┘
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Document Your Features)
[2] Help me identify flows for my app
[3] What's a "critical path" flow?
```

---

## Step 4: Document Your Features

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Document Your Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Document features in your theme's about/ folder.
```

**📋 File Structure:**

```
about/
├── features.json      # Feature & flow definitions
├── business.md        # Business context
└── team.md            # Team information
```

**📋 features.json Template:**

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-12-18",

  "features": {
    "authentication": {
      "id": "authentication",
      "name": "Authentication",
      "description": "User identity and access management",
      "category": "core",
      "status": "stable",
      "testTags": ["@feat-auth"],
      "components": {
        "email": {
          "name": "Email Authentication",
          "testTags": ["@feat-auth", "@crud"]
        },
        "oauth-google": {
          "name": "Google OAuth",
          "testTags": ["@feat-auth"]
        }
      }
    },

    "tasks": {
      "id": "tasks",
      "name": "Task Management",
      "description": "Create and manage tasks",
      "category": "entities",
      "status": "stable",
      "testTags": ["@feat-tasks", "@crud"]
    }
  },

  "flows": {
    "onboarding": {
      "id": "user-onboarding",
      "name": "User Onboarding",
      "description": "New user to first task",
      "category": "acquisition",
      "criticalPath": true,
      "testTags": ["@flow-onboarding", "@smoke"],
      "steps": [
        "Register with email",
        "Verify email",
        "Create team",
        "Create first task"
      ],
      "features": ["authentication", "teams-management", "tasks"]
    }
  },

  "statusDefinitions": {
    "stable": "Production-ready, fully tested",
    "beta": "Feature complete, in testing",
    "in-development": "Currently being implemented",
    "planned": "Scheduled for future development"
  }
}
```

**📋 Status Tracking:**

Use status to track feature maturity:

```
stable         → Production-ready
beta           → Feature complete, testing
in-development → Being built now
planned        → Future roadmap
deprecated     → Being phased out
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TIP: If you have your business.md and team.md
   defined, Claude can help you generate a
   features.json based on your product context!

   Just ask: "Help me define features for my app"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Connect with Testing)
[2] Help me create my features.json
[3] Show me a complete example
```

---

## Step 5: Connect with Testing

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Connect with Testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Features & Flows connect to testing via TAGS.
This is where the concept becomes practical.
```

**📋 The Connection:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  features.   │────▶│  Cypress     │────▶│  FEATURE_    │
│  json        │     │  Tests       │     │  REGISTRY    │
│  (definition)│     │  (tags)      │     │  (coverage)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**📋 Tag Prefixes:**

```
@feat-{name}    → Feature tag (e.g., @feat-auth)
@flow-{name}    → Flow tag (e.g., @flow-onboarding)
@smoke          → Quick sanity tests
@regression     → Broader test suite
@crud           → CRUD operation tests
@area-{name}    → Area-specific (e.g., @area-devtools)
```

**📋 Using Tags in Cypress:**

```typescript
// Test file: login.cy.ts
describe('@uat @smoke @feat-auth Login', () => {
  it('should login with valid credentials', () => {
    // Test code
  })
})
```

**📋 Registry Generation:**

When you run `pnpm build:registries`, the system:

1. Scans all Cypress test files
2. Extracts tags from describe blocks
3. Generates FEATURE_REGISTRY with coverage data
4. Validates against features.json

**📋 Coverage Metrics:**

```typescript
// Auto-generated COVERAGE_SUMMARY
{
  features: {
    total: 15,      // From features.json
    withTests: 12,  // Features with @feat-* tests
    withoutTests: 3 // Gap to fill
  },
  flows: {
    total: 5,
    withTests: 3,
    withoutTests: 2
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Features & Flows as a conceptual framework
• How to identify features (entities + capabilities)
• How to define flows (user journeys)
• How to document in features.json
• How tags connect to test coverage

📚 NEXT STEP (important!):
   /how-to:manage-test-coverage
   └── Learn how to create tests with proper
       tags and maintain coverage

📚 Related tutorials:
   • /how-to:run-tests - Execute your test suite
   • /how-to:create-entity - Create new entities

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "Help me identify features for my app"

When user asks for help, Claude should:

1. **Check for about files:**

```typescript
// Look for:
// - about/business.md
// - about/features.json (existing)
// - Entity configs in config/entities/
```

2. **Ask clarifying questions:**

```
To help you define features, I need to understand your app:

1. What's your app's main purpose?
   (e.g., project management, e-commerce, CRM)

2. What entities have you created or plan to create?
   (Each entity typically becomes a feature)

3. Who are your target users?
   (Different users may need different features)

4. What are the 3 most important things users do?
   (These become your critical flows)
```

3. **Generate suggestions based on context**

---

## Common Questions

### "What if I'm not sure something is a feature?"

```
📋 Decision Guide:

Ask yourself these questions:

1. Can a user interact with it directly?
   YES → Likely a feature

2. Would you write tests specifically for it?
   YES → Likely a feature

3. Does it have its own UI section?
   YES → Likely a feature

4. Is it just a utility/helper for other features?
   YES → NOT a feature (it's implementation detail)

When in doubt, start broad and refine later.
Features aren't set in stone - you can split
or merge them as your understanding grows.
```

### "What's a critical path flow?"

```
📋 Critical Path Flows:

A critical path flow is a user journey that:

• MUST work for the business to survive
• Directly impacts revenue or core value
• Affects the majority of users

Examples:
✅ User registration → Always critical
✅ Checkout flow → Critical for e-commerce
✅ Core feature usage → Critical for retention
❌ Settings change → Important but not critical
❌ Profile update → Nice to have

Critical flows get:
• @smoke tag (run on every deploy)
• Higher test priority
• Monitoring and alerts
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:manage-test-coverage` | **NEXT STEP** - Create tests and maintain coverage |
| `/how-to:run-tests` | Execute Cypress test suites |
| `/how-to:create-entity` | Create entities (which become features) |
