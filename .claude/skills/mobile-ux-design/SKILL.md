---
name: mobile-ux-design
description: |
  Mobile-specific UX/UI design patterns for React Native and mobile web.
  Covers bottom navigation anatomy, haptic feedback system, safe areas, tap targets (44px),
  gesture design, page transitions, badge notifications, splash screens,
  thumb-zone ergonomics, mobile-first responsive patterns, performance optimization
  (FlatList, Reanimated, 120Hz), and keyboard management.
  Use this skill when building or reviewing mobile app screens or mobile web interfaces.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Mobile UX Design

Comprehensive mobile-specific design patterns that make the difference between a
"works on mobile" app and a premium, native-feeling experience. Applies to React Native
apps AND mobile web (responsive) interfaces.

---

## When to Use This Skill

- Building or reviewing mobile app screens (React Native)
- Designing responsive mobile web interfaces
- Implementing bottom navigation bars
- Adding haptic feedback to interactions
- Designing mobile forms or input flows
- Optimizing touch targets and gesture areas
- Creating mobile page transitions and animations
- Designing notification badges and indicators
- Building splash screens or onboarding flows

---

## 1. Bottom Navigation Bar (The Backbone of Mobile UX)

The bottom nav is THE most critical usability element in mobile apps.

### 1.1 Content Strategy

**Include ONLY 3-5 essential destinations (MAXIMUM 6):**

| Good Candidates | Bad Candidates (put elsewhere) |
|----------------|-------------------------------|
| Home / Dashboard | Help / FAQ |
| Feed / Main content | Logout |
| Search | Privacy / Terms |
| Notifications | Settings (goes in Profile) |
| Profile / Account | About |

> **Fewer tabs = less "choice paralysis"**. If you have 7+ destinations, you're doing it wrong.

### 1.2 Central Action Button (CTA)

Consider a prominent center button for the PRIMARY action:

```
┌────────────────────────────────────────┐
│  🏠     🔍     [+]     🔔     👤     │
│  Home  Search  CREATE  Alerts Profile │
└────────────────────────────────────────┘
                  ↑
          Prominent, elevated,
          easy thumb reach
```

This facilitates one-handed use and highlights the most important action.

### 1.3 Visual State Design

Use AT LEAST TWO visual changes to indicate the active tab:

```
INACTIVE:  ○ outline icon + muted color + regular weight label
ACTIVE:    ● filled icon  + brand color  + bold label
```

**Implementation:**

```tsx
// React Native example
<TabIcon
  name={isActive ? 'home-filled' : 'home-outline'}
  color={isActive ? colors.primary : colors.muted}
  size={24}
/>
<Text style={[
  styles.tabLabel,
  isActive && { fontWeight: '700', color: colors.primary }
]}>
  {label}
</Text>
```

### 1.4 Dimensions & Safe Areas

```
BOTTOM NAV ANATOMY:
┌──────────────────────────────────────┐
│                                      │  ← Content area
├──────────────────────────────────────┤
│  ← separator: shadow/border/color →  │  ← 1px border OR subtle shadow
│                                      │
│   [24px]    [24px]    [24px]    [24]│  ← Icon size: 24px
│   Label     Label     Label    Label│  ← Label: 10-12px
│                                      │
├──────────────────────────────────────┤
│   ← Safe Area (home indicator) →     │  ← NEVER overlap this
└──────────────────────────────────────┘
```

**Critical Rules:**
- Icons: 24px
- Labels: 10-12px
- Tap area: MINIMUM 44x44px (even if icon is 24px, the touchable area must be 44px)
- **ALWAYS respect Safe Area** — never overlap the home indicator (bottom line on modern phones)
- Separate from content using: subtle shadow, 1px border, OR slightly different background

```tsx
// React Native Safe Area
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TabBar = () => {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {/* tab items */}
    </View>
  )
}
```

### 1.5 Labels

- **Keep labels SHORT** — one word, one line maximum
- For older or less technical audiences: labels are MANDATORY (not optional)
- Short and clear: "Home", "Search", "Profile" (NOT "My Account Settings")

### 1.6 Badge Notifications

```
BADGE PLACEMENT:
     ●  ← small circle (no number) for minor updates
    [3] ← number badge for countable items (messages, alerts)
   [24px icon]
    Label
```

**Rules:**
- Use colored circles OR numbers in the top-right corner of icons
- DON'T overuse badges (badge fatigue → user ignores all of them)
- Reserve number badges for truly countable items (unread messages)
- Use simple colored dots for "something new" indicators

---

## 2. Haptic Feedback System (Mobile App Only)

Haptic feedback makes the app feel "addictive" and physical — like pressing real buttons.

### 2.1 Intensity Hierarchy

| Intensity | When to Use | Examples |
|-----------|-------------|---------|
| **Light** (selection) | Repetitive actions, frequent taps | Data entry, small toggles, list item selection |
| **Medium** (impact) | Significant state changes | Tab switch, toggle important setting, add to cart |
| **Heavy** (notification) | Critical confirmations | Payment confirmed, delete confirmed, error alert |
| **Success** | Positive completions | Form submitted, booking confirmed |
| **Warning** | Attention needed | Approaching limit, validation error |
| **Error** | Something went wrong | Failed action, network error |

### 2.2 Implementation

```tsx
import * as Haptics from 'expo-haptics'

// Light - for repetitive actions
const onItemPress = () => {
  Haptics.selectionAsync()
  // handle action
}

// Medium - for significant changes
const onTabSwitch = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  // switch tab
}

// Heavy - for critical confirmations
const onPaymentConfirm = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  // confirm payment
}

// Error
const onError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  // show error
}
```

### 2.3 Where to Add Haptics

| Component | Haptic Type |
|-----------|------------|
| Regular button press | Light (selection) |
| Bottom nav tab switch | Medium (impact) |
| Pull-to-refresh trigger | Medium (impact) |
| Toggle switch | Light (selection) |
| Slider snapping to value | Light (selection) |
| Form submission success | Success (notification) |
| Delete confirmation | Heavy + Warning |
| Payment completion | Heavy + Success |
| Error occurrence | Error (notification) |
| Long press activated | Medium (impact) |
| Drag-and-drop start/end | Light → Medium |

### 2.4 Rules

- NEVER add haptics to EVERY interaction (fatigue)
- Haptics should feel NATURAL, not annoying
- Test on real device (simulator doesn't reproduce haptics)
- Provide a setting to disable haptics for accessibility

---

## 3. Touch Targets & Ergonomics

### 3.1 Minimum Tap Area: 44x44px

**Every interactive element MUST have a minimum touch area of 44x44 pixels**, even if the visual element is smaller:

```tsx
// Visual icon is 24px, but touch target is 44px
<Pressable
  style={{ padding: 10 }} // 24 + 10 + 10 = 44px touch target
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  onPress={handlePress}
>
  <Icon size={24} />
</Pressable>
```

### 3.2 Thumb Zone Design

Organize content by reachability for one-handed use:

```
THUMB ZONE MAP (right hand):
┌──────────────────────┐
│                      │  ← HARD to reach
│   Status bar         │     (put read-only info here)
│   Headers            │
│                      │
├──────────────────────┤
│                      │  ← POSSIBLE to reach
│   Content area       │     (scrollable content)
│   Lists              │
│                      │
├──────────────────────┤
│                      │  ← EASY to reach
│   Primary actions    │     (CTAs, navigation, FAB)
│   Bottom nav         │
└──────────────────────┘
```

**Rule:** Primary actions go at the BOTTOM. Read-only info goes at the TOP.

### 3.3 Mobile Grid System (3-Column)

For mobile layouts, implement a **3-column grid** and align elements to it:

```
MOBILE 3-COLUMN GRID:
┌──────┬──────┬──────┐
│  1   │  2   │  3   │
│      │      │      │
│      │      │      │
│      │      │      │
│      │      │      │
└──────┴──────┴──────┘
```

- Use Auto Layout (Figma) or flexbox with consistent spacing
- Don't fear whitespace — let content "breathe"
- Group related elements deliberately
- Maintain consistent vertical spacing between groups

### 3.4 Spacing Between Touch Targets

- Minimum 8px between adjacent tap targets
- For destructive actions next to common actions: minimum 16px gap
- Group related actions, separate dangerous ones

---

## 4. Page Transitions & Animations

### 4.1 Transition Types

| Navigation Type | Animation | Duration |
|----------------|-----------|----------|
| Tab switch (same level) | Crossfade or none | 150-200ms |
| Push to detail | Slide from right | 250-350ms |
| Pop back | Slide to right | 250-350ms |
| Modal open | Slide from bottom | 300ms |
| Modal close | Slide to bottom | 250ms |
| Sheet open | Slide from bottom (partial) | 300ms |

### 4.2 Complex Animation Sequences

For key moments (form submit, voice command, booking confirmation), break the animation into sub-steps:

```
ANIMATION SEQUENCE EXAMPLE (Booking Confirmation):
──────────────────────────────────────
Step 1: Button morphs (text → loader)          0-200ms
Step 2: Loader spins                           200-800ms
Step 3: Loader morphs to checkmark             800-1100ms
Step 4: Background expands from button center  1100-1400ms
Step 5: Success text fades in with spring      1400-1800ms
Step 6: Confetti particles (optional)          1600-2200ms
──────────────────────────────────────
```

### 4.3 Spring Animations

Use spring physics (not linear/ease) for natural-feeling motion:

```tsx
// React Native Reanimated
import Animated, { withSpring } from 'react-native-reanimated'

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{
    scale: withSpring(isPressed.value ? 0.95 : 1, {
      damping: 15,
      stiffness: 300,
    })
  }]
}))
```

### 4.4 Feedback Animations

- **Button press:** Scale down to 0.95-0.97 with spring
- **Success:** Checkmark draw animation + scale bounce
- **Error:** Shake animation (horizontal oscillation, 3-4 cycles)
- **Loading:** Subtle pulse or custom branded animation (NOT a generic spinner)
- **Pull-to-refresh:** Custom animation at top (e.g., mascot pulling a rope)

### 4.5 Respect `prefers-reduced-motion`

Users with vestibular disorders enable this setting. You MUST respect it:

```tsx
// React Native: Check AccessibilityInfo
import { AccessibilityInfo } from 'react-native'

const [reduceMotion, setReduceMotion] = useState(false)
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  const sub = AccessibilityInfo.addEventListener(
    'reduceMotionChanged', setReduceMotion
  )
  return () => sub.remove()
}, [])

// Use in animations
const duration = reduceMotion ? 0 : 300
```

When reduced motion is enabled:
- Replace slide/scale animations with simple fade or instant transitions
- Keep skeleton shimmer (it's subtle enough)
- Disable confetti/particle effects
- Keep haptic feedback (it's non-visual)

---

## 5. Mobile Form Design

### 5.1 Input Rules

| Context | Best Input | Reasoning |
|---------|-----------|-----------|
| One-time setup (age, height) | Slider / Scroll wheel | Fun, precision not critical |
| Daily entry (amounts, calories) | Text + keyboard | Speed critical for repeated use |
| Date selection | Calendar with swipe | Shows context (availability) |
| Time selection | Scroll wheel | Natural mobile mental model |
| Yes/No | Toggle switch | Clear binary state |
| Select from 3-6 options | Segmented control | All visible, easy comparison |
| Select from 7+ options | Bottom sheet list | Scrollable, searchable |

### 5.2 Keyboard Optimization

Always set the correct keyboard type:

```tsx
<TextInput keyboardType="email-address" />    // Email
<TextInput keyboardType="phone-pad" />         // Phone
<TextInput keyboardType="numeric" />           // Numbers
<TextInput keyboardType="decimal-pad" />       // Money/decimals
<TextInput returnKeyType="next" />             // Shows "Next" button
<TextInput returnKeyType="done" />             // Shows "Done" button
<TextInput autoComplete="name" />              // Autofill support
```

### 5.3 Keyboard Management

The keyboard covers ~50% of the screen. Handling it poorly makes forms unusable.

```tsx
// USE KeyboardAwareScrollView (better than KeyboardAvoidingView)
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

<KeyboardAwareScrollView
  enableOnAndroid={true}
  extraScrollHeight={20}     // Extra space above focused input
  keyboardShouldPersistTaps="handled" // Allow tapping buttons while keyboard open
>
  <TextInput ... />
  <TextInput ... />
  <Button ... />  {/* Button stays accessible above keyboard */}
</KeyboardAwareScrollView>
```

**Auto-Advance Between Fields:**

```tsx
// Create refs for each field
const emailRef = useRef<TextInput>(null)
const passwordRef = useRef<TextInput>(null)

<TextInput
  returnKeyType="next"           // Shows "Next" on keyboard
  onSubmitEditing={() => emailRef.current?.focus()} // Jump to next field
/>
<TextInput
  ref={emailRef}
  returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()}
/>
<TextInput
  ref={passwordRef}
  returnKeyType="done"           // Shows "Done" on last field
  onSubmitEditing={handleSubmit} // Submit form
/>
```

**Keyboard Rules:**
- Use `KeyboardAwareScrollView` (not `KeyboardAvoidingView` which requires platform config)
- `keyboardShouldPersistTaps="handled"` — allows tapping buttons/links while keyboard is open
- `returnKeyType="next"` for all fields except last (use `"done"`)
- `onSubmitEditing` chains focus to next field
- Dismiss keyboard on scroll: `keyboardDismissMode="on-drag"`
- For bottom-positioned submit buttons, add `extraScrollHeight` to keep them visible

### 5.4 Multi-Step Forms

- Use a progress indicator (steps or progress bar)
- Allow backward navigation
- Persist data between steps (don't lose on back press)
- Skip button for optional steps
- Search bar on selection screens

---

## 6. Mobile Navigation Patterns

### 6.1 Navigation Color Strategy

- **Bottom nav:** Neutral colors (white, gray, dark) — NOT brand-colored
- **Reserve brand colors** for actions WITHIN the content area
- **Contrast:** Minimum 3:1 ratio for inactive elements to remain legible

```
NAVIGATION COLOR PALETTE:
──────────────────────────────────────
Background:      White / Near-white (light) or Dark gray (dark)
Inactive icons:  40-50% gray
Active icon:     Brand color (primary)
Active label:    Brand color + bold weight
Separator:       5% opacity border or subtle shadow
──────────────────────────────────────
```

### 6.2 Gestures

| Gesture | Standard Action |
|---------|----------------|
| Swipe left | Delete / secondary action |
| Swipe right | Primary action (mark done, archive) |
| Long press | Context menu / multi-select |
| Pull down | Refresh content |
| Pinch | Zoom (images/maps) |
| Swipe between tabs | Tab navigation |

### 6.3 Sheet Pattern (Bottom Sheets)

Use bottom sheets instead of full-page navigations for:
- Quick actions (share, more options)
- Filters
- Brief forms (< 5 fields)
- Confirmations

```
SHEET ANATOMY:
┌──────────────────────────────┐
│                              │  ← Content (dimmed)
│                              │
├──────────────────────────────┤
│          ═══                 │  ← Handle (drag indicator)
│                              │
│   Sheet content              │  ← Actions, forms, etc.
│                              │
│   [Primary Action Button]    │
│                              │
├──────────────────────────────┤
│   ← Safe Area →              │
└──────────────────────────────┘
```

---

## 7. Splash Screen & First Launch

### 7.1 Splash Screen

- Show brand logo or icon centered
- Match background to the app's primary color or white
- Duration: 1-2 seconds max (or until app is ready)
- Transition to main screen with a fade (not an abrupt jump)

### 7.2 Onboarding

- Maximum 3-4 screens
- Each screen: ONE idea, ONE illustration, ONE sentence
- Allow skipping at any point
- Show progress dots
- Final screen: clear CTA ("Get Started")

```
ONBOARDING SCREEN:
┌──────────────────────┐
│                      │
│   [Illustration]     │
│                      │
│   Title (1 line)     │
│   Subtitle (2 lines) │
│                      │
│                      │
│   ● ○ ○              │  ← Progress dots
│                      │
│   [Get Started]      │  ← or [Next] / [Skip]
│                      │
└──────────────────────┘
```

---

## 8. Loading & Empty States (Mobile-Specific)

### 8.1 Skeleton Screens

Instead of spinners, use skeleton placeholders that mirror the actual content layout:

```
SKELETON EXAMPLE:
┌──────────────────────────┐
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
└──────────────────────────┘
  avatars   text lines (shimmer animation)
```

### 8.2 Pull-to-Refresh

- Custom animation (not just the default spinner)
- Show haptic feedback when threshold is reached
- Brief success indicator before content updates

### 8.3 Empty States

- Include illustration (mascot, contextual image)
- Clear headline + supportive text
- Primary CTA to resolve the empty state
- Consider animation (Lottie) for extra delight

---

## 9. Responsive Web → Mobile Adaptation

### 9.1 Dashboard Adaptation

When adapting a web dashboard for mobile web:

| Web Element | Mobile Adaptation |
|-------------|-------------------|
| Sidebar navigation | Bottom nav bar |
| Data tables | Card lists with key data |
| Complex charts | Simplified charts or summary cards |
| Multi-column layouts | Single column stacked |
| Hover tooltips | Tap-to-expand or inline display |
| Dropdown menus | Bottom sheets |
| Modal dialogs | Full-screen sheets |
| Horizontal tabs | Swipeable tabs |

### 9.2 Priority for Belleza Project

Based on target users:
- **Professionals/Admin** → Web Desktop + Native Mobile App
- **Clients** → **Web Mobile** (primary mobile web audience)

Prioritize mobile-responsive design for:
1. Booking flow (client-facing)
2. Appointment status page (client-facing)
3. Client profile/history (client-facing)
4. Dashboard is "nice to have" responsive (admins use native app)

---

## 10. Illustration & Visual Identity

### 10.1 Mascots and Brand Characters

Create a base illustration/mascot and generate contextual variations:

| Context | Mascot State |
|---------|-------------|
| Empty list | Sleeping or idle |
| Searching | Holding magnifying glass |
| Error | Confused or shrugging |
| Success | Celebrating |
| Loading | Working or running |
| No internet | Disconnected cable visual |

### 10.2 Animation of Illustrations

- Use **Lottie** (After Effects → JSON) for complex character animations
- Use **Rive** for interactive, state-driven illustrations
- Use CSS/Reanimated for simple motion (floating, breathing)

### 10.3 Consistency

- All illustrations must use the SAME artistic style
- Consistent color palette matching the theme
- Same line weight and proportions across all variations

---

## 11. Performance & Frame Rate (The Invisible UX)

A beautiful app that stutters, drops frames, or feels laggy is worse than an ugly one that's fast. Users perceive jank as **broken**, not slow. 60fps (16.6ms/frame) is the minimum; 120fps (8.3ms/frame) is the new premium bar on modern devices.

### 11.1 The Performance Mental Model

```
FRAME BUDGET:
──────────────────────────────────────────────
60fps  → 16.6ms per frame (standard)
120fps →  8.3ms per frame (Pro Motion / high refresh)
──────────────────────────────────────────────

WHAT EATS YOUR FRAME BUDGET:
┌─────────────────────────────────────────┐
│  JS Thread        │  UI Thread          │
│  (React logic)    │  (native rendering) │
│                   │                     │
│  State updates    │  Layout calc        │
│  Re-renders       │  Drawing views      │
│  API calls        │  Animations*        │
│  Business logic   │  Gestures*          │
└─────────────────────────────────────────┘
        * Reanimated runs these on UI thread
          (bypassing JS thread entirely)
```

### 11.2 FlatList Optimization (The #1 Performance Fix)

FlatList is the biggest source of jank in React Native. Every optimization matters:

```tsx
// ❌ BAD: Unoptimized FlatList
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
/>

// ✅ GOOD: Fully optimized FlatList
const MemoizedItem = React.memo(ItemCard)

<FlatList
  data={items}
  renderItem={({ item }) => <MemoizedItem item={item} />}
  keyExtractor={(item) => item.id}
  // Windowing (only render visible + buffer)
  windowSize={10}              // Render 10 screens worth (5 above + 5 below)
  maxToRenderPerBatch={10}     // Render 10 items per batch
  initialNumToRender={10}      // First render: 10 items
  updateCellsBatchingPeriod={50} // Batch updates every 50ms
  // Layout optimization
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,       // Skip measurement if height is fixed
    offset: ITEM_HEIGHT * index,
    index,
  })}
  // Memory optimization
  removeClippedSubviews={true} // Detach off-screen views (Android)
/>
```

**FlatList optimization priority:**

```
FIX                              IMPACT    EFFORT
──────────────────────────────────────────────────
React.memo on renderItem         HIGH      LOW     ← Do this FIRST
getItemLayout (fixed height)     HIGH      LOW
keyExtractor (stable keys)       HIGH      LOW
windowSize tuning (10-15)        MEDIUM    LOW
maxToRenderPerBatch              MEDIUM    LOW
removeClippedSubviews            MEDIUM    LOW
FlashList (drop-in replacement)  HIGH      MEDIUM
──────────────────────────────────────────────────
```

> **FlashList** (`@shopify/flash-list`) is a drop-in replacement for FlatList that's 5x faster. Use it for lists with 100+ items.

### 11.3 Reanimated: UI Thread Animations

Regular `Animated` API runs on the JS thread → competes with React for frame budget → jank. Reanimated v3/v4 worklets run **directly on the native UI thread**.

```tsx
// ❌ BAD: JS thread animation (janky during re-renders)
import { Animated } from 'react-native'
const opacity = useRef(new Animated.Value(0)).current
Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()

// ✅ GOOD: UI thread animation (butter smooth always)
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated'

const scale = useSharedValue(1)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}))

// Trigger: runs entirely on UI thread
const handlePress = () => {
  scale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
}

return <Animated.View style={animatedStyle} />
```

**Rules for Reanimated:**
- ALL interactive animations (press, drag, swipe) → Reanimated worklets
- Decorative/entrance animations → can use `Animated` with `useNativeDriver: true`
- Gesture handlers (`react-native-gesture-handler`) + Reanimated = 60fps gestures
- NEVER read `.value` synchronously in render — always use `useAnimatedStyle`

### 11.4 React.memo & Re-render Prevention

```tsx
// ❌ BAD: Parent re-render causes ALL children to re-render
function AppointmentList({ appointments, onSelect }) {
  return appointments.map(apt => (
    <AppointmentCard
      key={apt.id}
      appointment={apt}
      onSelect={() => onSelect(apt.id)}  // New function every render!
    />
  ))
}

// ✅ GOOD: Memoized children + stable callbacks
const AppointmentCard = React.memo(function AppointmentCard({ appointment, onSelect }) {
  return (/* ... */)
})

function AppointmentList({ appointments, onSelect }) {
  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect])
  return appointments.map(apt => (
    <AppointmentCard
      key={apt.id}
      appointment={apt}
      onSelect={handleSelect}
    />
  ))
}
```

### 11.5 Image Performance

```tsx
// ❌ BAD: Default Image component (no caching, no progressive loading)
import { Image } from 'react-native'
<Image source={{ uri: photoUrl }} />

// ✅ GOOD: expo-image with caching + blur placeholder
import { Image } from 'expo-image'
<Image
  source={photoUrl}
  placeholder={blurhash}          // LQIP blur while loading
  contentFit="cover"
  transition={200}                // Smooth fade-in
  cachePolicy="memory-disk"       // Cache aggressively
/>
```

> Use **expo-image** (or react-native-fast-image) over the default Image component. Default Image has no disk cache and re-downloads images on every mount.

### 11.6 120Hz / Pro Motion Considerations

Modern devices (iPhone Pro, Samsung Galaxy S series) support 120Hz displays:

```
RULE: If the app targets premium devices, test at 120Hz.

What breaks at 120Hz:
- setTimeout/setInterval-based animations (frame tearing)
- requestAnimationFrame logic assuming 16.6ms frames
- JS thread animations that barely hit 60fps

What works perfectly at 120Hz:
- Reanimated worklets (native driver, adapts automatically)
- CSS transitions (web mobile)
- Native gesture handlers

ACTION: Use Reanimated for ALL animations → automatic 120Hz support.
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| More than 5 bottom nav items | Choice paralysis | Max 5, use "More" sheet for extras |
| No safe area respect | Content hidden behind home indicator | Always use SafeAreaView |
| Tap targets < 44px | Frustrating mis-taps | Minimum 44x44px hitbox |
| Haptics on every single tap | Annoying, numbing | Use sparingly on significant actions |
| Generic spinner for loading | Feels slow and cheap | Skeleton screens or branded animation |
| Full-page modal for simple action | Heavy, jarring | Bottom sheet instead |
| Horizontal scroll for content | Easy to miss items | Vertical scroll with clear layout |
| Text-only empty states | Feels broken | Illustration + CTA |
| Same icon weight active/inactive | Hard to distinguish | Outline → filled on activation |
| Linear animations (not spring) | Feels robotic | Spring physics for natural motion |
| Ignoring reduce-motion preference | Vestibular disorder users get sick | Check AccessibilityInfo, disable animations |
| No gesture alternative for swipe actions | Motor impairment users can't use | Always provide button/menu fallback |
| KeyboardAvoidingView without platform config | Works on iOS, breaks on Android | Use KeyboardAwareScrollView instead |
| No auto-advance between form fields | User must manually tap each field | returnKeyType="next" + onSubmitEditing chain |
| Keyboard covers submit button | User can't submit without dismissing | extraScrollHeight or sticky submit |
| Default `<Image>` without caching | Re-downloads on every mount, slow | expo-image with cachePolicy="memory-disk" |
| JS thread animations for interactions | Competes with React, drops frames | Reanimated worklets on UI thread |
| Unoptimized FlatList (no memo, no getItemLayout) | Janky scrolling on 50+ items | React.memo + getItemLayout + windowSize |
| setTimeout-based animation timing | Frame tearing at 120Hz | Reanimated (adapts to refresh rate) |
| Inline arrow functions in renderItem | New function every render, breaks memo | useCallback + memoized component |

---

## Checklist

Before shipping ANY mobile screen:

- [ ] Bottom nav has 3-5 items maximum?
- [ ] Active tab shows filled icon + brand color + bold label?
- [ ] Safe area is respected (no overlap with home indicator)?
- [ ] All tap targets are minimum 44x44px?
- [ ] Haptic feedback added to significant interactions?
- [ ] Haptic intensity matches action importance?
- [ ] Page transitions use spring physics (not linear)?
- [ ] Loading states use skeletons (not generic spinners)?
- [ ] Empty states have illustration + headline + CTA?
- [ ] Forms use correct keyboard type for each field?
- [ ] Multi-step forms have progress indicator?
- [ ] Primary actions are in the thumb-easy zone (bottom)?
- [ ] Badges are used sparingly (not on every tab)?
- [ ] Navigation uses neutral colors (brand color for content only)?
- [ ] Splash screen transitions smoothly to main screen?
- [ ] Pull-to-refresh has custom animation + haptic feedback?
- [ ] `prefers-reduced-motion` / AccessibilityInfo.isReduceMotionEnabled respected?
- [ ] Swipe gestures have alternative button/menu fallbacks?
- [ ] Forms use KeyboardAwareScrollView (not bare KeyboardAvoidingView)?
- [ ] returnKeyType="next" chains through all fields, "done" on last?
- [ ] Submit button stays visible above keyboard?
- [ ] FlatList items wrapped in React.memo?
- [ ] FlatList has getItemLayout for fixed-height items?
- [ ] Interactive animations use Reanimated worklets (not Animated API)?
- [ ] Images use expo-image with cachePolicy and blur placeholder?
- [ ] No JS thread animations for gestures or interactive elements?
- [ ] Lists with 100+ items use FlashList instead of FlatList?

---

## Related Skills

- `premium-ux-patterns` - UX psychology patterns (applies to all platforms)
- `premium-ui-design` - Visual design rules (applies to all platforms)
- `frontend-design` - Implementation orchestrator
- `accessibility` - WCAG compliance (touch targets, contrast)
- `shadcn-components` - Web component patterns
