# Content Generation Use Case

## Overview

One of the most common and proven use cases for the AI plugin is **automated content generation**. This use case is already in production, generating marketing copy, product descriptions, blog posts, and more.

## Real-World Application

**Status:** ✅ In Production  
**Use:** Content creation workflows, automated copywriting  
**Models:** GPT-4o Mini, Claude Haiku, Llama 3.2  
**Results:** 10x faster content production with consistent quality

## Common Content Types

### 1. Product Descriptions

**Use Case:** E-commerce, catalogs, marketplaces

**Example Implementation:**

```typescript
// app/api/content/product-description/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { selectModel, calculateCost, extractTokens } from '@/contents/plugins/ai/lib/core-utils'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productName, features, targetAudience = 'general consumers' } = await request.json()

  const selection = await selectModel('gpt-4o-mini')

  const result = await generateText({
    model: selection.model,
    system: `You are an expert e-commerce copywriter. Write compelling, SEO-friendly product descriptions that convert.`,
    prompt: `
Product: ${productName}
Features: ${features.join(', ')}
Target Audience: ${targetAudience}

Write a compelling product description (100-150 words) that:
- Highlights key benefits
- Uses persuasive language
- Includes relevant keywords
- Ends with a call-to-action
    `.trim(),
    maxOutputTokens: 300,
    temperature: 0.7
  })

  const tokens = extractTokens(result)
  const cost = calculateCost(tokens, selection.costConfig)

  return NextResponse.json({
    description: result.text,
    wordCount: result.text.split(' ').length,
    cost,
    tokens
  })
}
```

**Usage:**
```bash
curl -X POST /api/content/product-description \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Wireless Noise-Canceling Headphones",
    "features": ["Active noise cancellation", "30-hour battery", "Bluetooth 5.0", "Comfortable ear cups"],
    "targetAudience": "remote workers and travelers"
  }'
```

**Response:**
```json
{
  "description": "Experience uninterrupted focus with our premium Wireless Noise-Canceling Headphones. Featuring advanced active noise cancellation technology, these headphones create your personal sound sanctuary wherever you go. With an impressive 30-hour battery life and Bluetooth 5.0 connectivity, you'll enjoy seamless audio all day long. The plush, comfortable ear cups ensure hours of fatigue-free listening, perfect for remote work, travel, or simply escaping into your favorite music. Upgrade your audio experience today and discover the difference true wireless freedom makes.",
  "wordCount": 89,
  "cost": 0.00032,
  "tokens": { "input": 85, "output": 105, "total": 190 }
}
```

### 2. Blog Post Generation

**Use Case:** Content marketing, SEO, thought leadership

**Example Implementation:**

```typescript
// app/api/content/blog-post/route.ts
export async function POST(request: NextRequest) {
  const { topic, keywords, tone = 'professional', length = 'medium' } = await request.json()

  const lengthGuide = {
    short: { words: '400-600', tokens: 800 },
    medium: { words: '800-1200', tokens: 1500 },
    long: { words: '1500-2000', tokens: 2500 }
  }

  const guide = lengthGuide[length] || lengthGuide.medium

  const selection = await selectModel('claude-3-5-haiku-20241022')

  const result = await generateText({
    model: selection.model,
    system: `You are a professional content writer specializing in engaging, SEO-optimized blog posts.`,
    prompt: `
Topic: ${topic}
Target Keywords: ${keywords.join(', ')}
Tone: ${tone}
Length: ${guide.words} words

Write a complete blog post with:
1. Attention-grabbing title
2. Compelling introduction
3. Well-structured body with H2/H3 headings
4. Key takeaways
5. Strong conclusion with CTA

Include keywords naturally and maintain ${tone} tone throughout.
    `.trim(),
    maxOutputTokens: guide.tokens,
    temperature: 0.8
  })

  const tokens = extractTokens(result)
  const cost = calculateCost(tokens, selection.costConfig)

  // Parse title and content
  const lines = result.text.split('\n')
  const title = lines[0].replace(/^#+\s*/, '')
  const content = lines.slice(1).join('\n').trim()

  return NextResponse.json({
    title,
    content,
    wordCount: content.split(' ').length,
    cost,
    tokens
  })
}
```

### 3. Marketing Copy

**Use Case:** Ads, landing pages, email campaigns

**Example - Email Subject Lines:**

```typescript
// app/api/content/email-subject/route.ts
export async function POST(request: NextRequest) {
  const { campaign, offer, audience } = await request.json()

  const selection = await selectModel('gpt-4o-mini')

  const result = await generateText({
    model: selection.model,
    system: `You are a direct response copywriter specializing in high-converting email subject lines.`,
    prompt: `
Campaign: ${campaign}
Offer: ${offer}
Audience: ${audience}

Generate 10 compelling email subject lines that:
- Create urgency or curiosity
- Are 40-60 characters
- Include power words
- Encourage opens

Format: One per line, numbered
    `.trim(),
    maxOutputTokens: 400,
    temperature: 0.9  // High creativity
  })

  // Parse subject lines
  const subjectLines = result.text
    .split('\n')
    .filter(line => line.match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim())

  return NextResponse.json({
    subjectLines,
    count: subjectLines.length,
    cost: calculateCost(extractTokens(result), selection.costConfig)
  })
}
```

### 4. Social Media Posts

**Use Case:** Social media management, engagement

**Example - Multi-Platform Posts:**

```typescript
// app/api/content/social-post/route.ts
export async function POST(request: NextRequest) {
  const { topic, platforms = ['twitter', 'linkedin', 'facebook'] } = await request.json()

  const selection = await selectModel('gpt-4o-mini')

  const platformGuides = {
    twitter: { limit: '280 characters', style: 'concise and witty' },
    linkedin: { limit: '150 words', style: 'professional and insightful' },
    facebook: { limit: '100 words', style: 'conversational and engaging' },
    instagram: { limit: '150 words', style: 'visual and inspiring' }
  }

  const posts = {}

  for (const platform of platforms) {
    const guide = platformGuides[platform]

    const result = await generateText({
      model: selection.model,
      system: `You are a social media expert creating ${guide.style} content for ${platform}.`,
      prompt: `
Topic: ${topic}
Platform: ${platform}
Limit: ${guide.limit}
Style: ${guide.style}

Create an engaging post with:
${platform === 'twitter' ? '- Relevant hashtags (2-3)' : ''}
${platform === 'instagram' ? '- Relevant hashtags (5-10)' : ''}
${platform === 'linkedin' ? '- Professional tone' : ''}
- Call-to-action
- Platform-appropriate formatting
      `.trim(),
      maxOutputTokens: 200,
      temperature: 0.8
    })

    posts[platform] = result.text
  }

  return NextResponse.json({ posts })
}
```

## Batch Processing

**Generate Multiple Items at Once:**

```typescript
// app/api/content/batch-descriptions/route.ts
export async function POST(request: NextRequest) {
  const { products } = await request.json()  // Array of products

  const selection = await selectModel('gpt-4o-mini')
  const results = []
  let totalCost = 0

  for (const product of products) {
    const result = await generateText({
      model: selection.model,
      system: 'You are a product copywriter.',
      prompt: `Write a 50-word description for: ${product.name}`,
      maxOutputTokens: 100
    })

    const tokens = extractTokens(result)
    const cost = calculateCost(tokens, selection.costConfig)
    totalCost += cost

    results.push({
      productId: product.id,
      description: result.text,
      cost
    })
  }

  return NextResponse.json({
    results,
    count: results.length,
    totalCost
  })
}
```

## Content Refinement

**Improve Existing Content:**

```typescript
// app/api/content/refine/route.ts
export async function POST(request: NextRequest) {
  const { content, instructions = 'Improve clarity and engagement' } = await request.json()

  const selection = await selectModel('claude-3-5-haiku-20241022')

  const result = await generateText({
    model: selection.model,
    system: 'You are an expert editor improving content quality.',
    prompt: `
Original Content:
${content}

Instructions:
${instructions}

Provide the refined version with improvements in:
- Clarity and readability
- Engagement and flow
- Grammar and style
- SEO optimization (if applicable)
    `.trim(),
    maxOutputTokens: content.split(' ').length * 2,  // Allow expansion
    temperature: 0.6
  })

  return NextResponse.json({
    original: content,
    refined: result.text,
    improvement: 'Content refined successfully',
    cost: calculateCost(extractTokens(result), selection.costConfig)
  })
}
```

## Integration with Entities

**Link Generated Content to Products:**

```typescript
import { AIHistoryService } from '@/contents/plugins/ai/lib/ai-history-service'

export async function generateAndSaveDescription(productId: string) {
  // Start operation tracking
  const historyId = await AIHistoryService.startOperation({
    userId: session.user.id,
    teamId: session.user.activeTeamId,
    operation: 'generate',
    model: 'gpt-4o-mini',
    provider: 'openai',
    relatedEntityType: 'products',
    relatedEntityId: productId
  })

  try {
    // Get product data
    const product = await getProduct(productId)

    // Generate description
    const result = await generateText({
      model: selection.model,
      prompt: `Write a description for: ${product.name}`
    })

    // Update product
    await updateProduct(productId, {
      description: result.text,
      ai_generated: true
    })

    // Complete tracking
    await AIHistoryService.completeOperation({
      historyId,
      tokensUsed: result.usage.totalTokens,
      tokensInput: result.usage.inputTokens,
      tokensOutput: result.usage.outputTokens,
      creditsUsed: 0,
      estimatedCost: cost,
      balanceAfter: user.balance,
      userId: session.user.id,
      metas: {
        contentType: 'product-description',
        productName: product.name
      }
    })

    return { description: result.text, cost }
  } catch (error) {
    await AIHistoryService.failOperation({
      historyId,
      errorMessage: error.message
    })
    throw error
  }
}
```

## Cost Optimization

### 1. Use Appropriate Models

```typescript
// ✅ Development: Free local model
const devModel = 'llama3.2:3b'

// ✅ Production bulk: Cheap cloud model
const bulkModel = 'gpt-4o-mini'  // $0.00015 input / $0.0006 output

// ✅ Production premium: Quality model
const premiumModel = 'gpt-4o'     // $0.0025 input / $0.01 output
```

### 2. Optimize Token Usage

```typescript
// ✅ Good: Specific, concise prompt
const prompt = `Write a 50-word product description for ${productName}`
// Uses ~15 input tokens

// ❌ Bad: Verbose, wasteful prompt
const prompt = `
I need you to please help me write a comprehensive product description.
The product is called ${productName} and I would like you to make it
engaging and informative. Please use around 50 words or so. Thank you!
`
// Uses ~40 input tokens (2.6x more expensive)
```

### 3. Cache Common Prompts

```typescript
// Cache system prompts
const SYSTEM_PROMPTS = {
  productDescription: 'You are an expert e-commerce copywriter...',
  blogPost: 'You are a professional content writer...',
  emailSubject: 'You are a direct response copywriter...'
}

// Reuse across requests
const result = await generateText({
  model: selection.model,
  system: SYSTEM_PROMPTS.productDescription,
  prompt: userPrompt
})
```

## Best Practices

1. **Validate Input** - Ensure product/content data is complete
2. **Set Appropriate Temperature** - Lower for factual, higher for creative
3. **Limit Output Tokens** - Don't over-allocate
4. **Track Costs** - Monitor per-generation costs
5. **A/B Test** - Compare models and prompts
6. **Save Examples** - Use `saveExample: true` for training
7. **Batch When Possible** - Generate multiple items efficiently
8. **Link to Entities** - Track which content was generated for what

## Next Steps

- **[Semantic Search](./02-semantic-search.md)** - Search content by meaning
- **[AI Auditing](./03-ai-auditing.md)** - Quality control with AI
- **[Custom Endpoints](../04-advanced-usage/02-custom-endpoints.md)** - Build specialized generators
