import { StatelessJsonRpcTransport } from '@/core/lib/mcp/transport';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

function request(id: string | number, method = 'tools/list'): JSONRPCMessage {
  return { jsonrpc: '2.0', id, method } as unknown as JSONRPCMessage;
}

function response(id: string | number, result: unknown = {}): JSONRPCMessage {
  return { jsonrpc: '2.0', id, result } as unknown as JSONRPCMessage;
}

function notification(method = 'notifications/initialized'): JSONRPCMessage {
  return { jsonrpc: '2.0', method } as unknown as JSONRPCMessage;
}

describe('StatelessJsonRpcTransport', () => {
  it('throws if handleMessage is called before onmessage is wired (not connected)', async () => {
    const transport = new StatelessJsonRpcTransport();
    await expect(transport.handleMessage(request(1))).rejects.toThrow('not connected');
  });

  it('routes a request to onmessage and resolves handleMessage with the matching response', async () => {
    const transport = new StatelessJsonRpcTransport();
    transport.onmessage = (msg) => {
      const id = (msg as { id: string | number }).id;
      // Simulate the SDK server replying asynchronously via send().
      void transport.send(response(id, { ok: true }));
    };

    const result = await transport.handleMessage(request('req-1'));
    expect(result).toEqual(response('req-1', { ok: true }));
  });

  it('returns null for notifications (no id) without waiting for a response', async () => {
    const transport = new StatelessJsonRpcTransport();
    const received: JSONRPCMessage[] = [];
    transport.onmessage = (msg) => received.push(msg);

    const result = await transport.handleMessage(notification());
    expect(result).toBeNull();
    expect(received).toHaveLength(1);
  });

  it('matches responses to their pending request by id when multiple are in flight', async () => {
    const transport = new StatelessJsonRpcTransport();
    transport.onmessage = (msg) => {
      const id = (msg as { id: string | number }).id;
      // Resolve out of order: id 2 before id 1.
      if (id === 2) {
        void transport.send(response(2, { which: 2 }));
      }
    };

    const p1 = transport.handleMessage(request(1));
    const p2 = transport.handleMessage(request(2));
    const r2 = await p2;
    expect(r2).toEqual(response(2, { which: 2 }));

    // id 1 never got a send(), resolve it now to avoid an unhandled timeout.
    transport.onmessage = () => {};
    void transport.send(response(1, { which: 1 }));
    const r1 = await p1;
    expect(r1).toEqual(response(1, { which: 1 }));
  });

  it('drops a send() with no matching pending request (server-originated message) silently', async () => {
    const transport = new StatelessJsonRpcTransport();
    await expect(transport.send(response('unknown-id'))).resolves.toBeUndefined();
  });

  it('close() clears pending resolvers and calls onclose', async () => {
    const transport = new StatelessJsonRpcTransport();
    const onclose = jest.fn();
    transport.onclose = onclose;
    await transport.close();
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('send() after close() is a no-op (does not resolve a stale pending request)', async () => {
    const transport = new StatelessJsonRpcTransport();
    transport.onmessage = () => {};
    const pending = transport.handleMessage(request('req-x'));
    await transport.close();
    await transport.send(response('req-x'));
    // The request is still pending forever after close (no resolution) — verify
    // send() didn't throw and didn't resolve by racing against a manual timeout.
    const raced = await Promise.race([
      pending.then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('not-resolved'), 20)),
    ]);
    expect(raced).toBe('not-resolved');
  });

  it('handleMessage rejects with a timeout error if no response ever arrives', async () => {
    jest.useFakeTimers();
    const transport = new StatelessJsonRpcTransport();
    transport.onmessage = () => {};
    const pending = transport.handleMessage(request('req-timeout'));
    const assertion = expect(pending).rejects.toThrow('timed out');
    jest.advanceTimersByTime(30_001);
    await assertion;
    jest.useRealTimers();
  });
});
