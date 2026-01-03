# AI History

## Overview

**AI History** is an audit trail system that tracks every AI operation in your application. It provides complete visibility into AI usage, costs, performance, and outcomes.

**Key Benefits:**
- **Cost Tracking** - Monitor token usage and spending across all AI operations
- **Performance Monitoring** - Track response times and success rates
- **Audit Trail** - Complete record of all AI interactions
- **Entity Linking** - Connect AI operations to application entities
- **Debugging** - Investigate issues and optimize prompts

## Database Schema

### AI History Table

```sql
CREATE TABLE ai_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Operation details
  operation VARCHAR(50) NOT NULL,        -- 'generate', 'refine', 'analyze', etc.
  status VARCHAR(20) NOT NULL,           -- 'pending', 'processing', 'completed', 'failed'
  
  -- AI configuration
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50),                   -- 'openai', 'anthropic', 'ollama'
  
  -- Token usage and costs
  tokens_used INTEGER DEFAULT 0,
  tokens_input INTEGER,                  -- Prompt tokens
  tokens_output INTEGER,                 -- Completion tokens
  credits_used DECIMAL(10,4) DEFAULT 0,
  estimated_cost DECIMAL(10,6) DEFAULT 0,
  balance_after DECIMAL(10,4),
  
  -- Entity relationship (polymorphic)
  related_entity_type VARCHAR(100),      -- 'products', 'articles', 'clients'
  related_entity_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### AI History Metadata Table

```sql
CREATE TABLE ai_history_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES ai_history(id) ON DELETE CASCADE,
  meta_key VARCHAR(255) NOT NULL,
  meta_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Flexible Metadata:**
- `sourceOperationId` - Link to original operation
- `userInstruction` - Original user input
- `systemPrompt` - System prompt used
- `parameters` - JSON of generation parameters
- Custom fields as needed

## AI History Service

### Import

```typescript
import { AIHistoryService } from '@/contents/plugins/ai/lib/ai-history-service'
```

### Operation Lifecycle

**1. Start Operation**

```typescript
const historyId = await AIHistoryService.startOperation({
  userId: 'user-id',
  operation: 'generate',
  model: 'gpt-4o-mini',
  provider: 'openai',
  relatedEntityType: 'products',
  relatedEntityId: 'product-uuid'
})
```

**2. Update Status (Optional)**

```typescript
await AIHistoryService.updateToProcessing(historyId)
```

**3. Complete Operation**

```typescript
await AIHistoryService.completeOperation({
  historyId,
  tokensUsed: 250,
  tokensInput: 100,
  tokensOutput: 150,
  creditsUsed: 0,
  estimatedCost: 0.00045,
  balanceAfter: 10.50,
  userId: 'user-id',
  metas: {
    userInstruction: 'Generate product description',
    systemPrompt: 'You are a product copywriter...',
    resultLength: 500
  }
})
```

**4. Fail Operation (If Error)**

```typescript
await AIHistoryService.failOperation({
  historyId,
  errorMessage: 'Rate limit exceeded',
  tokensUsed: 50  // Partial tokens before failure
})
```

### Methods Reference

#### `startOperation(params)`

**Parameters:**
```typescript
{
  userId: string              // Required
  operation: AIOperation      // 'generate' | 'refine' | 'analyze' | 'chat' | 'completion' | 'other'
  model: string               // Model name (e.g., 'gpt-4o-mini')
  provider?: AIProvider       // 'openai' | 'anthropic' | 'ollama'
  relatedEntityType?: string  // Entity type (e.g., 'products')
  relatedEntityId?: string    // Entity ID
}
```

**Returns:** `Promise<string>` - History record ID

**Usage:**
```typescript
const historyId = await AIHistoryService.startOperation({
  userId: session.user.id,
  operation: 'generate',
  model: 'llama3.2:3b',
  provider: 'ollama'
})
```

#### `completeOperation(params)`

**Parameters:**
```typescript
{
  historyId: string           // Required: ID from startOperation
  tokensUsed: number          // Total tokens
  tokensInput?: number        // Input tokens (optional but recommended)
  tokensOutput?: number       // Output tokens (optional but recommended)
  creditsUsed: number         // Credits deducted (if using credit system)
  estimatedCost: number       // Cost in USD
  balanceAfter: number        // User balance after operation
  userId: string              // Required for metadata
  metas?: Record<string, any> // Optional metadata
}
```

**Returns:** `Promise<void>`

**Usage:**
```typescript
await AIHistoryService.completeOperation({
  historyId,
  tokensUsed: result.usage.totalTokens,
  tokensInput: result.usage.inputTokens,
  tokensOutput: result.usage.outputTokens,
  creditsUsed: 0,
  estimatedCost: 0.00045,
  balanceAfter: user.balance,
  userId: session.user.id,
  metas: {
    temperature: 0.7,
    maxTokens: 500,
    responseLength: result.text.length
  }
})
```

#### `failOperation(params)`

**Parameters:**
```typescript
{
  historyId: string          // Required
  errorMessage: string       // Error description
  tokensUsed?: number        // Partial tokens if any
}
```

**Returns:** `Promise<void>`

**Usage:**
```typescript
try {
  // AI operation
} catch (error) {
  await AIHistoryService.failOperation({
    historyId,
    errorMessage: error.message,
    tokensUsed: partialTokens
  })
}
```

## Entity Linking

### Link Operation to Entity

**During Creation:**
```typescript
const historyId = await AIHistoryService.startOperation({
  userId: 'user-id',
  operation: 'analyze',
  model: 'claude-3-5-haiku-20241022',
  relatedEntityType: 'clients',
  relatedEntityId: clientId
})
```

**After Creation (via API):**
```bash
PATCH /api/v1/plugin/ai/ai-history/:id

{
  "relatedEntityType": "products",
  "relatedEntityId": "product-uuid"
}
```

### Use Cases

**1. Product Content Generation**
```typescript
// Generate product description
const historyId = await AIHistoryService.startOperation({
  userId: session.user.id,
  operation: 'generate',
  model: 'gpt-4o-mini',
  relatedEntityType: 'products',
  relatedEntityId: productId
})

// ... generate content ...

// Link shows which product this content was generated for
```

**2. Client Analysis**
```typescript
// Analyze client data
const historyId = await AIHistoryService.startOperation({
  userId: session.user.id,
  operation: 'analyze',
  model: 'claude-3-5-sonnet-20241022',
  relatedEntityType: 'clients',
  relatedEntityId: clientId
})

// History linked to specific client
```

**3. Content Auditing**
```typescript
// Audit article content
const historyId = await AIHistoryService.startOperation({
  userId: session.user.id,
  operation: 'analyze',
  model: 'gpt-4o',
  relatedEntityType: 'articles',
  relatedEntityId: articleId
})

// Track which articles have been audited
```

## Querying History

### Get User's History

```typescript
const history = await AIHistoryService.getUserHistory(userId, {
  limit: 50,
  offset: 0
})
```

### Filter by Operation

```typescript
const generations = await query(`
  SELECT * FROM ai_history
  WHERE user_id = $1
  AND operation = 'generate'
  ORDER BY created_at DESC
  LIMIT 50
`, [userId])
```

### Calculate Total Costs

```typescript
const result = await queryOne(`
  SELECT 
    SUM(estimated_cost) as total_cost,
    SUM(tokens_used) as total_tokens,
    COUNT(*) as operation_count
  FROM ai_history
  WHERE user_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
`, [userId])

console.log(`Monthly cost: $${result.total_cost}`)
console.log(`Total tokens: ${result.total_tokens}`)
console.log(`Operations: ${result.operation_count}`)
```

### Group by Model

```typescript
const modelStats = await query(`
  SELECT 
    model,
    COUNT(*) as usage_count,
    SUM(estimated_cost) as total_cost,
    AVG(tokens_used) as avg_tokens
  FROM ai_history
  WHERE user_id = $1
  GROUP BY model
  ORDER BY usage_count DESC
`, [userId])
```

## Dashboard Integration

### AI History Entity

The AI History entity is automatically available in the dashboard:

**Routes:**
- `/dashboard/ai-history` - List view
- `/dashboard/ai-history/:id` - Detail view

**Features:**
- Searchable by operation, model, provider, entity type
- Sortable by date, cost, status, tokens
- Filterable by status, operation, provider
- Bulk delete operations

### Permissions

```typescript
permissions: {
  read: ['admin', 'colaborator'],      // Users see their own via RLS
  create: ['admin', 'colaborator'],    // Created by API
  update: ['admin'],                   // Immutable (admin only)
  delete: ['admin', 'colaborator']     // Users can delete own history
}
```

## Real-World Example

### Complete Content Generation Flow

```typescript
export async function generateProductDescription(productId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  
  // 1. Start operation tracking
  const historyId = await AIHistoryService.startOperation({
    userId: session.user.id,
    operation: 'generate',
    model: 'gpt-4o-mini',
    provider: 'openai',
    relatedEntityType: 'products',
    relatedEntityId: productId
  })
  
  try {
    // 2. Update status
    await AIHistoryService.updateToProcessing(historyId)
    
    // 3. Get product data
    const product = await getProduct(productId)
    
    // 4. Generate content
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Generate a compelling product description for: ${product.name}`,
      maxTokens: 300
    })
    
    // 5. Calculate cost
    const tokens = {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
      total: result.usage.totalTokens
    }
    const cost = calculateCost(tokens, { input: 0.00015, output: 0.0006 })
    
    // 6. Complete operation
    await AIHistoryService.completeOperation({
      historyId,
      tokensUsed: tokens.total,
      tokensInput: tokens.input,
      tokensOutput: tokens.output,
      creditsUsed: 0,
      estimatedCost: cost,
      balanceAfter: session.user.balance,
      userId: session.user.id,
      metas: {
        productName: product.name,
        promptTemplate: 'product-description-v1',
        generatedLength: result.text.length
      }
    })
    
    // 7. Return result
    return {
      description: result.text,
      cost,
      tokens,
      historyId
    }
    
  } catch (error) {
    // 8. Handle failure
    await AIHistoryService.failOperation({
      historyId,
      errorMessage: error.message
    })
    throw error
  }
}
```

## Metadata Examples

### Store Custom Data

```typescript
await AIHistoryService.completeOperation({
  historyId,
  // ... other params
  metas: {
    // Prompt information
    userInstruction: 'Write a blog post about AI',
    systemPrompt: 'You are a technical writer...',
    
    // Generation parameters
    temperature: 0.7,
    maxTokens: 1000,
    model: 'gpt-4o-mini',
    
    // Results
    responseLength: 850,
    responseQuality: 'high',
    
    // Context
    sourceDocument: 'outline-v3.md',
    targetAudience: 'developers',
    
    // Custom fields
    campaignId: 'summer-2024',
    approved: false
  }
})
```

### Query Metadata

```typescript
// Find all operations with specific metadata
const operations = await query(`
  SELECT h.*
  FROM ai_history h
  JOIN ai_history_metas m ON h.id = m.entity_id
  WHERE h.user_id = $1
  AND m.meta_key = 'campaignId'
  AND m.meta_value = 'summer-2024'
`, [userId])
```

## Performance Optimization

### Index for Common Queries

```sql
-- Index for user queries
CREATE INDEX idx_ai_history_user_date 
ON ai_history(user_id, created_at DESC);

-- Index for entity relationships
CREATE INDEX idx_ai_history_entity 
ON ai_history(related_entity_type, related_entity_id);

-- Index for status tracking
CREATE INDEX idx_ai_history_status 
ON ai_history(status, created_at);
```

### Pagination

```typescript
async function getUserHistoryPaginated(
  userId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const offset = (page - 1) * pageSize
  
  return await query(`
    SELECT * FROM ai_history
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, pageSize, offset])
}
```

## Best Practices

1. **Always Track Operations** - Even failed ones provide valuable data
2. **Use Meaningful Operation Names** - Make it easy to filter and analyze
3. **Link to Entities** - Connect AI work to business objects
4. **Store Relevant Metadata** - Helps with debugging and optimization
5. **Monitor Costs** - Set up alerts for unusual spending
6. **Clean Old Data** - Archive or delete history after retention period

## Next Steps

- **[Text Generation](./01-text-generation.md)** - Generate AI content
- **[Core Utilities](../04-advanced-usage/01-core-utilities.md)** - Use in custom endpoints
- **[Custom Endpoints](../04-advanced-usage/02-custom-endpoints.md)** - Build with history tracking
