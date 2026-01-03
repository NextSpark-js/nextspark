# Admin-Only Endpoints

## Overview

Algunos endpoints están diseñados exclusivamente para superadmins (dueños del producto). Estos endpoints permiten acceso a datos globales del sistema, no limitados por team isolation.

## Endpoints Administrativos

### 1. Users Management

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/api/v1/users` | GET | Lista todos los usuarios del sistema | `role: superadmin` |
| `/api/v1/users` | POST | Crear nuevo usuario | `role: superadmin` |

**Validación de permisos:**
```typescript
import { hasAdminPermission } from '@/core/lib/api/auth/permissions'

// En el endpoint:
if (!hasAdminPermission(authResult, 'users:read')) {
  return createApiError('Insufficient permissions. Superadmin access required.', 403)
}
```

### 2. Teams Management

El endpoint `/api/v1/teams` **NO es admin-only**. Lista los teams del usuario autenticado.

**Comportamiento actual:**
- GET `/api/v1/teams` → Lista teams donde el usuario es miembro
- Filtra por `team_members.userId = authenticated_user_id`
- Accesible por cualquier usuario autenticado

**Para listar TODOS los teams del sistema (futuro):**
- Crear endpoint específico: `/api/v1/admin/teams`
- O agregar query param: `/api/v1/teams?scope=all` (requiere `role: superadmin`)

### 3. API Keys Management

El endpoint `/api/v1/api-keys` **NO es admin-only**. Cada usuario gestiona sus propias keys.

**Comportamiento actual:**
- GET `/api/v1/api-keys` → Lista API keys del usuario autenticado
- Filtra por `api_key.userId = authenticated_user_id`
- Accesible por cualquier usuario autenticado

## Implementación

### Helper Function

```typescript
import { hasAdminPermission } from '@/core/lib/api/auth/permissions'

// En el endpoint:
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createApiError('Authentication required', 401)
  }

  // Validar permisos de superadmin
  if (!hasAdminPermission(authResult, 'users:read')) {
    return createApiError('Insufficient permissions. Superadmin access required.', 403)
  }

  // ... implementación del endpoint
}
```

### Diferencia con Team-Scoped Endpoints

| Tipo | Ejemplo | Quién puede acceder |
|------|---------|---------------------|
| Admin-Only | `/api/v1/users` | Solo superadmin |
| Team-Scoped | `/api/v1/teams/[id]/members` | Miembros del team |
| User-Scoped | `/api/v1/api-keys` | El propio usuario |

## Códigos de Error

| Código | Mensaje | Cuándo |
|--------|---------|--------|
| 401 | Authentication required | No hay sesión/API key |
| 403 | Superadmin access required | Usuario no es superadmin |

## Security Best Practices

1. **Siempre usar hasAdminPermission()** - No reimplementar la lógica
2. **Validar tanto sesión como API key** - El helper maneja ambos casos
3. **Mensajes de error claros** - "Superadmin access required" (no revelar detalles)
4. **Logging de intentos fallidos** - Para auditoría de seguridad

## Testing

### Unit Tests

```typescript
import { isSuperAdmin, hasAdminPermission } from '@/core/lib/api/auth/permissions'

describe('Admin Authentication', () => {
  it('should allow superadmin session', () => {
    const authResult = {
      success: true,
      type: 'session',
      user: { id: '1', role: 'superadmin', email: 'admin@test.com' }
    }
    expect(hasAdminPermission(authResult)).toBe(true)
  })

  it('should reject normal user', () => {
    const authResult = {
      success: true,
      type: 'session',
      user: { id: '1', role: 'member', email: 'user@test.com' }
    }
    expect(hasAdminPermission(authResult)).toBe(false)
  })
})
```

### Manual Testing

**Escenario 1: Usuario normal intenta acceder**
```bash
# Login como usuario con role: member
curl -X GET http://localhost:5173/api/v1/users \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json"

# Resultado esperado: 403 Insufficient permissions. Superadmin access required.
```

**Escenario 2: Superadmin accede**
```bash
# Login como usuario con role: superadmin
curl -X GET http://localhost:5173/api/v1/users \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json"

# Resultado esperado: 200 con lista de todos los usuarios
```

**Escenario 3: API Key de usuario normal**
```bash
# API key con scope users:read de usuario normal
curl -X GET http://localhost:5173/api/v1/users \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json"

# Resultado esperado: 403 Insufficient permissions. Superadmin access required.
```

**Escenario 4: API Key de superadmin**
```bash
# API key con scope users:read de superadmin
curl -X GET http://localhost:5173/api/v1/users \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json"

# Resultado esperado: 200 con lista de usuarios
```

## Migration Notes

**Phase 3 Security Update:**
- Agregado validación de superadmin en `/api/v1/users` (GET y POST)
- Creado helper `hasAdminPermission()` centralizado
- Implementada doble validación: role + scope (para API keys)
- Tests de seguridad agregados en `core/tests/jest/api/admin-auth.test.ts`

**Antes de Phase 3:**
- Cualquier sesión podía acceder a `/api/v1/users` (vulnerabilidad)
- Solo API keys tenían validación de scopes

**Después de Phase 3:**
- Solo superadmins pueden acceder (sesión o API key)
- Validación unificada con `hasAdminPermission()`
