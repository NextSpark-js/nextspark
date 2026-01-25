# UI Package Architecture (Simplified)

**Enfoque:** Solo UI. Sin entities, types, ni business logic.

---

## Pregunta Central

¿Podemos crear un paquete de UI compartido **sin romper** los imports existentes del core y themes?

**Respuesta: Sí, usando re-exports.**

---

## Estado Actual

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOY                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Theme                                                           │
│    └── import { Button } from '@nextsparkjs/core/components/ui'  │
│                           │                                      │
│                           ▼                                      │
│  Core (@nextsparkjs/core)                                        │
│    └── src/components/ui/button.tsx  (Radix + CVA)               │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Mobile App (apps/mobile-dev)                                    │
│    └── src/components/ui/button.tsx  (Pressable + CVA)           │
│         ↑                                                        │
│         └── Código duplicado, no conectado                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Problema:** Duplicación. Cambios en uno no afectan al otro.

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                       PROPUESTA                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Theme                                                           │
│    └── import { Button } from '@nextsparkjs/core/components/ui'  │
│                           │                                      │
│                           ▼  (SIN CAMBIOS - sigue funcionando)   │
│  Core (@nextsparkjs/core)                                        │
│    └── src/components/ui/button.tsx                              │
│         │                                                        │
│         └── RE-EXPORTA desde @nextsparkjs/ui                     │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  @nextsparkjs/ui (NUEVO PAQUETE)                            │ │
│  │                                                              │ │
│  │  src/                                                        │ │
│  │  ├── shared/                                                 │ │
│  │  │   └── variants/button.ts    ← CVA variants (compartido)   │ │
│  │  │                                                           │ │
│  │  ├── web/                                                    │ │
│  │  │   └── button.tsx            ← Radix implementation        │ │
│  │  │                                                           │ │
│  │  └── native/                                                 │ │
│  │      └── button.tsx            ← Pressable implementation    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  Mobile App                                                      │
│    └── import { Button } from '@nextsparkjs/ui'                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ¿Cómo Funciona el Re-Export?

### Paso 1: Core re-exporta desde @nextsparkjs/ui

```tsx
// @nextsparkjs/core/src/components/ui/button.tsx
// ANTES (actual):
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from '../../lib/utils'

const buttonVariants = cva(...)

export function Button({ ... }) {
  return <button ... />
}

// ─────────────────────────────────────────────────

// DESPUÉS (propuesto):
export { Button, buttonVariants } from '@nextsparkjs/ui'
```

**Una línea.** Eso es todo el cambio en core.

### Paso 2: Los themes NO cambian nada

```tsx
// Theme component (SIN CAMBIOS)
import { Button } from '@nextsparkjs/core/components/ui'

export function MyComponent() {
  return <Button variant="primary">Click me</Button>
}
```

Funciona exactamente igual porque core re-exporta.

### Paso 3: Mobile importa directo

```tsx
// Mobile app
import { Button } from '@nextsparkjs/ui'

export function MyScreen() {
  return <Button variant="primary" onPress={handlePress}>Click me</Button>
}
```

---

## Estructura del Paquete @nextsparkjs/ui

```
packages/ui/
├── package.json
├── tsconfig.json
│
└── src/
    │
    ├── shared/                      # 100% compartido
    │   │
    │   ├── variants/
    │   │   ├── button.ts            # CVA variants
    │   │   ├── card.ts
    │   │   ├── badge.ts
    │   │   ├── input.ts
    │   │   └── index.ts
    │   │
    │   └── utils/
    │       └── cn.ts                # clsx + tailwind-merge
    │
    ├── web/                         # Solo web
    │   ├── button.tsx               # <button> + Radix
    │   ├── card.tsx                 # <div>
    │   ├── dialog.tsx               # Radix Dialog
    │   ├── select.tsx               # Radix Select
    │   └── index.ts
    │
    └── native/                      # Solo React Native
        ├── button.tsx               # Pressable
        ├── card.tsx                 # View
        ├── dialog.tsx               # Modal
        ├── select.tsx               # Custom Modal + FlatList
        └── index.ts
```

---

## package.json con Conditional Exports

```json
{
  "name": "@nextsparkjs/ui",
  "version": "0.1.0",
  "exports": {
    ".": {
      "react-native": "./dist/native/index.js",
      "default": "./dist/web/index.js"
    },
    "./button": {
      "react-native": "./dist/native/button.js",
      "default": "./dist/web/button.js"
    },
    "./card": {
      "react-native": "./dist/native/card.js",
      "default": "./dist/web/card.js"
    },
    "./variants": "./dist/shared/variants/index.js",
    "./variants/*": "./dist/shared/variants/*.js",
    "./utils": "./dist/shared/utils/index.js"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react-native": {
      "optional": true
    }
  }
}
```

**Magia:** El bundler (webpack/metro) elige automáticamente:
- Next.js → usa `./dist/web/`
- React Native → usa `./dist/native/`

---

## Ejemplo Completo: Button

### shared/variants/button.ts (Compartido)

```ts
import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-6 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariants = typeof buttonVariants
```

### web/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../shared/utils/cn"
import { buttonVariants } from "../shared/variants/button"
import type { VariantProps } from "class-variance-authority"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

### native/button.tsx

```tsx
import { Pressable, ActivityIndicator } from "react-native"
import { cn } from "../shared/utils/cn"
import { buttonVariants } from "../shared/variants/button"
import { Text } from "./text"
import type { VariantProps } from "class-variance-authority"
import type { PressableProps } from "react-native"

export interface ButtonProps
  extends Omit<PressableProps, "children">,
    VariantProps<typeof buttonVariants> {
  className?: string
  children?: React.ReactNode
  isLoading?: boolean
}

export function Button({
  className,
  variant,
  size,
  children,
  disabled,
  isLoading,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        buttonVariants({ variant, size }),
        disabled && "opacity-50",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : typeof children === "string" ? (
        <Text className="text-primary-foreground font-medium">{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}
```

---

## Flujo de Imports (Resumen Visual)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   THEME                           MOBILE APP                     │
│     │                                  │                         │
│     │ import { Button }                │ import { Button }       │
│     │ from '@nextsparkjs/core/.../ui'  │ from '@nextsparkjs/ui'  │
│     │                                  │                         │
│     ▼                                  │                         │
│   CORE                                 │                         │
│     │                                  │                         │
│     │ export { Button }                │                         │
│     │ from '@nextsparkjs/ui'           │                         │
│     │                                  │                         │
│     └──────────────┬───────────────────┘                         │
│                    │                                             │
│                    ▼                                             │
│              @nextsparkjs/ui                                     │
│                    │                                             │
│         ┌─────────┴─────────┐                                    │
│         │                   │                                    │
│         ▼                   ▼                                    │
│     web/button.tsx    native/button.tsx                          │
│     (Radix)           (Pressable)                                │
│         │                   │                                    │
│         └─────────┬─────────┘                                    │
│                   │                                              │
│                   ▼                                              │
│         shared/variants/button.ts                                │
│         (CVA - compartido)                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Respuestas a tus Preguntas

### 1. ¿Podemos evitar el refactor del core web?

**Sí.** El único cambio en core es:

```tsx
// ANTES (muchas líneas de código)
const buttonVariants = cva(...)
export function Button() { ... }

// DESPUÉS (una línea)
export { Button, buttonVariants } from '@nextsparkjs/ui'
```

Los 64 componentes de core se convierten en 64 re-exports de una línea.

### 2. ¿Los themes siguen funcionando sin cambios?

**Sí.** Los themes importan desde core:

```tsx
import { Button } from '@nextsparkjs/core/components/ui'
```

Core re-exporta desde `@nextsparkjs/ui`, así que funciona transparente.

### 3. ¿Cómo lo importa mobile?

Directo desde el paquete:

```tsx
import { Button } from '@nextsparkjs/ui'
```

El bundler (Metro) elige automáticamente la versión `native/`.

### 4. ¿Qué se comparte realmente?

| Elemento | Compartido | Por qué |
|----------|------------|---------|
| CVA variants | ✅ 100% | Puro JS, sin dependencias de plataforma |
| cn() utility | ✅ 100% | clsx + tailwind-merge funcionan en ambos |
| Class names | ✅ ~95% | Tailwind funciona en ambos (NativeWind) |
| Componentes | ❌ 0% | Radix vs Pressable son incompatibles |

---

## Migración Incremental

No hay que migrar todo de golpe:

### Fase 1: Crear paquete con 3 componentes
```
@nextsparkjs/ui
├── shared/variants/button.ts
├── shared/variants/card.ts
├── shared/variants/badge.ts
├── web/button.tsx (mover desde core)
├── web/card.tsx
├── web/badge.tsx
├── native/button.tsx (mover desde mobile)
├── native/card.tsx
└── native/badge.tsx
```

### Fase 2: Core re-exporta esos 3
```tsx
// core/src/components/ui/button.tsx
export { Button, buttonVariants } from '@nextsparkjs/ui'

// Los otros 61 componentes siguen igual (sin cambios)
```

### Fase 3: Mobile usa el paquete
```tsx
// Antes
import { Button } from '@/src/components/ui'

// Después
import { Button } from '@nextsparkjs/ui'
```

### Fase 4-N: Migrar más componentes gradualmente

---

## Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|------------|
| Versiones desincronizadas | Monorepo con versiones lockstep |
| Performance NativeWind | Medir desde día 1, tener Restyle como plan B |
| Complejidad de build | Empezar simple (tsup/unbuild) |
| Breaking changes | Semantic versioning estricto |

---

## Conclusión

**Sí es posible** crear un paquete de UI compartido sin romper nada:

1. Core re-exporta → Themes siguen funcionando
2. Mobile importa directo → Bundler elige versión native
3. Variants compartidos → Una sola fuente de verdad para estilos
4. Migración gradual → No es todo o nada

**Lo que NO se comparte:** El código de los componentes (web usa Radix, mobile usa Pressable).

**Lo que SÍ se comparte:** Variants (CVA), utilities (cn), class names (Tailwind).
