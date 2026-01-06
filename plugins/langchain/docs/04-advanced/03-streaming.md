# Streaming Responses

This guide covers real-time token-by-token streaming via Server-Sent Events (SSE).

## Overview

Streaming enables:
- **Real-time display**: Show tokens as they're generated
- **Better UX**: User sees immediate feedback
- **Cancellation**: Abort long-running requests
- **Tool visibility**: See when tools are being called

---

## Why SSE over WebSocket?

| Aspect | SSE | WebSocket |
|--------|-----|-----------|
| **Complexity** | Simple | More complex |
| **Direction** | Server → Client | Bidirectional |
| **Reconnection** | Built-in | Manual |
| **HTTP/2** | Full support | Separate protocol |
| **Firewall** | Standard HTTP | May be blocked |

For LLM streaming (one-way, server to client), SSE is simpler and more reliable.

---

## Stream Chunk Types

```typescript
type StreamChunk =
    | { type: 'token'; content: string }
    | { type: 'done'; fullContent: string; tokenUsage?: TokenUsage }
    | { type: 'error'; error: string }
    | { type: 'tool_start'; toolName: string }
    | { type: 'tool_end'; toolName: string; result: unknown }
```

| Type | Description | Example |
|------|-------------|---------|
| `token` | A generated token | `{ type: 'token', content: 'Hello' }` |
| `done` | Stream complete | `{ type: 'done', fullContent: 'Hello world!' }` |
| `error` | Error occurred | `{ type: 'error', error: 'Timeout' }` |
| `tool_start` | Tool invocation started | `{ type: 'tool_start', toolName: 'list_tasks' }` |
| `tool_end` | Tool completed | `{ type: 'tool_end', toolName: 'list_tasks', result: [...] }` |

---

## API Endpoint

### POST /api/.../ai/chat/stream

Streaming chat endpoint using SSE.

**Request**:
```json
{
    "message": "Show my tasks",
    "sessionId": "session-123",
    "agentName": "orchestrator"
}
```

**Response Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Response Stream**:
```
data: {"type":"token","content":"I"}

data: {"type":"token","content":" found"}

data: {"type":"tool_start","toolName":"list_tasks"}

data: {"type":"tool_end","toolName":"list_tasks","result":[...]}

data: {"type":"token","content":" 3"}

data: {"type":"token","content":" tasks"}

data: {"type":"done","fullContent":"I found 3 tasks...","tokenUsage":{"inputTokens":50,"outputTokens":30,"totalTokens":80}}

data: [DONE]
```

---

## Backend Implementation

### streamChat Generator

```typescript
import { streamChat, StreamChunk } from '@/contents/plugins/langchain/lib/streaming'

async function* handleStream(
    agent: Agent,
    message: string,
    context: AgentContext
): AsyncGenerator<StreamChunk> {
    yield* streamChat(
        agent,
        message,
        context,
        { modelConfig: { provider: 'openai', model: 'gpt-4o-mini' } },
        {
            sessionId: 'session-123',
            agentName: 'orchestrator',
            signal: abortController.signal,
        }
    )
}
```

### SSE Response

```typescript
import { createSSEEncoder } from '@/contents/plugins/langchain/lib/streaming'

export async function POST(request: NextRequest) {
    const { message, sessionId, agentName } = await request.json()

    // Create streaming response
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = createSSEEncoder()

            for await (const chunk of streamChat(agent, message, context, config, options)) {
                controller.enqueue(encoder.encode(chunk))

                if (chunk.type === 'done' || chunk.type === 'error') {
                    controller.enqueue(encoder.encodeDone())
                    controller.close()
                    break
                }
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}
```

---

## Frontend Integration

### useStreamingChat Hook

```typescript
import { useStreamingChat } from '@/contents/plugins/langchain/hooks/useStreamingChat'

function ChatPanel() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')

    const {
        isStreaming,
        streamContent,
        error,
        sendMessage,
        cancelStream,
    } = useStreamingChat({
        sessionId: 'session-123',
        agentName: 'orchestrator',
        onToken: (token) => {
            // Called for each token
            console.log('Token:', token)
        },
        onToolStart: (toolName) => {
            console.log('Tool started:', toolName)
        },
        onToolEnd: (toolName, result) => {
            console.log('Tool completed:', toolName, result)
        },
        onComplete: (fullContent, tokenUsage) => {
            setMessages(prev => [...prev, { role: 'assistant', content: fullContent }])
        },
        onError: (error) => {
            console.error('Stream error:', error)
        },
    })

    const handleSend = async () => {
        setMessages(prev => [...prev, { role: 'user', content: input }])
        await sendMessage(input)
        setInput('')
    }

    return (
        <div>
            <MessageList messages={messages} />

            {isStreaming && (
                <div>
                    <TypingIndicator content={streamContent} />
                    <button onClick={cancelStream}>Stop</button>
                </div>
            )}

            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
            />
            <button onClick={handleSend} disabled={isStreaming}>
                Send
            </button>
        </div>
    )
}
```

### Hook Options

```typescript
interface UseStreamingChatOptions {
    sessionId?: string
    agentName?: string

    // Callbacks
    onToken?: (token: string) => void
    onToolStart?: (toolName: string) => void
    onToolEnd?: (toolName: string, result: unknown) => void
    onComplete?: (fullContent: string, tokenUsage?: TokenUsage) => void
    onError?: (error: string) => void
}

interface UseStreamingChatReturn {
    isStreaming: boolean
    streamContent: string      // Accumulated content so far
    error: string | null
    sendMessage: (message: string) => Promise<void>
    cancelStream: () => void
}
```

---

## Cancellation

### Backend: AbortSignal

```typescript
const controller = new AbortController()

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000)

yield* streamChat(agent, message, context, config, {
    signal: controller.signal,
})
```

### Frontend: Cancel Button

```typescript
const { isStreaming, cancelStream } = useStreamingChat(options)

<button
    onClick={cancelStream}
    disabled={!isStreaming}
>
    Stop Generating
</button>
```

When cancelled, stream emits:
```json
{ "type": "error", "error": "Stream cancelled by user" }
```

---

## Integration with Services

### Memory Persistence

After streaming completes, messages are automatically saved:

```typescript
// In streamChat()
if (sessionId && fullContent) {
    await dbMemoryStore.addMessages(
        sessionId,
        [new HumanMessage(input), new AIMessage(fullContent)],
        context,
        sessionConfig
    )
}
```

### Token Tracking

Token usage is tracked on completion:

```typescript
// In streamChat()
if (tokenUsage.totalTokens > 0) {
    await tokenTracker.trackUsage({
        context,
        sessionId,
        provider: config.modelConfig?.provider,
        model: config.modelConfig?.model,
        usage: tokenUsage,
        agentName,
    })
}
```

### Observability

Traces are automatically created:

```typescript
// In streamChat()
const traceContext = await tracer.startTrace(...)

// On completion
await tracer.endTrace(context, traceId, {
    output: fullContent,
    tokens: tokenUsage,
    llmCalls: counts.llmCalls,
    toolCalls: counts.toolCalls,
})
```

---

## UI Components

### Typing Indicator

```typescript
function TypingIndicator({ content }: { content: string }) {
    return (
        <div className="typing-indicator">
            <div className="message-content">
                {content}
                <span className="cursor">|</span>
            </div>
        </div>
    )
}
```

### Tool Call Display

```typescript
function ToolCallIndicator({ toolName, isActive }: Props) {
    return (
        <div className={`tool-call ${isActive ? 'active' : 'completed'}`}>
            <ToolIcon />
            <span>{toolName}</span>
            {isActive && <Spinner />}
        </div>
    )
}
```

---

## Error Handling

### Network Errors

```typescript
const { error } = useStreamingChat({
    onError: (error) => {
        if (error.includes('network')) {
            // Retry or show reconnect button
        } else if (error.includes('cancelled')) {
            // User cancelled, no action needed
        } else {
            // Show error message
            toast.error(error)
        }
    },
})
```

### Timeout

Configure server-side timeout:

```typescript
// In API route
export const runtime = 'edge' // Or 'nodejs'
export const maxDuration = 60 // seconds
```

---

## Best Practices

### 1. Show Immediate Feedback

```typescript
// Show user message immediately
setMessages(prev => [...prev, { role: 'user', content: input }])

// Then start streaming
await sendMessage(input)
```

### 2. Handle Edge Cases

```typescript
// Empty response
if (chunk.type === 'done' && !chunk.fullContent) {
    showMessage('No response generated')
}

// Very long response
if (streamContent.length > MAX_LENGTH) {
    cancelStream()
    showWarning('Response too long')
}
```

### 3. Provide Cancel Option

Always show cancel button during streaming for user control.

### 4. Buffer Tool Calls

```typescript
const [activeTools, setActiveTools] = useState<string[]>([])

onToolStart: (name) => {
    setActiveTools(prev => [...prev, name])
},
onToolEnd: (name) => {
    setActiveTools(prev => prev.filter(t => t !== name))
},
```

---

## Troubleshooting

### Stream Not Connecting

1. Check Content-Type header is `text/event-stream`
2. Verify no caching headers interfere
3. Check CORS if cross-origin

### Tokens Not Appearing

1. Verify LangChain's `streamEvents` is working
2. Check `on_chat_model_stream` events are emitted
3. Ensure model supports streaming

### Memory Issues

1. Don't accumulate too much content in state
2. Clean up on component unmount
3. Use `cancelStream` when navigating away

---

## Related Documentation

- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - How streaming integrates with orchestration
- [Token Tracking](./02-token-tracking.md) - Usage tracking during streams
- [Observability](./01-observability.md) - Tracing streaming requests
