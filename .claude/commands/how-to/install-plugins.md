# /how-to:install-plugins

Interactive guide to install and configure plugins in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/plugins/SKILL.md` - Plugin system architecture

---

## Syntax

```
/how-to:install-plugins
/how-to:install-plugins [plugin-name]
```

---

## Behavior

Guides the user through installing plugins from NPM or local sources, configuring environment variables, and enabling them in their theme.

---

## Tutorial Structure

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding Plugin Installation
        └── NPM distribution model

Step 2: Install the Plugin Package
        └── NPM or workspace installation

Step 3: Configure Environment Variables
        └── Set up required credentials

Step 4: Enable and Use the Plugin
        └── Integrate into your theme
```

---

## Step 1: Understanding Plugin Installation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: INSTALL PLUGINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding Plugin Installation

NextSpark uses **Model B Distribution**:

┌─────────────────────────────────────────────┐
│  PLUGIN DISTRIBUTION MODEL                  │
│  ─────────────────────────────────────────  │
│                                             │
│  NPM Package → CLI copies to project        │
│                                             │
│  @nextsparkjs/plugin-ai                     │
│       │                                     │
│       ↓  (nextspark install)                │
│                                             │
│  plugins/plugin-ai/                │
│                                             │
└─────────────────────────────────────────────┘

Key Point: Plugins are COPIED to your project,
NOT kept in node_modules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Available Official Plugins:

• @nextsparkjs/plugin-ai - AI assistant integration
• @nextsparkjs/plugin-analytics - Usage analytics
• @nextsparkjs/plugin-email - Email sending (Resend)
• @nextsparkjs/plugin-storage - File storage (S3)
• @nextsparkjs/plugin-payments - Additional payment providers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What plugin would you like to install?
```

---

## Step 2: Install the Plugin Package

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Install the Plugin Package
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Method 1: Using NextSpark CLI (Recommended)

```bash
# Install a plugin
pnpm exec nextspark install plugin-ai

# Install multiple plugins
pnpm exec nextspark install plugin-ai plugin-analytics
```

This will:
1. Download the plugin from NPM
2. Copy to plugins/
3. Add dependencies to your package.json
4. Create .env.example entries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Method 2: Manual Installation

```bash
# 1. Install the NPM package temporarily
pnpm add @nextsparkjs/plugin-ai --save-dev

# 2. Copy to plugins directory
cp -r node_modules/@nextsparkjs/plugin-ai plugins/plugin-ai

# 3. Remove from node_modules (optional)
pnpm remove @nextsparkjs/plugin-ai

# 4. Install plugin dependencies
pnpm install
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 After Installation, Your Structure:

```
plugins/
├── plugin-ai/           ← Installed plugin
│   ├── package.json
│   ├── plugin.config.ts
│   ├── .env.example
│   └── ...
└── plugin-analytics/    ← Another plugin
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Configure)
[2] Show me what's in the plugin package
[3] I have installation errors
```

---

## Step 3: Configure Environment Variables

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Configure Environment Variables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each plugin has an .env.example file with required variables:

```bash
# Check what variables are needed
cat plugins/plugin-ai/.env.example
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Example: plugin-ai Environment Variables

```env
# plugins/plugin-ai/.env.example

# ============================================
# AI PLUGIN ENVIRONMENT VARIABLES
# ============================================

# Required: AI Provider API Key
AI_PLUGIN_API_KEY=your-anthropic-api-key

# Optional: Default model
AI_PLUGIN_DEFAULT_MODEL=claude-3-5-sonnet

# Optional: Enable debug logging
AI_PLUGIN_DEBUG=false
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Add Variables to Your .env:

```bash
# Copy to root .env file
cat plugins/plugin-ai/.env.example >> .env

# Edit .env with your actual values
code .env
```

```env
# .env
# ... your existing variables ...

# AI Plugin
AI_PLUGIN_API_KEY=sk-ant-xxxx
AI_PLUGIN_DEFAULT_MODEL=claude-3-5-sonnet
AI_PLUGIN_DEBUG=false
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT: Variable Namespacing

Plugins use namespaced variables (e.g., AI_PLUGIN_*)
This prevents conflicts with root variables.

Global variables (DATABASE_URL, etc.) stay in root .env ONLY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Enable Plugin)
[2] What variables does this plugin need?
[3] I need help getting API keys
```

---

## Step 4: Enable and Use the Plugin

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Enable and Use the Plugin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Rebuild the Plugin Registry:

```bash
node core/scripts/build/registry.mjs
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2️⃣  Use Plugin Components in Your Theme:

```typescript
// app/dashboard/page.tsx
import { AIAssistant } from '@/plugins/plugin-ai/components'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <AIAssistant />
    </div>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣  Use Plugin Hooks:

```typescript
'use client'

import { useAI } from '@/plugins/plugin-ai/hooks'

export function MyComponent() {
  const { chat, isLoading } = useAI()

  const handleAsk = async () => {
    const response = await chat('What is NextSpark?')
    console.log(response)
  }

  return (
    <button onClick={handleAsk} disabled={isLoading}>
      Ask AI
    </button>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4️⃣  Verify Plugin is Working:

```bash
# Start dev server
pnpm dev

# Check plugin is loaded (in browser console)
# Look for: [AI Plugin] Loaded
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Plugin Registry Entry:

After rebuild, the plugin appears in the registry:

```typescript
// .nextspark/registries/plugin-registry.ts (auto-generated)
export const PLUGIN_REGISTRY = {
  'plugin-ai': {
    name: 'plugin-ai',
    displayName: 'AI Assistant',
    version: '1.0.0',
    enabled: true,
    hasComponents: true,
    hasAPI: true,
  },
  // ...
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• How plugin distribution works
• Installing plugins via CLI or manually
• Configuring environment variables
• Using plugin components and hooks

📚 Related tutorials:
   • /how-to:create-plugin - Create your own plugin
   • /how-to:customize-app - App customization

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:create-plugin` | Create new plugins |
