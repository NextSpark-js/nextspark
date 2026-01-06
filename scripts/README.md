# NextSpark Scripts

Scripts para gestionar el ciclo de vida de los paquetes NPM de NextSpark.

## Estructura

```
scripts/
├── setup-claude.sh           # Configurar Claude Code (symlinks)
├── utils/                    # Utilidades para gestión de paquetes
│   ├── increment-version.sh  # Incrementar versiones
│   ├── repackage.sh          # Crear archivos .tgz
│   └── publish.sh            # Publicar a npm
├── tests/                    # Scripts de testing
│   ├── local/                # Test con paquetes locales (.tgz)
│   │   ├── setup.sh          # Crear proyecto de test
│   │   └── run.sh            # Ejecutar tests
│   └── npm/                  # Test con paquetes de npm
│       ├── setup.sh          # Crear proyecto de test
│       └── run.sh            # Ejecutar tests
└── README.md                 # Esta documentación
```

---

## Flujos de Uso

### 1. Desarrollo Local (Iteración Rápida)

Para probar cambios locales antes de publicar:

```bash
# 1. Empaquetar todos los paquetes (con build)
./scripts/utils/repackage.sh --all --clean

# 2. Crear proyecto de test con paquetes locales
./scripts/tests/local/setup.sh --clean

# 3. Ejecutar tests
./scripts/tests/local/run.sh --all
```

### 2. Publicar Nueva Versión

Flujo completo para publicar a npm:

```bash
# 1. Incrementar versión (ej: patch, minor, major, beta)
./scripts/utils/increment-version.sh patch

# 2. Empaquetar todos los paquetes
./scripts/utils/repackage.sh --all --clean

# 3. Test local antes de publicar
./scripts/tests/local/setup.sh --skip-repackage --clean
./scripts/tests/local/run.sh --all

# 4. Publicar a npm (requiere login previo)
./scripts/utils/publish.sh ./dist --tag latest

# 5. Verificar publicación con paquetes de npm
./scripts/tests/npm/setup.sh --clean
./scripts/tests/npm/run.sh --all
```

### 3. Publicar Versión Beta/Alpha

```bash
# Incrementar a beta (0.1.0 → 0.1.1-beta.0)
./scripts/utils/increment-version.sh beta

# Empaquetar y publicar con tag beta
./scripts/utils/repackage.sh --all --clean
./scripts/utils/publish.sh ./dist --tag beta
```

---

## Scripts de Utilidades (`utils/`)

### `increment-version.sh`

Incrementa la versión de todos los paquetes del monorepo.

```bash
./scripts/utils/increment-version.sh <type> [--yes]

# Tipos disponibles:
#   major    1.0.0 → 2.0.0
#   minor    1.0.0 → 1.1.0
#   patch    1.0.0 → 1.0.1
#   alpha    1.0.0 → 1.0.1-alpha.0
#   beta     1.0.0 → 1.0.1-beta.0
#   rc       1.0.0 → 1.0.1-rc.0

# Ejemplos:
./scripts/utils/increment-version.sh patch           # Interactivo
./scripts/utils/increment-version.sh minor --yes    # Sin confirmación
./scripts/utils/increment-version.sh beta           # Nueva versión beta
```

**Paquetes actualizados:**
- `packages/core`
- `packages/cli`
- `packages/create-nextspark-app`
- `themes/*`
- `plugins/*`

---

### `repackage.sh`

Crea archivos `.tgz` para distribución.

```bash
./scripts/utils/repackage.sh [options]

# Opciones:
#   --all              Empaquetar todos los paquetes
#   --package <name>   Empaquetar paquete específico (repetible)
#   --output <path>    Directorio de salida (default: ./dist)
#   --skip-build       Saltar build (usar código existente)
#   --clean            Limpiar directorio de salida primero

# Nombres de paquetes válidos:
#   core, cli, create-app, theme-*, plugin-*

# Ejemplos:
./scripts/utils/repackage.sh --all                    # Todo
./scripts/utils/repackage.sh --all --skip-build       # Sin rebuild
./scripts/utils/repackage.sh --package core           # Solo core
./scripts/utils/repackage.sh --package core --package cli  # Core y CLI
./scripts/utils/repackage.sh --all --output /tmp/dist     # Output custom
```

**Orden de empaquetado** (respeta dependencias):
1. `@nextsparkjs/core`
2. `@nextsparkjs/cli`
3. `create-nextspark-app`
4. Themes (`@nextsparkjs/theme-*`)
5. Plugins (`@nextsparkjs/plugin-*`)

---

### `publish.sh`

Publica paquetes `.tgz` a npm.

```bash
./scripts/utils/publish.sh <packages-dir> [options]

# Opciones:
#   --tag <tag>       Tag de distribución (default: latest)
#   --dry-run         Simular sin publicar
#   --otp <code>      Código 2FA de npm
#   --no-cleanup      No borrar .tgz después de publicar
#   --registry <url>  Registry personalizado

# Tags comunes: latest, beta, alpha, next, rc

# Ejemplos:
./scripts/utils/publish.sh ./dist                     # Publicar como latest
./scripts/utils/publish.sh ./dist --tag beta          # Publicar como beta
./scripts/utils/publish.sh ./dist --dry-run           # Test sin publicar
./scripts/utils/publish.sh ./dist --otp 123456        # Con código 2FA
./scripts/utils/publish.sh ./dist --registry http://localhost:4873  # Verdaccio
```

**Requisitos:**
- `npm login` previo
- Para scoped packages: `npm login --scope=@nextsparkjs`

---

## Scripts de Testing (`tests/`)

### `local/setup.sh`

Crea un proyecto de test usando paquetes locales `.tgz`.

```bash
./scripts/tests/local/setup.sh [options]

# Opciones:
#   --skip-repackage    Usar .tgz existentes (no rebuild)
#   --preset <name>     Preset a usar (default: saas)
#   --theme <name>      Theme a usar (default: default)
#   --clean             Eliminar proyecto existente primero

# Ejemplos:
./scripts/tests/local/setup.sh                        # Setup completo
./scripts/tests/local/setup.sh --skip-repackage       # Sin rebuild
./scripts/tests/local/setup.sh --preset blog --clean  # Blog preset, limpio
```

**Ubicación del proyecto:** `../projects/test-local-packages/`

**Flujo interno:**
1. Ejecuta `utils/repackage.sh --all` (si no `--skip-repackage`)
2. Crea directorio del proyecto
3. Copia `.tgz` a `.packages/`
4. Crea `package.json` con referencias `file:./packages/*.tgz`
5. Instala con pnpm (usa paquetes locales)
6. Ejecuta wizard CLI local con flags `--name`, `--slug`, `--description`
7. Crea `.env` con variables necesarias
8. Build del proyecto

---

### `local/run.sh`

Ejecuta tests en el proyecto local.

```bash
./scripts/tests/local/run.sh [options]

# Opciones:
#   --unit    Ejecutar tests unitarios (Jest)
#   --e2e     Ejecutar tests E2E (Cypress)
#   --all     Ejecutar todos los tests
#   --build   Rebuild antes de tests

# Ejemplos:
./scripts/tests/local/run.sh --all
./scripts/tests/local/run.sh --unit
./scripts/tests/local/run.sh --e2e --build
```

---

### `npm/setup.sh`

Crea un proyecto de test usando paquetes publicados en npm.

```bash
./scripts/tests/npm/setup.sh [options]

# Opciones:
#   --version <ver>   Versión a usar (default: latest)
#   --preset <name>   Preset a usar (default: saas)
#   --theme <name>    Theme a usar (default: default)
#   --clean           Eliminar proyecto existente primero

# Ejemplos:
./scripts/tests/npm/setup.sh                          # Última versión
./scripts/tests/npm/setup.sh --version 1.0.0          # Versión específica
./scripts/tests/npm/setup.sh --version beta           # Última beta
./scripts/tests/npm/setup.sh --preset blog --clean    # Blog, limpio
```

**Ubicación del proyecto:** `../projects/test-npm-packages/`

---

### `npm/run.sh`

Ejecuta tests en el proyecto npm.

```bash
./scripts/tests/npm/run.sh [options]

# Opciones: igual que local/run.sh
```

---

## Comandos Claude Code

Los scripts tienen comandos Claude Code equivalentes en `.claude/commands/`:

| Script | Comando Claude |
|--------|----------------|
| `increment-version.sh` | `/npm:version` |
| `repackage.sh` | `/npm:repackage` |
| `publish.sh` | `/npm:publish` |
| `tests/local/*` | `/npm:test-local` |
| `tests/npm/*` | `/npm:test-npm` |

---

## Setup Script

### `setup-claude.sh`

Configura Claude Code creando symlinks desde el directorio root `.claude/` hacia `repo/.claude/`.

**¿Por qué es necesario?**
- Claude Code lee la configuración desde `.claude/` en el root del proyecto
- El repositorio git está en `/repo/`, por lo que la configuración real vive en `repo/.claude/`
- Este script crea symlinks para que Claude Code encuentre la configuración

```bash
./repo/scripts/utils/setup-claude.sh

# Salida:
# Setting up Claude Code configuration...
# Project root: /path/to/nextspark
#   Linked: README.md
#   Linked: agents
#   Linked: commands
#   Linked: config
#   Linked: sessions
#   Linked: settings.local.json
#   Linked: skills
#   Linked: tools
```

**Cuándo ejecutarlo:**
- Después de clonar el repositorio
- Después de un `git clean` o reset del directorio root
- El script es idempotente (puede ejecutarse múltiples veces)

**Estructura resultante:**
```
nextspark/
├── .claude/                    # Symlinks (creados por setup-claude.sh)
│   ├── commands → ../repo/.claude/commands
│   ├── skills → ../repo/.claude/skills
│   └── ...
└── repo/
    └── .claude/                # Archivos reales (versionados en git)
        ├── commands/
        ├── skills/
        └── ...
```

---

## Troubleshooting

### Error: "Email provider API key is required"

Configura `EMAIL_PROVIDER=console` en `.env` del proyecto de test.

### Error: "NEXT_PUBLIC_ACTIVE_THEME is not set"

El setup.sh crea automáticamente el `.env`. Si falla, asegúrate de tener:
```env
NEXT_PUBLIC_ACTIVE_THEME=<slug-del-proyecto>
```

### Error: "npm login required"

```bash
npm login
npm login --scope=@nextsparkjs  # Para paquetes scoped
```

### pnpm install falla con "permission denied"

Los scripts usan `file:` references que requieren acceso de lectura a los `.tgz`.
```bash
chmod 644 .packages/*.tgz
```
