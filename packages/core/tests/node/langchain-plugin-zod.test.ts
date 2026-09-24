/**
 * The langchain plugin describes its tools and its router output with zod 4 schemas, the zod a
 * NextSpark project installs. @langchain/openai turns each schema into the JSON Schema it sends to
 * OpenAI; a version that converts through `openai/helpers/zod`, which only reads zod 3, sends an
 * empty schema instead, and the model is asked to call tools without their parameters.
 *
 * Every module resolves from apps/dev/plugins/langchain, as the plugin's own imports do, and the requests
 * go to a local server standing in for the OpenAI API.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import { buildTools } from '../../../../apps/dev/plugins/langchain/lib/tools-builder'
import { createOpenAIModel } from '../../../../apps/dev/plugins/langchain/lib/providers'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const requireFromPlugin = createRequire(path.join(REPO, 'apps/dev/plugins/langchain/package.json'))

const z = requireFromPlugin('zod') as typeof import('zod')
const { ChatOpenAI } = requireFromPlugin('@langchain/openai') as typeof import('@langchain/openai')
const { DynamicStructuredTool } = requireFromPlugin('@langchain/core/tools') as typeof import('@langchain/core/tools')
const { HumanMessage } = requireFromPlugin('@langchain/core/messages') as typeof import('@langchain/core/messages')

type ChatRequest = {
  path?: string
  tools?: { function: { parameters: Record<string, unknown> } }[]
  response_format?: { json_schema?: { schema: Record<string, unknown> } }
}

/** Starts a server that answers every chat completion with `message`, recording each request body. */
async function fakeOpenAI(message: Record<string, unknown>) {
  const requests: ChatRequest[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const request = JSON.parse(body) as ChatRequest & { stream?: boolean }
      requests.push({ ...request, path: req.url })
      if (request.stream) {
        const content = typeof message.content === 'string' ? message.content : ''
        res.setHeader('content-type', 'text/event-stream')
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [{ index: 0, finish_reason: null, delta: { role: 'assistant', content } }],
        })}\n\n`)
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'gpt-4o-mini',
          choices: [{ index: 0, finish_reason: 'stop', delta: {} }],
        })}\n\n`)
        res.end('data: [DONE]\n\n')
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 0,
        model: 'gpt-4o-mini',
        choices: [{ index: 0, finish_reason: 'stop', message }],
      }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  const model = new ChatOpenAI({
    apiKey: 'test',
    model: 'gpt-4o-mini',
    configuration: { baseURL: `http://127.0.0.1:${port}/v1` },
    supportsStrictToolCalling: false,
    maxRetries: 0,
  })

  return {
    model,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const INTENTS = '{"intents":[{"type":"task","action":"list"}]}'

const routerSchema = () => z.object({
  intents: z.array(z.object({
    type: z.enum(['task', 'customer']).describe('Intent category'),
    action: z.string().describe('Requested operation'),
  })).describe('Classified intents'),
})

function collectDescriptions(value: unknown, descriptions = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return descriptions

  const schema = value as Record<string, unknown>
  if (typeof schema.description === 'string') descriptions.add(schema.description)
  for (const nestedValue of Object.values(schema)) {
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item) => collectDescriptions(item, descriptions))
    } else {
      collectDescriptions(nestedValue, descriptions)
    }
  }
  return descriptions
}

test('a tool built from a zod 4 schema reaches OpenAI with its parameters', async () => {
  const openai = await fakeOpenAI({ role: 'assistant', content: 'ok' })
  try {
    const tool = new DynamicStructuredTool({
      name: 'search',
      description: 'Search records',
      schema: z.object({
        query: z.string().describe('Terms to search for'),
        limit: z.number().optional().describe('Maximum rows'),
      }),
      func: async ({ query }) => `found ${query}`,
    })

    await openai.model.bindTools([tool]).invoke([new HumanMessage('find cats')])

    assert.equal(openai.requests[0].path, '/v1/chat/completions')
    const parameters = openai.requests[0].tools?.[0].function.parameters
    assert.deepEqual(parameters?.properties, {
      query: { type: 'string', description: 'Terms to search for' },
      limit: { type: 'number', description: 'Maximum rows' },
    }, JSON.stringify(parameters))
    assert.deepEqual(parameters?.required, ['query'])
  } finally {
    await openai.close()
  }
})

test('structured output with a zod 4 schema sends that schema, through function calling and JSON schema', async () => {
  const calls = {
    functionCalling: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'extract_intents', arguments: INTENTS } }] },
    jsonSchema: { role: 'assistant', content: INTENTS },
  }

  for (const [method, message] of Object.entries(calls)) {
    const openai = await fakeOpenAI(message)
    try {
      const result = await openai.model
        .withStructuredOutput(routerSchema(), { name: 'extract_intents', method: method as keyof typeof calls })
        .invoke([new HumanMessage('list my tasks')])

      const request = openai.requests[0]
      const sent = method === 'functionCalling' ? request.tools?.[0].function.parameters : request.response_format?.json_schema?.schema
      assert.ok(sent && 'properties' in sent && 'intents' in (sent.properties as object), `${method} sent ${JSON.stringify(sent)}`)
      assert.deepEqual([...collectDescriptions(sent)].sort(), ['Classified intents', 'Intent category', 'Requested operation'])
      assert.deepEqual(result, JSON.parse(INTENTS))
    } finally {
      await openai.close()
    }
  }
})


test('tools built by the langchain plugin preserve zod 4 descriptions for OpenAI', async () => {
  const openai = await fakeOpenAI({ role: 'assistant', content: 'ok' })
  try {
    const [tool] = buildTools([{
      name: 'search_records',
      description: 'Search project records',
      schema: z.object({
        terms: z.string().describe('Terms to search for'),
        maxRows: z.number().optional().describe('Maximum rows'),
      }),
      func: async () => 'ok',
    }])

    const pluginModel = createOpenAIModel({
      provider: 'openai',
      model: 'gpt-5-mini',
      options: { apiKey: 'test', baseUrl: openai.baseUrl },
    })
    await pluginModel.bindTools([tool]).invoke([new HumanMessage('find records')])

    assert.equal(openai.requests[0].path, '/v1/chat/completions')

    const properties = openai.requests[0].tools?.[0].function.parameters.properties as Record<string, Record<string, unknown>>
    assert.equal(properties.terms.description, 'Terms to search for')
    assert.equal(properties.maxRows.description, 'Maximum rows')
  } finally {
    await openai.close()
  }
})

/**
 * The agent factory imports the plugin's memory, tracing and token tracking, which reach
 * `@nextsparkjs/core/lib/db` and through it the registries a built project generates. An agent
 * created without a context never queries them, so CommonJS loads receive replacements whose
 * functions throw. tsx transpiles this plugin path to CommonJS on both supported Node versions.
 */
type CommonJsModule = typeof import('node:module') & {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const commonJsModule = createRequire(import.meta.url)('node:module') as CommonJsModule

async function importAgentFactory() {
  const dbStub = Object.fromEntries(['queryWithRLS', 'mutateWithRLS', 'query']
    .map((name) => [name, () => { throw new Error(`${name} reached the database`) }]))
  class FileLogger {
    async debug() {}
    async info() {}
    async warn() {}
    async error() {}
    static async clearAll() { return 0 }
  }
  const stubs = {
    '@nextsparkjs/core/lib/db': dbStub,
    '@nextsparkjs/core/lib/utils/file-logger': { FileLogger },
  }
  const originalLoad = commonJsModule._load
  commonJsModule._load = (request, parent, isMain) => stubs[request as keyof typeof stubs]
    ?? originalLoad(request, parent, isMain)

  try {
    return await import('../../../../apps/dev/plugins/langchain/lib/agent-factory')
  } finally {
    commonJsModule._load = originalLoad
  }
}

test('the plugin agent, with a tool bound, forwards getAgent invoke and streamEvents calls to OpenAI', async () => {
  const { createAgent } = await importAgentFactory()
  const openai = await fakeOpenAI({ role: 'assistant', content: 'agent reply' })
  try {
    const created = await createAgent({
      sessionId: 'agent-types',
      systemPrompt: 'Reply with the fixture content.',
      tools: [{
        name: 'search_records',
        description: 'Search project records',
        schema: z.object({ terms: z.string().describe('Terms to search for') }),
        func: async () => 'ok',
      }],
      modelConfig: {
        provider: 'openai',
        model: 'gpt-5-mini',
        options: { apiKey: 'test', baseUrl: openai.baseUrl },
      },
    })
    const agent = created.getAgent()

    const invoked = await agent.invoke({ messages: [] })
    assert.equal(invoked.messages.at(-1)?.content, 'agent reply')

    const events = []
    for await (const event of agent.streamEvents({ messages: [] }, { version: 'v2' })) {
      events.push(event)
    }

    assert.ok(events.length > 0)
    assert.equal(openai.requests.length, 2)
    assert.ok(openai.requests.every((request) => request.path === '/v1/chat/completions'))
    assert.ok(openai.requests.every((request) => JSON.stringify(request).includes('Reply with the fixture content.')))
    for (const request of openai.requests) {
      const [tool] = request.tools ?? []
      assert.equal((tool?.function as { name?: string } | undefined)?.name, 'search_records', `sent tools ${JSON.stringify(request.tools)}`)
    }
  } finally {
    await openai.close()
  }
})
