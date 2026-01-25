# Plan: Integración de Mobile App en Monorepo NextSpark

## Objetivo

Integrar la aplicación móvil (Expo/React Native) en el monorepo de NextSpark, manteniéndola **fuera del workspace de pnpm** para evitar conflictos de dependencias.

---

## Estrategia Elegida

**Opción 2: `apps/mobile` dentro del repo pero FUERA del workspace pnpm**

```
nextspark/
├── apps/
│   ├── dev/           # App web de desarrollo (en workspace)
│   └── mobile/        # App móvil (FUERA del workspace)
├── packages/
├── plugins/
├── themes/
└── pnpm-workspace.yaml
```

### Razones

1. **Un solo repositorio** - Historia de git unificada, PRs que pueden incluir cambios web + mobile
2. **Deps aisladas** - Mobile tiene su propio `node_modules`, sin conflictos con Tailwind 4
3. **Metro sin problemas** - Sin symlinks de pnpm que causen issues
4. **CI/CD selectivo** - Pipelines pueden detectar cambios en `/apps/mobile`

---

## Checklist de Migración

### Fase 1: Preparación del Monorepo

- [ ] **1.1** Actualizar `pnpm-workspace.yaml` para excluir mobile explícitamente
- [ ] **1.2** Agregar scripts en root `package.json` para desarrollo mobile
- [ ] **1.3** Actualizar `.gitignore` del monorepo si es necesario
- [ ] **1.4** Documentar la estructura en el README del monorepo

### Fase 2: Copiar la Mobile App

- [ ] **2.1** Copiar contenido de `apps/mobile-dev/` a `repo/apps/mobile/`
- [ ] **2.2** Actualizar `package.json` de mobile (nombre, paths)
- [ ] **2.3** Verificar que `.gitignore` de mobile excluye `node_modules/`, `.expo/`, etc.
- [ ] **2.4** Actualizar paths en configuración si hay referencias absolutas

### Fase 3: Configuración de la App

- [ ] **3.1** Actualizar `app.config.js` con configuración correcta
- [ ] **3.2** Revisar `metro.config.js` (no debería necesitar cambios)
- [ ] **3.3** Crear/actualizar `.env.example` con variables necesarias
- [ ] **3.4** Verificar `tsconfig.json` paths

### Fase 4: CI/CD (GitHub Actions)

- [ ] **4.1** Crear workflow específico para mobile (opcional)
- [ ] **4.2** Configurar path filters para detectar cambios en `apps/mobile/`
- [ ] **4.3** Agregar step de lint/typecheck para mobile

### Fase 5: Validación

- [ ] **5.1** Instalar dependencias: `cd apps/mobile && pnpm install`
- [ ] **5.2** Iniciar app web: `pnpm start --web`
- [ ] **5.3** Verificar login y CRUD desde browser
- [ ] **5.4** Verificar team switching
- [ ] **5.5** Probar build de producción web: `pnpm run build:web`

### Fase 6: Limpieza

- [ ] **6.1** Eliminar repo/carpeta mobile-dev original (después de validar)
- [ ] **6.2** Commit final con toda la migración

---

## Cambios Detallados por Archivo

### 1. `pnpm-workspace.yaml`

```yaml
# ANTES
packages:
  - 'packages/*'
  - 'apps/*'
  - 'plugins/*'
  - 'themes/*'

# DESPUÉS
packages:
  - 'packages/*'
  - 'apps/dev'          # Explícito, solo dev
  - 'plugins/*'
  - 'themes/*'
  # apps/mobile queda FUERA del workspace intencionalmente
  # Ver: apps/mobile/.docs/09-monorepo-integration-plan.md
```

### 2. Root `package.json` - Agregar scripts

```json
{
  "scripts": {
    "dev": "pnpm --filter @nextsparkjs/dev dev",
    "build": "pnpm --filter @nextsparkjs/dev build",

    "// Mobile app (fuera del workspace)": "",
    "mobile:install": "cd apps/mobile && pnpm install",
    "mobile:start": "cd apps/mobile && pnpm start",
    "mobile:web": "cd apps/mobile && pnpm run web",
    "mobile:ios": "cd apps/mobile && pnpm run ios",
    "mobile:android": "cd apps/mobile && pnpm run android"
  }
}
```

### 3. `apps/mobile/package.json`

```json
{
  "name": "@nextspark/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build:web": "expo export --platform web",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

### 4. `apps/mobile/.gitignore`

```gitignore
# Dependencies
node_modules/

# Expo
.expo/
dist/
web-build/

# Native builds
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
ios/
android/

# Environment
.env
.env.local

# IDE
.idea/
.vscode/

# OS
.DS_Store
```

### 5. `apps/mobile/.env.example`

```env
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5173

# Optional: Enable debug logging
# EXPO_PUBLIC_DEBUG=true
```

### 6. Root `.gitignore` - Agregar si no existe

```gitignore
# Mobile app specific (apps/mobile tiene su propio .gitignore)
apps/mobile/node_modules/
apps/mobile/.expo/
apps/mobile/dist/
```

---

## Estructura Final Esperada

```
nextspark/
├── .github/
│   └── workflows/
│       ├── ci.yml           # CI principal (web)
│       └── mobile.yml       # CI mobile (opcional, futuro)
├── apps/
│   ├── dev/                 # En workspace pnpm
│   │   ├── app/
│   │   ├── package.json
│   │   └── ...
│   └── mobile/              # FUERA del workspace pnpm
│       ├── app/             # Expo Router pages
│       ├── src/
│       │   ├── components/
│       │   ├── providers/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── constants/
│       ├── .docs/           # Documentación
│       ├── .env.example
│       ├── .gitignore
│       ├── app.config.js
│       ├── metro.config.js
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── core/
│   └── cli/
├── plugins/
├── themes/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Workflow de Desarrollo

### Desarrollo Web (desde raíz)

```bash
# Instalar deps del workspace
pnpm install

# Iniciar dev server
pnpm dev
```

### Desarrollo Mobile (requiere cd)

```bash
# Opción 1: Usando scripts del root
pnpm mobile:install   # Primera vez
pnpm mobile:web       # Iniciar en browser

# Opción 2: Directamente
cd apps/mobile
pnpm install          # Primera vez
pnpm start --web      # Iniciar en browser
```

### Desarrollo Simultáneo

```bash
# Terminal 1: Web app
pnpm dev

# Terminal 2: Mobile app
cd apps/mobile && pnpm start --web
```

---

## Consideraciones Futuras

### Compartir Código entre Web y Mobile

Si en el futuro queremos compartir código (tipos, utilidades, etc.):

1. **Opción A:** Crear `packages/shared` con tipos/interfaces comunes
2. **Opción B:** Mobile puede importar de `@nextsparkjs/core` (requiere configurar Metro)
3. **Opción C:** Publicar types como paquete npm separado

Por ahora, la mobile app es standalone y no comparte código directamente.

### CI/CD para Mobile

Workflow futuro para GitHub Actions:

```yaml
# .github/workflows/mobile.yml
name: Mobile CI

on:
  push:
    paths:
      - 'apps/mobile/**'
  pull_request:
    paths:
      - 'apps/mobile/**'

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: cd apps/mobile && pnpm install
      - run: cd apps/mobile && pnpm lint
      - run: cd apps/mobile && pnpm typecheck
```

---

## Notas Importantes

1. **No correr `pnpm install` desde la raíz para mobile** - Siempre hacer `cd apps/mobile` primero
2. **El mobile app tiene su propio lockfile** - `apps/mobile/pnpm-lock.yaml`
3. **Variables de entorno separadas** - Mobile usa `EXPO_PUBLIC_*`, web usa `NEXT_PUBLIC_*`
4. **Tailwind versions diferentes** - Web usa v4, Mobile usa v3 (NativeWind)

---

## Estimación de Tiempo

| Fase | Tiempo Estimado |
|------|-----------------|
| Fase 1: Preparación | 10 min |
| Fase 2: Copiar app | 5 min |
| Fase 3: Configuración | 15 min |
| Fase 4: CI/CD | 20 min (opcional) |
| Fase 5: Validación | 15 min |
| Fase 6: Limpieza | 5 min |
| **Total** | **~1 hora** |

---

## Comando de Ejecución

Cuando estés listo para ejecutar este plan:

```
Ejecuta el plan de integración de mobile app al monorepo según .docs/09-monorepo-integration-plan.md
```
