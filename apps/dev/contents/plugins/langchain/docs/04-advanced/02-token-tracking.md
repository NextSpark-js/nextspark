# Token & Cost Tracking

This guide covers the token usage tracking system for monitoring LLM costs and usage.

## Overview

The token tracker provides:
- **Per-request tracking**: Input/output tokens for each LLM call
- **Cost calculation**: Automatic cost computation based on model pricing
- **Usage analytics**: Aggregated stats by user, team, model, and time period
- **Dashboard**: Visual usage monitoring

---

## How It Works

```
LLM Request → Token Usage → Cost Calculation → Database → Analytics
                ↓               ↓
          inputTokens      pricing table
          outputTokens          ↓
                          totalCost (USD)
```

---

## Pricing Configuration

Default pricing per 1M tokens (USD):

```typescript
const DEFAULT_PRICING = {
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    // Local models are free
    'ollama/*': { input: 0, output: 0 },
}
```

### Cost Calculation

```typescript
// Per-request cost formula
inputCost = (inputTokens / 1,000,000) * pricing.input
outputCost = (outputTokens / 1,000,000) * pricing.output
totalCost = inputCost + outputCost

// Example: gpt-4o-mini with 500 input + 200 output tokens
inputCost = (500 / 1,000,000) * 0.15 = $0.000075
outputCost = (200 / 1,000,000) * 0.60 = $0.000120
totalCost = $0.000195 (~$0.0002 per request)
```

---

## Database Schema

**Table**: `langchain_token_usage`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique identifier |
| `userId` | TEXT | User who made request |
| `teamId` | TEXT | Team context |
| `sessionId` | TEXT | Session identifier |
| `provider` | TEXT | LLM provider (openai, anthropic) |
| `model` | TEXT | Model name |
| `inputTokens` | INTEGER | Input token count |
| `outputTokens` | INTEGER | Output token count |
| `totalTokens` | INTEGER | Total tokens |
| `inputCost` | DECIMAL(12,6) | Input cost USD |
| `outputCost` | DECIMAL(12,6) | Output cost USD |
| `totalCost` | DECIMAL(12,6) | Total cost USD |
| `agentName` | TEXT | Agent that made call |
| `metadata` | JSONB | Additional data |
| `createdAt` | TIMESTAMPTZ | Timestamp |

**RLS Policies**:
- Users can only see their own usage
- Team admins can see team-wide usage

---

## Token Tracker Service

### Basic Usage

```typescript
import { tokenTracker } from '@/contents/plugins/langchain/lib/token-tracker'

// Track usage after LLM call
await tokenTracker.trackUsage({
    context: { userId, teamId },
    sessionId: 'session-123',
    provider: 'openai',
    model: 'gpt-4o-mini',
    usage: {
        inputTokens: 150,
        outputTokens: 80,
        totalTokens: 230,
    },
    agentName: 'orchestrator',
})
```

### Calculate Cost

```typescript
const costs = tokenTracker.calculateCost('gpt-4o-mini', {
    inputTokens: 500,
    outputTokens: 200,
    totalTokens: 700,
})

console.log(costs)
// { inputCost: 0.000075, outputCost: 0.000120, totalCost: 0.000195 }
```

### Get Usage Stats

```typescript
// Get user's usage for last 30 days
const stats = await tokenTracker.getUsage(
    { userId, teamId },
    '30d'
)

console.log(stats)
// {
//   totalTokens: 150000,
//   totalCost: 2.45,
//   inputTokens: 100000,
//   outputTokens: 50000,
//   requestCount: 450,
//   byModel: {
//     'gpt-4o-mini': { tokens: 120000, cost: 0.50 },
//     'claude-3-haiku': { tokens: 30000, cost: 1.95 }
//   }
// }
```

### Get Daily Usage (Charts)

```typescript
const daily = await tokenTracker.getDailyUsage(
    { userId, teamId },
    30  // days
)

console.log(daily)
// [
//   { date: '2024-12-23', tokens: 5000, cost: 0.08, requests: 25 },
//   { date: '2024-12-22', tokens: 4500, cost: 0.07, requests: 22 },
//   ...
// ]
```

### Get Team Usage (Admin)

```typescript
const teamStats = await tokenTracker.getTeamUsage(teamId, '30d')

console.log(teamStats)
// {
//   totalTokens: 500000,
//   totalCost: 8.50,
//   byUser: {
//     'user-1': { tokens: 200000, cost: 3.40 },
//     'user-2': { tokens: 300000, cost: 5.10 }
//   }
// }
```

---

## API Endpoints

### Get User Usage

```
GET /api/v1/theme/default/ai/usage
```

**Query Parameters**:
- `period` - `today`, `7d`, `30d`, or `all` (default: `30d`)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalTokens": 150000,
    "totalCost": 2.45,
    "inputTokens": 100000,
    "outputTokens": 50000,
    "requestCount": 450,
    "byModel": {
      "gpt-4o-mini": { "tokens": 120000, "cost": 0.50 }
    }
  }
}
```

### Get Team Usage (Admin)

```
GET /api/v1/theme/default/ai/usage/team
```

**Query Parameters**:
- `period` - `today`, `7d`, `30d`, or `all` (default: `30d`)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalTokens": 500000,
    "totalCost": 8.50,
    "byUser": {
      "user-1": { "tokens": 200000, "cost": 3.40 },
      "user-2": { "tokens": 300000, "cost": 5.10 }
    }
  }
}
```

---

## Dashboard

The usage dashboard is available at:

```
/dashboard/settings/ai-usage
```

### Features

1. **Summary Stats**
   - Total tokens used
   - Total cost
   - Request count

2. **Usage by Model**
   - Breakdown per model
   - Percentage allocation

3. **Daily Chart**
   - Token usage over time
   - Cost trend
   - Request volume

4. **Period Selector**
   - Today
   - Last 7 days
   - Last 30 days
   - All time

---

## React Hook

### useTokenUsage

```typescript
import { useTokenUsage } from '@/contents/plugins/langchain/hooks/useTokenUsage'

function UsageStats() {
    const { data, isLoading, error } = useTokenUsage({
        period: '30d',
    })

    if (isLoading) return <Loading />

    return (
        <div>
            <Stat label="Total Tokens" value={data.totalTokens.toLocaleString()} />
            <Stat label="Total Cost" value={`$${data.totalCost.toFixed(2)}`} />
            <Stat label="Requests" value={data.requestCount} />

            <h3>By Model</h3>
            {Object.entries(data.byModel).map(([model, stats]) => (
                <div key={model}>
                    {model}: {stats.tokens.toLocaleString()} tokens (${stats.cost.toFixed(2)})
                </div>
            ))}
        </div>
    )
}
```

---

## Integration

### With Agent Factory

Token tracking is automatically integrated when using the agent factory:

```typescript
// In agent-factory.ts
const response = await model.invoke(messages)

// After LLM call, tokens are automatically tracked
await tokenTracker.trackUsage({
    context,
    sessionId,
    provider: modelConfig.provider,
    model: modelConfig.model,
    usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
    },
    agentName,
})
```

### With Graph Orchestrator

The graph orchestrator tracks usage at trace level:

```typescript
// End trace includes token stats
await tracer.endTrace(context, traceId, {
    tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
    },
    cost: tokenTracker.calculateCost(model, usage).totalCost,
})
```

---

## Custom Pricing

### Override Default Pricing

```typescript
const customPricing = {
    ...DEFAULT_PRICING,
    'my-custom-model': { input: 1.00, output: 2.00 },
}

const costs = tokenTracker.calculateCost('my-custom-model', usage, customPricing)
```

### Wildcard Pricing

Use wildcards for provider-level pricing:

```typescript
const pricing = {
    'openai/*': { input: 0.50, output: 1.50 },  // Default for all OpenAI
    'gpt-4o': { input: 5.00, output: 15.00 },   // Override specific model
}
```

---

## Query Periods

| Period | Description | SQL |
|--------|-------------|-----|
| `today` | Current date | `>= CURRENT_DATE` |
| `7d` | Last 7 days | `>= now() - 7 days` |
| `30d` | Last 30 days | `>= now() - 30 days` |
| `all` | All time | No filter |

---

## Cost Optimization Tips

### 1. Use Appropriate Models

```typescript
// For simple routing: use cheap model
'orchestrator': {
    model: 'claude-3-haiku',  // $0.25/$1.25 per 1M
}

// For complex synthesis: use capable model
'combiner': {
    model: 'gpt-4o-mini',  // $0.15/$0.60 per 1M
}
```

### 2. Monitor by Model

Check which models consume most tokens:

```typescript
const stats = await tokenTracker.getUsage(context, '30d')

// Sort by cost
Object.entries(stats.byModel)
    .sort(([,a], [,b]) => b.cost - a.cost)
    .forEach(([model, stats]) => {
        console.log(`${model}: $${stats.cost.toFixed(2)}`)
    })
```

### 3. Set Alerts

Monitor when usage exceeds thresholds:

```typescript
const stats = await tokenTracker.getUsage(context, 'today')

if (stats.totalCost > DAILY_BUDGET) {
    // Send alert
    await notifyAdmin(`Daily AI budget exceeded: $${stats.totalCost}`)
}
```

### 4. Use Local Models

For development or non-critical tasks:

```typescript
// Ollama models are free
'dev-agent': {
    provider: 'ollama',
    model: 'llama3.2',  // Free (local)
}
```

---

## Troubleshooting

### Missing Token Counts

Some providers don't return usage in responses. Check:

1. Model supports usage metadata
2. Response includes `usage` field
3. Streaming mode may not include usage

### Zero Cost

If costs are $0.00:
1. Model might be using local provider (Ollama)
2. Model not in pricing table
3. Check for typos in model name

### High Costs

If costs are unexpectedly high:
1. Check model being used
2. Look for long inputs/outputs
3. Review request frequency
4. Consider caching responses

---

## Related Documentation

- [Observability](./01-observability.md) - Includes token tracking in traces
- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - Optimized for fewer LLM calls
- [Configuration](../01-getting-started/03-configuration.md) - Model selection
