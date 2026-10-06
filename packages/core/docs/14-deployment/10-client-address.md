# Client Address

## Introduction

Rate limits, API audit logs, entity audit logs, login security notifications and CSP reports record the address of the client that sent a request. A Next.js route handler does not see the network connection, only request headers, and which header holds the real client address depends on what runs in front of the app. Set it for each deployment with `NEXTSPARK_CLIENT_IP_SOURCE`.

Every reader in core and its plugins takes the address from one helper, `getClientIp(headers)` in `@nextsparkjs/core/lib/api/client-ip`. Use it in your own routes too.

---

## The setting

| `NEXTSPARK_CLIENT_IP_SOURCE` | Reads | Use it when |
|---|---|---|
| `vercel` | `x-vercel-forwarded-for`, then `x-real-ip` | The app runs on Vercel |
| `cloudflare` | `cf-connecting-ip` | Every request reaches the app through Cloudflare |
| `xff` | `X-Forwarded-For`, the entry `NEXTSPARK_TRUSTED_PROXY_HOPS` (default `1`) places from the right | One or more proxies you run append the address they received from |
| `header:<name>` | That header only, e.g. `header:x-real-ip` (when it holds a list, its last entry) | Your proxy overwrites one header with the client address |
| `none` | Nothing: every request counts as the same client | Nothing in front of the app sets a client address |
| *(not set)* | `cf-connecting-ip`, the last `X-Forwarded-For` entry, `x-real-ip`, `true-client-ip`, in that order | Kept for existing projects; production logs a warning at startup |

Each mode reads only its own header. A header the mode does not name is ignored, whatever the client puts in it.

A value the setting does not recognize stops the rate-limited requests (they answer 500) and logs an error at startup in every environment, so a typo does not pass unnoticed. Audit rows and login notifications are still written, with the address `unknown`.

### X-Forwarded-For and hops

Each proxy that handles a request appends the address it received the request from. The client can put anything at the start of the header, so only the entries your own proxies wrote count, from the right: with one proxy the client is the last entry, with two the second to last, and so on. Set `NEXTSPARK_TRUSTED_PROXY_HOPS` to the number of proxies you run in front of the app. A request that carries fewer entries than that did not pass through every proxy, so none of its entries is trusted: it counts as `unknown`, and all such requests share one bucket.

---

## Deployment targets

### Vercel

```bash
NEXTSPARK_CLIENT_IP_SOURCE=vercel
```

Vercel sets `x-vercel-forwarded-for` and `x-real-ip` to the client address and does not forward the one a client sends. `x-vercel-forwarded-for` keeps the address Vercel saw even when another proxy sits on top of Vercel. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

### Cloudflare

```bash
NEXTSPARK_CLIENT_IP_SOURCE=cloudflare
```

Cloudflare sets `cf-connecting-ip` on every request it proxies. Make the app reachable only through Cloudflare (for example, allow only [Cloudflare's address ranges](https://www.cloudflare.com/ips/) at your firewall, or use Cloudflare Tunnel): a request that reaches the origin directly can carry any `cf-connecting-ip`. This also applies when nginx or another proxy sits between Cloudflare and the app.

### nginx (or another single reverse proxy)

Either append to `X-Forwarded-For`:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

```bash
NEXTSPARK_CLIENT_IP_SOURCE=xff
NEXTSPARK_TRUSTED_PROXY_HOPS=1
```

or overwrite one header:

```nginx
proxy_set_header X-Real-IP $remote_addr;
```

```bash
NEXTSPARK_CLIENT_IP_SOURCE=header:x-real-ip
```

Name a header that your proxy sets to a single address. Core takes the last entry of a list, but Better Auth trusts only a single address and counts requests with a list in one shared bucket; for a header your proxy appends to, use `xff`.

With a load balancer in front of nginx that also appends, set `NEXTSPARK_TRUSTED_PROXY_HOPS=2`. Make `next start` listen only where the proxy can reach it (for example `next start -H 127.0.0.1`, or a private Docker network), so no request reaches it without going through the proxy.

### Docker standalone with no proxy

```bash
NEXTSPARK_CLIENT_IP_SOURCE=none
```

Nothing in front of the app sets a client address, and the app cannot read the connection's address, so per-client limits are not possible: every request shares one bucket per rate-limit tier (Better Auth's own limit included), and audit rows record `unknown`. For per-client limits, put a reverse proxy in front (see nginx above) and set `xff` or `header:<name>`.

---

## Better Auth's own rate limit

Better Auth limits its endpoints (sign-in, sign-up, OTP, ...) on its own, reading the client address from `advanced.ipAddress.ipAddressHeaders` (default `x-forwarded-for`, trusted only when it holds a single address). With `vercel`, `cloudflare` or `header:<name>`, core passes the same headers to Better Auth. With `none`, core passes no header, so Better Auth counts every request to one of its endpoints in a shared bucket and logs a warning saying it could not determine a client address. With `xff` or nothing set, Better Auth keeps its default.

---

## Startup warning

In production, when `NEXTSPARK_CLIENT_IP_SOURCE` is not set, the server logs once at startup:

```
[client-ip] NEXTSPARK_CLIENT_IP_SOURCE is not set, so rate limits and audit logs read the client address from request headers in a fixed order. ...
```

Set the variable for your deployment to remove it. The warning is printed from `logAuthReadinessAtStartup`, which the project's `instrumentation.ts` already calls; a project whose `instrumentation.ts` does not call it sees the warning on the first request instead.
