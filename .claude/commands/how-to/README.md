# /how-to:* Commands

Interactive guided tutorials for NextSpark core functionalities.

---

## Philosophy

These commands follow a **guided learning approach**:

1. **Step-by-step instructions** - Claude guides you through each step
2. **Interactive Q&A** - Ask questions at any point during the tutorial
3. **Hands-on practice** - Apply concepts to your actual project
4. **Validation** - Claude validates your implementation as you go

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  /how-to:{topic}                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Introduction                                                │
│     - Brief explanation of the concept                         │
│     - What you'll learn                                        │
│     - Prerequisites check                                      │
│     ↓                                                           │
│  2. Step-by-Step Guide                                          │
│     - Each step explained clearly                              │
│     - Code examples and patterns                               │
│     - Pause after each step for questions                      │
│     ↓                                                           │
│  3. Interactive Implementation                                  │
│     - Apply to your project                                    │
│     - Claude validates your work                               │
│     ↓                                                           │
│  4. Summary & Next Steps                                        │
│     - Recap what you learned                                   │
│     - Related tutorials                                        │
│     - Best practices reminder                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Available Commands

### Getting Started

| Command | Description |
|---------|-------------|
| `/how-to:start` | **Main index** - Starting point for all tutorials |

### Configuration & Setup

| Command | Description |
|---------|-------------|
| `/how-to:setup-claude-code` | **First step** - Configure AI workflow system |
| `/how-to:setup-database` | Configure PostgreSQL, run migrations |
| `/how-to:setup-authentication` | Configure Better Auth, OAuth providers |
| `/how-to:setup-email-providers` | Configure email sending providers |
| `/how-to:set-app-languages` | Configure supported languages and i18n |

### Entities & Database

| Command | Description |
|---------|-------------|
| `/how-to:create-entity` | Create a new entity with full CRUD |
| `/how-to:create-migrations` | Write database migrations with RLS |
| `/how-to:create-api` | Create custom API endpoints |

### Page Builder & Blocks

| Command | Description |
|---------|-------------|
| `/how-to:create-block` | Create page builder blocks |

### Permissions & Billing

| Command | Description |
|---------|-------------|
| `/how-to:set-plans-and-permissions` | Configure subscription plans and features |
| `/how-to:set-user-roles-and-permissions` | Configure team roles and RBAC |

### Plugins & Extensions

| Command | Description |
|---------|-------------|
| `/how-to:create-plugin` | Create a new plugin from scratch |
| `/how-to:install-plugins` | Install and configure plugins |
| `/how-to:set-scheduled-actions` | Configure background tasks and cron jobs |

### Customization

| Command | Description |
|---------|-------------|
| `/how-to:customize-theme` | Customize design system and styles |
| `/how-to:customize-dashboard` | Customize dashboard layout and navigation |
| `/how-to:customize-app` | App-level customizations and settings |

### Testing & Deployment

| Command | Description |
|---------|-------------|
| `/how-to:add-translations` | Add translations for your content |
| `/how-to:run-tests` | Run Cypress API and E2E tests |
| `/how-to:deploy` | Deploy to production |

---

## Interaction Pattern

During any how-to tutorial, Claude will:

1. **Show the current step** with clear instructions
2. **Wait for your confirmation** or questions
3. **Validate your implementation** when requested
4. **Answer questions** at any point

### Response Options at Each Step

```
📚 STEP 2 OF 5: Create the Entity Configuration

[Instructions for this step...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to next step
[2] See code example
[3] I have a question
[4] Apply this to my project now
[5] Skip this step
[6] Exit tutorial
```

---

## Example Session

```
> /how-to:create-entity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE AN ENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome! This tutorial will guide you through creating
a new entity in NextSpark with full CRUD capabilities.

📋 What you'll learn:
   • Entity configuration structure
   • Database migration with RLS
   • Automatic API generation
   • Dashboard integration

⏱️  Estimated time: 15-20 minutes

Prerequisites:
   ✓ NextSpark project set up
   ✓ Database running
   ✓ project configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to begin? What entity would you like to create?

> Products entity with name, price, and category

Great! Let's create the Products entity. Starting with Step 1...
```

---

## Command Standards

Each how-to command follows these conventions:

### 1. Clear Step Numbers

Every step is numbered (STEP 1 OF N) so users know their progress.

### 2. Interactive Checkpoints

After each major step, Claude asks the user to confirm understanding or if they have questions.

### 3. Code Validation

When users implement code, Claude offers to validate their implementation.

### 4. Related Skills

Each tutorial references related skills for deeper learning.

### 5. Exit Gracefully

Users can exit at any point. Progress context is preserved for the session.

---

## Naming Convention

```
how-to:  (prefix) → TUTORIAL command namespace

   /how-to:create-entity    → "create entity" tutorial
   /how-to:setup-database   → "setup database" tutorial

-  (hyphen) → COMPOUND WORD separator

   /how-to:set-app-languages     → "set app languages"
   /how-to:customize-dashboard   → "customize dashboard"
```

---

## Command Files

- [start.md](./start.md) - Main index
- [setup-claude-code.md](./setup-claude-code.md) - AI workflow configuration (FIRST STEP)
- [setup-database.md](./setup-database.md) - Database setup
- [setup-authentication.md](./setup-authentication.md) - Auth setup
- [setup-email-providers.md](./setup-email-providers.md) - Email providers
- [set-app-languages.md](./set-app-languages.md) - i18n setup
- [create-entity.md](./create-entity.md) - Entity creation
- [create-migrations.md](./create-migrations.md) - Database migrations
- [create-api.md](./create-api.md) - API endpoints
- [create-block.md](./create-block.md) - Block development
- [create-plugin.md](./create-plugin.md) - Plugin development
- [create-child-entities.md](./create-child-entities.md) - Child entities
- [add-metadata.md](./add-metadata.md) - Metadata system
- [add-taxonomies.md](./add-taxonomies.md) - Tags and categories
- [add-translations.md](./add-translations.md) - Translations
- [set-plans-and-permissions.md](./set-plans-and-permissions.md) - Billing & plans
- [set-user-roles-and-permissions.md](./set-user-roles-and-permissions.md) - RBAC
- [set-scheduled-actions.md](./set-scheduled-actions.md) - Background jobs
- [install-plugins.md](./install-plugins.md) - Plugin installation
- [customize-theme.md](./customize-theme.md) - Theme customization
- [customize-dashboard.md](./customize-dashboard.md) - Dashboard customization
- [customize-app.md](./customize-app.md) - App customization
- [define-features-flows.md](./define-features-flows.md) - Feature registry
- [manage-test-coverage.md](./manage-test-coverage.md) - Test coverage
- [run-tests.md](./run-tests.md) - Testing
- [deploy.md](./deploy.md) - Deployment
- [use-superadmin.md](./use-superadmin.md) - Superadmin panel
- [use-devtools.md](./use-devtools.md) - Developer tools
- [handle-file-uploads.md](./handle-file-uploads.md) - File uploads
- [implement-search.md](./implement-search.md) - Search implementation

---

## Related

- `/session:*` - Development session commands
- `.claude/skills/` - Detailed technical knowledge
- `docs/` - Project documentation
