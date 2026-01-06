# Plan de Implementación: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Version:** v1
**Creado por:** architecture-supervisor
**Fecha:** [YYYY-MM-DD]
**ClickUp Task:** [TASK_ID or "LOCAL_ONLY"]

---

## Referencias a Sesiones Anteriores

**Versión Actual:** v1
**Sesiones Previas:** N/A (primera versión)

<!--
Si esta es v2 o superior, documentar aquí:

**Sesión Previa:** `YYYY-MM-DD-feature-name-v1`
**Pendientes Heredados de v1:**
- [Pendiente 1 de pendings.md de sesión anterior]
- [Pendiente 2 de pendings.md de sesión anterior]

**Contexto Relevante de Sesión Anterior:**
- [Decisiones técnicas que aplican a esta versión]
- [Issues encontrados que afectan v2]
- [Lecciones aprendidas]

**Decisiones de Arquitectura Heredadas:**
- [Decisión 1 y por qué se mantiene o cambia]
- [Decisión 2 y por qué se mantiene o cambia]
-->

---

## Resumen Técnico

[Descripción de alto nivel del approach técnico - 2-3 párrafos]

**Tecnologías involucradas:**
- [Tecnología 1]
- [Tecnología 2]
- [Tecnología 3]

**Archivos principales a modificar/crear:**
- `path/to/file1.ts`
- `path/to/file2.tsx`
- `path/to/file3.ts`

---

## Fase 1: Base de Datos y Backend

### 1.1 Migraciones de Base de Datos

```sql
-- Ejemplo de migración
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- campos...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Pasos detallados:**
1. Crear archivo de migración `migrations/YYYYMMDD_feature_name.sql`
2. Definir esquema de tabla con todos los campos
3. Agregar índices necesarios para performance
4. Incluir triggers de `updated_at`
5. Ejecutar migración: `npm run db:migrate`
6. Verificar tablas: `npm run db:verify`

### 1.2 API Endpoints

**POST /api/v1/[resource]**
- Dual authentication (session + API key)
- Zod schema validation
- Error handling
- Response format estándar

**GET /api/v1/[resource]**
- Paginación (limit, offset)
- Filtros (fechas, búsqueda)
- Ordenamiento
- Include related resources

**PATCH /api/v1/[resource]/[id]**
- Validación de ownership
- Partial updates
- Audit logging

**DELETE /api/v1/[resource]/[id]**
- Soft delete si aplica
- Cascade deletes
- Authorization checks

**Pasos detallados:**
1. Crear route handler en `app/api/v1/[resource]/route.ts`
2. Implementar dual authentication middleware
3. Definir Zod schemas en `core/lib/validation/[resource].ts`
4. Implementar lógica de negocio
5. Agregar error handling comprehensivo
6. Validar responses contra estándares API

### 1.3 Tests de Backend

**Unit Tests:**
- Validation schemas
- Business logic functions
- Error handling

**Integration Tests:**
- API endpoints (200, 400, 401, 404, 500)
- Database operations
- Auth flows

**Coverage target:** 90%+ para paths críticos

---

## Fase 2: Componentes Frontend

### 2.1 UI Components

**[ComponentName] Component**
- Ubicación: `core/components/[feature]/[component-name].tsx`
- Basado en: shadcn/ui [base component]
- Props: [listar props con tipos]

**Component Tree:**
```
[ParentComponent]
├── [ChildComponent1]
│   └── [SubComponent]
├── [ChildComponent2]
└── [ChildComponent3]
```

**Pasos detallados:**
1. Crear component file con TypeScript strict mode
2. Definir Props interface completa
3. Implementar accessibility (ARIA labels, keyboard nav)
4. Usar CSS variables del theme (NO hardcoded colors)
5. Agregar data-cy attributes para E2E tests
6. Implementar error states y loading states
7. Agregar React.memo si re-renders frecuentes
8. Documentar con JSDoc

### 2.2 State Management

**Client State:**
- useState para UI state local
- useContext para cross-component state

**Server State:**
```typescript
// TanStack Query para data fetching
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetch(`/api/v1/resource/${id}`).then(res => res.json())
})
```

**Mutations:**
```typescript
const mutation = useMutation({
  mutationFn: createResource,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] })
  }
})
```

**NO usar useEffect para:**
- Data fetching (usar TanStack Query)
- Derived state (calcular durante render)
- UI state sync (usar key prop)

### 2.3 Internacionalización

**Translation Keys:**
- `feature.title` - Título principal
- `feature.description` - Descripción
- `feature.actions.create` - Botón crear
- `feature.actions.edit` - Botón editar
- `feature.actions.delete` - Botón eliminar
- `feature.validation.required` - Error de campo requerido

**Archivos a modificar:**
- `contents/themes/[ACTIVE_THEME]/messages/en.json`
- `contents/themes/[ACTIVE_THEME]/messages/es.json`

**Pasos:**
1. Agregar todas las keys de traducción
2. Usar `useTranslations('feature')` hook
3. NUNCA hardcodear texto en componentes
4. Validar que todas las keys existan en ambos idiomas

### 2.4 Tests de Frontend

**Component Tests (Jest):**
- Rendering con diferentes props
- User interactions (clicks, inputs)
- Error states
- Loading states

**E2E Tests (Cypress):**
- Complete user flows
- Form submissions
- CRUD operations
- cy.session() para auth (3-5x más rápido)

**Coverage target:** 80%+ para features importantes

---

## Fase 3: Integración y Validación

### 3.1 Integration Checklist

- [ ] Backend endpoints responden correctamente
- [ ] Frontend consume API correctamente
- [ ] Auth flow funciona (session + API key)
- [ ] Traducciones completas (en + es)
- [ ] Error handling end-to-end
- [ ] Loading states implementados
- [ ] Data persistence verificada
- [ ] Build completa sin errores: `pnpm build`

### 3.2 Performance Validation

- [ ] Bundle size impact < 100KB
- [ ] No memory leaks (verificar con DevTools)
- [ ] Queries DB optimizadas (usar EXPLAIN ANALYZE)
- [ ] Images optimizadas (Next.js Image component)
- [ ] Lazy loading implementado donde aplica

### 3.3 Security Validation

- [ ] Input sanitization (XSS prevention)
- [ ] SQL injection prevention (parameterized queries)
- [ ] CSRF token validation
- [ ] Authorization checks en todos los endpoints
- [ ] No secrets en client-side code
- [ ] Rate limiting configurado

---

## Fase 4: Plan de QA

### 4.1 Setup de Testing

**Pre-requisitos:**
1. Clear cache: `rm -rf .next`
2. Start dev server: `pnpm dev`
3. Launch Playwright browser
4. Login como: [especificar rol - superadmin/admin/member]

### 4.2 Casos de Prueba Funcionales

**CP1: [Descripción del caso]**
- **Objetivo:** Validar [qué funcionalidad]
- **Pasos:**
  1. [Paso 1]
  2. [Paso 2]
  3. [Paso 3]
- **Resultado Esperado:** [Qué debe ocurrir]
- **Criterios de Éxito:** [Métricas específicas]
- **Criterio de Aceptación relacionado:** CA1

**CP2: [Caso de error - validación negativa]**
- **Objetivo:** Validar manejo de errores
- **Pasos:**
  1. Intentar [acción inválida]
  2. [Paso 2]
- **Resultado Esperado:** Error message claro y user-friendly
- **No debe:** Exponer información sensible

[Agregar más casos de prueba según complejidad]

### 4.3 Casos de Prueba Visuales

**Desktop (1920x1080, 1366x768):**
- [ ] Layout integrity
- [ ] Component alignment
- [ ] Typography rendering
- [ ] Interactive states (hover, focus, active)
- [ ] Modal/dialog positioning

**Mobile (375x667 iPhone, 360x640 Android):**
- [ ] Responsive layout
- [ ] Touch target sizes (min 44x44px)
- [ ] Mobile navigation
- [ ] Form input experience
- [ ] Scrolling behavior

**Tablet (768px, 1024px):**
- [ ] Transition points
- [ ] Orientation changes

### 4.4 Casos de Prueba de Performance

- [ ] Página carga en < 2.5s (LCP)
- [ ] Interacciones responden en < 100ms (FID)
- [ ] No layout shift (CLS < 0.1)
- [ ] No memory leaks durante uso prolongado

### 4.5 Casos de Prueba de Seguridad

- [ ] XSS attempts bloqueados
- [ ] SQL injection attempts bloqueados
- [ ] CSRF protection working
- [ ] Unauthorized access bloqueado
- [ ] Session management seguro

---

## Notas Técnicas

### Registry Patterns

**CRITICAL:** NO usar dynamic imports para content/config loading

```typescript
// ❌ PROHIBIDO
const config = await import(`@/contents/themes/${name}`)

// ✅ CORRECTO
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
const entity = ENTITY_REGISTRY[name]
```

### Performance Considerations

**Database Indexes:**
- Index en campos de búsqueda frecuente
- Composite indexes para queries complejas
- Evitar indexes en campos con high cardinality

**React Optimization:**
- React.memo para components con re-renders frecuentes
- useCallback para functions passed como props
- useMemo para cálculos costosos
- Virtualization para listas > 100 items

### Security Best Practices

**Input Validation:**
```typescript
// Server-side validation con Zod
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().positive()
})
```

**SQL Queries:**
```typescript
// SIEMPRE usar parameterized queries
db.query('SELECT * FROM users WHERE id = $1', [userId])
// NUNCA string concatenation
```

---

## Dependencias

**NPM Packages (si aplica):**
- `package-name@version` - [propósito]

**Peer Dependencies:**
- Verificar compatibilidad con versiones existentes

---

## Rollback Plan

**Si algo falla:**
1. Revertir migración: `-- rollback migration SQL`
2. Feature flag: Deshabilitar feature
3. Rollback git: `git revert [commit-hash]`

---

## Post-Implementation

**Después de merge:**
- [ ] Monitorear logs por errores
- [ ] Validar métricas de performance
- [ ] User feedback collection
- [ ] Documentation actualizada

---

**Notas finales:**
- Este plan es una guía detallada pero flexible
- Developers pueden ajustar approach si encuentran mejor solución
- SIEMPRE comunicar cambios significativos al plan
- SIEMPRE validar con `pnpm build` antes de considerar completo
