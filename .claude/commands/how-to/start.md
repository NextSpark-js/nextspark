# /how-to:start

Interactive learning hub for NextSpark - Your starting point for all tutorials.

**Aliases:** `/learn`, `/tutorials`

---

## Syntax

```
/how-to:start
/how-to:start [topic]
/how-to:start --list
```

---

## Behavior

This command presents an interactive menu of all available tutorials, organized by category. Users can:
- Browse tutorials by category
- Jump directly to a specific topic
- Get recommendations based on their project state

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /how-to:start                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Welcome & Introduction                                      │
│     - Brief explanation of the how-to system                   │
│     - Show tutorial categories                                 │
│     ↓                                                           │
│  2. [MANDATORY] Ask user's learning goal                        │
│     - "What would you like to learn?"                          │
│     - Present categories as options                            │
│     ↓                                                           │
│  3. Show relevant tutorials                                     │
│     - List tutorials in selected category                      │
│     - Suggest learning path if applicable                      │
│     ↓                                                           │
│  4. [MANDATORY] Launch selected tutorial                        │
│     - Hand off to specific how-to command                      │
│     - Preserve context for follow-up                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 NEXTSPARK LEARNING HUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome! I'm here to guide you through NextSpark's features
with interactive, step-by-step tutorials.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 TUTORIAL CATEGORIES

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  🚀 GETTING STARTED (New to NextSpark)                          │
│     ├── Setup Claude Code                 ← START HERE         │
│     ├── Setup Database                                         │
│     ├── Setup Authentication                                   │
│     ├── Setup Email Providers                                  │
│     └── Set App Languages                                      │
│                                                                 │
│  📊 ENTITIES & DATA                                             │
│     ├── Create Entity                     ← Most popular       │
│     ├── Create Migrations                                      │
│     ├── Create API Endpoints                                   │
│     ├── Add Metadata                      ← NEW                │
│     ├── Create Child Entities             ← NEW                │
│     └── Add Taxonomies                    ← NEW                │
│                                                                 │
│  🧱 PAGE BUILDER                                                │
│     └── Create Block                                           │
│                                                                 │
│  🔐 PERMISSIONS & BILLING                                       │
│     ├── Set Plans and Permissions                              │
│     └── Set User Roles and Permissions                         │
│                                                                 │
│  🔌 PLUGINS & EXTENSIONS                                        │
│     ├── Create Plugin                                          │
│     ├── Install Plugins                                        │
│     └── Set Scheduled Actions                                  │
│                                                                 │
│  🎨 CUSTOMIZATION                                               │
│     ├── Customize Theme                                        │
│     ├── Customize Dashboard                                    │
│     └── Customize App                                          │
│                                                                 │
│  📈 QUALITY & COVERAGE (connects everything!)                   │
│     ├── Define Features & Flows          ← Start here          │
│     └── Manage Test Coverage             ← Then this           │
│                                                                 │
│  🧪 TESTING & DEPLOYMENT                                        │
│     ├── Add Translations                                       │
│     ├── Run Tests                                              │
│     └── Deploy                                                 │
│                                                                 │
│  🛠️ ADMINISTRATION                            ← NEW SECTION     │
│     ├── Use Superadmin Panel              ← NEW                │
│     └── Handle File Uploads               ← NEW                │
│                                                                 │
│  🔧 DEVELOPER TOOLS                           ← NEW SECTION     │
│     ├── Use Devtools Dashboard            ← NEW                │
│     └── Implement Search                  ← NEW                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to learn?

[1] Getting Started - I'm new to NextSpark
[2] Create Entity - Add new data types to my app
[3] Create Block - Build page builder components
[4] Permissions & Billing - Configure access control
[5] Create Plugin - Extend functionality
[6] Customize - Change the look and feel
[7] Quality & Coverage - Define features, flows, and testing
[8] Administration - Manage users and files
[9] Developer Tools - Devtools and search
[10] Other - Show me all tutorials
```

---

## Learning Paths

When user selects a category, suggest a learning path:

### Getting Started Path

```
📍 RECOMMENDED PATH: Getting Started

   Step 0: /how-to:setup-claude-code        ← START HERE
           └── Configure AI workflow system
           └── Set up config files (workspace, team, github)
                │
                ↓
   Step 1: /how-to:setup-database
           └── Configure PostgreSQL, run migrations
                │
                ↓
   Step 2: /how-to:setup-authentication
           └── Configure Better Auth, social logins
                │
                ↓
   Step 3: /how-to:set-app-languages
           └── Configure supported languages

   ⏱️  Total estimated time: ~60 minutes

Would you like to start with Step 0?
```

### Entity Developer Path

```
📍 RECOMMENDED PATH: Entity Development

   Step 1: /how-to:create-entity
           └── Create entity config, schema, service
                │
                ↓
   Step 2: /how-to:create-migrations
           └── Write migrations with RLS
                │
                ↓
   Step 3: /how-to:create-api
           └── Add custom endpoints

   ⏱️  Total estimated time: ~30 minutes

Would you like to start with Step 1?
```

### Page Builder Path

```
📍 RECOMMENDED PATH: Page Builder Development

   Step 1: /how-to:create-block
           └── Create page builder blocks
                │
                ↓
   Step 2: /how-to:customize-theme
           └── Customize design system

   ⏱️  Total estimated time: ~25 minutes

Would you like to start with Step 1?
```

### Security & Billing Path

```
📍 RECOMMENDED PATH: Permissions & Billing

   Step 1: /how-to:set-user-roles-and-permissions
           └── Configure team roles and RBAC
                │
                ↓
   Step 2: /how-to:set-plans-and-permissions
           └── Configure billing plans and features

   ⏱️  Total estimated time: ~35 minutes

Would you like to start with Step 1?
```

### Quality & Coverage Path

```
📍 RECOMMENDED PATH: Quality & Coverage

   Step 1: /how-to:define-features-flows
           └── Understand the conceptual framework
           └── Define YOUR app's features and flows
           └── Document in features.json
                │
                ↓
   Step 2: /how-to:manage-test-coverage
           └── Learn the 3-level selector system
           └── Create Cypress tests with proper tags
           └── Maintain BDD documentation
           └── Track coverage metrics

   ⏱️  Total estimated time: ~40 minutes

💡 TIP: This path connects EVERYTHING together!
   Features → Tests → Tags → Coverage → Devtools

Would you like to start with Step 1?
```

### Administration Path

```
📍 RECOMMENDED PATH: Administration

   Step 1: /how-to:use-superadmin
           └── Access the Superadmin Panel
           └── Manage users, teams, subscriptions
           └── Configure team roles and permissions
                │
                ↓
   Step 2: /how-to:handle-file-uploads
           └── Configure Vercel Blob storage
           └── Use FileUpload, ImageUpload components
           └── Add file fields to entities

   ⏱️  Total estimated time: ~30 minutes

💡 TIP: Superadmin is required to manage users
   and configure system-wide settings.

Would you like to start with Step 1?
```

### Developer Tools Path

```
📍 RECOMMENDED PATH: Developer Tools

   Step 1: /how-to:use-devtools
           └── Access DevTools Dashboard
           └── Explore blocks, API, configuration
           └── View test coverage metrics
                │
                ↓
   Step 2: /how-to:implement-search
           └── Use useEntitySearch hook
           └── Implement search UI
           └── Customize relevance scoring

   ⏱️  Total estimated time: ~25 minutes

💡 TIP: DevTools is available to superadmin
   and developer roles for debugging.

Would you like to start with Step 1?
```

### Advanced Entities Path

```
📍 RECOMMENDED PATH: Advanced Entities

   Step 1: /how-to:add-metadata
           └── Understand metadata system
           └── Use MetaService for custom fields
           └── API patterns for metadata
                │
                ↓
   Step 2: /how-to:create-child-entities
           └── Build parent-child relationships
           └── Configure childEntities array
           └── Use nested API endpoints
                │
                ↓
   Step 3: /how-to:add-taxonomies
           └── Create tags and categories
           └── Set up taxonomy tables
           └── Link entities to taxonomies

   ⏱️  Total estimated time: ~45 minutes

💡 TIP: Complete /how-to:create-entity first
   before starting this advanced path.

Would you like to start with Step 1?
```

---

## Direct Topic Access

```
/how-to:start entities
```

Output:

```
📊 ENTITIES & DATA TUTORIALS

I found 3 tutorials in this category:

[1] Create Entity (15-20 min)
    Create a new entity with full CRUD, validation, and dashboard UI

[2] Create Migrations (10-15 min)
    Write database migrations with RLS policies

[3] Create API Endpoints (10-15 min)
    Create custom API endpoints with dual authentication

Which tutorial would you like to start?
```

---

## Project State Recommendations

Claude may analyze the project state to suggest relevant tutorials:

```
📊 BASED ON YOUR PROJECT:

I noticed:
  • No custom entities defined yet
  • Default permissions config
  • No plugins installed

Recommended next steps:
  1. /how-to:create-entity - Start building your data model
  2. /how-to:set-user-roles-and-permissions - Customize access control

Would you like to start with creating an entity?
```

---

## Options

| Option | Description |
|--------|-------------|
| `--list` | Show all tutorials without interactive menu |
| `[topic]` | Jump directly to topic category |

---

## Interaction Guidelines

### [MANDATORY] Behaviors

1. **Always welcome the user** - Brief, friendly introduction
2. **Present clear options** - Numbered choices for easy selection
3. **Suggest learning paths** - Connect related tutorials
4. **Respect user choice** - Allow direct access to any tutorial

### Optional Behaviors

- Analyze project state for recommendations
- Track completed tutorials (session-based)
- Suggest next steps after completing a tutorial

---

## After Selection

When user selects a tutorial:

1. Confirm selection
2. Launch the specific `/how-to:{topic}` command
3. The new command takes over the interaction

```
Great choice! Let's learn how to create an entity.

Starting tutorial...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE AN ENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Tutorial content continues...]
```

---

## Tutorial Completion

After completing any tutorial, offer navigation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TUTORIAL STORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Great job! You've learned how to create entities.

📚 Related tutorials:
   • /how-to:create-migrations - Add custom database migrations
   • /how-to:create-api - Create custom API endpoints

🔙 Back to menu:
   • /how-to:start - Return to learning hub

What would you like to do next?
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/session:explain` | Explain existing implementation |
| `/session:demo` | Visual demo of a feature |
| `/doc:read` | Read documentation |
