# Installation and Setup

## Prerequisites

- Node.js 18+ and pnpm installed
- NextSpark project set up
- Active theme with plugin support

## Step 1: Enable the Plugin

### In Theme Configuration

The AI plugin is enabled by default in the default theme. To enable it in your custom theme:

```typescript
// contents/themes/[your-theme]/theme.config.ts
export const yourThemeConfig: ThemeConfig = {
  name: 'your-theme',
  // ... other config
  plugins: ['ai'],  // Add 'ai' to plugins array
}
```

### Verify Plugin is Active

```bash
# Check loaded plugins in development
pnpm dev

# Look for plugin load message in console:
# [AI Plugin] Core utilities loaded - ready for custom endpoints
```

## Step 2: Choose Your Provider

You can use one or multiple providers simultaneously. Choose based on your needs:

### Option A: Ollama (Local, Free)

**Best for:**
- Development and testing
- Privacy-sensitive applications
- Cost-free inference
- No API key management

**Setup:**

1. **Install Ollama** (if not already installed)
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.com/install.sh | sh
   
   # Windows
   # Download from https://ollama.com/download
   ```

2. **Start Ollama Server**
   ```bash
   ollama serve
   ```

3. **Pull a Model** (e.g., Llama 3.2 3B)
   ```bash
   ollama pull llama3.2:3b
   ```

4. **Configure Base URL** (optional, defaults to `http://localhost:11434`)
   ```bash
   # contents/plugins/ai/.env
   OLLAMA_BASE_URL=http://localhost:11434
   ```

5. **Test**
   ```bash
   curl http://localhost:11434/api/tags
   # Should return list of installed models
   ```

### Option B: OpenAI (Cloud, Paid)

**Best for:**
- Production deployments
- Highest quality responses
- Proven reliability

**Setup:**

1. **Get API Key**
   - Visit https://platform.openai.com/api-keys
   - Create new API key
   - Copy the key (starts with `sk-`)

2. **Create Plugin Environment File**
   ```bash
   # Create .env file in plugin directory
   touch contents/plugins/ai/.env
   ```

3. **Add API Key**
   ```bash
   # contents/plugins/ai/.env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   AI_PLUGIN_ENABLED=true
   ```

4. **Set Default Model** (optional)
   ```bash
   # contents/plugins/ai/.env
   DEFAULT_MODEL=gpt-4o-mini
   MAX_TOKENS=2000
   DEFAULT_TEMPERATURE=0.7
   ```

5. **Test API Key**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-your-key-here"
   ```

### Option C: Anthropic (Cloud, Paid)

**Best for:**
- Complex reasoning tasks
- Long context windows (200K+ tokens)
- Advanced analysis

**Setup:**

1. **Get API Key**
   - Visit https://console.anthropic.com/
   - Create new API key
   - Copy the key (starts with `sk-ant-`)

2. **Add API Key to Plugin Environment**
   ```bash
   # contents/plugins/ai/.env
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
   AI_PLUGIN_ENABLED=true
   ```

3. **Set Default Model** (optional)
   ```bash
   # contents/plugins/ai/.env
   DEFAULT_MODEL=claude-3-5-haiku-20241022
   ```

4. **Test API Key**
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: sk-ant-your-key-here" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-5-haiku-20241022","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
   ```

## Step 3: Configure Plugin

### Environment Variables Reference

Create `contents/plugins/ai/.env` with your configuration:

```bash
# ==========================================
# PLUGIN ACTIVATION
# ==========================================
AI_PLUGIN_ENABLED=true

# ==========================================
# PROVIDER API KEYS (add one or more)
# ==========================================

# OpenAI (optional)
OPENAI_API_KEY=sk-your-openai-key

# Anthropic (optional)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Ollama (optional, defaults to localhost)
OLLAMA_BASE_URL=http://localhost:11434

# ==========================================
# DEFAULT SETTINGS (optional)
# ==========================================

# Default model for generate endpoint
# Options: llama3.2:3b, gpt-4o-mini, claude-3-5-haiku-20241022
DEFAULT_MODEL=llama3.2:3b

# Default maximum output tokens
MAX_TOKENS=2000

# Default temperature (0-1, creativity)
DEFAULT_TEMPERATURE=0.7

# Ollama default model (if using Ollama)
OLLAMA_DEFAULT_MODEL=llama3.2:3b
```

### Security Best Practices

1. **Never Commit API Keys**
   ```bash
   # Verify .env is in .gitignore
   grep "\.env" .gitignore
   
   # Add if missing
   echo "*.env" >> .gitignore
   ```

2. **Use Different Keys for Environments**
   - Development: Use Ollama or low-cost models
   - Staging: Use separate API keys with rate limits
   - Production: Use production keys with monitoring

3. **Restrict API Key Permissions**
   - OpenAI: Limit permissions in dashboard
   - Anthropic: Set usage limits
   - Monitor usage regularly

4. **Rotate Keys Regularly**
   - Set reminders to rotate keys every 90 days
   - Have backup keys ready for emergencies

## Step 4: Rebuild Registry

After enabling the plugin, rebuild the registries:

```bash
# Rebuild all registries (includes plugins)
pnpm registry:build

# Or rebuild individual registries
pnpm registry:build:plugins
pnpm registry:build:docs
```

**Expected Output:**
```
✓ Plugin registry built successfully
✓ AI plugin loaded
✓ Docs registry built (includes plugin docs)
```

## Step 5: Verify Installation

### Check Plugin Status

Visit the generate endpoint info page:

```bash
# Start development server
pnpm dev

# Open browser or use curl
curl http://localhost:5173/api/plugin/ai/generate

# Should return endpoint documentation with:
# - Available models
# - Setup instructions
# - Usage examples
```

### Test Generate Endpoint

**Simple Test:**
```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Say hello",
    "model": "llama3.2:3b"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "response": "Hello! How can I assist you today?",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "isLocal": true,
  "cost": 0,
  "tokens": {
    "input": 5,
    "output": 12,
    "total": 17
  },
  "userId": "user-id-here"
}
```

### Test Embeddings Endpoint (OpenAI Only)

```bash
curl -X POST http://localhost:5173/api/plugin/ai/embeddings \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "text": "Hello world"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "embedding": [0.123, -0.456, ...],  // 1536 numbers
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "tokens": 2,
  "userId": "user-id-here"
}
```

## Step 6: Database Setup (Optional)

The AI History entity requires database tables. These are created automatically via migrations when the plugin is loaded.

### Verify Tables Created

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('ai_history', 'ai_history_metas');
```

### Manual Migration (if needed)

```bash
# Run migrations manually
pnpm db:migrate

# Or apply specific migration
psql $DATABASE_URL -f contents/plugins/ai/entities/ai-history/migrations/001_ai_history_table.sql
psql $DATABASE_URL -f contents/plugins/ai/entities/ai-history/migrations/002_ai_history_metas.sql
```

## Troubleshooting

### Plugin Not Loading

**Issue:** "AI plugin disabled" error

**Solution:**
```bash
# Check AI_PLUGIN_ENABLED in .env
cat contents/plugins/ai/.env | grep AI_PLUGIN_ENABLED

# Should be: AI_PLUGIN_ENABLED=true

# Rebuild registry
pnpm registry:build:plugins
```

### Ollama Connection Failed

**Issue:** "ECONNREFUSED" error

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Check base URL in .env
cat contents/plugins/ai/.env | grep OLLAMA_BASE_URL
```

### OpenAI Authentication Failed

**Issue:** "OpenAI authentication failed"

**Solution:**
```bash
# Verify API key format (should start with sk-)
cat contents/plugins/ai/.env | grep OPENAI_API_KEY

# Test key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR-KEY-HERE"

# Check for rate limits or invalid key in OpenAI dashboard
```

### Anthropic Authentication Failed

**Issue:** "Anthropic authentication failed"

**Solution:**
```bash
# Verify API key format (should start with sk-ant-)
cat contents/plugins/ai/.env | grep ANTHROPIC_API_KEY

# Test key directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR-KEY-HERE" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Database Tables Not Created

**Issue:** "Table 'ai_history' doesn't exist"

**Solution:**
```bash
# Run migrations manually
pnpm db:migrate

# Or check migration files exist
ls contents/plugins/ai/entities/ai-history/migrations/
```

### Authentication Required Error

**Issue:** "Authentication required" when testing endpoints

**Solution:**
- Endpoints require authentication (session or API key)
- Test from authenticated dashboard pages
- Or use API key in Authorization header:
  ```bash
  curl -X POST http://localhost:5173/api/plugin/ai/generate \
    -H "Authorization: Bearer your-api-key-here" \
    -d '{"prompt": "test"}'
  ```

## Next Steps

✅ Plugin installed and configured  
✅ Provider(s) set up and tested  
✅ Database tables created  
✅ Endpoints verified

**Continue to:**
- **[Configuration](./03-configuration.md)** - Detailed configuration options
- **[Text Generation](../02-features/01-text-generation.md)** - Start using AI
- **[Core Utilities](../04-advanced-usage/01-core-utilities.md)** - Build custom features