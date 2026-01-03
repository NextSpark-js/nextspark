# DevTools

> Development tools and documentation area for developers only.

## Overview

DevTools is accessible at `/devtools` and provides development-specific tools, documentation viewers, and configuration inspectors. Unlike Admin, it is restricted exclusively to users with the `developer` role.

**Route**: `/devtools/*`
**Access**: `developer` only
**Guard**: `DeveloperGuard`
**Color Scheme**: Purple/Violet (`bg-violet-*`, `text-purple-*`)

## Access Control

### DeveloperGuard

Located at `core/components/app/guards/DeveloperGuard.tsx`

```typescript
// Strict developer-only check
if (session.user?.role !== 'developer') {
  // Show access denied or redirect
}
```

### Helper Hook

```typescript
import { useIsDeveloper } from "@/core/components/app/guards/DeveloperGuard";

const isDeveloper = useIsDeveloper();
```

## Available Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/devtools` | `page.tsx` | Dashboard with quick links |
| `/devtools/api` | `api/page.tsx` | API Explorer - list all endpoints |
| `/devtools/api/[...path]` | `api/[...path]/page.tsx` | API Tester - test individual endpoints |
| `/devtools/tests/[[...path]]` | `tests/[[...path]]/page.tsx` | Test cases documentation viewer |
| `/devtools/config` | `config/page.tsx` | Application configuration viewer |
| `/devtools/style` | `style/page.tsx` | Style gallery and design system |

## Layout Structure

```text
/devtools (layout.tsx)
├── DeveloperGuard
│   └── div.flex.h-screen.bg-background
│       ├── DevtoolsSidebar (hidden lg:block)
│       ├── div.flex-1.flex.flex-col
│       │   ├── DevtoolsMobileHeader (lg:hidden)
│       │   └── main.flex-1.overflow-y-auto
│       │       └── div.container.mx-auto.p-6.max-w-7xl
│       │           └── {children}
```

## Key Features

### API Tester (`/devtools/api`)

Integrated Postman-like API testing tool:
- Browse all API endpoints organized by entity
- Click any endpoint to open the tester
- Support for all HTTP methods (GET, POST, PATCH, PUT, DELETE)
- Path parameters with dedicated inputs
- Query parameters and custom headers
- JSON payload editor with validation
- Session or API key authentication
- Cross-team bypass for superadmin/developer
- Response viewer with status, timing, and headers

See [05 - API Tester](./05-api-tester.md) for complete documentation.

### Test Cases Viewer (`/devtools/tests`)

The flagship feature of the Dev Zone. Provides:
- File tree navigation for test documentation
- BDD Test Viewer for `.bdd.md` files with Gherkin syntax highlighting
- Markdown viewer for standard `.md` files
- URL synchronization for shareable links
- Bilingual support (EN/ES)

See [04 - Test Cases Feature](./04-test-cases.md) for complete documentation.

### Configuration Viewer (`/devtools/config`)

Displays the current application configuration:
- Entity configurations with accordion navigation
- Theme settings
- Plugin configurations
- Environment-specific values

### Style Gallery (`/devtools/style`)

Visual reference for design system elements:
- Component showcase
- Color palette
- Typography scale
- Icon library
- Spacing and sizing tokens

## Components Location

DevTools components are located in core:

```text
core/components/devtools/
├── DevtoolsSidebar.tsx
├── DevtoolsMobileHeader.tsx
├── FileTree.tsx
├── MarkdownViewer.tsx
├── ConfigViewer.tsx
├── TestCasesViewer.tsx
├── api-tester/
│   ├── index.ts
│   ├── types.ts
│   ├── ApiTester.tsx
│   ├── MethodSelector.tsx
│   ├── PathParamsEditor.tsx
│   ├── KeyValueEditor.tsx
│   ├── AuthSelector.tsx
│   ├── PayloadEditor.tsx
│   ├── ResponseViewer.tsx
│   ├── hooks/useApiRequest.ts
│   └── utils/url-builder.ts
└── bdd/
    ├── index.ts
    ├── types.ts
    ├── parser.ts
    ├── GherkinHighlighter.tsx
    ├── BDDHeader.tsx
    ├── BDDTestCard.tsx
    ├── BDDTableOfContents.tsx
    └── BDDTestViewer.tsx
```

## Recommended Uses

### For Development
- Browse and review test documentation before writing tests
- Verify test coverage for features
- Access Gherkin scenarios in English or Spanish
- Copy grep tags for running specific test suites

### For Debugging
- View current application configuration
- Inspect entity field definitions
- Check theme-specific settings
- Verify plugin registrations

### For Design
- Reference design system components
- Check color values and variants
- Verify spacing and typography
- Preview UI components

## Visual Branding

DevTools uses a purple/violet palette:

```css
/* Primary colors */
bg-violet-100, bg-violet-600
text-violet-600, text-violet-400 (dark mode)
bg-purple-50, bg-purple-600 (gradients)
border-violet-*, border-purple-*

/* Example button */
<Button className="bg-purple-600 hover:bg-purple-700">
```

## Why Developer-Only?

DevTools is restricted to developers because:

1. **Sensitive Information**: Configuration details could expose internal architecture
2. **Development Focus**: Tools are only relevant to developers
3. **Test Documentation**: Contains implementation details and edge cases
4. **Performance**: Dev tools may impact performance if broadly accessible

## Related Files

- Layout: `app/devtools/layout.tsx`
- Guard: `core/components/app/guards/DeveloperGuard.tsx`
- Sidebar: `core/components/devtools/DevtoolsSidebar.tsx`
- Test API: `app/api/devtools/tests/route.ts`
