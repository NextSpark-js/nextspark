# Default Theme Introduction

## Overview

The **Default Theme** (also known as "Boilerplate") is the reference implementation for the NextSpark system. It serves as both a working example and a starting point for creating custom themes.

**Key Characteristics:**
- **Production-Ready** - Fully functional theme with complete features
- **Reference Implementation** - Demonstrates best practices and patterns
- **Minimal but Complete** - Essential features without unnecessary complexity
- **Highly Customizable** - Easy to extend or use as a base for new themes

## Purpose

### As a Reference

The default theme showcases:
- **Theme Structure** - How to organize theme files and directories
- **Entity Configuration** - Example entity (Tasks) with complete setup
- **Public Templates** - Landing page, features, pricing, and support pages
- **Styling System** - OKLCH color system with Tailwind CSS v4
- **Internationalization** - English and Spanish translations
- **Plugin Integration** - AI plugin integration example

### As a Starting Point

Use the default theme to:
- **Bootstrap New Projects** - Start with working foundation
- **Learn Theme System** - Understand theme architecture
- **Create Custom Themes** - Copy and modify for your brand
- **Test Features** - Verify core functionality works correctly

## Key Features

### 1. Modern Design System

**Color System:**
- OKLCH color space for perceptual uniformity
- Comprehensive color palette (background, foreground, primary, secondary, etc.)
- Chart colors (5 variations)
- Sidebar-specific colors
- Automatic dark mode support

**Typography:**
- **Sans:** Open Sans (body text)
- **Serif:** Source Serif 4 (headings)
- **Mono:** IBM Plex Mono (code)

**Spacing:**
- Consistent spacing scale (xs to 2xl)
- Custom border radius system (1.5rem base)
- Comprehensive shadow system

### 2. Responsive Layout

**Breakpoints:**
- Mobile-first approach
- Desktop, tablet, and mobile optimized
- Custom mobile navigation with bottom bar
- Responsive sidebar for dashboard

**Mobile Features:**
- Bottom navigation with 5 configurable items
- Central action button (highlighted)
- "More" sheet for additional options
- Touch-optimized interactions

### 3. Task Management Entity

**Complete CRUD Operations:**
- Create, read, update, delete tasks
- Searchable and filterable
- Sortable columns
- Bulk operations support

**Features:**
- Metadata system support
- API access enabled
- Multi-language support
- RLS (Row Level Security) ready

**Permissions:**
- All roles can manage tasks (member, colaborator, admin)
- User-scoped data access
- Dashboard integration

### 4. Public Pages

**Available Templates:**
- **Home** (`/`) - Landing page
- **Features** (`/features`) - Feature showcase
- **Pricing** (`/pricing`) - Pricing plans
- **Support** (`/support`) - Support information

**Characteristics:**
- Server-side rendered
- SEO optimized
- Responsive design
- Internationalized content

### 5. Internationalization

**Supported Languages:**
- **English** (en) - Primary
- **Spanish** (es) - Default

**Translation Namespaces:**
- `common` - Shared UI elements
- `dashboard` - Dashboard-specific content
- `settings` - Settings pages
- `auth` - Authentication flows
- `public` - Public pages
- `validation` - Form validation
- `tasks` - Task entity translations

### 6. Plugin Integration

**Included Plugin:**
- **AI Plugin** - Artificial intelligence features integration

**Integration Points:**
- Plugin configuration in `theme.config.ts`
- Plugin documentation accessible
- Seamless plugin functionality

## Theme Structure

```
contents/themes/default/
├── theme.config.ts              # Theme configuration and metadata
├── app.config.ts                # Application config overrides
├── dashboard.config.ts          # Dashboard configuration
│
├── entities/                    # Theme-specific entities
│   └── tasks/
│       ├── tasks.config.ts      # Entity configuration
│       ├── tasks.fields.ts      # Field definitions
│       ├── messages/            # Entity translations
│       │   ├── en.json
│       │   └── es.json
│       └── migrations/          # Database migrations
│           ├── 001_tasks_table.sql
│           ├── 002_task_metas.sql
│           └── 003_tasks_sample_data.sql
│
├── messages/                    # Theme-wide translations
│   ├── en.json
│   └── es.json
│
├── templates/                   # Page templates
│   └── (public)/
│       ├── layout.tsx           # Public layout
│       ├── page.tsx             # Home page
│       ├── features/page.tsx    # Features page
│       ├── pricing/page.tsx     # Pricing page
│       └── support/page.tsx     # Support page
│
├── styles/                      # Theme styles
│   ├── globals.css              # Global CSS overrides
│   └── components.css           # Component-specific styles
│
├── public/                      # Static assets
│   ├── brand/                   # Brand assets (logos, favicons)
│   ├── images/                  # Theme images
│   ├── fonts/                   # Custom fonts
│   └── docs/                    # Documentation images
│
└── docs/                        # Theme documentation
    ├── 01-overview/
    └── 02-features/
```

## Configuration Overview

### Theme Configuration (`theme.config.ts`)

**Metadata:**
```typescript
{
  name: 'easy-home',
  displayName: 'Boilerplate',
  version: '1.0.0',
  author: 'NextSpark Team',
  plugins: ['ai']
}
```

**Styles:**
- CSS variable definitions
- Color system (OKLCH)
- Typography system
- Spacing and shadows

**Components:**
- Component overrides (optional)
- Custom components (optional)

### Application Configuration (`app.config.ts`)

**Overrides:**
- App name and version
- Supported locales (en, es)
- Default locale (es)
- CORS origins
- Documentation settings
- Mobile navigation configuration

**Notable Settings:**
- Documentation enabled and public
- Plugin docs hidden in production
- 5-item mobile bottom navigation
- Configurable "More" sheet items

## Active Theme Selection

**Environment Variable:**
```bash
NEXT_PUBLIC_ACTIVE_THEME=default
```

**Build-Time Selection:**
- Theme selected during build/dev startup
- Registry system loads theme configuration
- Styles compiled and injected
- Translations loaded
- Templates rendered

## Getting Started

### 1. Activate Theme

```bash
# Set in .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

### 2. Build Registry

```bash
pnpm registry:build
```

### 3. Start Development

```bash
pnpm dev
```

### 4. Access Application

- **Dashboard:** http://localhost:5173/dashboard
- **Home:** http://localhost:5173/
- **Tasks:** http://localhost:5173/dashboard/tasks

## Use Cases

### Learning the System

**Best for:**
- New developers learning the boilerplate
- Understanding theme architecture
- Exploring entity system
- Testing core features

**Approach:**
- Study theme structure
- Review configuration files
- Examine entity implementation
- Test in browser

### Starting New Project

**Best for:**
- Rapid project initialization
- Client projects needing base theme
- MVPs and prototypes
- Standard SaaS applications

**Approach:**
- Copy default theme
- Rename to project-specific name
- Customize colors and typography
- Add/modify entities
- Update translations
- Customize public pages

### Reference Implementation

**Best for:**
- Creating custom themes
- Verifying core functionality
- Comparing implementations
- Learning best practices

**Approach:**
- Reference when stuck
- Compare implementations
- Copy proven patterns
- Verify expected behavior

## Customization Possibilities

The default theme can be customized in several ways:

**Visual:**
- Colors (OKLCH color system)
- Typography (font families)
- Spacing and sizing
- Border radius
- Shadows

**Structure:**
- Add/remove entities
- Modify public pages
- Change navigation
- Add custom components

**Functionality:**
- Enable/disable features
- Add plugins
- Configure permissions
- Adjust mobile navigation

**Content:**
- Update translations
- Change brand assets
- Modify page copy
- Add documentation

## Next Steps

- **[Customization](./02-customization.md)** - Learn how to customize the theme
- **[Components](../02-features/01-components.md)** - Explore theme components
- **[Styling](../02-features/02-styling.md)** - Understand the styling system
- **[Core Documentation](/docs/core/theme-system/introduction)** - Deep dive into theme system