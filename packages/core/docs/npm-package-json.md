# @nextspark/core package.json

Este archivo documenta la estructura del package.json cuando NextSpark
se publique como paquete npm.

## Propósito

Cuando NextSpark se publique a npm como `@nextspark/core`, este será el
package.json que defina cómo se consume el paquete.

## Estructura Completa

```json
{
  "name": "@nextspark/core",
  "version": "0.1.0",
  "description": "NextSpark - Complete SaaS framework for Next.js with authentication, billing, and multi-tenancy",
  "keywords": [
    "nextjs",
    "saas",
    "boilerplate",
    "framework",
    "authentication",
    "billing",
    "multi-tenancy"
  ],
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./next": "./next.js",
    "./config": "./lib/config/index.ts",
    "./lib/*": "./lib/*",
    "./components/*": "./components/*",
    "./hooks/*": "./hooks/*",
    "./providers/*": "./providers/*"
  },
  "bin": {
    "nextspark": "./bin/nextspark.mjs"
  },
  "scripts": {
    "postinstall": "node ./scripts/setup/npm-postinstall.mjs",
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  },
  "files": [
    "dist",
    "lib",
    "components",
    "hooks",
    "providers",
    "scripts",
    "templates",
    "bin",
    "next.js",
    "README.md",
    "LICENSE"
  ],
  "peerDependencies": {
    "next": ">=15.0.0",
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0"
  },
  "dependencies": {
    "chokidar": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/nextspark"
  },
  "bugs": {
    "url": "https://github.com/yourusername/nextspark/issues"
  },
  "homepage": "https://nextspark.dev",
  "license": "MIT",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  }
}
```

## Campos Clave

### `name`

`@nextspark/core` - El nombre del paquete en npm. El scope `@nextspark` permite
tener múltiples paquetes relacionados en el futuro (ej: `@nextspark/auth`,
`@nextspark/billing`).

### `type`

`"module"` - Indica que este paquete usa ES modules (ESM) en lugar de CommonJS.
Todos los archivos .js se interpretan como ESM.

### `main` y `types`

- `main`: Punto de entrada principal para imports desde JavaScript
- `types`: Archivo de tipos TypeScript para intellisense

```typescript
// Cuando alguien hace:
import { something } from '@nextspark/core'
// Se resuelve a: ./dist/index.js
```

### `exports`

Define los puntos de entrada públicos del paquete. Solo estos paths están
disponibles para importar.

```typescript
// Permitido:
import { something } from '@nextspark/core'
import { withNextSpark } from '@nextspark/core/next'
import { defineConfig } from '@nextspark/core/config'
import Button from '@nextspark/core/components/ui/button'
import { useAuth } from '@nextspark/core/hooks/use-auth'

// NO permitido (no está en exports):
import internal from '@nextspark/core/internal/something'
```

### `bin`

Define comandos CLI que se instalan globalmente.

```bash
# Después de instalar el paquete, estos comandos están disponibles:
npx nextspark dev
npx nextspark build
npx nextspark generate
```

El campo `bin.nextspark` apunta a `./bin/nextspark.mjs`.

### `scripts.postinstall`

Se ejecuta automáticamente después de `npm install @nextspark/core`.

```bash
# Cuando un usuario ejecuta:
npm install @nextspark/core

# npm ejecuta automáticamente:
node ./scripts/setup/npm-postinstall.mjs
```

Este script:
1. Detecta si existe `nextspark.config.ts` en el proyecto
2. Si existe, ejecuta setup automático (registries, theme, app generation)
3. Si no existe, no hace nada (instalación como dependencia transitiva)

### `files`

Define qué archivos/directorios se incluyen cuando se publica a npm.

```
@nextspark/core
├── dist/               # Código TypeScript compilado
├── lib/                # Código fuente TypeScript (para imports directos)
├── components/         # Componentes React
├── hooks/              # React hooks
├── providers/          # React providers
├── scripts/            # Scripts de build (registry, theme, etc.)
├── templates/          # Templates para /app generation
├── bin/                # CLI entry point
├── next.js             # Next.js wrapper
├── README.md
└── LICENSE
```

**Nota:** No se incluyen archivos de configuración del proyecto actual
(tsconfig.json, .env, etc.) ni archivos de desarrollo (.git, node_modules).

### `peerDependencies`

Dependencias que el proyecto del usuario DEBE tener instaladas.

```json
{
  "peerDependencies": {
    "next": ">=15.0.0",
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0"
  }
}
```

NextSpark no instala estas dependencias automáticamente. El usuario debe
tenerlas en su proyecto. npm/pnpm mostrará una advertencia si faltan.

**Razón:** Evita conflictos de versión y duplicación de paquetes grandes.

### `dependencies`

Dependencias que NextSpark necesita para funcionar.

```json
{
  "dependencies": {
    "chokidar": "^5.0.0"
  }
}
```

Estas se instalan automáticamente con el paquete.

**Nota:** En el futuro, cuando tengamos `ejs` para templates, también iría aquí.

## Flujo de Instalación

Cuando un usuario instala NextSpark:

```bash
# 1. Usuario ejecuta
npm install @nextspark/core

# 2. npm instala el paquete + dependencies
# 3. npm ejecuta postinstall hook automáticamente
# 4. postinstall hook:
#    - Busca nextspark.config.ts
#    - Si existe: genera registries, theme, app structure
#    - Si no existe: sale silenciosamente
```

## Ubicación en Monorepo

Cuando se implemente la estructura de monorepo:

```
packages/
└── core/
    ├── package.json          # Este archivo
    ├── tsconfig.json         # Config TypeScript para el paquete
    ├── lib/                  # Código fuente
    ├── components/
    ├── hooks/
    ├── scripts/
    ├── templates/
    └── bin/
```

## Publicación a NPM

```bash
# Desde packages/core/

# 1. Build TypeScript to dist/
pnpm build

# 2. Verify what will be published
npm pack --dry-run

# 3. Publish to npm
npm publish --access public
```

## Versionado Semántico

NextSpark sigue [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

```bash
# Incrementar versión
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0

# Publish nueva versión
npm publish
```

## Notas Importantes

1. **NO modificar este archivo directamente** - Es documentación de referencia
   para la futura publicación a npm.

2. **package.json actual del proyecto** - Ubicado en la raíz del proyecto,
   sigue siendo el que se usa durante desarrollo.

3. **Migración a monorepo** - En el futuro, el código se moverá a
   `packages/core/` y este será su package.json real.

4. **TypeScript compilation** - Antes de publicar, el código TypeScript se
   compila a JavaScript en `dist/`.

5. **Template files** - Los archivos .ejs en `templates/` se incluyen en el
   paquete para que el CLI pueda generar el directorio `/app`.

## Referencias

- [npm package.json](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [package.json exports](https://nodejs.org/api/packages.html#exports)
- [npm bin](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bin)
- [Peer Dependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#peerdependencies)
