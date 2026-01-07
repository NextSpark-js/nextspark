# NextSpark Scripts

Scripts para gestionar el ciclo de vida de los paquetes NPM de NextSpark.

## Estructura

```
scripts/
├── setup/
│   ├── local.sh        # Crear proyecto test NUEVO con .tgz locales
│   ├── npm.sh          # Crear proyecto test NUEVO con paquetes npm
│   ├── update-local.sh # Actualizar proyecto EXISTENTE con .tgz locales
│   └── claude.sh       # Configurar Claude Code symlinks
├── packages/
│   ├── version.sh      # Incrementar versiones
│   ├── pack.sh         # Crear .tgz
│   └── publish.sh      # Publicar a npm
└── README.md
```

---

## Comandos pnpm

```bash
pnpm setup:local         # Crear proyecto test NUEVO con paquetes locales
pnpm setup:npm           # Crear proyecto test NUEVO con paquetes npm
pnpm setup:update-local  # Actualizar proyecto EXISTENTE (my-app) con paquetes locales
pnpm setup:claude        # Configurar Claude Code

pnpm pkg:version         # Incrementar versiones
pnpm pkg:pack            # Empaquetar todo a .packages/
pnpm pkg:publish         # Publicar a npm
```

---

## Flujos de Uso

### 1. Flujo de Desarrollo Dual-Mode (Recomendado)

Este es el flujo estándar para desarrollar y probar cambios en modo monorepo Y npm:

```bash
# === PASO 1: Desarrollar en monorepo ===
cd repo
# Hacer cambios en packages/core, packages/cli, themes/, plugins/
pnpm dev                            # Probar en puerto 5173

# === PASO 2: Probar en proyecto npm existente (my-app) ===
pnpm setup:update-local             # Reempaqueta TODO y actualiza my-app
cd ../projects/my-app
pnpm dev                            # Probar en puerto 3000

# === PASO 3: Si funciona, publicar ===
cd ../repo
pnpm pkg:version -- patch           # Subir versión
pnpm pkg:pack
pnpm pkg:publish -- --tag latest
git add . && git commit -m "..."
```

**Puertos:**
- Monorepo (`/repo`): puerto 5173
- npm mode (`/projects/my-app`): puerto 3000

### 2. Crear Proyecto Test Nuevo (desde cero)

Para probar el wizard y setup completo:

```bash
pnpm setup:local                    # Crea proyecto en ../projects/test-local-packages
# o con opciones:
pnpm setup:local -- --preset blog   # Usar preset blog
```

### 3. Publicar Nueva Versión

```bash
# 1. Incrementar versión
pnpm pkg:version -- patch           # o minor, major, beta

# 2. Test en ambos modos
pnpm dev                            # Test monorepo
pnpm setup:update-local             # Actualiza my-app
cd ../projects/my-app && pnpm dev   # Test npm mode

# 3. Empaquetar y publicar
cd ../repo
pnpm pkg:pack
pnpm pkg:publish -- --tag latest
```

### 4. Publicar Versión Beta

```bash
pnpm pkg:version -- beta
pnpm setup:update-local             # Test en my-app
pnpm pkg:pack
pnpm pkg:publish -- --tag beta
```

### 5. Reset Total de my-app (desde npm publicado)

Cuando hay cambios en CLI/wizard o después de varios releases:

```bash
cd ../projects
rm -rf my-app
npx --yes create-nextspark-app@latest my-app
cd my-app
pnpm nextspark add:theme @nextsparkjs/theme-default
pnpm dev
```

---

## Scripts de Setup (`setup/`)

### `local.sh`

Crea proyecto test con paquetes locales `.tgz`.

```bash
./scripts/setup/local.sh [--preset <name>] [--theme <name>]

# Ejemplos:
./scripts/setup/local.sh                          # Defaults
./scripts/setup/local.sh --preset blog            # Blog preset
./scripts/setup/local.sh --preset saas --theme productivity
```

**Ubicación:** `../projects/test-local-packages/`

**Flujo interno:**
1. Limpia proyecto existente
2. Crea `.packages/`
3. Ejecuta `pack.sh --all` directo a `.packages/`
4. Crea `package.json` con `file:` references
5. Instala con pnpm
6. Ejecuta wizard CLI con flags `--name`, `--slug`, `--yes`
7. Crea `.env`
8. Build del proyecto

---

### `update-local.sh`

Actualiza un proyecto EXISTENTE con paquetes locales `.tgz`. A diferencia de `local.sh` que crea un proyecto nuevo, este script actualiza un proyecto ya inicializado (ej: `my-app` creado con npm).

```bash
./scripts/setup/update-local.sh [options]

# Opciones:
#   --target <path>    Directorio del proyecto (default: ../projects/my-app)
#   --skip-build       Saltar build de paquetes
#   --skip-install     Saltar pnpm install después de actualizar

# Ejemplos:
./scripts/setup/update-local.sh                     # Actualiza my-app
./scripts/setup/update-local.sh --skip-build        # Solo reempaquetar sin rebuild
./scripts/setup/update-local.sh --target ../projects/other-app
```

**Flujo interno:**
1. Ejecuta `pack.sh --all` para construir y empaquetar todo
2. Copia `.tgz` a `target/.packages/`
3. Actualiza `package.json` con referencias `file:`
4. Limpia `.next` cache
5. Ejecuta `pnpm install --force`

**Caso de uso principal:**
- Desarrollar en monorepo (puerto 5173)
- Ejecutar `pnpm setup:update-local`
- Probar en my-app (puerto 3000)

---

### `npm.sh`

Crea proyecto test NUEVO con paquetes publicados en npm.

```bash
./scripts/setup/npm.sh [--version <ver>] [--preset <name>] [--theme <name>]

# Ejemplos:
./scripts/setup/npm.sh                    # Última versión
./scripts/setup/npm.sh --version 1.0.0    # Versión específica
./scripts/setup/npm.sh --version beta     # Última beta
```

**Ubicación:** `../projects/test-npm-packages/`

---

### `claude.sh`

Configura Claude Code creando symlinks.

```bash
./scripts/setup/claude.sh
```

**¿Por qué es necesario?**
- Claude Code lee configuración desde `.claude/` en root
- El repo está en `/repo/`, configuración vive en `repo/.claude/`
- Este script crea symlinks para que Claude encuentre la configuración

---

## Scripts de Packages (`packages/`)

### `version.sh`

Incrementa versión de todos los paquetes.

```bash
./scripts/packages/version.sh <type> [--yes]

# Tipos: major, minor, patch, alpha, beta, rc

# Ejemplos:
./scripts/packages/version.sh patch           # Interactivo
./scripts/packages/version.sh minor --yes     # Sin confirmación
./scripts/packages/version.sh beta            # Nueva beta
```

---

### `pack.sh`

Crea archivos `.tgz` para distribución.

```bash
./scripts/packages/pack.sh [options]

# Opciones:
#   --all              Empaquetar todos
#   --package <name>   Paquete específico (repetible)
#   --output <path>    Directorio salida (default: ./.packages)
#   --skip-build       Saltar build
#   --clean            Limpiar salida primero

# Ejemplos:
./scripts/packages/pack.sh --all                    # Todo
./scripts/packages/pack.sh --all --skip-build       # Sin rebuild
./scripts/packages/pack.sh --package core           # Solo core
```

---

### `publish.sh`

Publica `.tgz` a npm.

```bash
./scripts/packages/publish.sh <dir> [options]

# Opciones:
#   --tag <tag>       Tag (default: latest)
#   --dry-run         Simular
#   --otp <code>      Código 2FA

# Ejemplos:
./scripts/packages/publish.sh ./.packages                 # Latest
./scripts/packages/publish.sh ./.packages --tag beta      # Beta
./scripts/packages/publish.sh ./.packages --dry-run       # Test
```

**Requisitos:** `npm login` y `npm login --scope=@nextsparkjs`

---

## Troubleshooting

### Error: "Email provider API key is required"
```bash
EMAIL_PROVIDER=console  # En .env
```

### Error: "NEXT_PUBLIC_ACTIVE_THEME is not set"
```bash
NEXT_PUBLIC_ACTIVE_THEME=<slug>  # En .env
```

### Error: "npm login required"
```bash
npm login
npm login --scope=@nextsparkjs
```
