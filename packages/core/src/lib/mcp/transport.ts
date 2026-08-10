/**
 * Stateless in-memory Transport for MCP over HTTP (App Router friendly).
 *
 * The official StreamableHTTPServerTransport requires Node's
 * IncomingMessage/ServerResponse, which Next.js App Router does not expose.
 * This transport bypasses HTTP entirely: the route handler parses the
 * JSON-RPC body, feeds each message to an ephemeral McpServer through this
 * transport, and returns the collected responses as plain JSON.
 *
 * Stateless by design: one server + one transport per request, no sessions,
 * no SSE/server-push. Server-originated notifications are dropped.
 */

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

type PendingResolver = (message: JSONRPCMessage) => void

const RESPONSE_TIMEOUT_MS = 30_000

export class StatelessJsonRpcTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private pending = new Map<string | number, PendingResolver>()
  private closed = false

  async start(): Promise<void> {
    // No connection to establish: messages are pushed via handleMessage().
  }

  /** Called by the McpServer with responses (and notifications, which we drop). */
  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) return
    // A response carries an id and no method; match it to its pending request.
    const id = (message as { id?: string | number | null }).id
    if (id !== undefined && id !== null && !('method' in message)) {
      const resolve = this.pending.get(id)
      if (resolve) {
        this.pending.delete(id)
        resolve(message)
        return
      }
    }
    // Server-originated requests/notifications have no receiver in stateless mode.
  }

  async close(): Promise<void> {
    this.closed = true
    this.pending.clear()
    this.onclose?.()
  }

  /**
   * Feed one client message to the server. Resolves with the server's
   * response for requests, or null for notifications (no response expected).
   */
  async handleMessage(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    if (!this.onmessage) {
      throw new Error('Transport not connected to a server')
    }
    const isRequest = 'method' in message && 'id' in message && message.id !== null
    if (!isRequest) {
      this.onmessage(message)
      return null
    }
    const request = message as JSONRPCMessage & { id: string | number }
    return new Promise<JSONRPCMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`MCP request ${String(request.id)} timed out`))
      }, RESPONSE_TIMEOUT_MS)
      this.pending.set(request.id, (response) => {
        clearTimeout(timer)
        resolve(response)
      })
      this.onmessage!(message)
    })
  }
}
