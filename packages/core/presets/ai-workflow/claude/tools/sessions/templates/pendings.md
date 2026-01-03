# Pendientes: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Version:** v1
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD HH:MM
**Status:** Sin pendientes

---

## Resumen

**Total Pendientes:** 0
**Prioridad Alta:** 0
**Prioridad Media:** 0
**Prioridad Baja:** 0

---

## Pendientes para Futuras Iteraciones

No hay pendientes documentados para esta sesión.

---

<!--
INSTRUCCIONES PARA DOCUMENTAR PENDIENTES:

Cuando se detecte un pendiente, agregar una entrada usando el siguiente formato:

### P1: [Título del Pendiente]

**Detectado por:** [agent-name]
**Fecha:** YYYY-MM-DD
**Prioridad:** Alta / Media / Baja
**Categoría:** Feature / Bug / Refactor / Performance / Security / UX / Documentation

**Descripción:**
[Descripción detallada de qué quedó sin resolver]

**Razón para Postergar:**
[Por qué se decidió dejarlo para una futura iteración]
- [ ] Tiempo insuficiente
- [ ] Fuera del alcance actual
- [ ] Requiere decisión de producto
- [ ] Dependencia externa
- [ ] Complejidad técnica alta
- [ ] Otro: [especificar]

**Impacto de No Resolverlo:**
[Qué consecuencias tiene dejar esto pendiente]
- Funcionalidad afectada: [descripción]
- Usuarios afectados: [quiénes]
- Riesgo: [bajo/medio/alto]

**Recomendación para v[X+1]:**
[Qué se debería hacer en la siguiente iteración]
1. [Paso recomendado 1]
2. [Paso recomendado 2]
3. [Paso recomendado 3]

**Archivos Relacionados:**
- `path/to/file1.ts` - [descripción]
- `path/to/file2.tsx` - [descripción]

**Acceptance Criteria Afectados:**
- AC[X]: [descripción de cómo afecta]

---

EJEMPLO DE USO:

### P1: Implementar paginación en lista de productos

**Detectado por:** frontend-developer
**Fecha:** 2025-12-11
**Prioridad:** Media
**Categoría:** Feature

**Descripción:**
La lista de productos actualmente carga todos los items de una vez. Para datasets grandes (>100 productos), esto causa problemas de performance.

**Razón para Postergar:**
- [x] Fuera del alcance actual
- [x] Tiempo insuficiente

**Impacto de No Resolverlo:**
- Funcionalidad afectada: Lista de productos con muchos items
- Usuarios afectados: Usuarios con catálogos grandes
- Riesgo: medio

**Recomendación para v2:**
1. Implementar paginación server-side en API `/api/v1/products`
2. Agregar componente de paginación en UI
3. Implementar infinite scroll como alternativa
4. Agregar tests E2E para paginación

**Archivos Relacionados:**
- `app/api/v1/products/route.ts` - Agregar params de paginación
- `app/products/ProductList.tsx` - Agregar UI de paginación

**Acceptance Criteria Afectados:**
- AC3: "Lista debe mostrar productos" - parcialmente cumplido sin paginación

-->

---

## Historial de Sesiones

| Versión | Fecha | Pendientes Resueltos | Nuevos Pendientes |
|---------|-------|---------------------|-------------------|
| v1 | YYYY-MM-DD | N/A (primera versión) | 0 |

---

## Notas

[Notas adicionales sobre decisiones de alcance o contexto relevante]

---

**Próxima Iteración:** Si se necesita continuar con este feature, crear sesión `YYYY-MM-DD-feature-name-v2` y referenciar este archivo en el nuevo plan.

---

**Última actualización:** YYYY-MM-DD HH:MM por [agent-name]
