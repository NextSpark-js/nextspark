# Architecture Analysis & Optimization Proposals

**Document Type:** Technical Analysis & Proposals
**Status:** Research Complete - Ready for Review
**Date:** January 2025

---

## Executive Summary

This document analyzes the current mobile app architecture, compares it with NextSpark Web patterns, identifies optimization opportunities, and proposes a path toward a **unified UI package** (`@nextsparkjs/ui`) that could serve both web and mobile platforms.

---

## Part 1: Current State Analysis

### 1.1 Mobile App Architecture (Current)

```
apps/mobile-dev/
├── src/components/ui/    # 13 shadcn-style primitives
├── src/lib/              # Utilities (cn, storage, alert)
├── src/hooks/            # TanStack Query hooks
├── src/providers/        # Auth, Query providers
└── src/styles/           # CSS variables + Tailwind
```

**Strengths:**
- NativeWind enables Tailwind classes in React Native
- CVA provides identical variant system to web
- cn() utility is 100% the same as web
- Component API mirrors shadcn/ui patterns

**Weaknesses:**
- Components are duplicated (web has own, mobile has own)
- No shared types between platforms
- Business logic hooks are copy-pasted with minor changes
- Theming uses different color formats (OKLCH web vs Hex mobile)

### 1.2 NextSpark Web Architecture (Core)

```
repo/packages/core/
├── src/components/ui/    # 64 shadcn/ui components (Radix-based)
├── src/lib/              # Utilities, services, config
├── src/hooks/            # TanStack Query hooks
├── src/providers/        # Plugin, Theme, Query, Translation
├── src/contexts/         # Team, Subscription, Sidebar
└── globals.css           # CSS variables (HSL/OKLCH)
```

**Key Patterns:**
- Radix UI as accessibility foundation
- CVA + cn() for styling
- Build-time registries (zero runtime I/O)
- Plugin architecture for extensibility
- Multi-tenant team context

---

## Part 2: Differences Analysis

### 2.1 Component-Level Comparison

| Component | Web (shadcn/ui) | Mobile (Custom) | Difference |
|-----------|-----------------|-----------------|------------|
| Button | `<button>` + Radix Slot | `Pressable` | Element type |
| Card | `<div>` | `View` | Element type |
| Input | `<input>` | `TextInput` | API differences |
| Dialog | Radix Dialog | RN `Modal` | Full reimplementation |
| Select | Radix Select | Custom Modal + FlatList | Full reimplementation |
| Accordion | Radix Accordion | Custom + LayoutAnimation | Full reimplementation |

**Pattern Observed:** Simple components (Button, Card, Badge) are nearly identical. Complex components (Dialog, Select, Accordion) require full reimplementation.

### 2.2 Styling System Comparison

```tsx
// Web - cn() with Tailwind
<div className={cn("rounded-xl border bg-card", className)} />

// Mobile - cn() with NativeWind (IDENTICAL!)
<View className={cn("rounded-xl border bg-card", className)} />
```

**What's Shared:**
- `cn()` function: 100% identical
- CVA variants: 100% identical
- Class names: ~95% identical
- CSS variable names: 100% identical

**What Differs:**
- Color format: OKLCH (web) vs Hex (mobile)
- Some classes: `space-y-4` → `gap-4`, `hover:` → `active:`

### 2.3 Business Logic Comparison

| Layer | Shareable? | Notes |
|-------|------------|-------|
| Types/Interfaces | 100% | Pure TypeScript |
| Validation (Zod) | 100% | Platform-agnostic |
| API client patterns | 80% | Fetch works everywhere |
| TanStack Query hooks | 80% | Same patterns, minor API diffs |
| Context patterns | 100% | React contexts work identically |
| Services (pure logic) | 100% | No platform dependencies |

---

## Part 3: Optimization Opportunities

### 3.1 Quick Wins (Low Effort, High Impact)

#### A. Extract Shared Types Package
```
packages/
  @nextsparkjs/types/
    ├── entities/     # Task, Customer, User types
    ├── api/          # Request/Response types
    └── ui/           # Component prop types
```

**Benefit:** Single source of truth for types across web + mobile.

#### B. Unify Utility Functions
```
packages/
  @nextsparkjs/utils/
    ├── cn.ts         # Class merging
    ├── format.ts     # Date, currency, etc.
    └── validation.ts # Zod schemas
```

**Benefit:** No more copy-pasting utilities.

#### C. Standardize Color Tokens
```css
/* Use HSL everywhere (web + mobile compatible) */
:root {
  --primary: 0 0% 9%;           /* HSL without function */
  --primary-foreground: 0 0% 98%;
}
```

**Benefit:** Single theming source, easier maintenance.

### 3.2 Medium-Term Improvements

#### A. Shared Hooks Package
```
packages/
  @nextsparkjs/hooks/
    ├── useAuth.ts       # Auth state management
    ├── useTeam.ts       # Team context
    ├── useEntity.ts     # Generic CRUD hook factory
    └── useTasks.ts      # Task-specific hooks
```

**Implementation:** Create platform-agnostic hooks that accept an API client as dependency injection.

```tsx
// Shared hook (platform-agnostic)
export function createTasksHooks(apiClient: ApiClient) {
  return {
    useTasks: (filters?: TaskFilters) => useQuery({
      queryKey: ['tasks', filters],
      queryFn: () => apiClient.get('/tasks', { params: filters })
    }),
    useCreateTask: () => useMutation({
      mutationFn: (data: CreateTaskInput) => apiClient.post('/tasks', data),
      onSuccess: () => queryClient.invalidateQueries(['tasks'])
    })
  }
}
```

#### B. Improve Mobile Component Structure

**Current:**
```
src/components/ui/button.tsx  # All-in-one file
```

**Proposed:**
```
src/components/ui/button/
  ├── index.ts           # Exports
  ├── button.tsx         # Component
  ├── button.variants.ts # CVA definitions (shareable!)
  └── button.types.ts    # TypeScript types (shareable!)
```

**Benefit:** Variants and types can be extracted to shared packages.

---

## Part 4: Universal UI Package Proposal

### 4.1 The Vision

Create `@nextsparkjs/ui` - a universal component library that:
- Exports the **same API** for web and mobile
- Uses **conditional imports** to load platform-specific implementations
- Shares **variants, types, and styling logic** across platforms
- Maintains **one documentation** for both platforms

### 4.2 Architecture Options

#### Option A: React Native for Web (Full Unification)

**Approach:** Use React Native primitives everywhere, compile to web with `react-native-web`.

```tsx
// Single component works on both
import { View, Text, Pressable } from 'react-native'

export function Button({ children, onPress }) {
  return (
    <Pressable className="bg-primary rounded-lg px-4 py-2" onPress={onPress}>
      <Text className="text-primary-foreground">{children}</Text>
    </Pressable>
  )
}
```

**Pros:**
- True "write once, run everywhere"
- Used by Twitter, Uber, Beatgig
- Expo has excellent support

**Cons:**
- Loses web-native semantics (`<button>`, `<input>`)
- SEO implications (renders `<div>` not `<button>`)
- Radix accessibility features lost
- Major migration for existing NextSpark web

**Verdict:** ❌ Not recommended for NextSpark (too invasive)

#### Option B: Gluestack-ui Style (Copy-Paste Universal)

**Approach:** Provide universal components as copy-paste source, not a package.

```
.claude/presets/ui/
  ├── button/
  │   ├── button.web.tsx      # shadcn/ui implementation
  │   ├── button.native.tsx   # NativeWind implementation
  │   ├── button.variants.ts  # Shared CVA variants
  │   └── button.types.ts     # Shared types
```

**Pros:**
- Maximum flexibility
- No runtime overhead
- Easy to customize

**Cons:**
- No automatic updates
- Sync issues between platforms
- More manual work

**Verdict:** ⚠️ Viable for MVP, not ideal long-term

#### Option C: Platform-Specific Exports (Recommended)

**Approach:** Single package with platform-conditional exports via `package.json` exports field.

```json
// @nextsparkjs/ui/package.json
{
  "name": "@nextsparkjs/ui",
  "exports": {
    "./button": {
      "react-native": "./dist/native/button.js",
      "default": "./dist/web/button.js"
    },
    "./card": {
      "react-native": "./dist/native/card.js",
      "default": "./dist/web/card.js"
    },
    "./variants": "./dist/shared/variants.js",
    "./types": "./dist/shared/types.js"
  }
}
```

**Package Structure:**
```
packages/ui/
├── src/
│   ├── shared/              # 100% shared code
│   │   ├── variants/        # CVA variant definitions
│   │   │   ├── button.ts
│   │   │   ├── card.ts
│   │   │   └── badge.ts
│   │   ├── types/           # TypeScript interfaces
│   │   │   ├── button.ts
│   │   │   └── common.ts
│   │   └── utils/           # cn(), formatters, etc.
│   │       └── cn.ts
│   │
│   ├── web/                 # Web implementations
│   │   ├── button.tsx       # Uses <button> + Radix
│   │   ├── card.tsx         # Uses <div>
│   │   ├── dialog.tsx       # Uses Radix Dialog
│   │   └── index.ts
│   │
│   └── native/              # React Native implementations
│       ├── button.tsx       # Uses Pressable
│       ├── card.tsx         # Uses View
│       ├── dialog.tsx       # Uses Modal
│       └── index.ts
│
├── package.json             # Conditional exports
└── tsconfig.json
```

**Pros:**
- Clean separation of concerns
- Shared logic is truly shared
- Each platform gets optimal implementation
- Same import path for developers
- Gradual migration possible

**Cons:**
- More complex build setup
- Two implementations to maintain

**Verdict:** ✅ Recommended approach

### 4.3 Shared Variants Pattern (Deep Dive)

The key insight is that **CVA variant definitions are pure JavaScript** - they have no platform dependencies.

```tsx
// packages/ui/src/shared/variants/button.ts
import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  // Base styles (work on both platforms)
  "flex-row items-center justify-center rounded-lg",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-input bg-background",
        ghost: "",
        destructive: "bg-destructive",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const buttonTextVariants = cva("font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
    },
    size: {
      default: "text-base",
      sm: "text-sm",
      lg: "text-lg",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

```tsx
// packages/ui/src/web/button.tsx
import { forwardRef } from "react"
import { Slot } from "@radix-ui/react-slot"
import { buttonVariants } from "../shared/variants/button"
import { cn } from "../shared/utils/cn"
import type { ButtonProps } from "../shared/types/button"

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
```

```tsx
// packages/ui/src/native/button.tsx
import { Pressable, ActivityIndicator } from "react-native"
import { buttonVariants, buttonTextVariants } from "../shared/variants/button"
import { cn } from "../shared/utils/cn"
import { Text } from "./text"
import type { ButtonProps } from "../shared/types/button"

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
        <ActivityIndicator />
      ) : typeof children === "string" ? (
        <Text className={cn(buttonTextVariants({ variant, size }))}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}
```

### 4.4 Developer Experience (Final State)

```tsx
// Same import, same API - works on web AND mobile!
import { Button, Card, CardHeader, CardContent, Badge } from "@nextsparkjs/ui"

function TaskCard({ task }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <Badge variant={task.priority}>{task.priority}</Badge>
      </CardHeader>
      <CardContent>
        <Text className="font-semibold">{task.title}</Text>
        <Button
          variant="outline"
          size="sm"
          onPress={() => handleEdit(task.id)}  // onPress works on web too!
        >
          Edit
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Part 5: Migration Roadmap

### Phase 1: Foundation (Week 1-2)

1. **Create `@nextsparkjs/types` package**
   - Extract all shared types from core
   - Add mobile-specific type extensions

2. **Create `@nextsparkjs/utils` package**
   - Move `cn()`, formatters, validators
   - Ensure 100% platform-agnostic

3. **Standardize CSS variables**
   - Convert OKLCH to HSL across all themes
   - Create shared `tokens.css` file

### Phase 2: Shared Variants (Week 3-4)

1. **Extract CVA variants to shared location**
   - Button, Card, Badge, Input variants
   - Create `@nextsparkjs/ui/variants` export

2. **Update web components to import shared variants**
   - No functional change, just import source

3. **Update mobile components to import shared variants**
   - Verify NativeWind compatibility

### Phase 3: Unified Package (Week 5-8)

1. **Create `@nextsparkjs/ui` package structure**
   - Set up conditional exports
   - Configure build for web + native

2. **Migrate simple components first**
   - Button, Card, Badge, Separator, Skeleton
   - These have minimal platform differences

3. **Migrate complex components**
   - Dialog, Select, Accordion
   - These need more platform-specific code

4. **Documentation**
   - Single Storybook with platform tabs
   - Usage examples for both platforms

### Phase 4: Integration (Week 9-10)

1. **Update NextSpark core to use `@nextsparkjs/ui`**
2. **Update mobile app to use `@nextsparkjs/ui`**
3. **Remove duplicate component code**
4. **Test across both platforms**

---

## Part 6: Alternative Considerations

### 6.1 Why Not Tamagui?

[Tamagui](https://tamagui.dev/) is a popular universal UI solution, but:

- **Learning curve:** New styling paradigm
- **Migration cost:** Would require rewriting all components
- **Lock-in:** Moves away from Tailwind ecosystem
- **Not needed:** We already have 95% class compatibility via NativeWind

### 6.2 Why Not Gluestack v2?

[Gluestack UI](https://gluestack.io/) is closer to our approach (uses NativeWind), but:

- **External dependency:** Adds maintenance burden
- **Customization limits:** Our components are already tailored to NextSpark
- **Existing investment:** We've already built shadcn-style primitives

### 6.3 Recommended External Libraries

For complex components we shouldn't build from scratch:

| Component | Web | Mobile | Shared Logic |
|-----------|-----|--------|--------------|
| Date Picker | `react-day-picker` | `react-native-calendars` | Date utilities |
| Rich Text | `tiptap` | `@10play/tentap-editor` | None (too different) |
| Charts | `recharts` | `victory-native` | Data transformations |
| Maps | `@react-google-maps/api` | `react-native-maps` | GeoJSON utilities |

---

## Part 7: Conclusion & Recommendations

### Immediate Actions (This Sprint)

1. **Extract shared types** - Create `src/types/shared/` in mobile app
2. **Unify variants** - Move CVA definitions to separate files
3. **Standardize colors** - Use HSL format everywhere

### Short-Term (Next 2 Sprints)

1. **Create `@nextsparkjs/utils`** - Shared utilities package
2. **Create `@nextsparkjs/types`** - Shared types package
3. **Prototype conditional exports** - Test with Button component

### Medium-Term (Next Quarter)

1. **Build `@nextsparkjs/ui`** - Full universal component library
2. **Migrate NextSpark core** - Use new package
3. **Migrate mobile app** - Use new package
4. **Single documentation** - Unified Storybook

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Shared code % | ~10% | ~60% |
| Component variants duplication | 100% | 0% |
| Type definitions duplication | 100% | 0% |
| Time to add new component (both platforms) | 2-3 days | 1 day |
| Developer onboarding (mobile) | 1 week | 2 days |

---

## Part 8: Trade-offs & Disadvantages (Honest Assessment)

### 8.1 NativeWind-Specific Limitations

#### Performance Overhead

| Metric | NativeWind v4 | twrnc | Native StyleSheet |
|--------|---------------|-------|-------------------|
| Render time | ~2x slower | Baseline | Fastest |
| Bundle size | +~50KB | +~20KB | 0KB |
| Build time | Slower (Tailwind compile) | Fast | N/A |

**Context:** NativeWind is still [faster than Styled Components and Emotion](https://www.nativewind.dev/docs/core-concepts/differences), which together represent 77% of React Native styling usage. The 2x difference vs twrnc is noticeable in benchmarks but rarely perceptible in real apps.

#### Disabled Features for Performance

NativeWind disables certain Tailwind plugins for performance:
- `textOpacity`
- `borderOpacity`
- `divideOpacity`
- `backgroundOpacity`

**Impact:** Can't use `text-black/50` syntax. Must use explicit colors or opacity utilities.

#### Static-Only Classes

```tsx
// ✅ Works - Static classes
const color = isError ? 'text-red-500' : 'text-blue-500'

// ❌ Doesn't work - Dynamic interpolation
const color = `text-${colorName}-500`
```

**Impact:** Less flexible than pure CSS Tailwind. Must pre-define all possible classes.

### 8.2 React Native vs Native Performance

| Scenario | React Native | Native (Swift/Kotlin) |
|----------|--------------|----------------------|
| Standard UI | ~95% native perf | 100% |
| Complex animations | 70-90% | 100% |
| Heavy computation | 60-80% (JS bridge) | 100% |
| 60fps scrolling | Usually achievable | Guaranteed |
| Startup time | Slower (~1-2s) | Faster (~0.5s) |
| Memory usage | Higher | Lower |

**When Native is Better:**
- High-performance games
- AR/VR applications
- Complex real-time animations
- Apps requiring <500ms startup
- Memory-constrained devices

**When React Native is Fine:**
- Business/productivity apps ✅ (our case)
- E-commerce apps
- Social media apps
- Content apps
- Internal tools

### 8.3 Architectural Trade-offs

#### Complexity Cost

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIMPLE (Current)                              │
├─────────────────────────────────────────────────────────────────┤
│  Web App → Uses @nextsparkjs/core components                     │
│  Mobile App → Uses its own components                            │
│  ✓ Clear boundaries                                              │
│  ✓ No shared build complexity                                    │
│  ✗ Duplication                                                   │
│  ✗ Sync issues                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    COMPLEX (Proposed)                            │
├─────────────────────────────────────────────────────────────────┤
│  Web App → Uses @nextsparkjs/ui (web export)                     │
│  Mobile App → Uses @nextsparkjs/ui (native export)               │
│  ✓ Single source of truth                                        │
│  ✓ Consistent DX                                                 │
│  ✗ Conditional exports complexity                                │
│  ✗ Both platforms affected by changes                            │
│  ✗ More complex CI/CD                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Risk: Lowest Common Denominator

When sharing code, you may be tempted to limit features to what works on BOTH platforms:

```tsx
// Web could do this...
<Dialog onOpenChange={handleOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>

// But mobile needs explicit state management
const [open, setOpen] = useState(false)
<Button onPress={() => setOpen(true)}>Open</Button>
<Dialog open={open} onOpenChange={setOpen}>...</Dialog>

// Shared API must use the more explicit pattern (mobile wins)
```

#### Risk: Platform-Specific Bugs

A change that works on web might break mobile:

```tsx
// Works on web, breaks on mobile
<View className="hover:bg-accent">  // No hover on mobile!

// Works on mobile, looks wrong on web
<View className="active:opacity-80">  // Web expects hover feedback
```

**Mitigation:** Strong testing on both platforms before merge.

### 8.4 Organizational Trade-offs

| Factor | Separate Codebases | Shared UI Package |
|--------|-------------------|-------------------|
| Team structure | Can be independent | Must coordinate |
| Release cycle | Independent | Coupled |
| Bug impact | Isolated | Cross-platform |
| Onboarding | Learn one platform | Learn abstraction |
| Hiring | Platform specialists | Generalists preferred |

### 8.5 When NOT to Use This Approach

❌ **Don't share UI if:**
- Mobile UX should be fundamentally different from web
- You have dedicated platform teams with no cross-training
- Performance is critical (games, real-time trading)
- You're using platform-specific features heavily (ARKit, Android Widgets)
- Mobile app is a companion, not a core product

✅ **Do share UI if:**
- Same features should exist on both platforms
- Small team needs to maintain both
- DX consistency is valued
- Business apps / productivity tools (our case)
- Faster time-to-market is priority

---

## Part 9: Industry Case Studies

### 9.1 Fuentes y Nivel de Verificación

| Nivel | Significado |
|-------|-------------|
| ✅ **Verificado** | Fuente oficial (blog de ingeniería, showcase oficial) |
| ⚠️ **Reportado** | Artículos de terceros citando la empresa |
| ❓ **No verificado** | Claim popular sin fuente primaria clara |

### 9.2 Companies Using React Native + Shared Codebases

#### Shopify ✅ VERIFICADO
- **Fuente:** [Shopify Engineering Blog](https://shopify.engineering/react-native-future-mobile-shopify)
- **Claim:** "All mobile apps at Shopify are built using React Native"
- **Code sharing verificado:**
  - Arrive app: **95%** entre iOS y Android
  - Compass app: **99%** entre iOS y Android
- **Productividad:** "2x más productivos que desarrollo nativo"
- **Listado en:** [React Native Official Showcase](https://reactnative.dev/showcase)

#### Discord ✅ VERIFICADO (pero historia más compleja)
- **Fuente:** [Discord Engineering Blog](https://discord.com/blog/supercharging-discord-mobile-our-journey-to-a-faster-app)
- **Historia real:**
  - 2022: Migraron Android **A** React Native (no al revés)
  - Usuarios se quejaron de performance
  - 2023: Redujeron startup time a la mitad
  - 2025: Habilitando New Architecture + explorando Rust
- **Métricas verificadas:**
  - 14% reducción memoria (server list)
  - 60% reducción de slow frames (chat)
  - 12% menos memoria en chat
- **NO encontré:** El claim de "98% code sharing"

#### Meta (Facebook, Instagram) ✅ VERIFICADO
- **Fuente:** [React Native Official Showcase](https://reactnative.dev/showcase)
- React Native fue creado por Meta
- Apps: Facebook, Instagram, Facebook Ads Manager, Messenger Desktop
- **No hay métricas públicas de code sharing**

#### Microsoft ✅ VERIFICADO
- **Fuente:** [React Native Official Showcase](https://reactnative.dev/showcase)
- Apps: Microsoft Office, Outlook, Teams, Xbox Game Pass
- Mantienen `react-native-windows` y `react-native-macos`
- **No hay métricas públicas de code sharing**

#### Amazon ✅ VERIFICADO
- **Fuente:** [React Native Official Showcase](https://reactnative.dev/showcase)
- Usando React Native desde 2016
- Apps: Amazon Shopping, Alexa, Photos, Kindle
- **No hay métricas públicas de code sharing**

#### Wix ✅ VERIFICADO
- **Fuente:** [React Native Official Showcase](https://reactnative.dev/showcase)
- "One of the largest React Native code bases in the world"
- Mantienen varios proyectos open source de RN
- **No hay métricas públicas de code sharing**

#### Walmart ⚠️ PARCIALMENTE VERIFICADO
- **Fuente parcial:** [Walmart Global Tech Blog](https://medium.com/walmartglobaltech/tagged/react-native)
- Tienen múltiples posts sobre React Native
- Crearon Electrode Native (open source)
- **El claim de "95% code sharing":** Aparece en múltiples artículos de terceros, pero no encontré la fuente primaria exacta en su blog
- **Verificado:** ~90% de Walmart Grocery App es React Native

#### Pinterest ⚠️ REPORTADO
- **Fuente:** Artículos de terceros
- Claim: "Prototipo iOS 10 días, Android 2 días, 100% UI shared"
- **No encontré blog oficial de Pinterest confirmando**

#### Uber Eats ⚠️ REPORTADO
- **Fuente:** Artículos de terceros y charlas de conferencias
- Claim: 3 dashboards con React Native
- **No encontré blog oficial reciente**

#### Twitter/X ❓ NO VERIFICADO
- El claim de "React Native for Web" aparece en artículos
- **No encontré fuente oficial de Twitter/X**
- Twitter Lite (PWA) usaba React, pero RN for Web es menos claro

### 9.3 ¿Qué Stack de Styling Usan Realmente? ⚠️ IMPORTANTE

**La respuesta honesta: NINGUNA de estas empresas usa NativeWind + shadcn.**

| Empresa | Stack de Styling Real | Fuente |
|---------|----------------------|--------|
| **Shopify** | [@shopify/restyle](https://github.com/Shopify/restyle) (su propia librería) | [Shopify Engineering](https://shopify.engineering/5-ways-to-improve-your-react-native-styling-workflow) |
| **Discord** | Desconocido (probablemente StyleSheet nativo o solución interna) | No hay info pública |
| **Meta** | Solución interna (ellos crearon RN) | No hay info pública |
| **Microsoft** | Desconocido | No hay info pública |
| **Wix** | Probablemente solución propia | No hay info pública |

#### ¿Qué es Shopify Restyle?

```tsx
// Restyle usa "utility props" en lugar de className
<Box
  marginTop="xl"
  padding="m"
  backgroundColor="cardBackground"
>
  <Text variant="header">Title</Text>
</Box>
```

Es similar en filosofía a Tailwind, pero:
- NO usa strings de clases (`className="mt-4"`)
- USA props tipados (`marginTop="xl"`)
- Tiene un theme system propio
- No comparte sintaxis con web Tailwind

#### ¿Quién USA NativeWind?

Según [State of React Native 2024](https://results.stateofreactnative.com/en-US/styling/):
- NativeWind creció +15% en 2024
- Popular en **startups y proyectos nuevos**
- **NO hay case studies públicos de empresas Fortune 500 usando NativeWind**

#### Implicación para Nuestra Propuesta

El approach que propuse (NativeWind + shadcn-style) es:
- ✅ Técnicamente válido
- ✅ Buena DX para equipos que conocen Tailwind
- ✅ Usado por startups y proyectos indie
- ⚠️ **NO probado a escala enterprise**
- ⚠️ **Diferente a lo que usan Shopify/Discord**

**Alternativa más conservadora:** Usar `@shopify/restyle` que SÍ está probado a escala.

### 9.4 Patrones Arquitectónicos Similares

#### Beatgig / Solito ✅ VERIFICADO
- **Fuente:** [Universal React Native](https://raf.dev/blog/universal-react-native/) (blog del creador)
- Fernando Rojo, creador de Solito
- **Pattern verificado:** Shared components, platform-specific layouts
- Startup real con este approach

#### Guild ⚠️ REPORTADO
- Mencionado en [Theodo blog](https://blog.theodo.com/2023/05/react-native-single-codebase/)
- Startup usando universal approach
- **No encontré su sitio/app para verificar estado actual**

### 9.5 Industry Statistics

| Metric | Value | Source | Verificación |
|--------|-------|--------|--------------|
| RN market share (cross-platform) | ~35% | Varios reportes | ⚠️ Varía por fuente |
| Stack Overflow ranking (2024) | 6th framework | [SO Survey](https://survey.stackoverflow.co/2024/) | ✅ Verificable |
| Apps en producción | 1000+ | RN Showcase | ✅ Verificable |

### 9.6 Conclusión sobre Fuentes

**Lo que SÍ está bien documentado:**
- Empresas como Shopify, Discord, Meta, Microsoft USAN React Native (verificado en showcase oficial)
- Shopify tiene métricas públicas de code sharing (95-99%)
- Discord tiene métricas de performance post-migración

**Lo que es más anecdótico:**
- Muchos claims de "X% code sharing" vienen de artículos de terceros
- NativeWind específicamente tiene poca documentación de adopción enterprise
- Twitter/X usando RN for Web no está bien documentado

**Implicación para NextSpark:**
Las empresas verificadas (Shopify, Discord, Wix) son **apps de productividad/commerce** similares a nuestro caso de uso. Eso es más relevante que claims no verificados de otras empresas.

---

## Part 10: Final Recommendation for NextSpark

### Our Context

| Factor | Our Situation |
|--------|---------------|
| App type | Business/Productivity SaaS |
| Team size | Small, full-stack |
| Platform priority | Web-first, mobile companion |
| Performance needs | Standard (not gaming/real-time) |
| UX consistency | High priority |
| Time-to-market | Important |

### Opciones Realistas

#### Opción A: Continuar con NativeWind (Status Quo Mejorado)
```
Pros:
✅ Ya lo implementamos y funciona
✅ DX familiar para desarrolladores Tailwind
✅ Menor curva de aprendizaje para el equipo
✅ Comparte sintaxis con web (aunque no código)

Contras:
⚠️ No probado a escala enterprise
⚠️ Menos madurez que alternativas
⚠️ El "shared UI package" sería innovación propia, no patrón probado
```

#### Opción B: Migrar a @shopify/restyle
```
Pros:
✅ Probado a escala (Shopify, apps con millones de usuarios)
✅ Mantenido por empresa grande
✅ Bien documentado
✅ Type-safe por diseño

Contras:
⚠️ Sintaxis diferente a web Tailwind
⚠️ Requiere reescribir los 13 componentes mobile
⚠️ No comparte código/sintaxis con web
⚠️ Curva de aprendizaje
```

#### Opción C: Esperar a que NativeWind madure
```
Pros:
✅ NativeWind está creciendo rápido (+15% en 2024)
✅ Gluestack v2 lo valida indirectamente
✅ Puede haber case studies enterprise pronto

Contras:
⚠️ Mientras tanto, seguimos con incertidumbre
⚠️ El ecosistema puede fragmentarse
```

### Mi Recomendación Honesta

**Para NextSpark específicamente, continuar con NativeWind** porque:

1. **Ya está implementado** - Reescribir tiene costo
2. **Mobile es companion, no core** - El riesgo es menor
3. **Equipo pequeño** - La DX de Tailwind es valiosa
4. **No necesitamos escala Shopify** - Diferentes necesidades

**PERO** con estas salvedades:

1. **No oversell el "shared UI package"** - Es aspiracional, no probado
2. **Monitorear performance** - Medir desde día 1
3. **Tener plan B** - Si NativeWind falla, Restyle es la alternativa
4. **Ser realistas** - El code sharing será ~60%, no 95%

### Lo que NO Recomiendo

❌ Invertir mucho tiempo en `@nextsparkjs/ui` universal ahora
❌ Prometer a stakeholders "write once run anywhere"
❌ Asumir que lo que funciona para Shopify funciona para nosotros

### What Pragmatic Success Looks Like

```
Hoy:                            6 meses:
├── core/ui/ (64 components)    ├── core/ui/ (web, unchanged)
├── mobile/ui/ (13 components)  ├── mobile/ui/ (NativeWind, mejorado)
└── Duplicación                 ├── shared/types/ (compartido)
                                ├── shared/hooks/ (parcialmente compartido)
                                └── shared/utils/ (cn, formatters)
```

**Meta realista:** Compartir types, hooks, y utils. NO los componentes UI.

---

## References

- [React Native for Web - Universal Apps](https://necolas.github.io/react-native-web/)
- [NativeWind - Tailwind for React Native](https://www.nativewind.dev/)
- [NativeWind Platform Differences](https://www.nativewind.dev/docs/core-concepts/differences)
- [Gluestack UI - Universal Components](https://gluestack.io/)
- [Tamagui - Universal UI](https://tamagui.dev/)
- [Solito - Universal Navigation](https://solito.dev/)
- [Expo - Universal React Platform](https://expo.dev/)
- [React Native Showcase](https://reactnative.dev/showcase)
- [State of React Native 2023](https://results.stateofreactnative.com/)
- [Companies Using React Native](https://trio.dev/companies-use-react-native/)
- [React Native Pros and Cons 2025](https://www.netguru.com/blog/react-native-pros-and-cons)
- [Universal React Native](https://raf.dev/blog/universal-react-native/)
- [Theodo - Single Codebase Analysis](https://blog.theodo.com/2023/05/react-native-single-codebase/)

---

*This document is a living analysis. Update as architecture evolves.*
