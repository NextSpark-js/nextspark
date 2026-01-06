# NextSpark Scripts

Scripts para gestionar el ciclo de vida de los paquetes NPM de NextSpark.

## Estructura

```
scripts/
├── setup/
│   ├── local.sh      # Crear proyecto test con .tgz locales
│   ├── npm.sh        # Crear proyecto test con paquetes npm
│   └── claude.sh     # Configurar Claude Code symlinks
├── packages/
│   ├── version.sh    # Incrementar versiones
│   ├── pack.sh       # Crear .tgz
│   └── publish.sh    # Publicar a npm
└── README.md
```

---

## Comandos pnpm

```bash
pnpm setup:local      # Crear proyecto test con paquetes locales
pnpm setup:npm        # Crear proyecto test con paquetes npm
pnpm setup:claude     # Configurar Claude Code

pnpm pkg:version      # Incrementar versiones
pnpm pkg:pack         # Empaquetar todo a .packages/
pnpm pkg:publish      # Publicar a npm
```

---

## Flujos de Uso

### 1. Desarrollo Local (Iteración Rápida)

Para probar cambios locales antes de publicar:

```bash
pnpm setup:local                    # Empaqueta y crea proyecto test
# o con opciones:
pnpm setup:local -- --preset blog   # Usar preset blog
```

### 2. Publicar Nueva Versión

```bash
# 1. Incrementar versión
pnpm pkg:version -- patch           # o minor, major, beta

# 2. Test local
pnpm setup:local

# 3. Empaquetar y publicar
pnpm pkg:pack
pnpm pkg:publish -- --tag latest
```

### 3. Publicar Versión Beta

```bash
pnpm pkg:version -- beta
pnpm setup:local
pnpm pkg:pack
pnpm pkg:publish -- --tag beta
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

### `npm.sh`

Crea proyecto test con paquetes publicados en npm.

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
