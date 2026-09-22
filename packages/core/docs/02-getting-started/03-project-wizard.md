# NextSpark Project Wizard

The NextSpark CLI wizard helps you create a new project with a customized starter theme. It provides an interactive experience to configure your project's settings.

## Running the Wizard

```bash
pnpm exec nextspark init
```

Or with options:

```bash
# Quick mode (fewer questions)
pnpm exec nextspark init --quick

# Expert mode (all options)
pnpm exec nextspark init --expert

# Use a preset
pnpm exec nextspark init --preset saas
pnpm exec nextspark init --preset blog
pnpm exec nextspark init --preset crm
```

## Wizard Steps (10 Steps)

### Step 1: Project Type
- **Web only**: Standard flat Next.js project
- **Web + Mobile**: pnpm monorepo with a Next.js web app and an Expo mobile app sharing the same backend

### Step 2: Project Info
- **Project Name**: Display name for your project
- **Project Slug**: URL-friendly identifier (e.g., `my-app`)
- **Project Description**: Brief description of your project

### Step 3: Team Configuration
- **Team Mode**: `multi-tenant` | `single-tenant` | `single-user`
- **Team Roles**: Select roles (owner, admin, member, viewer, or custom)

### Step 4: Internationalization
- **Default Locale**: Primary language (en, es, fr, de, it, pt)
- **Supported Locales**: Additional languages

### Step 5: Billing Configuration
- **Billing Model**: `free` | `freemium` | `paid`
- **Currency**: USD, EUR, GBP, CAD, AUD

### Step 6: Features
- Analytics Dashboard
- Team Management
- Billing & Subscriptions
- API Access
- Documentation Site

### Step 7: Content Features (NEW)
- **Pages with Page Builder**: Adds the `page` entity with full page builder support
- **Blog**: Adds the `post` entity with the Post Content block

### Step 8: Authentication
- Email & Password
- Google OAuth
- Email Verification

### Step 9: Dashboard Features
- Global Search
- Notifications
- Theme Toggle
- Support/Help Menu
- Quick Create
- Superadmin Access
- DevTools Access

### Step 10: Dev Tools
- Dev Keyring (development credentials)
- Debug Mode

## Production Sign-In Provider

Login is passwordless by default (an emailed one-time code, plus Google
OAuth) — neither path works in production without a provider, and a
password is never used as an automatic fallback. After Theme & Plugin
Selection, a genuinely interactive run (not `--yes`, not `--quick`, not a
`--preset` run) asks how to handle it:

- **Resend** — a masked prompt for `RESEND_API_KEY` and the sender address
  (`RESEND_FROM_EMAIL`). Values are validated against the same shape core's
  auth readiness check expects (e.g. `re_...` keys, no `@resend.dev` /
  `@yourdomain.com` sender).
- **Google OAuth** — a masked prompt for `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`. Only offered when Step 8 (Authentication) enabled Google OAuth.
- **Both**, or **configure later** — postpones setup. The project still
  generates, but is marked **LOCAL-ONLY / not production-ready for
  sign-in** in `.env` and in the wizard's final summary, with instructions
  to either set the variables above or declare runtime-only injection
  (`NEXTSPARK_AUTH_RUNTIME_ONLY=email,google`) before `nextspark prepare
  --production` / `nextspark build`.

Anything entered here is written only to the project's local `.env` — never
to `.env.example`, never to the console, and never to the wizard summary.
`--yes`, `--quick`, and `--preset` runs always postpone this step rather
than prompting, so a non-interactive run never blocks on it.

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
├── .nextspark/
│   └── registries/                  # Generated registries
├── contents/
│   └── themes/
│       └── [your-slug]/          # Your custom theme
│           ├── config/           # Configuration files
│           │   ├── app.config.ts
│           │   ├── billing.config.ts
│           │   ├── dashboard.config.ts
│           │   ├── dev.config.ts
│           │   ├── features.config.ts
│           │   ├── permissions.config.ts
│           │   └── theme.config.ts
│           ├── entities/         # Entities copied by the starter/features
│           │   └── ...
│           ├── blocks/           # Page builder blocks
│           │   └── ...
│           ├── messages/         # i18n translations
│           ├── templates/        # Page templates
│           ├── tests/            # Cypress & Jest tests
│           └── migrations/       # Database migrations
├── public/                       # Static assets
├── .env                          # Generated local environment
├── .env.example                  # Environment template
├── next.config.mjs
├── proxy.ts
├── tsconfig.json
├── pnpm-workspace.yaml
└── package.json                  # Dependencies & scripts
```

The wizard does not create a root `nextspark.config.ts`. The active theme is
selected with `NEXT_PUBLIC_ACTIVE_THEME` in `.env`, and the generated
TypeScript configuration lives under `contents/themes/[your-slug]/config/`.

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
The CLI includes `nextspark doctor`, but it is not currently a passing
post-generation gate. On a newly generated project it exits with code 1 after
three passing checks because the configuration check parses `tsconfig.json` as
strict JSON while the generated file contains valid JSONC comments. This is a
known CLI/template mismatch; it does not mean the generated TypeScript config
is invalid.

## What's New

### Recent Improvements

1. **Content Features Step (Step 7)**
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
   - Doctor diagnostics (with the fresh-project limitation described above)

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
