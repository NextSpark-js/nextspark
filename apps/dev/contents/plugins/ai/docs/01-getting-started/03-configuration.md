# Configuration

## Configuration File Structure

The AI plugin uses a dedicated environment file for all configuration:

```
contents/plugins/ai/
├── .env                  # Your configuration (never commit)
├── .env.example          # Template (commit this)
└── lib/
    ├── plugin-env.ts     # Client-side config
    └── server-env.ts     # Server-side config
```

## Environment Variables

### Plugin Activation

```bash
# Enable/disable the entire plugin
AI_PLUGIN_ENABLED=true
```

**Values:**
- `true` - Plugin active, endpoints available
- `false` - Plugin disabled, endpoints return 503

**Use Case:** Disable plugin temporarily without removing from theme config

### Provider API Keys

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Anthropic Configuration  
ANTHROPIC_API_KEY=sk-ant-...

# Ollama Configuration (optional)
OLLAMA_BASE_URL=http://localhost:11434
```

**Notes:**
- You can configure multiple providers simultaneously
- The plugin will use the appropriate provider based on model selection
- API keys are **required** for their respective providers
- Ollama works without API keys (local inference)

### Default Model Settings

```bash
# Default model for generate endpoint
DEFAULT_MODEL=llama3.2:3b

# Maximum output tokens (affects cost and response length)
MAX_TOKENS=2000

# Temperature for response creativity (0 = deterministic, 1 = creative)
DEFAULT_TEMPERATURE=0.7

# Default Ollama model (used when no model specified for Ollama)
OLLAMA_DEFAULT_MODEL=llama3.2:3b
```

## Provider-Specific Configuration

### OpenAI

**Required:**
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

**Available Models:**
- `gpt-4o` - Most capable, multimodal ($0.0025 input / $0.01 output per 1K tokens)
- `gpt-4o-mini` - Fast and affordable ($0.00015 input / $0.0006 output per 1K tokens)
- `gpt-3.5-turbo` - Legacy, fast ($0.0005 input / $0.0015 output per 1K tokens)

**Best Practices:**
```bash
# Use gpt-4o-mini for development
DEFAULT_MODEL=gpt-4o-mini

# Reserve gpt-4o for production critical features
# Specify in request: { "model": "gpt-4o", "prompt": "..." }
```

**Rate Limits:**
- Tier 1 (New users): 200 requests/day, 40,000 tokens/minute
- Tier 2-5: Higher limits based on usage
- Monitor at: https://platform.openai.com/account/limits

**Cost Management:**
```bash
# Set conservative token limits
MAX_TOKENS=1000  # Reduces cost per request

# Use lower temperature for deterministic tasks
DEFAULT_TEMPERATURE=0.3  # More focused responses
```

### Anthropic

**Required:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Available Models:**
- `claude-3-5-sonnet-20241022` - Highest quality ($0.003 input / $0.015 output per 1K tokens)
- `claude-3-5-haiku-20241022` - Fast and affordable ($0.00025 input / $0.00125 output per 1K tokens)
- `claude-sonnet-4-5-20250929` - Current latest (same pricing as 3.5 Sonnet)

**Best Practices:**
```bash
# Use Haiku for most tasks (fast, cheap)
DEFAULT_MODEL=claude-3-5-haiku-20241022

# Use Sonnet for complex reasoning
# Specify in request: { "model": "claude-3-5-sonnet-20241022", "prompt": "..." }
```

**Context Windows:**
- Haiku: 200,000 tokens
- Sonnet: 200,000 tokens
- Both support large documents and conversations

**Rate Limits:**
- Tier 1: 50 requests/minute, 40,000 tokens/minute
- Tier 4: 2,000 requests/minute, 400,000 tokens/minute
- Monitor at: https://console.anthropic.com/settings/limits

### Ollama (Local)

**Optional:**
```bash
OLLAMA_BASE_URL=http://localhost:11434
```

**Available Models** (install via `ollama pull`):
- `llama3.2:3b` - Fast, 3B parameters, good for testing
- `llama3.2` - 11B parameters, better quality
- `llama3.1` - Previous version, still excellent
- `qwen2.5` - Chinese company, multilingual
- `mistral` - European model, strong performance
- `gemma2` - Google model
- `codellama` - Specialized for code

**Best Practices:**
```bash
# Use smallest model for development
OLLAMA_DEFAULT_MODEL=llama3.2:3b

# Pull multiple models for different tasks
ollama pull llama3.2:3b      # Fast, development
ollama pull llama3.2          # Better quality
ollama pull codellama         # Code generation
```

**Hardware Requirements:**
- 3B models: 4GB RAM minimum
- 11B models: 8GB RAM minimum
- 70B+ models: 64GB RAM + GPU recommended

**Performance:**
- Local inference: No API latency
- GPU acceleration: Significant speedup
- CPU only: Usable for development

**No Cost:**
- All inference is free
- Only costs are hardware/electricity

## Configuration Access in Code

### Server-Side Configuration

```typescript
import { getServerPluginConfig } from '@/contents/plugins/ai/lib/server-env'

export async function POST(request: Request) {
  const config = await getServerPluginConfig()
  
  console.log(config.defaultModel)        // "llama3.2:3b"
  console.log(config.maxTokens)           // 2000
  console.log(config.defaultTemperature)  // 0.7
  console.log(config.openaiApiKey)        // "sk-proj-..."
  console.log(config.anthropicApiKey)     // "sk-ant-..."
  console.log(config.ollamaBaseUrl)       // "http://localhost:11434"
}
```

### Client-Side Configuration

```typescript
import { getPluginConfig } from '@/contents/plugins/ai/lib/plugin-env'

export function MyComponent() {
  const config = getPluginConfig()
  
  // Only non-sensitive config available
  console.log(config.enabled)             // true
  console.log(config.defaultModel)        // "llama3.2:3b"
  
  // API keys NOT available client-side (security)
}
```

## Security Best Practices

### 1. Environment File Security

```bash
# ✅ ALWAYS in .gitignore
contents/plugins/ai/.env

# ❌ NEVER commit .env files
# ❌ NEVER share API keys in code
# ❌ NEVER log API keys
```

### 2. API Key Management

**Separate Keys by Environment:**
```bash
# Development (.env.local)
OPENAI_API_KEY=sk-proj-dev-key-here

# Production (.env.production)
OPENAI_API_KEY=sk-proj-prod-key-here
```

**Use Different Keys for:**
- Development (rate limited)
- Staging (separate billing)
- Production (monitored closely)

### 3. Rate Limiting

**Application Level:**
```typescript
// Implement rate limiting in your endpoints
import { rateLimit } from '@/core/lib/api/rate-limit'

export async function POST(request: Request) {
  // Limit to 10 requests per minute per user
  await rateLimit(request, { max: 10, windowMs: 60000 })
  
  // Continue with AI request
}
```

**Provider Level:**
- Set usage limits in provider dashboards
- Monitor usage regularly
- Set up billing alerts

### 4. Key Rotation

**Best Practice:**
```bash
# Rotate keys every 90 days
# 1. Create new key in provider dashboard
# 2. Update .env with new key
# 3. Test thoroughly
# 4. Revoke old key after 24-48 hours
```

**Emergency Rotation:**
```bash
# If key compromised:
# 1. Immediately revoke in provider dashboard
# 2. Create new key
# 3. Update production environment
# 4. Review usage logs for abuse
```

### 5. Monitoring and Alerts

**Set Up Alerts:**
- Unusual spending patterns
- Rate limit warnings
- Failed authentication attempts
- High error rates

**OpenAI Monitoring:**
- Dashboard: https://platform.openai.com/usage
- Set monthly spending limits
- Enable email notifications

**Anthropic Monitoring:**
- Console: https://console.anthropic.com/settings/usage
- Track credit usage
- Set budget alerts

## Configuration Examples

### Development Configuration

```bash
# contents/plugins/ai/.env (development)

# Use local Ollama for free development
AI_PLUGIN_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=llama3.2:3b
MAX_TOKENS=1000
DEFAULT_TEMPERATURE=0.7

# Optional: Add OpenAI for testing production features
# OPENAI_API_KEY=sk-proj-dev-key
```

### Production Configuration

```bash
# Production environment variables

# Use cloud providers for reliability
AI_PLUGIN_ENABLED=true

# Primary: Anthropic (good cost/performance)
ANTHROPIC_API_KEY=sk-ant-prod-key-here
DEFAULT_MODEL=claude-3-5-haiku-20241022

# Fallback: OpenAI
OPENAI_API_KEY=sk-proj-prod-key-here

# Conservative token limits
MAX_TOKENS=2000
DEFAULT_TEMPERATURE=0.7
```

### Multi-Provider Configuration

```bash
# All providers enabled

AI_PLUGIN_ENABLED=true

# Cloud providers
OPENAI_API_KEY=sk-proj-key-here
ANTHROPIC_API_KEY=sk-ant-key-here

# Local provider for development
OLLAMA_BASE_URL=http://localhost:11434

# Default to local for development
DEFAULT_MODEL=llama3.2:3b

# Override in production:
# DEFAULT_MODEL=claude-3-5-haiku-20241022
```

## Validation

The plugin validates configuration on startup:

```typescript
import { validateServerPluginEnvironment } from '@/contents/plugins/ai/lib/server-env'

const validation = await validateServerPluginEnvironment()

if (!validation.valid) {
  console.error('Plugin configuration errors:', validation.errors)
  // Example errors:
  // - "AI_PLUGIN_ENABLED must be 'true' or 'false'"
  // - "No AI provider configured (need OPENAI_API_KEY, ANTHROPIC_API_KEY, or Ollama)"
}
```

## Troubleshooting Configuration

### Issue: "Plugin disabled"

**Check:**
```bash
grep AI_PLUGIN_ENABLED contents/plugins/ai/.env
# Should output: AI_PLUGIN_ENABLED=true
```

### Issue: "No provider configured"

**Check:**
```bash
# At least one should be set
grep -E "(OPENAI|ANTHROPIC)_API_KEY" contents/plugins/ai/.env

# Or Ollama should be running
curl http://localhost:11434/api/tags
```

### Issue: "Invalid API key format"

**OpenAI keys** start with `sk-proj-` (new) or `sk-` (legacy)  
**Anthropic keys** start with `sk-ant-`

**Fix:**
```bash
# Copy key exactly as shown in provider dashboard
# No extra spaces or quotes
OPENAI_API_KEY=sk-proj-actual-key-here
```

## Next Steps

✅ Configuration file created  
✅ Provider(s) configured  
✅ Security best practices implemented  
✅ Validation passing

**Continue to:**
- **[Text Generation](../02-features/01-text-generation.md)** - Use the generate endpoint
- **[Embeddings](../02-features/02-embeddings.md)** - Generate semantic embeddings
- **[Core Utilities](../04-advanced-usage/01-core-utilities.md)** - Build custom endpoints
