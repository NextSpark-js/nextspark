# NextSpark Project Wizard

The NextSpark CLI wizard helps you create a new project with a customized starter theme. It provides an interactive experience to configure your project's settings.

## Running the Wizard

```bash
npx nextspark init
```

Or with options:

```bash
# Quick mode (fewer questions)
npx nextspark init --quick

# Expert mode (all options)
npx nextspark init --expert

# Use a preset
npx nextspark init --preset saas
npx nextspark init --preset blog
npx nextspark init --preset crm
```

## Wizard Steps (9 Steps)

### Step 1: Project Info
- **Project Name**: Display name for your project
- **Project Slug**: URL-friendly identifier (e.g., `my-app`)
- **Project Description**: Brief description of your project

### Step 2: Team Configuration
- **Team Mode**: `multi-tenant` | `single-tenant` | `single-user`
- **Team Roles**: Select roles (owner, admin, member, viewer, or custom)

### Step 3: Internationalization
- **Default Locale**: Primary language (en, es, fr, de, it, pt)
- **Supported Locales**: Additional languages

### Step 4: Billing Configuration
- **Billing Model**: `free` | `freemium` | `paid`
- **Currency**: USD, EUR, GBP, CAD, AUD

### Step 5: Features
- Analytics Dashboard
- Team Management
- Billing & Subscriptions
- API Access
- Documentation Site

### Step 6: Content Features (NEW)
- **Pages with Page Builder**: Adds the `page` entity with full page builder support
- **Blog**: Adds the `post` entity with the Post Content block

### Step 7: Authentication
- Email & Password
- Google OAuth
- Email Verification

### Step 8: Dashboard Features
- Global Search
- Notifications
- Theme Toggle
- Support/Help Menu
- Quick Create
- Superadmin Access
- DevTools Access

### Step 9: Dev Tools
- Dev Keyring (development credentials)
- Debug Mode

## Presets

Presets pre-configure all settings for common use cases:

| Preset | Team Mode | Billing | Content Features |
|--------|-----------|---------|------------------|
| **saas** | multi-tenant | freemium | pages: false, blog: false |
| **blog** | single-user | free | pages: false, blog: true |
| **crm** | single-tenant | paid | pages: true, blog: false |

## Generated Structure

The wizard generates:

```
your-project/
├── app/                          # Next.js app directory
├── contents/
│   └── themes/
│       └── [your-slug]/          # Your custom theme
│           ├── config/           # Configuration files
│           │   ├── app.config.ts
│           │   ├── theme.config.ts
│           │   ├── billing.config.ts
│           │   ├── dashboard.config.ts
│           │   ├── dev.config.ts
│           │   └── permissions.config.ts
│           ├── entities/         # Entity definitions
│           │   ├── tasks/        # Default task entity
│           │   ├── pages/        # (if pages enabled)
│           │   └── posts/        # (if blog enabled)
│           ├── blocks/           # Page builder blocks
│           │   ├── hero/         # Default hero block
│           │   └── post-content/ # (if blog enabled)
│           ├── messages/         # i18n translations
│           ├── templates/        # Page templates
│           ├── tests/            # Cypress & Jest tests
│           └── migrations/       # Database migrations
├── public/                       # Static assets
├── .env.example                  # Environment template
└── package.json                  # Dependencies & scripts
```

## DX Features

### Demo Theme Installation
Before starting the wizard, you can optionally install a demo theme to explore NextSpark features:

```
Would you like to install the demo theme first? (recommended for exploration)
```

### Interactive Preview
After configuration, the wizard shows a preview of files to be created before generation.

### Environment Setup
The wizard can automatically:
- Copy `.env.example` to `.env`
- Set your theme as active (`NEXT_PUBLIC_ACTIVE_THEME`)
- Generate secure `BETTER_AUTH_SECRET`
- Configure database URL

### Git Integration
Optionally initialize a Git repository with an initial commit.

### Doctor Command
Validate your project setup:

```bash
npx nextspark doctor
```

## What's New

### Recent Improvements

1. **Content Features Step (Step 6)**
   - Optional Pages with Page Builder support
   - Optional Blog with Posts entity
   - Intelligent entity/block copying based on selection

2. **Dashboard Features**
   - All 7 topbar features now configurable
   - Support, Quick Create, Superadmin Access, DevTools Access

3. **DX Improvements**
   - Demo theme installation
   - Interactive config preview
   - Environment auto-setup
   - Git initialization
   - Doctor health check

4. **Empty Directory Support**
   - Wizard can now run from an empty directory
   - Automatically creates `package.json` if missing

## Pending Improvements

### Custom Dashboard Components
Future wizard step to create custom sidebar and topbar components:
- User can choose to add custom dashboard components to their theme
- Creates a `/components` folder with custom Sidebar and Topbar
- Edits the dashboard layout to use custom components
- Components initially identical to core, but fully customizable
