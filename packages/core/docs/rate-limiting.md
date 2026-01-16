# Rate Limiting en NextSpark

## Introducción

El rate limiting (limitación de tasa) es una técnica de seguridad que controla cuántas solicitudes puede hacer un usuario/IP en un período de tiempo. Protege tu aplicación contra:

- **Ataques de fuerza bruta** (intentos masivos de login)
- **Abuso de API** (scraping, spam)
- **Denegación de servicio (DoS)** (sobrecarga del servidor)

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
- Requiere configurar Upstash (o Redis propio)
- Latencia mínima adicional (~1-5ms por request)

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
- Redis propio (AWS ElastiCache, DigitalOcean, etc.)
- Upstash es la opción más simple para Next.js/Vercel

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

### Paso 4: Verificar

Reinicia tu aplicación. En los logs deberías ver que el rate limiting usa Redis.

---

## Tiers de Rate Limiting

NextSpark incluye tres niveles predefinidos:

| Tier | Límite | Ventana | Uso recomendado |
|------|--------|---------|-----------------|
| `auth` | 5 requests | 15 minutos | Login, registro, reset password |
| `api` | 100 requests | 1 minuto | Endpoints de API generales |
| `strict` | 10 requests | 1 hora | Operaciones sensibles (cambio email/password) |

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
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

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

Sí, pero necesitarás modificar la configuración. Upstash usa una API HTTP REST, mientras que Redis tradicional usa el protocolo TCP. La implementación actual está optimizada para Upstash.

### ¿Qué pasa si Upstash está caído?

El sistema "falla abierto" (fail open): si hay un error de conexión con Redis, el request se permite. Esto evita bloquear usuarios legítimos por problemas de infraestructura.

### ¿Los contadores se reinician al hacer deploy?

- **In-memory**: Sí, cada deploy reinicia los contadores
- **Redis**: No, los contadores persisten

### ¿Puedo cambiar los límites?

Actualmente los límites están definidos en el código. En futuras versiones podrán configurarse via `app.config.ts`.

---

## Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Necesito Upstash para desarrollo? | No |
| ¿Necesito Upstash para 1 servidor en producción? | No (pero recomendado) |
| ¿Necesito Upstash para múltiples servidores? | Sí |
| ¿Upstash tiene tier gratuito? | Sí (10k comandos/día) |
| ¿Funciona sin configurar nada? | Sí (usa in-memory) |
