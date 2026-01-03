# AI Plugin Introduction

## Overview

The **AI Plugin** is a versatile, multi-provider AI utility system that brings powerful artificial intelligence capabilities to your SaaS application. Unlike monolithic AI solutions, this plugin provides **core utilities and example implementations** that you can extend and customize for your specific needs.

**Philosophy:**
- **Utility-First** - Provides reusable functions, not rigid solutions
- **Provider-Agnostic** - Supports OpenAI, Anthropic, and Ollama (local)
- **Extensible** - Build custom endpoints using provided utilities
- **Production-Ready** - Includes history tracking, cost calculation, and error handling

## Multi-Provider Support

### Supported Providers

**OpenAI**
- Models: GPT-4o, GPT-4o Mini, GPT-3.5 Turbo
- Best for: Production deployments, highest quality responses
- Cost: Pay per token (~$0.00015-0.0025 per 1K input tokens)

**Anthropic**
- Models: Claude 3.5 Sonnet, Claude 3.5 Haiku
- Best for: Complex reasoning, long context windows
- Cost: Pay per token (~$0.00025-0.003 per 1K input tokens)

**Ollama (Local)**
- Models: Llama 3.2, Llama 3.1, Qwen 2.5, Mistral, Gemma 2
- Best for: Development, privacy-sensitive applications, cost-free inference
- Cost: Free (runs on your hardware)

## Key Use Cases

### 1. Content Generation

Generate high-quality content for various purposes:
- **Marketing Copy** - Product descriptions, ad copy, landing pages
- **Blog Posts** - Articles, tutorials, documentation
- **Email Campaigns** - Personalized emails, newsletters
- **Social Media** - Posts, captions, engagement content

**Already in use for:** Content creation workflows, automated copywriting

### 2. AI-Powered Auditing

Analyze and audit content using AI:
- **Content Analysis** - Quality checks, tone analysis, compliance
- **Data Validation** - Structured data extraction and verification
- **Report Generation** - Automated insights and summaries
- **Quality Assurance** - Consistency checks across content

**Already in use for:** Content auditing workflows, quality control

### 3. Semantic Search with Embeddings

Enable meaning-based search and recommendations:
- **Semantic Search** - Find content by meaning, not just keywords
- **Content Recommendations** - Similar content suggestions
- **Similarity Matching** - Duplicate detection, content clustering
- **RAG (Retrieval Augmented Generation)** - Context-aware AI responses

**Already in use for:** Embedding generation for search systems

### 4. Custom AI Workflows

Build specialized AI features:
- **Classification** - Categorize content, sentiment analysis
- **Summarization** - Extract key points from long text
- **Translation** - Multi-language support
- **Custom Analysis** - Domain-specific AI operations

## Architecture

### Core Components

```
contents/plugins/ai/
├── lib/
│   ├── core-utils.ts           # Core utility functions
│   ├── ai-history-service.ts   # History tracking
│   └── server-env.ts            # Configuration
│
├── api/
│   ├── generate/               # Text generation endpoint
│   ├── embeddings/             # Embeddings endpoint
│   └── ai-history/             # History management
│
├── entities/
│   └── ai-history/             # AI History entity
│
├── types/
│   └── ai.types.ts             # TypeScript types
│
└── plugin.config.ts            # Plugin configuration
```

### Core Utilities (`core-utils.ts`)

**Primary Functions:**
- `selectModel()` - Automatically select and configure AI models
- `calculateCost()` - Track token usage and costs
- `validatePlugin()` - Ensure plugin is properly configured
- `extractTokens()` - Extract token usage from AI responses
- `handleAIError()` - Consistent error handling across providers
- `COST_CONFIG` - Up-to-date pricing for all models

### Example Endpoints

**`/api/plugin/ai/generate`**
- General-purpose text generation
- Supports all providers and models
- Includes cost tracking and history
- Flexible system prompts and parameters

**`/api/plugin/ai/embeddings`**
- Generate semantic embeddings
- Uses OpenAI text-embedding-3-small (1536 dimensions)
- Optimized for search and recommendations

### History Tracking System

**AI History Entity** tracks every AI operation:
- **Audit Trail** - Complete record of all AI interactions
- **Cost Tracking** - Token usage and estimated costs
- **Performance Monitoring** - Response times and success rates
- **Entity Linking** - Connect AI operations to application entities
- **Metadata Support** - Store custom operation data

### Vercel AI SDK Integration

Built on the [Vercel AI SDK](https://sdk.vercel.ai/):
- **Unified API** - Consistent interface across providers
- **Streaming Support** - Real-time response streaming
- **Type Safety** - Full TypeScript support
- **Error Handling** - Robust error management

## Versatility and Extensibility

### Why This Plugin is Different

**Not a Chatbot Plugin:**
- Doesn't force you into a specific UI or chat interface
- Provides building blocks, not finished products
- You decide how to use AI in your application

**Utility-Based Design:**
- Import core functions into your own endpoints
- Build custom workflows using provided utilities
- Extend with your own logic and business rules

### Building Custom Endpoints

```typescript
// Your custom endpoint using plugin utilities
import { selectModel, calculateCost, extractTokens } from '@/contents/plugins/ai/lib/core-utils'
import { generateText } from 'ai'

export async function POST(request: Request) {
  // Your custom logic here
  const { prompt, model } = await request.json()
  
  // Use plugin utilities
  const selectedModel = await selectModel(model)
  const result = await generateText({
    model: selectedModel.model,
    prompt: `Custom system prompt\n\n${prompt}`
  })
  
  const tokens = extractTokens(result)
  const cost = calculateCost(tokens, selectedModel.costConfig)
  
  return Response.json({
    response: result.text,
    cost,
    tokens
  })
}
```

## Real-World Applications

### Content Generation Platform

**Use Case:** Automated marketing content creation
**Implementation:** Custom endpoint using `generate` with specialized prompts
**Result:** 10x faster content production with consistent quality

### AI-Powered CMS

**Use Case:** Content auditing and quality control
**Implementation:** Analysis workflows using custom prompts and history tracking
**Result:** Automated quality checks across thousands of content pieces

### Semantic Product Search

**Use Case:** E-commerce search by description
**Implementation:** Embeddings generation + vector database integration
**Result:** Customers find products by describing what they want

## Getting Started

### Quick Setup

1. **Enable Plugin** - Activate in theme configuration
2. **Configure Provider** - Set up API keys or Ollama
3. **Test Endpoint** - Try the generate endpoint
4. **Build Custom Features** - Use utilities for your use cases

### Next Steps

- **[Installation](./02-installation.md)** - Set up the plugin
- **[Configuration](./03-configuration.md)** - Configure providers and settings
- **[Text Generation](../02-features/01-text-generation.md)** - Start generating content
- **[Core Utilities](../04-advanced-usage/01-core-utilities.md)** - Build custom endpoints

## Key Features Summary

✅ **Multi-Provider Support** - OpenAI, Anthropic, Ollama  
✅ **Text Generation** - Flexible content creation  
✅ **Embeddings** - Semantic search capabilities  
✅ **History Tracking** - Complete audit trail  
✅ **Cost Calculation** - Automatic usage tracking  
✅ **Error Handling** - Robust error management  
✅ **TypeScript** - Full type safety  
✅ **Extensible** - Build custom endpoints  
✅ **Production-Ready** - Used in real applications

## Philosophy

This plugin is designed for developers who want:
- **Control** - Build exactly what you need
- **Flexibility** - Choose your provider and model
- **Simplicity** - Clean utilities without bloat
- **Performance** - Efficient, well-tested code
- **Maintainability** - Clear patterns and documentation

It's not a black box. It's a toolkit.