# Installation

This guide covers the complete setup process for integrating the LangChain plugin into your theme.

## Prerequisites

Before installing, ensure you have:

- PostgreSQL database (Supabase recommended)
- Node.js 18+ with pnpm
- At least one LLM provider configured (Ollama recommended for development)

## Step 1: Database Migration

The plugin requires a `langchain_sessions` table for conversation persistence.

### Run the Migration

```bash
# Navigate to the migrations folder
cd contents/plugins/langchain/migrations

# Apply the migration to your database
psql $DATABASE_URL -f 001_langchain_memory.sql
```

Or using your migration tool:

```bash
pnpm db:migrate
```

### Migration Contents

The migration creates:

```sql
-- Table for conversation storage
CREATE TABLE public."langchain_sessions" (
    id              TEXT PRIMARY KEY,
    "userId"        TEXT NOT NULL REFERENCES users(id),
    "teamId"        TEXT NOT NULL REFERENCES teams(id),
    "sessionId"     TEXT NOT NULL,
    name            TEXT DEFAULT NULL,
    "isPinned"      BOOLEAN DEFAULT false,
    messages        JSONB NOT NULL DEFAULT '[]',
    metadata        JSONB DEFAULT '{}',
    "maxMessages"   INTEGER DEFAULT 50,
    "expiresAt"     TIMESTAMPTZ DEFAULT NULL,
    "createdAt"     TIMESTAMPTZ DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ DEFAULT now(),
    UNIQUE ("userId", "teamId", "sessionId")
);

-- Performance indexes
CREATE INDEX idx_sessions_lookup ON langchain_sessions(...);
CREATE INDEX idx_sessions_pinned ON langchain_sessions(...);
CREATE INDEX idx_sessions_updated ON langchain_sessions(...);

-- Row-Level Security
ALTER TABLE langchain_sessions ENABLE ROW LEVEL SECURITY;
```

## Step 2: Environment Variables

Configure your LLM provider(s) in `.env`:

### Required Variables

```env
# Enable the plugin
LANGCHAIN_PLUGIN_ENABLED=true

# Optional: Enable debug console logging
LANGCHAIN_PLUGIN_DEBUG=false

# Enable file logging (core environment variable)
LOG_ENABLED=true  # Logs to logger/ai/
```

### Provider Configuration

#### Option A: Ollama (Recommended for Development)

Ollama runs locally and is free. Install from [ollama.com](https://ollama.com):

```bash
# Install Ollama (macOS)
brew install ollama

# Pull a model
ollama pull llama3.2:3b     # Fast, lightweight
ollama pull qwen2.5:7b      # Better quality
ollama pull mistral         # Good balance

# Start Ollama server
ollama serve
```

Configure in `.env`:

```env
LANGCHAIN_OLLAMA_BASE_URL=http://localhost:11434
LANGCHAIN_OLLAMA_MODEL=qwen2.5:7b
```

#### Option B: OpenAI

```env
OPENAI_API_KEY=sk-...
LANGCHAIN_OPENAI_MODEL=gpt-4o-mini
```

#### Option C: Anthropic

```env
ANTHROPIC_API_KEY=sk-ant-...
LANGCHAIN_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

#### Option D: LM Studio (OpenAI-Compatible)

LM Studio provides a local server with OpenAI API compatibility:

```env
# Point OpenAI provider to LM Studio
LANGCHAIN_OPENAI_BASE_URL=http://localhost:1234/v1
LANGCHAIN_OPENAI_MODEL=local-model
# API key not required for local
```

### Complete Example

```env
# Plugin settings
LANGCHAIN_PLUGIN_ENABLED=true
LANGCHAIN_PLUGIN_DEBUG=false

# File logging (core)
LOG_ENABLED=true  # Logs to logger/ai/

# Ollama (development)
LANGCHAIN_OLLAMA_BASE_URL=http://localhost:11434
LANGCHAIN_OLLAMA_MODEL=qwen2.5:7b

# OpenAI (production fallback)
OPENAI_API_KEY=sk-...
LANGCHAIN_OPENAI_MODEL=gpt-4o-mini

# Anthropic (optional)
ANTHROPIC_API_KEY=sk-ant-...
LANGCHAIN_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## Step 3: Theme Structure

Create the following structure in your theme:

```
contents/themes/your-theme/
├── lib/
│   └── langchain/
│       ├── langchain.config.ts    # Agent configuration
│       ├── orchestrator.ts        # (optional) Orchestration logic
│       ├── agents/
│       │   ├── index.ts           # Prompt loader
│       │   └── *.md               # System prompts
│       └── tools/
│           ├── index.ts           # Tool exports
│           └── *.ts               # Entity tools
└── api/
    └── ai/
        └── chat/
            └── route.ts           # Chat API endpoint
```

### Using Presets

The plugin provides presets as starting points:

```bash
# Copy configuration preset
cp contents/plugins/langchain/presets/lib/langchain.config.ts.preset \
   contents/themes/your-theme/lib/langchain/langchain.config.ts

# Copy API endpoint preset
mkdir -p contents/themes/your-theme/api/ai/chat
cp contents/plugins/langchain/presets/api/chat/route.ts.preset \
   contents/themes/your-theme/api/ai/chat/route.ts

# Copy tools preset
mkdir -p contents/themes/your-theme/lib/langchain/tools
cp contents/plugins/langchain/presets/lib/tools/entity-tools.ts.preset \
   contents/themes/your-theme/lib/langchain/tools/example.ts

# Copy prompt preset
mkdir -p contents/themes/your-theme/lib/langchain/agents
cp contents/plugins/langchain/presets/agents/entity-assistant.md.preset \
   contents/themes/your-theme/lib/langchain/agents/assistant.md
```

## Step 4: Basic Configuration

Create your agent configuration:

```typescript
// contents/themes/your-theme/lib/langchain/langchain.config.ts

import type {
    ThemeLangChainConfig,
    AgentDefinition,
    ToolContext,
} from '@/contents/plugins/langchain/types/langchain.types'
import { createAgentHelpers } from '@/contents/plugins/langchain/lib/agent-helpers'
import { createMyTools } from './tools/my-entity'

export const AGENTS: Record<string, AgentDefinition> = {
    'my-assistant': {
        provider: 'ollama',
        temperature: 0.3,
        description: 'Assistant for my entity',
        systemPrompt: 'my-assistant',  // loads agents/my-assistant.md
        createTools: (context: ToolContext) => createMyTools(context),
    },
}

export const langchainConfig: ThemeLangChainConfig = {
    defaultProvider: 'ollama',
    defaultTemperature: 0.3,
    agents: AGENTS,
}

// Export helpers
const helpers = createAgentHelpers(AGENTS, {
    provider: langchainConfig.defaultProvider,
    temperature: langchainConfig.defaultTemperature,
})

export const {
    getAgentConfig,
    getAgentModelConfig,
    getAgentTools,
    getAgentPromptName,
    hasAgent,
    getAgentNames,
} = helpers
```

## Step 5: Verify Installation

### Test Provider Connection

```typescript
import { isProviderAvailable, getAvailableProviders } from '@/contents/plugins/langchain/plugin.config'

// Check available providers
console.log('Available:', getAvailableProviders())
// ['ollama', 'openai'] (depends on env config)

// Check specific provider
console.log('Ollama:', isProviderAvailable('ollama'))
// true/false
```

### Test Agent Creation

```typescript
import { createAgent } from '@/contents/plugins/langchain/lib/agent-factory'

const agent = await createAgent({
    sessionId: 'test-session',
    systemPrompt: 'You are a helpful assistant. Respond with "Hello, I am working!"',
    tools: [],
    modelConfig: {
        provider: 'ollama',
        model: 'llama3.2:3b',
        temperature: 0.3,
    },
})

const response = await agent.chat('Test message')
console.log(response.content)
// Should receive a response from the LLM
```

### Test Memory Persistence

```typescript
import { memoryStore } from '@/contents/plugins/langchain/lib/memory-store'

const context = { userId: 'test-user', teamId: 'test-team' }

// Create session (sessionId is auto-generated)
const { sessionId } = await memoryStore.createSession(context, 'Test Chat')
console.log('Created session:', sessionId)

// List sessions
const sessions = await memoryStore.listSessions(context)
console.log('Sessions:', sessions.length)

// Clean up
await memoryStore.clearSession(sessionId, context)
```

## Troubleshooting

### Ollama Connection Failed

```
Error: Failed to connect to Ollama at http://localhost:11434
```

**Solution:**

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Verify model is pulled
ollama list
```

### OpenAI API Key Invalid

```
Error: Invalid API Key
```

**Solution:**
- Verify `OPENAI_API_KEY` is set correctly
- Check the key starts with `sk-`
- Ensure the key has API access (not just ChatGPT access)

### Database Connection Error

```
Error: relation "langchain_sessions" does not exist
```

**Solution:**

```bash
# Run the migration
psql $DATABASE_URL -f contents/plugins/langchain/migrations/001_langchain_memory.sql
```

### Provider Not Available

```
Error: Provider 'openai' is not available. Configure OPENAI_API_KEY
```

**Solution:**
- Set the required environment variables
- Restart the development server
- Use `getAvailableProviders()` to check what's configured

## Next Steps

Now that the plugin is installed:

1. [Configure your agents](./03-configuration.md)
2. [Create custom tools](../02-core-concepts/03-tools.md)
3. [Set up graph orchestration](../03-orchestration/01-graph-orchestrator.md) (recommended)
4. [Configure observability](../04-advanced/01-observability.md)
