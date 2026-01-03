# {{THEME_DISPLAY_NAME}}

{{THEME_DESCRIPTION}}

## Overview

This theme provides a complete starting point for building your application.

## Features

- Modern design with light/dark mode support
- Fully responsive layout
- Customizable color palette
- Internationalization ready (English & Spanish)
- Complete permission system
- Subscription/billing integration

## Getting Started

1. Configure your theme in `config/`:
   - `theme.config.ts` - Visual styling (colors, fonts, spacing)
   - `app.config.ts` - Application settings (teams, i18n, API)
   - `permissions.config.ts` - Roles and permissions (Single Source of Truth)
   - `billing.config.ts` - Plans, features, limits
   - `dashboard.config.ts` - Dashboard UI configuration
   - `dev.config.ts` - Development tools (devKeyring)

2. Add your translations in `messages/`

3. Create your entities in `entities/`

4. Customize public pages in `templates/(public)/`

## Structure

```
{{THEME_SLUG}}/
├── config/                   # Theme configuration (6 files)
│   ├── app.config.ts         # App settings, i18n, teams mode
│   ├── billing.config.ts     # Plans, features, limits
│   ├── dashboard.config.ts   # Dashboard UI (topbar, sidebar)
│   ├── dev.config.ts         # Development tools (devKeyring)
│   ├── permissions.config.ts # Roles, team/entity permissions
│   └── theme.config.ts       # Visual styling, component overrides
│
├── about/                    # Theme documentation
│   ├── business.md           # Business overview
│   ├── features.json         # Feature registry for tests
│   └── team.md               # Team/user documentation
│
├── styles/
│   ├── globals.css           # CSS variables, colors
│   └── components.css        # Component styles
│
├── messages/
│   ├── en.json               # English translations
│   └── es.json               # Spanish translations
│
├── entities/                 # Data entities
│   └── [entity]/
│       ├── [entity].config.ts
│       ├── [entity].fields.ts
│       ├── [entity].types.ts
│       ├── [entity].service.ts
│       ├── messages/
│       └── migrations/
│
├── blocks/                   # Page builder blocks
│   └── [block]/
│       ├── component.tsx
│       ├── config.ts
│       ├── fields.ts
│       ├── schema.ts
│       └── index.ts
│
├── templates/                # Page templates
│   └── (public)/
│       ├── layout.tsx
│       ├── page.tsx
│       └── support/
│
├── migrations/               # Database migrations
│
├── tests/                    # Testing
│   ├── cypress.config.ts
│   ├── cypress/
│   └── jest/
│
├── docs/                     # Theme documentation
│
└── public/                   # Static assets
```

## Configuration Files

| File | Purpose |
|------|---------|
| `config/app.config.ts` | Application metadata, teams mode, i18n, API settings |
| `config/permissions.config.ts` | **Single Source of Truth** for all permissions and roles |
| `config/billing.config.ts` | Subscription plans, features, limits, action mappings |
| `config/dashboard.config.ts` | Topbar, sidebar, settings pages, entity views |
| `config/theme.config.ts` | Visual styling, fonts, spacing, component overrides |
| `config/dev.config.ts` | DevKeyring users, development tools |

## Author

{{THEME_AUTHOR}}

## Version

{{THEME_VERSION}}
