---
description: "[Plugin] Create a new plugin with complete file structure"
---

# Create New Plugin

You are creating a new plugin for the NextSpark system.

**Plugin Requirements:**
{{{ input }}}

---

## Protocol

### Step 1: Parse Requirements

From the input above, extract:
- **Plugin name** (required) - will be converted to kebab-case slug
- **Display name** (optional - defaults to title-cased plugin name)
- **Description** (required)
- **Author** (optional - defaults to "Development Team")
- **Complexity** (optional - defaults to "service")

If complexity is not specified, ask:

```typescript
await AskUserQuestion({
  questions: [{
    header: "Complexity",
    question: "What is the complexity level of this plugin?",
    options: [
      { label: "Utility", description: "Functions only, no UI components" },
      { label: "Service (Recommended)", description: "API + components + hooks" },
      { label: "Full-featured", description: "Entities + migrations + API + UI" }
    ],
    multiSelect: false
  }]
})
```

### Step 2: Check Plugin Doesn't Exist

```bash
# Check if plugin already exists
ls -la contents/plugins/{plugin-slug}/ 2>/dev/null
```

If plugin exists, ask user what to do:
- Continue with existing plugin
- Choose a different name
- Abort

### Step 3: Launch plugin-creator Agent

Launch the `plugin-creator` agent with full context:

```
Create a new plugin with:

**Plugin Name:** {extracted name}
**Slug:** {kebab-case name}
**Display Name:** {extracted or generated}
**Description:** {from input}
**Author:** {from input or default}
**Complexity:** {utility | service | full}

**IMPORTANT:**
1. Execute: pnpm create:plugin {slug} --description "{description}" --author "{author}" --complexity {complexity}
2. Customize plugin.config.ts with appropriate lifecycle hooks
3. Define TypeScript types in lib/types.ts
4. Document environment variables in .env.example
5. Register plugin in plugin-sandbox theme
6. Run build-registry after creation
7. Verify plugin appears in PLUGIN_REGISTRY
```

### Step 4: Launch plugin-validator Agent

After plugin-creator completes, launch `plugin-validator` to verify:

```
Validate the newly created plugin: {slug}

Run all gate validations:
1. TypeScript compiles without errors
2. All config files exist and valid
3. Plugin registered in plugin-sandbox theme
4. Plugin appears in PLUGIN_REGISTRY
5. Build passes with plugin-sandbox theme
6. Environment variables documented
```

### Step 5: Report Results

After both agents complete:
- Confirm all files were created
- Verify build-registry was executed
- Check plugin appears in PLUGIN_REGISTRY
- Provide next steps for development

---

## Output Format

```markdown
## Plugin Created: {plugin-name}

**Location:** `contents/plugins/{slug}/`
**Complexity:** {complexity}
**Test Theme:** plugin-sandbox

### Files Created
- [x] plugin.config.ts - Plugin configuration and lifecycle hooks
- [x] lib/core.ts - Core plugin logic
- [x] lib/types.ts - TypeScript type definitions
- [x] api/example/route.ts - Example API endpoint
- [x] components/ExampleWidget.tsx - Example UI component
- [x] hooks/usePlugin.ts - Custom React hook
- [x] messages/en.json - English translations
- [x] messages/es.json - Spanish translations
- [x] .env.example - Environment variables documentation
- [x] README.md - Plugin documentation
- [x] tests/plugin.test.ts - Unit test scaffolding

### Plugin Configuration
- **Slug:** {slug}
- **Display Name:** {displayName}
- **Version:** 1.0.0
- **Enabled:** true
- **Dependencies:** []

### Environment Variables
```env
{PLUGIN_PREFIX}_API_KEY=your-api-key
{PLUGIN_PREFIX}_DEBUG=false
```

### Registry
- [x] `node core/scripts/build/registry.mjs` executed
- [x] Plugin appears in PLUGIN_REGISTRY
- [x] Plugin registered in plugin-sandbox theme

### Validation
- [x] TypeScript compiles without errors
- [x] Build passes with plugin-sandbox theme

### Next Steps
1. Copy `.env.example` variables to `.env` and configure
2. Implement core logic in `lib/core.ts`
3. Add API endpoints in `api/` directory
4. Build UI components in `components/`
5. Test with: `NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm dev`
6. Run tests: `pnpm test contents/plugins/{slug}`

### Testing Commands
```bash
# Start dev server with plugin-sandbox theme
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm dev

# Run plugin tests
pnpm test contents/plugins/{slug}

# Build to verify integration
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm build
```
```

---

## Complexity Reference

| Level | Creates | Use When |
|-------|---------|----------|
| `utility` | lib/, types | Simple helper functions |
| `service` | lib/, api/, components/, hooks/ | Most plugins - API integrations, UI widgets |
| `full` | lib/, api/, components/, hooks/, entities/, migrations/ | Complex plugins with database tables |

## Available in create:plugin Script

```bash
pnpm create:plugin <name> [options]

Options:
  --description, -d    Plugin description
  --author, -a         Plugin author
  --display-name       Display name (defaults to capitalized name)
  --complexity, -c     utility | service | full (default: service)
```

---

**Now create the plugin as specified above.**
