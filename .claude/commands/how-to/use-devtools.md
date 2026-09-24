# /how-to:use-devtools

Interactive guide to using the Devtools Dashboard for development and debugging in NextSpark.

**Aliases:** `/how-to:devtools`, `/how-to:developer-tools`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/test-coverage/SKILL.md` - FEATURE_REGISTRY and coverage metrics
- `.claude/skills/page-builder-blocks/SKILL.md` - Block structure and patterns

---

## Syntax

```
/how-to:use-devtools
/how-to:use-devtools --section blocks
/how-to:use-devtools --api-explorer
```

---

## Behavior

Guides the user through the Devtools Dashboard: block explorer, API explorer, test coverage, and configuration viewer.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Accessing Devtools
        └── Requirements and navigation

Step 2: Block Explorer
        └── Browse and inspect blocks

Step 3: API Explorer
        └── Test endpoints interactively

Step 4: Test Coverage Dashboard
        └── Features, flows, and tags

Step 5: Configuration Viewer
        └── Inspect app configuration
```

---

## Step 1: Accessing Devtools

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: USE DEVTOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Accessing Devtools

The Devtools Dashboard provides developer tools
for debugging, testing, and exploring your app.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Access Requirements:**

```
┌─────────────────────────────────────────────┐
│  REQUIRED: superadmin OR developer role     │
│  ─────────────────────────────────────────  │
│  Access is controlled by user role.         │
│  Developers can access without being        │
│  superadmin.                                │
└─────────────────────────────────────────────┘
```

**📋 How to Access:**

```
URL: /devtools

Navigation:
1. Log in as superadmin or developer
2. Click the devtools icon in sidebar
   or navigate directly to /devtools
```

**📋 Devtools Structure:**

```
/devtools/
├── page.tsx           # Home page with overview
├── blocks/
│   └── page.tsx       # Block explorer
├── api/
│   └── page.tsx       # API explorer
├── tests/
│   └── page.tsx       # Test cases viewer
├── config/
│   └── page.tsx       # Configuration viewer
├── features/
│   └── page.tsx       # Features viewer
├── flows/
│   └── page.tsx       # Flows viewer
├── tags/
│   └── page.tsx       # Tags overview
└── style/
    └── page.tsx       # Style gallery
```

**📋 Available Tools:**

| Tool | Path | Description |
|------|------|-------------|
| Block Explorer | `/devtools/blocks` | Browse page builder blocks |
| API Explorer | `/devtools/api` | Test API endpoints |
| Test Coverage | `/devtools/tests` | View test coverage |
| Config Viewer | `/devtools/config` | Inspect configuration |
| Features | `/devtools/features` | Feature documentation |
| Flows | `/devtools/flows` | User flow diagrams |
| Tags | `/devtools/tags` | Tag/category overview |
| Style Gallery | `/devtools/style` | Component showcase |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Block Explorer)
[2] I can't access devtools
[3] How do I make someone a developer?
```

---

## Step 2: Block Explorer

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Block Explorer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Browse and inspect all page builder blocks
in your theme.
```

**📋 Block Explorer Features:**

```
┌─────────────────────────────────────────────┐
│  /devtools/blocks                           │
│  ─────────────────────────────────────────  │
│                                             │
│  VIEW:                                      │
│  • All registered blocks                    │
│  • Block metadata (name, category, icon)    │
│  • Schema structure                         │
│  • Field definitions                        │
│                                             │
│  FILTERS:                                   │
│  • Filter by category                       │
│  • Search by name                           │
│                                             │
│  ACTIONS:                                   │
│  • View block details                       │
│  • Preview block rendering                  │
│  • View schema JSON                         │
│  • View fields configuration                │
└─────────────────────────────────────────────┘
```

**📋 Block Detail View:**

```
/devtools/blocks/:blockName

Shows:
├── Configuration
│   ├── Name
│   ├── Display Name
│   ├── Description
│   ├── Category
│   ├── Icon
│   └── Variants
├── Schema
│   └── Zod schema structure
├── Fields
│   └── Form field definitions
└── Preview
    └── Live block preview
```

**📋 Using Block Explorer:**

```typescript
// BlocksViewer component
import { BlocksViewer } from '@/core/components/devtools'

// Or BlockDetailViewer for single block
import { BlockDetailViewer } from '@/core/components/devtools'

<BlockDetailViewer blockName="hero-banner" />
```

**📋 Block Categories:**

| Category | Description |
|----------|-------------|
| hero | Large header sections |
| content | General content blocks |
| features | Feature showcases |
| cta | Call to action sections |
| footer | Footer components |
| gallery | Image galleries |
| testimonials | Reviews and testimonials |
| pricing | Pricing tables |
| faq | FAQ/Accordion sections |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (API Explorer)
[2] How do I create a new block?
[3] Can I preview with custom data?
```

---

## Step 3: API Explorer

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: API Explorer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test API endpoints interactively, similar
to Postman but built into your app.
```

**📋 API Explorer Features:**

```
┌─────────────────────────────────────────────┐
│  /devtools/api                              │
│  ─────────────────────────────────────────  │
│                                             │
│  CAPABILITIES:                              │
│  • Browse all API endpoints                 │
│  • Send test requests                       │
│  • View response data                       │
│  • Auto-authentication                      │
│  • Request history                          │
│                                             │
│  REQUEST BUILDER:                           │
│  • Method selection (GET, POST, etc.)       │
│  • URL parameters                           │
│  • Request body (JSON)                      │
│  • Headers configuration                    │
│                                             │
│  RESPONSE VIEWER:                           │
│  • Status code                              │
│  • Response headers                         │
│  • Response body (formatted JSON)           │
│  • Response time                            │
└─────────────────────────────────────────────┘
```

**📋 Endpoint Documentation:**

The API Explorer reads documentation from `docs.md` files:

```
app/api/v1/entities/
├── route.ts         # API handler
└── docs.md          # Endpoint documentation

// docs.md format
# Entity API

## GET /api/v1/entities/:entity
List all records for an entity.

### Parameters
- `entity` (path) - Entity slug
- `page` (query) - Page number
- `limit` (query) - Items per page

### Response
{ "success": true, "data": [...] }
```

**📋 ApiTester Component:**

```typescript
import { ApiTester } from '@/core/components/devtools'

// Interactive API testing UI
<ApiTester
  defaultEndpoint="/api/v1/entities/tasks"
  defaultMethod="GET"
/>
```

**📋 Authentication in API Explorer:**

```
┌─────────────────────────────────────────────┐
│  AUTO-AUTHENTICATION                        │
│  ─────────────────────────────────────────  │
│                                             │
│  The API Explorer automatically uses your   │
│  current session for authentication.        │
│                                             │
│  For API key testing:                       │
│  1. Click "Auth Settings"                   │
│  2. Select "API Key"                        │
│  3. Enter your API key                      │
│  4. Requests include Authorization header   │
└─────────────────────────────────────────────┘
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Test Coverage)
[2] How do I add documentation for my API?
[3] Can I export requests to curl?
```

---

## Step 4: Test Coverage Dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Test Coverage Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View test coverage metrics for features,
flows, and tags.
```

**📋 Test Coverage Features:**

```
┌─────────────────────────────────────────────┐
│  /devtools/tests                            │
│  ─────────────────────────────────────────  │
│                                             │
│  METRICS:                                   │
│  • Feature coverage percentage              │
│  • Flow coverage percentage                 │
│  • Total tests count                        │
│  • Tests by tag                             │
│                                             │
│  VIEWS:                                     │
│  • Features list with test status           │
│  • Flows list with coverage                 │
│  • Tags hierarchy                           │
│  • Test files browser                       │
└─────────────────────────────────────────────┘
```

**📋 Coverage Summary:**

```typescript
// From COVERAGE_SUMMARY
{
  theme: 'default',
  generatedAt: '2024-12-18T10:30:00Z',
  features: {
    total: 15,
    withTests: 12,
    withoutTests: 3
  },
  flows: {
    total: 5,
    withTests: 3,
    withoutTests: 2
  },
  tags: {
    total: 97,
    testFiles: 25
  }
}
```

**📋 Features Viewer:**

```
/devtools/features

┌─────────────────────────────────────────────┐
│  FEATURE COVERAGE                           │
│  ─────────────────────────────────────────  │
│                                             │
│  Feature          Status    Tests    Tag    │
│  ──────────────   ──────    ─────    ────   │
│  authentication   ✓ Tested  15       @feat-auth
│  teams-mgmt       ✓ Tested  8        @feat-teams
│  billing          ✗ No tests 0       @feat-billing
│  notifications    ✗ No tests 0       @feat-notif
│                                             │
│  Coverage: 80% (12/15 features)             │
└─────────────────────────────────────────────┘
```

**📋 Flows Viewer:**

```
/devtools/flows

┌─────────────────────────────────────────────┐
│  FLOW COVERAGE                              │
│  ─────────────────────────────────────────  │
│                                             │
│  Flow             Critical  Tests   Tag     │
│  ──────────────   ────────  ─────   ────    │
│  user-onboarding  ★         5       @flow-onboarding
│  team-collab      ★         3       @flow-team
│  checkout         ★         0       @flow-checkout
│                                             │
│  Coverage: 60% (3/5 flows)                  │
│  Critical flows: 2/3 covered                │
└─────────────────────────────────────────────┘
```

**📋 Tags Overview:**

```
/devtools/tags

Shows tag hierarchy:
├── features (@feat-*)
├── flows (@flow-*)
├── priorities (@smoke, @regression)
├── operations (@crud, @search)
├── areas (@area-devtools, @area-superadmin)
└── other (custom tags)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Configuration Viewer)
[2] How do I increase my coverage?
[3] What do the tags mean?
```

---

## Step 5: Configuration Viewer

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Configuration Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect your application's configuration
in real-time.
```

**📋 Config Viewer Features:**

```
┌─────────────────────────────────────────────┐
│  /devtools/config                           │
│  ─────────────────────────────────────────  │
│                                             │
│  SHOWS:                                     │
│  • app.config.ts values                     │
│  • Environment variables (safe ones)        │
│  • Feature flags                            │
│  • Entity configurations                    │
│  • Theme settings                           │
│                                             │
│  VIEWS:                                     │
│  • Tree view (collapsible)                  │
│  • JSON view (raw)                          │
│  • Table view (key-value)                   │
└─────────────────────────────────────────────┘
```

**📋 ConfigViewer Component:**

```typescript
import { ConfigViewer } from '@/core/components/devtools'

<ConfigViewer
  config={appConfig}
  view="tree"  // 'tree' | 'json' | 'table'
/>
```

**📋 Configuration Sections:**

| Section | Shows |
|---------|-------|
| App | App name, URL, environment |
| Auth | Auth providers, settings |
| Entities | Registered entities |
| Teams | Team mode, roles |
| Billing | Plans, features |
| Theme | project, settings |

**📋 Security Note:**

```
┌─────────────────────────────────────────────┐
│  ⚠️ SECURITY                                │
│  ─────────────────────────────────────────  │
│                                             │
│  The Config Viewer does NOT show:           │
│  • API keys                                 │
│  • Database credentials                     │
│  • Secret tokens                            │
│  • Sensitive environment variables          │
│                                             │
│  Only safe, non-sensitive configuration     │
│  values are displayed.                      │
└─────────────────────────────────────────────┘
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Accessing the Devtools Dashboard
• Block Explorer for page builder
• API Explorer for testing endpoints
• Test Coverage Dashboard
• Configuration Viewer

📚 Related tutorials:
   • /how-to:create-block - Create page builder blocks
   • /how-to:manage-test-coverage - Testing strategy
   • /how-to:create-api - Create API endpoints

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "How do I make someone a developer?"

```
📋 Adding Developer Role:

Option 1: Via devKeyring (development)

   // app.config.ts
   devKeyring: {
     'dev@example.com': {
       password: 'Test1234',
       role: 'developer',  // or 'member'
       isDeveloper: true   // grants devtools access
     }
   }

Option 2: Via database

   UPDATE users SET is_developer = true
   WHERE email = 'dev@example.com';

Option 3: Custom user field

   // Add to user schema and check in auth
   const canAccessDevtools = user.role === 'superadmin'
     || user.isDeveloper === true
```

### "How do I add documentation for my API?"

```
📋 Adding API Documentation:

1. Create docs.md next to your route.ts:

   app/api/v1/my-endpoint/
   ├── route.ts
   └── docs.md

2. Use markdown format:

   # My Endpoint

   ## POST /api/v1/my-endpoint
   Create a new resource.

   ### Request Body
   ```json
   {
     "name": "string",
     "value": "number"
   }
   ```

   ### Response
   ```json
   {
     "success": true,
     "data": { "id": "..." }
   }
   ```

   ### Errors
   - 400: Validation error
   - 401: Unauthorized
   - 403: Forbidden

3. The API Explorer will automatically load it.
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:create-block` | Create page builder blocks |
| `/how-to:manage-test-coverage` | Testing and coverage strategy |
| `/how-to:create-api` | Create custom API endpoints |
| `/how-to:use-superadmin` | Superadmin panel |
