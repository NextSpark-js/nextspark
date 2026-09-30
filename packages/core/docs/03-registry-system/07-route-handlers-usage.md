# Route Handlers Registry: Usage

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, `nextspark prepare` generates the registries together with `src/app`.

The [Route Handlers Registry](./06-route-handlers-architecture.md) is documentation metadata about the API routes of a project. Read it through `ApiRoutesService`; nothing executes a route handler through it (project and plugin routes are route files of their own in the generated `src/app`).

## Query the routes

```typescript
import { ApiRoutesService } from '@nextsparkjs/core/lib/services'

// Every route across all categories
const all = ApiRoutesService.getAllRoutes()

// By category: 'core' | 'entity' | 'theme' | 'plugin'
const grouped = ApiRoutesService.getRoutesGroupedByCategory()

// Totals for a dashboard
const summary = ApiRoutesService.getSummary()
console.log(`${summary.totalRoutes} routes`)
```

`ApiRouteEntry` (`path`, `methods`, `category`, `source`, `subcategory`) is also exported from the same module.

## Add a route

Add a file; there is nothing to register.

```typescript
// api/orders/route.ts  ->  GET/POST /api/orders
export async function GET() {
  return Response.json({ orders: [] })
}
```

```typescript
// plugins/my-plugin/api/lookup/route.ts  ->  GET /api/plugins/my-plugin/lookup
export async function GET() {
  return Response.json({ ok: true })
}
```

Run `nextspark prepare` (or `nextspark dev`, which regenerates on changes): the route appears in `src/app` and in the registry.

## Where the old lookups went

`RouteHandlerService`, `THEME_ROUTE_HANDLERS` and `PLUGIN_ROUTE_HANDLERS` (handler lookups by route key) and the `/api/v1/theme/<theme>/**` and `/api/v1/plugin/<plugin>/**` dispatchers were removed in `0.1.0-beta.192`. `nextspark migrate` lists the project URLs that move (`/api/v1/theme/<t>/x` to `/api/x`, `/api/v1/plugin/<p>/x` to `/api/plugins/<p>/x`); see [Upgrading 0.x projects](../17-updates/06-upgrade-0x-projects.md).
