---
name: frontend-design
description: |
  Create distinctive, production-grade frontend interfaces with high design quality.
  Use this skill when building UI, designing screens, or reviewing visual quality.
  ORCHESTRATOR: Loads premium-ux-patterns + premium-ui-design + mobile-ux-design as needed.
  Covers implementation patterns for animations, micro-interactions, Framer Motion,
  Lottie, Reanimated, and the complete premium design philosophy.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Frontend Design (Orchestrator)

This is the **master skill** for creating premium, production-grade interfaces.
It orchestrates three specialized sub-skills and provides implementation guidance.

**When invoked, ALWAYS read the relevant sub-skills based on the platform:**

```
SKILL LOADING MATRIX:
──────────────────────────────────────────────────
Task                         | Load These Skills
──────────────────────────────────────────────────
Web dashboard UI             | premium-ui-design + premium-ux-patterns
Mobile app screen            | ALL THREE skills
Mobile web responsive        | premium-ui-design + mobile-ux-design
Landing page                 | premium-ui-design + premium-ux-patterns
Design review/audit          | ALL THREE skills
Component library work       | premium-ui-design
Animation/interaction work   | premium-ux-patterns + mobile-ux-design
──────────────────────────────────────────────────
```

---

## When to Use This Skill

- Building any new UI screen (web or mobile)
- Reviewing existing UI for quality improvements
- Implementing animations and micro-interactions
- Converting a "functional" interface to a "premium" one
- Designing empty states, loading states, error states
- Optimizing user flows for retention
- Creating a new design system or theme
- Any task where visual quality matters

---

## Core Philosophy: The 10x Better Framework

A premium interface is NOT about adding more features. It's about:

1. **Removing friction** (cognitive load reduction)
2. **Adding delight** at peak moments (Peak-End Rule)
3. **Being consistent** (one icon library, one spacing system, one color system)
4. **Anticipating needs** (smart defaults, personalization)
5. **Feeling physical** (spring animations, haptic feedback)

```
THE PREMIUM PYRAMID:
                    ▲
                   /│\
                  / │ \
                 /  │  \   DELIGHT
                / Peak  \  (animations, celebrations,
               /  moments \  branded loading)
              /───────────\
             /             \   POLISH
            /  Consistency   \  (spacing, typography, color,
           /   & refinement   \  icon consistency, dark mode)
          /───────────────────\
         /                     \   FOUNDATION
        /    Clarity & Flow     \  (hierarchy, navigation,
       /    (zero friction)      \  readable content, clear CTAs)
      /───────────────────────────\
```

---

## Sub-Skills Reference

### premium-ux-patterns
**Focus:** Psychology and behavior
- Peak-End Rule implementation
- Cognitive load reduction techniques
- Personalization by user tier (new/returning/power)
- Smart search design (before, during, zero results)
- Post-action experience (timelines, humanization)
- Empty state design (illustration + CTA)
- Category page visual rhythm
- Smart input selection (slider vs keyboard)
- Halo Effect (first 50ms impression)
- Conversion patterns (pricing, data viz, landing pages)
- Toast & notification patterns (timing, placement, stacking)
- Form validation UX (inline, on-blur, positive feedback)
- Onboarding progressive disclosure (checklists, gamification)
- Optimistic UI & perceived performance (instant feel)
- Error recovery UX (retry, graceful degradation, offline)

### premium-ui-design
**Focus:** Visual rules and technical design
- 4-layer color system (neutrals, accent scale, semantic, data viz)
- OKLCH color space for perceptual uniformity in charts
- Typography discipline (max 4 sizes, monospace for numbers, line height, max width)
- 8pt grid spacing system
- Shadow and gradient discipline (tinted shadows)
- Iconography rules (single library, state differentiation)
- Dark mode rules (double-distance, elevation = lighter, OKLCH token swap)
- Corner radius math (nested subtraction rule)
- Visual hierarchy and card optimization
- Layout cleanup (sidebar, modals vs flyouts, responsive data tables)
- Focus state design and accessibility (WCAG 2.2)
- `prefers-reduced-motion` support
- Fluid typography with CSS clamp()
- Eliminating "AI-generated" look

### mobile-ux-design
**Focus:** Mobile-specific patterns
- Bottom navigation anatomy (3-5 items, safe areas, 44px tap targets)
- Haptic feedback system (light/medium/heavy hierarchy)
- Thumb-zone ergonomics
- Page transitions and spring animations
- Mobile form design (keyboard types, multi-step)
- Sheet patterns (bottom sheets over modals)
- Splash screen and onboarding
- Loading states (skeleton screens)
- Responsive web → mobile adaptation
- Illustration and mascot system
- Performance & frame rate (FlatList optimization, Reanimated, 120Hz)
- Keyboard management (auto-advance, KeyboardAwareScrollView)

---

## Implementation Patterns

### Web (Next.js + shadcn/ui + Tailwind)

#### Animations with Framer Motion

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// Page transition wrapper
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Staggered list animation
export function StaggeredList({ items }: { items: any[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05
          }
        }
      }}
    >
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          {/* item content */}
        </motion.div>
      ))}
    </motion.div>
  )
}

// Hover scale for interactive cards
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
  <Card>...</Card>
</motion.div>
```

#### Button Press Animation

```tsx
// Premium button with scale + loading state
export function PremiumButton({ children, loading, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      disabled={loading}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </motion.div>
        ) : (
          <motion.span
            key="text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
```

#### Skeleton Loading (shadcn pattern)

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
```

#### Empty State Component

```tsx
import Lottie from 'lottie-react'
import emptyAnimation from '@/assets/animations/empty-search.json'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  animation
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {animation && (
        <Lottie
          animationData={animation}
          loop
          className="w-48 h-48 mb-6"
        />
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

### Mobile (React Native + Expo + Reanimated)

#### Spring Animations

```tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated'

// Press feedback
export function AnimatedPressable({ children, onPress, style }) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
```

#### Success Animation Sequence

```tsx
import Animated, {
  withDelay,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

export function useSuccessAnimation() {
  const checkScale = useSharedValue(0)
  const bgOpacity = useSharedValue(0)
  const textOpacity = useSharedValue(0)

  const play = () => {
    // Step 1: Background fade
    bgOpacity.value = withTiming(1, { duration: 200 })
    // Step 2: Checkmark bounces in
    checkScale.value = withDelay(200,
      withSpring(1, { damping: 12, stiffness: 200 })
    )
    // Step 3: Text fades in
    textOpacity.value = withDelay(500,
      withTiming(1, { duration: 300 })
    )
    // Step 4: Haptic feedback
    runOnJS(Haptics.notificationAsync)(
      Haptics.NotificationFeedbackType.Success
    )
  }

  return { checkScale, bgOpacity, textOpacity, play }
}
```

#### Lottie Empty States (React Native)

```tsx
import LottieView from 'lottie-react-native'

export function EmptyState({ title, subtitle, animation, onAction }) {
  return (
    <View style={styles.container}>
      <LottieView
        source={animation}
        autoPlay
        loop
        style={{ width: 200, height: 200 }}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onAction && (
        <AnimatedButton onPress={onAction.handler}>
          {onAction.label}
        </AnimatedButton>
      )}
    </View>
  )
}
```

---

## AI-Assisted Animation Workflow

When building complex animations (confetti, multi-step celebrations, page transitions with multiple elements), **NEVER try to generate the entire animation in a single prompt**. Break it into incremental sub-steps.

### The Incremental Approach

```
ANIMATION DECOMPOSITION:
──────────────────────────────────────────────────
Complex Animation Goal: "Booking confirmation celebration"
──────────────────────────────────────────────────
Step 1: Static layout (all elements visible, no motion)
Step 2: Fade-in for background overlay
Step 3: Scale-in for checkmark icon (spring physics)
Step 4: Text entrance with stagger
Step 5: Confetti particle system
Step 6: Auto-dismiss with fade-out after 3s
──────────────────────────────────────────────────
Each step = one prompt to Claude Code. Test each before adding the next.
```

### Why This Works

- **Debugging:** If step 3 breaks, you know exactly where the issue is
- **Iteration:** You can refine timing/easing per step without rewriting everything
- **Quality:** Each sub-animation gets proper attention (spring config, duration, easing)
- **Composability:** Steps become reusable animation hooks

### Implementation Pattern

```tsx
// Step 1: Create individual animation hooks
function useCheckmarkAnimation() { /* spring scale 0→1 */ }
function useTextFadeIn() { /* opacity 0→1 with delay */ }
function useConfetti() { /* particle system */ }

// Step 2: Compose them into a sequence
function useBookingConfirmation() {
  const checkmark = useCheckmarkAnimation()
  const text = useTextFadeIn()
  const confetti = useConfetti()

  const play = () => {
    checkmark.play()           // 0ms
    text.play(200)             // 200ms delay
    confetti.play(400)         // 400ms delay
  }

  return { checkmark, text, confetti, play }
}
```

### Prompt Template for Claude Code

When requesting animation generation, use this structure:

```
"Create [specific animation] for [component].
- Physics: spring with damping [X], stiffness [Y]
- Duration: [Z]ms
- Trigger: [event]
- Platform: [web/mobile/both]
- Do NOT add other animations yet — just this one step."
```

---

## AI-Assisted Illustration & Mascot Workflow

For creating consistent illustration systems (empty states, onboarding, error pages), use AI image generation with a **base illustration anchor**.

### The Base Illustration Method

```
MASCOT/ILLUSTRATION WORKFLOW:
──────────────────────────────────────────────────
1. Create ONE base illustration (hand-drawn or AI-generated)
   → This becomes the "style anchor"

2. Feed base to AI (DALL-E, Midjourney) with variation prompts:
   → "Same character, now searching with magnifying glass"
   → "Same character, sleeping on a cloud"
   → "Same character, celebrating with confetti"

3. Clean up outputs for consistency:
   → Match line weight, color palette, proportions
   → Export as SVG or transparent PNG

4. Animate with Rive or Lottie:
   → Simple: Lottie (breathing, floating, blinking)
   → Interactive: Rive (responds to user actions)
──────────────────────────────────────────────────
```

### Variation Contexts for a SaaS App

| Context | Illustration Mood | Usage |
|---------|------------------|-------|
| Empty list | Character looking around, curious | No data yet |
| Empty search | Character with magnifying glass | No results found |
| Success | Character celebrating, jumping | Task completed |
| Error | Character confused, scratching head | Something went wrong |
| Loading | Character working, building | Processing |
| Onboarding | Character waving, welcoming | First-time user |
| Sleeping/Idle | Character resting | No recent activity |

### Tool Selection: Lottie vs Rive

```
LOTTIE:
├── Best for: Pre-defined animations (loop, play once)
├── Workflow: After Effects → Bodymovin plugin → .json
├── Web: lottie-react
├── Mobile: lottie-react-native
└── Limitation: No interactivity, file can be large

RIVE:
├── Best for: Interactive, state-driven animations
├── Workflow: Rive editor → .riv file
├── Web: @rive-app/react-canvas
├── Mobile: rive-react-native
└── Advantage: Tiny files, responds to user input
```

### When to Use Which

- **Lottie:** Empty states, loading indicators, celebration moments, onboarding slides
- **Rive:** Interactive mascots, animated toggles, game-like UI elements, drag feedback

### Free Lottie Resources

- **LottieFiles** (lottiefiles.com) — Largest library of free Lottie animations
- **IconScout** — Animated icons and illustrations
- Search terms: "empty state", "success", "loading", "search", "error", "celebration"

---

## Design Review Checklist

When reviewing ANY UI (web or mobile), check against these categories:

### Foundation (Must Pass)
- [ ] Clear visual hierarchy — eye knows where to go
- [ ] Single primary action per screen
- [ ] Consistent spacing (8pt grid)
- [ ] No hardcoded user-facing strings (i18n)
- [ ] Accessible contrast ratios (4.5:1 for text, 3:1 for large text)

### Polish (Should Pass)
- [ ] Max 4 font sizes across entire app
- [ ] Single icon library, single weight
- [ ] Proper shadow discipline (subtle or none)
- [ ] No multi-hue gradients
- [ ] Dark mode follows elevation = lighter rule
- [ ] Dynamic numbers use tabular-nums/monospace
- [ ] Nested corner radius follows subtraction rule

### Delight (Aspire To)
- [ ] Peak moment has celebration animation
- [ ] End moment has summary/progress
- [ ] Loading states use skeletons or branded animation
- [ ] Empty states have illustration + CTA
- [ ] Spring physics for all interactive animations
- [ ] Haptic feedback on significant mobile actions
- [ ] Hover states on all interactive web elements
- [ ] Page transitions between views
- [ ] Staggered entrance animations for lists
- [ ] Buttons use state machine (idle/loading/success/error)
- [ ] Images use LQIP blur-up placeholders
- [ ] Scroll snap on carousels/onboarding screens
- [ ] Toast notifications with proper timing/placement
- [ ] Form validation inline on blur with positive feedback
- [ ] Optimistic UI updates for mutations (instant feel)
- [ ] Prefetching on hover/focus for links and data
- [ ] Shared element transitions for list→detail navigation
- [ ] Scroll-linked reveal animations for content sections
- [ ] Choreographed stagger on list/grid entrance

### Performance (Must Pass)
- [ ] INP < 200ms on all interactive elements (test with web-vitals)
- [ ] Animations use only `transform` + `opacity` (compositor-only)
- [ ] Heavy filters/search use `useTransition` / `startTransition`
- [ ] List items wrapped in `React.memo` (prevents O(n) re-renders)
- [ ] Long lists virtualized (react-window or tanstack-virtual)
- [ ] Heavy client components use `next/dynamic` with loading fallback
- [ ] LCP < 2.5s and CLS < 0.1 (check with Lighthouse)

### Accessibility (Must Pass)
- [ ] Focus indicators visible on all interactive elements
- [ ] `prefers-reduced-motion` disables/reduces animations
- [ ] Modals trap focus and use `aria-modal` + `inert`
- [ ] Color contrast meets WCAG 2.2 AA (4.5:1 text, 3:1 large)
- [ ] Touch targets minimum 44px (mobile) or 24px (desktop)

### Mobile-Specific (If Applicable)
- [ ] Bottom nav: 3-5 items, 44px tap targets, safe area respected
- [ ] Filled vs outline icons for active/inactive states
- [ ] Haptic feedback hierarchy (light/medium/heavy)
- [ ] Keyboard types match input context
- [ ] Primary actions in thumb-easy zone

---

## Scroll Behavior Patterns

### Sticky Headers

```css
/* Sticky header that shrinks on scroll */
.header {
  position: sticky;
  top: 0;
  z-index: 40;
  transition: height 200ms ease, padding 200ms ease;
}

/* Use CSS scroll-state() for Chrome 133+ (no JS needed) */
@container scroll-state(stuck: top) {
  .header { height: 48px; padding: 4px 16px; }
}
```

### Scroll Snap (Carousels, Onboarding)

```css
/* Horizontal scroll snap for card carousels */
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch; /* iOS momentum */
}

.carousel-item {
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* Account for sticky header in vertical snap */
.section-snap {
  scroll-snap-type: y proximity;
  scroll-padding-top: 64px; /* = header height */
}
```

### Smooth Scroll Anchors

```css
html {
  scroll-behavior: smooth;
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

---

## Image Loading & Perceived Speed

### LQIP (Low-Quality Image Placeholder)

Show a tiny blurred image while the full image loads:

```tsx
// Next.js Image with blur placeholder (built-in)
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..." // 16x16 base64
  priority // For hero/above-the-fold images
/>
```

### Image Format Fallback Chain

```
PRIORITY: AVIF > WebP > JPEG
──────────────────────────────────────
AVIF:  Best compression, smallest files
WebP:  Wide support, good compression
JPEG:  Universal fallback
──────────────────────────────────────
```

Next.js `<Image>` handles this automatically. For manual `<picture>`:

```html
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" />
</picture>
```

### Hero Image Optimization

- Use `fetchpriority="high"` for above-the-fold hero images
- Use `loading="lazy"` for everything below the fold
- Serve responsive sizes via `srcset` and `sizes`

---

## Modal & Dialog Accessibility

### Focus Trap Pattern

When a modal opens, keyboard focus MUST be trapped inside it:

```tsx
// With shadcn/ui Dialog (uses Radix — handles this automatically)
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

// Manual implementation checklist:
// 1. On open: move focus to first focusable element (or dialog itself)
// 2. Tab/Shift+Tab cycles within dialog only
// 3. Escape key closes dialog
// 4. On close: return focus to trigger element
// 5. Background content is inert (aria-hidden or HTML inert attribute)
```

### Required ARIA Attributes

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Deletion</h2>
  <p id="dialog-description">This action cannot be undone.</p>
  {/* ... */}
</div>
```

### Background Inert

```tsx
// HTML inert attribute (modern browsers)
// When dialog is open, add inert to the main content
<main inert={isDialogOpen}>
  {/* Page content — not focusable, not clickable */}
</main>
<Dialog open={isDialogOpen}>
  {/* Dialog content */}
</Dialog>
```

---

## Button State Machine

Buttons should communicate their state clearly at every moment:

```
BUTTON STATE MACHINE:
──────────────────────────────────────
idle → hover → pressed → loading → success/error → idle
                           ↓
                        disabled (during loading)
──────────────────────────────────────
```

### Implementation

```tsx
type ButtonState = 'idle' | 'loading' | 'success' | 'error'

export function StatefulButton({ onClick, children }) {
  const [state, setState] = useState<ButtonState>('idle')

  const handleClick = async () => {
    setState('loading')
    try {
      await onClick()
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={state === 'loading'}
    >
      <AnimatePresence mode="wait">
        {state === 'idle' && <span key="text">{children}</span>}
        {state === 'loading' && <Loader2 key="loader" className="animate-spin" />}
        {state === 'success' && <Check key="check" className="text-green-500" />}
        {state === 'error' && <X key="error" className="text-red-500" />}
      </AnimatePresence>
    </Button>
  )
}
```

### Timing Rules

| State Transition | Duration | Visual |
|-----------------|----------|--------|
| idle → hover | 100-150ms | Subtle color shift or scale 1.02 |
| hover → pressed | 100ms | Scale 0.97 or darken |
| pressed → loading | immediate | Morph text to spinner |
| loading → success | 200ms | Morph spinner to checkmark |
| success → idle | 2000ms | Fade back to text |
| loading → error | 200ms | Morph spinner to X + shake |
| error → idle | 3000ms | Fade back to text |

---

## Optimistic UI & Perceived Performance

Making mutations feel **instant** is what separates "fast" from "buttery smooth."

### Optimistic Updates with TanStack Query

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => api.updateAppointment(data),

    // BEFORE server responds: update cache immediately
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['appointments'] })

      // Snapshot previous value (for rollback)
      const previous = queryClient.getQueryData(['appointments'])

      // Optimistically update cache
      queryClient.setQueryData(['appointments'], (old) =>
        old.map(apt => apt.id === newData.id ? { ...apt, ...newData } : apt)
      )

      return { previous } // Context for rollback
    },

    // ON ERROR: rollback to snapshot
    onError: (err, newData, context) => {
      queryClient.setQueryData(['appointments'], context.previous)
      toast.error('Failed to update. Changes reverted.')
    },

    // ALWAYS: refetch to ensure server state is accurate
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    }
  })
}
```

### Prefetching on Hover/Focus

```tsx
// Prefetch data when user shows intent (hover/focus)
function AppointmentCard({ appointment }) {
  const queryClient = useQueryClient()

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['appointment', appointment.id],
      queryFn: () => api.getAppointment(appointment.id),
      staleTime: 30_000, // Don't refetch if < 30s old
    })
  }

  return (
    <Link
      href={`/appointments/${appointment.id}`}
      onMouseEnter={prefetch}  // Desktop: hover
      onFocus={prefetch}        // Keyboard: focus
    >
      {appointment.title}
    </Link>
  )
}
```

### Route Prefetching (Next.js)

```tsx
import Link from 'next/link'

// Next.js prefetches linked routes automatically on viewport enter
<Link href="/appointments" prefetch={true}>
  Appointments
</Link>

// For programmatic prefetching:
import { useRouter } from 'next/navigation'
const router = useRouter()
router.prefetch('/appointments')
```

### Optimistic Patterns Summary

```
PERCEIVED SPEED TECHNIQUES:
──────────────────────────────────────
Optimistic updates   → Show change before server confirms
Prefetch on hover    → Load data before user clicks
Route prefetch       → Pre-load next page bundle
Skeleton screens     → Show structure before content loads
LQIP images          → Show blur before image loads
Stale-while-revalidate → Show cached data, update in background
──────────────────────────────────────
```

---

## Continuous Improvement

### Reference Sources
- **Mobbin** (mobbin.com) — Analyze how top apps solve specific problems (tab bars, search, onboarding)
- **Dribbble** — Visual inspiration for layouts and aesthetics
- **Apple HIG** — iOS design standards
- **Material Design 3** — Android/cross-platform patterns
- **Phosphor Icons** — Professional, consistent icon library
- **Lucide Icons** — Alternative icon library (lighter)

### Benchmarking Process
Before designing a new screen:
1. Search Mobbin for how top apps solve the same problem
2. Pick 2-3 references that match your brand tone
3. Identify the PATTERNS (not copy the design)
4. Apply patterns with your design system tokens

### The Taste Curator Rule
Follow talented designers on Twitter/X to be exposed to high-quality design daily.
This builds "design taste" passively over time.

---

## Quick Reference: Animation Durations

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| Micro-interaction (hover, press) | 100-200ms | spring (stiff) |
| Element entrance | 200-300ms | spring (soft) |
| Page transition | 250-400ms | ease-in-out |
| Modal open/close | 250-350ms | ease-out / ease-in |
| Celebration/confetti | 1500-2500ms | custom sequence |
| Loading shimmer | infinite loop | linear |
| Skeleton pulse | 1500ms loop | ease-in-out |

---

## Spring Animation Physics (Deep Dive)

Spring animations are what make apps feel **alive** instead of robotic. Understanding the three parameters lets you tune ANY animation to feel exactly right.

### The Three Parameters

```
SPRING PHYSICS:
──────────────────────────────────────
Stiffness  = How quickly the spring pulls toward the target
             Higher = snappier, more forceful (100-500)

Damping    = How much the oscillation is reduced
             Higher = less bouncing, settles faster (10-40)
             Lower  = more bouncing, springy feel (5-15)

Mass       = Weight of the moving object
             Higher = more sluggish, heavier feel (1-5)
             Default: 1 (rarely changed)
──────────────────────────────────────
```

### Physics-Based vs Duration-Based Springs

```tsx
// PHYSICS-BASED: Natural, incorporates gesture velocity
// Use for: interactive elements (drag, swipe, press)
transition={{ type: "spring", stiffness: 300, damping: 25 }}

// DURATION-BASED: Predictable timing, no velocity transfer
// Use for: decorative animations (entrance, page transition)
transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
```

> **Rule:** If the animation responds to user gesture → physics-based. If it's decorative → duration-based is fine.

### Spring Presets by Use Case

```tsx
// ── INTERACTIVE ──

// Snappy (buttons, toggles, chips) — immediate, minimal bounce
{ stiffness: 400, damping: 25, mass: 1 }

// Press feedback (scale down on press) — crisp, no overshoot
{ stiffness: 500, damping: 30, mass: 0.8 }

// Drag release (snap back after dragging) — responsive, slight bounce
{ stiffness: 350, damping: 20, mass: 1 }

// ── TRANSITIONS ──

// Modal open/close — smooth, slightly bouncy
{ stiffness: 300, damping: 22, mass: 1 }

// Page transition — gentle, no bounce
{ stiffness: 150, damping: 30, mass: 1 }

// Sidebar slide — medium, smooth
{ stiffness: 250, damping: 28, mass: 1 }

// ── CELEBRATIONS ──

// Bouncy entrance (confetti, checkmark) — playful
{ stiffness: 200, damping: 12, mass: 1 }

// Scale pop (badge, notification) — attention-grabbing
{ stiffness: 300, damping: 10, mass: 0.8 }

// Float up (toast, element entrance) — light, airy
{ stiffness: 120, damping: 14, mass: 0.6 }

// ── MOBILE (Reanimated) ──

// Card press — native feel
withSpring(value, { damping: 15, stiffness: 300 })

// Bottom sheet snap — responsive, slight settle
withSpring(value, { damping: 50, stiffness: 500 })

// List item bounce — playful entrance
withSpring(value, { damping: 12, stiffness: 200 })
```

---

## Transition Choreography (Staggered & Orchestrated)

Coordinated animations make pages feel **designed**, not just **loaded**.

### Parent-Children Orchestration

```tsx
// Parent variant controls children timing
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.2,     // Wait 200ms before children start
      staggerChildren: 0.08,  // 80ms between each child
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,   // Reverse order on exit
    }
  }
}

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
  exit: { opacity: 0, y: -10 }
}

// Usage
<motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit">
  {items.map(item => (
    <motion.div key={item.id} variants={childVariants}>
      <Card>{item.content}</Card>
    </motion.div>
  ))}
</motion.div>
```

### Advanced Stagger Patterns

```tsx
import { stagger } from 'framer-motion'

// Stagger from center outward (great for grids)
transition={{ delayChildren: stagger(0.1, { from: "center" }) }}

// Stagger from last to first (exit animation)
transition={{ delayChildren: stagger(0.05, { from: "last" }) }}

// Custom delay per index
const childVariants = {
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, type: "spring", damping: 25, stiffness: 300 }
  })
}
// Usage: <motion.div custom={index} variants={childVariants} />
```

### Page Transition with AnimatePresence

```tsx
// Wrap router content for enter/exit animations
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function AnimatedLayout({ children }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Choreography Timing Rules

```
STAGGER TIMING GUIDELINES:
──────────────────────────────────────
3-5 items   → 0.08-0.1s between each
6-12 items  → 0.05-0.08s between each
13+ items   → 0.03-0.05s (or animate first 8, rest instant)
Grid layout → stagger from center or top-left
List layout → stagger top to bottom
Exit        → faster than enter (0.5x the enter stagger)
──────────────────────────────────────
```

---

## Shared Element Transitions (View Transitions API)

The **View Transitions API** creates smooth morph animations between screens — the "Apple-level" detail where a thumbnail expands into a full-page image.

### CSS View Transitions (Native)

```css
/* Assign matching names to elements that should morph between views */
.product-thumbnail { view-transition-name: product-image; }
.product-hero      { view-transition-name: product-image; }
/* ↑ Same name = browser morphs between them automatically */

/* Customize the transition animation */
::view-transition-old(product-image) {
  animation: fade-out 0.25s ease-in;
}
::view-transition-new(product-image) {
  animation: fade-in 0.25s ease-out;
}
```

### React `<ViewTransition>` (Experimental)

```tsx
// React Canary — wraps View Transitions API with React lifecycle
import { ViewTransition } from 'react'

// List view
<ViewTransition name="product-image">
  <img src={product.thumbnail} />
</ViewTransition>

// Detail view (same name = shared element morph)
<ViewTransition name="product-image">
  <img src={product.fullImage} />
</ViewTransition>

// Custom transition class
<ViewTransition share="morph-scale">
  <Card>{content}</Card>
</ViewTransition>
```

### When to Use Shared Element Transitions

```
USE SHARED ELEMENTS:
──────────────────────────────────────
List → Detail     (card thumbnail → full image)
Grid → Expanded   (grid item → overlay)
Tab switch        (element morphs between tab content)
Search → Result   (search card → result page)
──────────────────────────────────────

DON'T USE (overkill):
──────────────────────────────────────
Simple page navigation (use fade/slide)
Within same page (use layout animations)
Every link click (too much motion)
──────────────────────────────────────
```

### Browser Support & Fallback

```
Chrome/Edge: Full support ✓
Safari 18+:  Same-document transitions ✓
Firefox 144+: Coming (feature flagged)
```

Always provide a CSS fallback (simple fade) for unsupported browsers:

```css
@supports not (view-transition-name: test) {
  .page-enter { animation: fadeIn 0.3s ease; }
  .page-exit { animation: fadeOut 0.2s ease; }
}
```

---

## Scroll-Linked Animations (CSS Scroll-Driven)

Animations that progress with scroll position — no JS needed.

### Scroll Progress Indicator

```css
/* Reading progress bar at top of page */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: oklch(var(--primary));
  transform-origin: left;
  animation: grow-progress linear;
  animation-timeline: scroll();  /* Links to page scroll */
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
```

### Reveal-on-Scroll (CSS-Only)

```css
/* Elements fade in as they enter the viewport */
.reveal-on-scroll {
  animation: reveal linear both;
  animation-timeline: view();            /* Tracks element visibility */
  animation-range: entry 0% entry 100%;  /* Animate during entry */
}

@keyframes reveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Parallax with Scroll-Driven Animations

```css
/* Background moves at different speed than content */
.parallax-bg {
  animation: parallax linear;
  animation-timeline: scroll();
}

@keyframes parallax {
  from { transform: translateY(0); }
  to   { transform: translateY(-100px); }
}
```

### IntersectionObserver Fallback (React)

```tsx
// For browsers without scroll-timeline support
import { useInView } from 'framer-motion'

function RevealOnScroll({ children }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {children}
    </motion.div>
  )
}
```

### Browser Support

```
CSS scroll-timeline: Chrome 115+, Edge 115+ ✓
CSS view():          Chrome 115+, Edge 115+ ✓
Firefox:             Behind flag (scroll-driven-animations)
Safari:              Not yet supported
→ Always provide JS fallback (IntersectionObserver) for Safari/Firefox
```

---

## INP & Core Web Vitals (Interaction Performance)

INP (Interaction to Next Paint) measures how fast your app **responds to user input**. A sluggish click, a delayed keystroke, or a janky toggle destroys the "premium feel" no matter how beautiful the UI is. Google uses INP as a Core Web Vital ranking signal.

### Core Web Vitals Targets

```
METRIC        TARGET     WHAT IT MEASURES
──────────────────────────────────────────────────
LCP           < 2.5s     Largest Contentful Paint (loading)
INP           < 200ms    Interaction to Next Paint (responsiveness)
CLS           < 0.1      Cumulative Layout Shift (visual stability)
──────────────────────────────────────────────────

INP ANATOMY (the 3 phases of every interaction):
┌──────────┬─────────────────┬───────────────────┐
│  Input   │   Processing    │   Presentation    │
│  Delay   │   Time          │   Delay           │
│          │                 │                   │
│ (event   │ (your handler   │ (browser renders  │
│  queued) │  runs)          │  next frame)      │
├──────────┴─────────────────┴───────────────────┤
│         Total = INP (target < 200ms)           │
└────────────────────────────────────────────────┘
```

### Reducing Input Delay

Input delay happens when the main thread is busy (long tasks, heavy JS bundles).

```tsx
// ❌ BAD: Heavy computation blocks the main thread
function handleSearch(query: string) {
  const results = expensiveFilter(allItems, query) // 300ms+ on large datasets
  setResults(results)
}

// ✅ GOOD: useTransition marks the update as non-urgent
import { useTransition } from 'react'

function handleSearch(query: string) {
  setQuery(query) // Urgent: update input immediately
  startTransition(() => {
    setResults(expensiveFilter(allItems, query)) // Non-urgent: can be interrupted
  })
}
```

**Key techniques:**
- `useTransition` / `startTransition` for non-urgent state updates
- Code splitting with `React.lazy` + `Suspense` to reduce initial bundle
- `React.memo` to prevent unnecessary re-renders during interactions
- Dynamic imports for heavy components: `const Chart = dynamic(() => import('./Chart'))`

### Reducing Processing Time

```tsx
// ❌ BAD: Entire list re-renders on every toggle
function TodoList({ items }: { items: Todo[] }) {
  return items.map(item => (
    <div key={item.id} onClick={() => toggle(item.id)}>
      {item.title}
    </div>
  ))
}

// ✅ GOOD: Memoized child prevents cascade re-renders
const TodoItem = React.memo(function TodoItem({ item, onToggle }: Props) {
  return (
    <div onClick={() => onToggle(item.id)}>
      {item.title}
    </div>
  )
})

function TodoList({ items }: { items: Todo[] }) {
  const toggle = useCallback((id: string) => { /* ... */ }, [])
  return items.map(item => (
    <TodoItem key={item.id} item={item} onToggle={toggle} />
  ))
}
```

**Key techniques:**
- `React.memo` on list items (prevents O(n) re-renders)
- `useCallback` for handlers passed to memoized children
- `useMemo` for expensive derived values
- Move heavy logic to Web Workers for computations > 50ms

### Reducing Presentation Delay

Presentation delay = time for browser to calculate layout + paint the next frame.

```css
/* ❌ BAD: Triggers layout recalculation on every frame */
.animate-bad {
  transition: width 0.3s, height 0.3s, top 0.3s, left 0.3s;
}

/* ✅ GOOD: Only compositor properties (GPU-accelerated, no layout) */
.animate-good {
  transition: transform 0.3s, opacity 0.3s;
  will-change: transform, opacity;
}
```

```
CSS PROPERTY COST:
──────────────────────────────────────────────
CHEAP (compositor only)  → transform, opacity
MEDIUM (repaint only)    → color, background, box-shadow
EXPENSIVE (layout + repaint) → width, height, top, left, padding, margin, font-size
──────────────────────────────────────────────
RULE: Animate ONLY transform + opacity for 60fps guaranteed.
```

### Next.js Specific Optimizations

```tsx
// 1. React Server Components reduce JS bundle (30%+ reduction)
// Server Component (no JS shipped to client):
async function ProductList() {
  const products = await db.products.findMany()
  return <ProductGrid products={products} />
}

// 2. Route-level code splitting (automatic in App Router)
// Each page is its own chunk — no need for manual splitting

// 3. Streaming with Suspense for progressive rendering
export default function Page() {
  return (
    <div>
      <Header />  {/* Renders instantly */}
      <Suspense fallback={<TableSkeleton />}>
        <DataTable />  {/* Streams when ready */}
      </Suspense>
    </div>
  )
}

// 4. next/dynamic for client-side heavy components
import dynamic from 'next/dynamic'
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false  // Skip SSR for browser-only libs
})
```

### INP Debugging

```typescript
// Measure INP in development
if (typeof window !== 'undefined') {
  import('web-vitals').then(({ onINP }) => {
    onINP((metric) => {
      console.log('INP:', metric.value, 'ms')
      if (metric.value > 200) {
        console.warn('POOR INP! Target:', metric.entries[0]?.target)
      }
    })
  })
}
```

### INP Quick Fixes Checklist

```
FIX                          IMPACT    EFFORT
──────────────────────────────────────────────
useTransition for filters    HIGH      LOW
React.memo on list items     HIGH      LOW
Code split heavy routes      HIGH      MEDIUM
Animate transform+opacity    HIGH      LOW
Debounce rapid inputs        MEDIUM    LOW
Move to Server Components    HIGH      HIGH
Web Worker for computation   MEDIUM    HIGH
Virtualize long lists        HIGH      MEDIUM
──────────────────────────────────────────────
```

---

## Related Skills

- `premium-ux-patterns` - UX psychology and behavioral design
- `premium-ui-design` - Visual design system rules
- `mobile-ux-design` - Mobile-specific design patterns
- `accessibility` - WCAG compliance
- `shadcn-components` - shadcn/ui component patterns
- `shadcn-theming` - Theme customization
- `tailwind-theming` - Tailwind CSS theming
- `design-system` - Design token mapping
- `react-patterns` - React component patterns
