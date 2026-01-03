# DevTools API Tester

> Herramienta integrada tipo Postman para testing de APIs directamente en el navegador.

## Overview

El API Tester permite a desarrolladores probar endpoints de la API sin salir del navegador. Accesible desde DevTools > API Explorer, soporta:

- Todos los métodos HTTP (GET, POST, PATCH, PUT, DELETE)
- Path parameters con inputs dedicados
- Query parameters dinámicos
- Request body JSON con validación
- Autenticación dual (session/API key)
- **Bypass cross-team** para superadmin/developer
- Visualización de respuesta con status, timing y headers

**Ruta:** `/devtools/api/[...path]`
**Acceso:** `developer` y `superadmin`
**Ubicación:** `core/components/devtools/api-tester/`

## Uso Básico

### 1. Navegar al Endpoint

1. Ir a `/devtools/api` (API Explorer)
2. Click en cualquier endpoint de la lista
3. Se abre el API Tester con el path pre-llenado

### 2. Configurar Request

```text
┌─────────────────────────────────────────────────┐
│ ← Back to Endpoints                             │
├─────────────────────────────────────────────────┤
│ /api/v1/customers/[id]                          │
│ Source: customers | Category: entities          │
├─────────────────────────────────────────────────┤
│ Method: [GET] [POST] [PATCH] [DELETE]           │
├─────────────────────────────────────────────────┤
│ URL Preview: localhost:5173/api/v1/customers/c1 │
├─────────────────────────────────────────────────┤
│ ▼ Path Parameters                               │
│   id: [c1_____________] (required)              │
├─────────────────────────────────────────────────┤
│ ▶ Query Parameters                              │
├─────────────────────────────────────────────────┤
│ ▶ Headers                                       │
├─────────────────────────────────────────────────┤
│ ▼ Authentication                                │
│   (•) Use session  ( ) Use API key              │
│   ☑ Cross-team access                           │
├─────────────────────────────────────────────────┤
│              [ Send Request ]                   │
└─────────────────────────────────────────────────┘
```

### 3. Enviar y Ver Respuesta

```text
┌─────────────────────────────────────────────────┐
│ Response              [200 OK]     [45ms]       │
├─────────────────────────────────────────────────┤
│ [Body] [Headers]                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ {                                           │ │
│ │   "data": {                                 │ │
│ │     "id": "c1",                             │ │
│ │     "name": "Customer One"                  │ │
│ │   }                                         │ │
│ │ }                                           │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Componentes

### ApiTester

Componente principal que orquesta toda la interfaz.

**Props:**

```typescript
interface ApiTesterProps {
  route: ApiRouteEntry  // Metadata del endpoint (methods, source, subcategory)
  basePath: string      // Path original (ej: /api/v1/customers/[id])
}
```

**Archivo:** `core/components/devtools/api-tester/ApiTester.tsx`

**Estado interno:**
- `method`: HttpMethod seleccionado
- `pathParams`: PathParam[] con valores
- `queryParams`: KeyValuePair[]
- `headers`: KeyValuePair[]
- `authType`: 'session' | 'apiKey'
- `apiKey`: string
- `body`: string (JSON)
- `bypassMode`: boolean

### MethodSelector

Selector de métodos HTTP con badges de colores.

```typescript
interface MethodSelectorProps {
  methods: string[]              // Métodos disponibles del endpoint
  selected: HttpMethod           // Método actualmente seleccionado
  onSelect: (method: HttpMethod) => void
}
```

**Colores:** GET=verde, POST=azul, PATCH=amarillo, PUT=naranja, DELETE=rojo

### PathParamsEditor

Editor de path parameters extraídos del URL pattern.

```typescript
interface PathParamsEditorProps {
  params: PathParam[]                    // Params extraídos
  onChange: (params: PathParam[]) => void
}

interface PathParam {
  name: string      // "id"
  pattern: string   // "[id]" o ":id"
  value: string     // Valor ingresado
  required: boolean // Si es requerido
}
```

### KeyValueEditor

Editor reutilizable para query params y headers.

```typescript
interface KeyValueEditorProps {
  items: KeyValuePair[]
  onChange: (items: KeyValuePair[]) => void
  keyPlaceholder?: string    // Default: translation key
  valuePlaceholder?: string  // Default: translation value
  dataCyPrefix: string       // "api-tester-query" o "api-tester-headers"
}

interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean  // Checkbox para incluir/excluir
}
```

### AuthSelector

Toggle de autenticación con opción de bypass.

```typescript
interface AuthSelectorProps {
  authType: AuthType                    // 'session' | 'apiKey'
  apiKey: string
  bypassMode: boolean
  onAuthTypeChange: (type: AuthType) => void
  onApiKeyChange: (key: string) => void
  onBypassModeChange: (enabled: boolean) => void
}
```

### PayloadEditor

Editor de JSON para request body.

```typescript
interface PayloadEditorProps {
  value: string                   // JSON string
  onChange: (value: string) => void
}
```

- Solo visible para POST, PATCH, PUT
- Validación JSON en tiempo real
- Muestra error si JSON es inválido

### ResponseViewer

Visualizador de respuesta con tabs.

```typescript
interface ResponseViewerProps {
  status: RequestStatus              // 'idle' | 'loading' | 'success' | 'error' | 'cancelled'
  response: ApiResponse | null
  error: string | null
}

interface ApiResponse {
  status: number        // HTTP status code
  statusText: string    // "OK", "Not Found", etc.
  headers: Record<string, string>
  body: unknown         // Parsed JSON or text
  timing: number        // Tiempo en ms
}
```

**Status colors:** 2xx=verde, 3xx=azul, 4xx=amarillo, 5xx=rojo

## Hook: useApiRequest

Hook para ejecutar requests HTTP con AbortController.

**Archivo:** `core/components/devtools/api-tester/hooks/useApiRequest.ts`

```typescript
interface UseApiRequestResult {
  status: RequestStatus           // Estado actual
  response: ApiResponse | null    // Respuesta exitosa
  error: string | null            // Mensaje de error
  execute: (config: RequestConfig) => Promise<void>
  cancel: () => void              // Abortar request
  reset: () => void               // Volver a idle
}

interface RequestConfig {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body?: string
  authType: AuthType
  apiKey?: string
}
```

**Uso:**

```typescript
const { status, response, error, execute, cancel, reset } = useApiRequest()

// Ejecutar request
await execute({
  url: 'http://localhost:5173/api/v1/customers',
  method: 'GET',
  headers: { 'x-team-id': 'team-123' },
  authType: 'session',
})

// Cancelar si es necesario
cancel()

// Response disponible en
if (status === 'success') {
  console.log(response?.body)
  console.log(response?.timing, 'ms')
}
```

## Utilidades: url-builder

**Archivo:** `core/components/devtools/api-tester/utils/url-builder.ts`

### extractPathParams

Extrae parámetros de path de un URL pattern.

```typescript
function extractPathParams(path: string): PathParam[]

// Soporta:
// - :id (legacy)
// - [id] (Next.js App Router)
// - [...path] (catch-all)
// - [[...path]] (optional catch-all)

extractPathParams('/api/v1/customers/[id]')
// → [{ name: 'id', pattern: '[id]', value: '', required: true }]

extractPathParams('/api/v1/customers/:customerId/orders/:orderId')
// → [
//   { name: 'customerId', pattern: ':customerId', value: '', required: true },
//   { name: 'orderId', pattern: ':orderId', value: '', required: true }
// ]
```

### buildUrl

Construye URL final con parámetros.

```typescript
function buildUrl(
  basePath: string,
  pathParams: PathParam[],
  queryParams: KeyValuePair[]
): string

buildUrl(
  '/api/v1/customers/[id]',
  [{ name: 'id', pattern: '[id]', value: 'c123', required: true }],
  [{ id: '1', key: 'include', value: 'orders', enabled: true }]
)
// → '/api/v1/customers/c123?include=orders'
```

### validatePathParams

Valida que los params requeridos tengan valor.

```typescript
function validatePathParams(params: PathParam[]): string[]

validatePathParams([
  { name: 'id', pattern: '[id]', value: '', required: true }
])
// → ['Path parameter "id" is required']
```

### validateJsonBody

Valida que el body sea JSON válido.

```typescript
function validateJsonBody(body: string): string | null

validateJsonBody('{"name": "test"}')  // → null (válido)
validateJsonBody('{invalid}')          // → 'Invalid JSON format'
validateJsonBody('')                   // → null (vacío es válido)
```

## Autenticación

### Session (default)

Usa cookies de sesión del navegador.

```typescript
// En useApiRequest.ts
credentials: config.authType === 'session' ? 'include' : 'omit'
```

- Automático si el usuario está logueado
- No requiere configuración adicional

### API Key

Usa header `x-api-key`.

```typescript
// En useApiRequest.ts
if (config.authType === 'apiKey' && config.apiKey) {
  headers['x-api-key'] = config.apiKey
}
```

- Ingresar API key en el input
- Útil para testing sin sesión activa

### Cross-Team Bypass

Permite a superadmin/developer acceder a datos de cualquier team.

**Seguridad de 3 capas:**

```typescript
// core/lib/api/auth/dual-auth.ts

// Layer 1: Rol elevado
const hasElevatedRole = ['superadmin', 'developer'].includes(user.role)

// Layer 2: Header de confirmación
const bypassHeader = request.headers.get('x-admin-bypass')
const confirmed = bypassHeader === 'confirm-cross-team-access'

// Layer 3: Membresía en NextSpark Team
const isMember = await checkSystemAdminMembership(user.id)
// → user debe ser miembro de team-nextspark-001
```

**Comportamiento:**

| Bypass | x-team-id Header | Resultado |
|--------|------------------|-----------|
| OFF    | Requerido        | Acceso solo al team del header |
| ON     | Sin header       | Acceso a TODOS los teams |
| ON     | Con header       | Acceso a ese team sin validar membresía |

**En ApiTester.tsx:**

```typescript
// Auto-inject x-admin-bypass header si bypass mode está habilitado
if (bypassMode) {
  customHeaders['x-admin-bypass'] = 'confirm-cross-team-access'
}
```

## Traducciones

Namespace: `devtools.apiTester`

**Archivo:** `core/messages/{locale}/devtools.json`

```json
{
  "apiTester": {
    "backToList": "Back to Endpoints",
    "method": "HTTP Method",
    "urlPreview": "URL Preview",
    "pathParams": "Path Parameters",
    "queryParams": "Query Parameters",
    "headers": "Custom Headers",
    "headersInfo": "Content-Type is set automatically. Add custom headers below.",
    "authentication": "Authentication",
    "requestBody": "Request Body (JSON)",
    "sendRequest": "Send Request",
    "sending": "Sending...",
    "cancel": "Cancel",
    "response": "Response",
    "responseBody": "Body",
    "responseHeaders": "Headers",
    "noResponse": "Send a request to see the response",
    "auth": {
      "useSession": "Use current session",
      "useApiKey": "Use API key",
      "apiKeyPlaceholder": "Enter your API key...",
      "adminBypass": "Cross-team access",
      "adminBypassTooltip": "Enable to access data from any team. Requires membership in NextSpark Team."
    },
    "editor": {
      "keyPlaceholder": "Key",
      "valuePlaceholder": "Value",
      "addButton": "Add"
    },
    "pathParam": {
      "required": "required",
      "enterPlaceholder": "Enter {name}..."
    },
    "responseStates": {
      "idle": "Send a request to see the response",
      "loading": "Sending request...",
      "error": "An error occurred"
    }
  }
}
```

## Data-cy Selectors

| Selector | Elemento |
|----------|----------|
| `api-tester` | Contenedor principal |
| `api-tester-back-btn` | Botón volver |
| `api-tester-endpoint-info` | Card info endpoint |
| `api-tester-method-card` | Card de métodos |
| `api-tester-url-preview` | Preview de URL |
| `api-tester-send-btn` | Botón enviar |
| `api-tester-cancel-btn` | Botón cancelar |
| `api-tester-auth` | Contenedor auth |
| `api-tester-auth-type` | RadioGroup auth |
| `api-tester-auth-session` | Radio session |
| `api-tester-auth-apikey` | Radio API key |
| `api-tester-apikey-input` | Input API key |
| `api-tester-bypass-toggle` | Switch bypass |
| `api-tester-query-*` | Elementos query params |
| `api-tester-headers-*` | Elementos headers |

## Testing

### Unit Tests

**Ubicación:** `core/tests/jest/components/devtools/api-tester/`

- `url-builder.test.ts` - 71 tests
- `useApiRequest.test.ts` - 33 tests

**Ejecutar:**

```bash
pnpm test -- --testPathPattern="api-tester"
```

### E2E Tests

**Ubicación:** `contents/themes/default/tests/cypress/e2e/uat/devtools/api-tester.cy.ts`

**Ejecutar:**

```bash
pnpm cy:run --spec "**/api-tester.cy.ts"
```

## Archivos Relacionados

```text
core/components/devtools/api-tester/
├── index.ts                    # Barrel export
├── types.ts                    # TypeScript types
├── ApiTester.tsx               # Componente principal
├── MethodSelector.tsx          # Selector de métodos
├── PathParamsEditor.tsx        # Editor path params
├── KeyValueEditor.tsx          # Editor key-value
├── AuthSelector.tsx            # Selector auth + bypass
├── PayloadEditor.tsx           # Editor JSON
├── ResponseViewer.tsx          # Visor respuesta
├── hooks/
│   └── useApiRequest.ts        # Hook de fetch
└── utils/
    └── url-builder.ts          # URL utilities

app/devtools/api/
├── page.tsx                    # API Explorer (lista)
└── [...path]/
    └── page.tsx                # API Tester (detalle)
```

## Ver También

- [DevTools Overview](./03-devtools.md) - Documentación general DevTools
- [API Authentication](../06-authentication/03-api-authentication.md) - Sistema dual auth
- [Generic Entity Handler](../05-api/04-generic-entity-handler.md) - Handler de entities
