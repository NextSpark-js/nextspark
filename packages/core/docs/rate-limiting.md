# Rate Limiting en NextSpark

## Introducción

El rate limiting (limitación de tasa) es una técnica de seguridad que controla cuántas solicitudes puede hacer un usuario/IP en un período de tiempo. Protege tu aplicación contra:

- **Ataques de fuerza bruta** (intentos masivos de login)
- **Abuso de API** (scraping, spam)
- **Denegación de servicio (DoS)** (sobrecarga del servidor)

NextSpark cuenta de dos maneras independientes, y un mismo request puede contarse en las dos:

- **Por dirección de cliente y tier** (`withRateLimitTier`): protege una ruta de una misma dirección, sea quien sea el que llama.
- **Por credencial** (tier `credential`): limita lo que puede enviar una API key o una conexión MCP, venga de la dirección que venga. Ver [Límite por credencial](#límite-por-credencial-tier-credential).

No hay un contador por usuario para los requests con sesión: un request del dashboard se limita solo por el tier de la ruta, por dirección.

La referencia completa (en inglés) está en [API Rate Limiting](./05-api/07-rate-limiting.md). Este documento explica los dos modos de conteo y cómo configurar Upstash.

## Modos de Rate Limiting

NextSpark soporta dos modos de rate limiting:

### 1. In-Memory (Por defecto)

Almacena los contadores en la memoria del servidor.

**Ventajas:**
- Sin configuración adicional
- Sin costos
- Funciona inmediatamente

**Limitaciones:**
- Los contadores se reinician cuando el servidor se reinicia
- No funciona correctamente con múltiples instancias (cada servidor tiene sus propios contadores)
- Es un contador de ventana fija: se reinicia al terminar la ventana, así que permite una ráfaga en el borde entre dos ventanas

**Ideal para:**
- Desarrollo local
- Aplicaciones con un solo servidor
- Proyectos pequeños/medianos

### 2. Redis Distribuido (Upstash)

Almacena los contadores en Redis, compartidos entre todas las instancias.

**Ventajas:**
- Funciona con múltiples servidores
- Los contadores persisten entre reinicios
- Protección real contra ataques distribuidos

**Limitaciones:**
- Requiere configurar Upstash: la implementación usa solo la API REST de Upstash (`@upstash/redis`). Un Redis propio por TCP (`redis://...`) no se lee
- Hacen falta **las dos** variables, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`; con una sola no se usa Redis
- Latencia adicional por request (una consulta a Redis; no medida en el repositorio)

En este modo el algoritmo es de ventana deslizante (`Ratelimit.slidingWindow` de `@upstash/ratelimit`).

**Ideal para:**
- Producción con múltiples instancias
- Aplicaciones que escalan horizontalmente
- Requisitos de seguridad estrictos

---

## ¿Por qué necesitas Redis distribuido?

### El Problema

Imagina que tienes 3 servidores detrás de un load balancer:

```
Usuario Malicioso
       │
       ▼
 Load Balancer
   /   │   \
  ▼    ▼    ▼
 S1   S2   S3
(5)  (5)  (5)  ← Cada servidor tiene su propio contador
```

Con rate limiting in-memory:
- Límite configurado: 5 intentos de login por 15 minutos
- El atacante puede hacer 5 × 3 = **15 intentos** (5 por cada servidor)
- El rate limiting es **3 veces menos efectivo**

### La Solución

Con Redis distribuido, todos los servidores comparten el mismo contador:

```
Usuario Malicioso
       │
       ▼
 Load Balancer
   /   │   \
  ▼    ▼    ▼
 S1   S2   S3
  \    │    /
   \   │   /
    ▼  ▼  ▼
    Redis (5) ← Un solo contador compartido
```

Ahora el atacante solo puede hacer **5 intentos totales**, sin importar a qué servidor lleguen sus requests.

---

## ¿Qué es Upstash?

[Upstash](https://upstash.com) es un servicio de Redis serverless optimizado para aplicaciones edge y serverless como las desplegadas en Vercel.

**Características:**
- **Serverless**: No necesitas administrar servidores
- **HTTP API**: Funciona en edge functions (Vercel, Cloudflare)
- **Pay-per-use**: Solo pagas por lo que usas
- **Global**: Baja latencia desde cualquier región

**Alternativas:**
- Hoy no hay: el framework solo habla con la API REST de Upstash. Un Redis propio (AWS ElastiCache, DigitalOcean, etc.) usa el protocolo TCP y no está soportado sin escribir otro adaptador.

---

## Configuración

### Paso 1: Crear cuenta en Upstash

1. Ve a [upstash.com](https://upstash.com) y crea una cuenta (gratis)
2. Crea una nueva base de datos Redis
3. Selecciona la región más cercana a tu servidor

### Paso 2: Obtener credenciales

En el dashboard de Upstash, encontrarás:

```
REST URL: https://xxxx.upstash.io
REST Token: AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==
```

### Paso 3: Configurar variables de entorno

Agrega a tu `.env`:

```bash
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==
```

Las dos variables son obligatorias. Si falta una, el rate limiting sigue en memoria.

**Si creaste la base desde el Marketplace de Vercel:** Vercel crea las variables con otros nombres, `KV_REST_API_URL` y `KV_REST_API_TOKEN`. El framework lee `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, así que hay que agregar esas dos a mano con los mismos valores.

### Paso 4: Verificar

Reinicia tu aplicación. `isDistributedRateLimitAvailable()` devuelve `true` cuando las dos variables están definidas (ver [Verificar si Redis está disponible](#verificar-si-redis-está-disponible)).

---

## Tiers de Rate Limiting

NextSpark incluye estos niveles predefinidos:

| Tier | Límite | Ventana | Uso recomendado |
|------|--------|---------|-----------------|
| `auth` | 60 requests | 15 minutos | Login, registro, reset password (por dirección de cliente) |
| `authIdentifier` | 5 requests | 15 minutos | Pedir y verificar códigos, login con contraseña (por email) |
| `api` | 100 requests | 1 minuto | Endpoints de API generales |
| `strict` | 10 requests | 1 hora | Operaciones sensibles (cambio email/password) |
| `read` | 200 requests | 1 minuto | Lecturas (GET) |
| `write` | 50 requests | 1 minuto | Escrituras (POST/PUT/DELETE) |
| `webhook` | 500 requests | 1 hora | Webhooks (la firma es la defensa principal) |
| `ingest` | 1000 requests | 1 minuto | Endpoints de ingesta de alto volumen |
| `credential` | 1000 cargos (un request común es uno; una herramienta MCP generada, dos) | 1 minuto | Lo que puede enviar una API key o una conexión MCP (por credencial, no por dirección) |

El tier `auth` cobra por dirección de cliente solo los `POST` de `/api/auth/*` de una lista explícita (pedir/verificar código, login con contraseña, registro, reset de contraseña); `sign-out`, la sesión y los callbacks OAuth no se cobran. `authIdentifier` cuenta además por email en pedir y verificar código y en el login con contraseña. Ver [Sign-in routes](./05-api/07-rate-limiting.md#sign-in-routes-the-auth-and-authidentifier-tiers).

### Límite por credencial (tier `credential`)

Un request que se autentica con una API key, o con un access token de [MCP browser sign-in](./06-authentication/14-mcp-browser-sign-in.md), se cuenta además contra esa credencial: 1000 cargos por minuto por defecto. Un request común es un cargo; una llamada a una herramienta MCP generada son dos (el request MCP y el handler de la API que ejecuta), así que entran unas 500 por minuto.

- Lo aplica `credentialRateLimitResponse` (`lib/api/rate-limit.ts`), que llaman `authenticateRequest`, `validateAndAuthenticateRequest`, `validateAndAuthenticateApiRequest` y el endpoint MCP. Una ruta que autentica con alguna de ellas ya tiene el límite.
- La credencial se identifica por el id de la API key, o por la aplicación y el usuario en una conexión MCP.
- **Siempre se cuenta en el proceso, y además en Redis cuando está configurado**, de modo que todas las instancias comparten la cuenta. El request se rechaza si cualquiera de las dos cuentas está excedida.
- Sin Redis cada proceso cuenta por su lado: en serverless cada instancia le da a la credencial sus propios 1000, lo que se acerca a no tener límite.
- Si Redis falla, la verificación compartida deja pasar el request y sigue valiendo la cuenta del proceso.
- Es un tope de seguridad: `DISABLE_RATE_LIMITING=true` **no** lo apaga (esa variable apaga los límites por dirección).
- En `/api/mcp` una llamada a un tool cuenta dos veces: el request MCP y el handler de API que el tool llama dentro del proceso.
- No se aplica a los requests con sesión.

`apiKeyRateLimitResponse` es solo la mitad en memoria; se conserva para los proyectos que la llaman. Las llamadas de core usan `credentialRateLimitResponse`.

### Ajustar o agregar tiers

En `app.config.ts` podés cambiar los números de un tier existente o declarar tiers propios con `rateLimit.tiers`. Sin esta entrada, todos los tiers conservan los valores de la tabla.

```typescript
// app.config.ts
export const APP_CONFIG_OVERRIDES = {
  rateLimit: {
    tiers: {
      write: { limit: 120 },                       // solo cambia el límite; la ventana sigue en 1 minuto
      credential: { limit: 3000 },                  // lo que puede enviar una API key o una conexión MCP por minuto
      exports: { limit: 5, windowMs: 10 * 60_000 }, // tier nuevo: 5 requests cada 10 minutos
    },
  },
}
```

```typescript
export const POST = withRateLimitTier(async (req) => { /* ... */ }, 'exports')
```

- `limit` es la cantidad de requests por ventana y `windowMs` la ventana en milisegundos; ambos deben ser enteros positivos.
- Un tier existente acepta cualquiera de los dos campos; un tier nuevo necesita los dos.
- Los nombres de los tiers declarados se aceptan como tipo (`RateLimitTier`) y funcionan igual con Redis y en memoria.
- Un valor inválido o faltante nunca deja un endpoint sin límite: un tier existente conserva su valor por defecto y un tier nuevo mal declarado se limita como `api`. Lo mismo ocurre con un nombre de tier que no existe ni está declarado (por ejemplo, por un error de tipeo). En los tres casos se registra un error una vez.

---

## Uso en tu código

### Verificar rate limit

```typescript
import {
  checkDistributedRateLimit,
  createRateLimitErrorResponse
} from '@nextsparkjs/core/lib/api';

export async function POST(request: Request) {
  // Obtener identificador (IP o userId)
  // Dirección del cliente según NEXTSPARK_CLIENT_IP_SOURCE (@nextsparkjs/core/lib/api/client-ip)
  const ip = getClientIp(request.headers);

  // Verificar rate limit
  const rateLimit = await checkDistributedRateLimit(ip, 'auth');

  if (!rateLimit.allowed) {
    return createRateLimitErrorResponse(rateLimit);
  }

  // Continuar con la lógica...
}
```

### Verificar si Redis está disponible

```typescript
import { isDistributedRateLimitAvailable } from '@nextsparkjs/core/lib/api';

if (isDistributedRateLimitAvailable()) {
  console.log('Usando Redis distribuido');
} else {
  console.log('Usando rate limiting in-memory');
}
```

---

## Costos de Upstash

### Tier Gratuito
- 10,000 comandos/día
- Suficiente para ~3,000-5,000 requests con rate limiting
- Ideal para desarrollo y proyectos pequeños

### Tier Pay-as-you-go
- $0.20 por 100,000 comandos
- Sin límites mensuales
- Ideal para producción

### Ejemplo de costos

| Requests/mes | Comandos Redis* | Costo estimado |
|--------------|-----------------|----------------|
| 100,000 | ~300,000 | $0.60 |
| 500,000 | ~1,500,000 | $3.00 |
| 1,000,000 | ~3,000,000 | $6.00 |

*Cada request puede generar 2-3 comandos Redis (check + increment)

---

## Preguntas Frecuentes

### ¿Puedo usar mi propio Redis?

No sin escribir código. Upstash usa una API HTTP REST, mientras que Redis tradicional usa el protocolo TCP, y la implementación actual solo usa la primera (`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`). No se lee ninguna variable `REDIS_URL`.

### ¿Qué pasa si Upstash está caído?

El sistema "falla abierto" (fail open): si hay un error de conexión con Redis, el request se permite. Esto evita bloquear usuarios legítimos por problemas de infraestructura. El límite por credencial conserva además su cuenta en memoria, que sigue valiendo aunque Redis falle.

### ¿Los contadores se reinician al hacer deploy?

- **In-memory**: Sí, cada deploy reinicia los contadores
- **Redis**: No, los contadores persisten

### ¿Puedo cambiar los límites?

Sí: ver [Ajustar o agregar tiers](#ajustar-o-agregar-tiers).

---

## Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Necesito Upstash para desarrollo? | No |
| ¿Necesito Upstash para 1 servidor en producción? | No (pero recomendado) |
| ¿Necesito Upstash para múltiples servidores o serverless? | Sí |
| ¿Qué variables lee el framework? | `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, las dos |
| ¿El límite por API key o conexión MCP se comparte entre instancias? | Solo con Upstash configurado |
| ¿Upstash tiene tier gratuito? | Sí (10k comandos/día) |
| ¿Funciona sin configurar nada? | Sí (usa in-memory) |
