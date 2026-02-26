---
name: premium-ux-patterns
description: |
  Premium UX psychology and behavioral design patterns for web and mobile.
  Covers Peak-End Rule, cognitive load reduction, personalization, user journey mapping,
  smart search, post-action UX, empty states, feedback loops, and conversion optimization.
  Use this skill when designing user flows, improving retention, or making interfaces feel "intelligent".
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Premium UX Patterns

Psychology-driven UX patterns that separate amateur products from premium, "top 1%" applications.
These patterns apply to BOTH web dashboards and mobile apps.

---

## When to Use This Skill

- Designing new user flows or screens
- Improving retention and engagement metrics
- Making an interface feel "smart" and anticipatory
- Reducing user frustration and cognitive load
- Designing empty states, loading states, or error states
- Optimizing post-action experiences (after purchase, after form submit)
- Creating personalized experiences based on user behavior
- Building search interfaces
- Designing category/listing pages

---

## 1. Peak-End Rule (The Golden Rule of Memorable Apps)

**Principle:** Users don't remember the entire experience. They judge quality based on TWO moments: the most intense point (the Peak) and the Final moment.

### 1.1 Map the User Journey First

Before designing ANY screen:

1. List every step from registration to task completion
2. Identify where users pause, feel stress, or encounter silence
3. Locate the natural "peak" moment (task completion, milestone reached)
4. Design the "end" moment (session close, task finish)

```
JOURNEY MAP TEMPLATE:
────────────────────────────────────────────────
Register → Onboard → [PEAK: First Success] → Use → [END: Session Close]
   │          │              │                  │           │
   ▼          ▼              ▼                  ▼           ▼
 Simple    Guided      Celebrate!          Smooth      Summarize
 forms     steps       Animation          flows       progress
                       + Confetti
────────────────────────────────────────────────
```

### 1.2 Design the Peak Moment

Choose ONE point in the journey to elevate above expectations:

- **When:** User completes a central task, reaches a milestone, or invests significant effort
- **How to implement:**
  - Micro-animations (confetti, sparkles, check-mark morphing)
  - Personalized celebration copy: "You showed up today, that's huge!"
  - Dynamic progress summaries that feel "built just for me"
  - Badges, achievements, or visual rewards
  - 3D transitions or fluid animations on payment/booking completion

```tsx
// Example: Peak moment after booking confirmation
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", damping: 15, stiffness: 300 }}
>
  <ConfettiExplosion />
  <h2>{t('booking.confirmed.title')}</h2>
  <p>{t('booking.confirmed.message', { name: user.firstName })}</p>
</motion.div>
```

### 1.3 Design the End Moment

Never let the app just "close" — design a conclusion that reaffirms value:

- **Dashboard web:** Show a progress card or summary: "3 appointments completed today"
- **Mobile app:**
  - Subtle animation on the last action before exit
  - Soft nudge to return: "See you tomorrow!"
  - Reward opportunity (rate, tip, share)

### 1.4 Mitigate Negative Moments

Negative moments are as memorable as positive ones. You MUST address:

- **Loading screens:** Convert to branded animations (never a blank spinner)
- **Error states:** Use optimistic micro-copy that guides before the user asks for help
- **Long forms:** Break into steps with progress indicators
- **Empty results:** Offer alternatives instead of dead-ends

```
NEGATIVE MOMENT MITIGATION:
──────────────────────────────────────
Wait time      → Branded loading animation
Error          → Helpful copy + suggested action
Empty results  → "Try these instead..." suggestions
Long form      → Multi-step wizard with progress bar
──────────────────────────────────────
```

### 1.5 Iterate on Peaks

- Test variations: different timing, icons vs emojis, animated vs static feedback
- Monitor where users abandon (that's your pain point)
- Monitor where users linger longer than necessary (that's your delight point)

---

## 2. User Flow Integrity (No Gaps, No Dead-Ends)

**Principle:** Gaps in user flow silently ruin the experience. Every screen must have a clear "next step" and an "escape hatch."

### 2.1 Flow Wireframing

Before designing any detail, draw SIMPLE BOXES to map the flow:

```
WIREFRAME FLOW CHECK:
┌─────┐    ┌─────────┐    ┌─────────┐    ┌──────┐
│Start├───→│Selection ├───→│ Config  ├───→│ Done │
│     │    │ Screen   │    │ Screen  │    │      │
└─────┘    └─────────┘    └─────────┘    └──────┘
              │                │
              ▼                ▼
           [Search]         [Skip]
           [Back]           [Back]
```

Look for:
- Missing "Back" navigation on any screen
- Selection screens WITHOUT a search bar
- Screens WITHOUT a "Skip" button when the step is optional
- Dead-end states with no clear next action

### 2.2 Mandatory Screen Elements

Every selection or configuration screen MUST have:

| Element | Why |
|---------|-----|
| **Search bar** | User may have 50+ options; scrolling is painful |
| **Skip button** | The step may not apply to every user |
| **Back navigation** | User must be able to retreat without losing data |
| **Clear CTA** | User must know what "next" looks like |
| **Progress indicator** | User must know where they are in the flow |

### 2.3 Remove Redundant Navigation

- **Remove navigation arrows** if the user can already swipe (mobile gesture replaces button)
- **Remove borders/strokes** on cards if color contrast is already sufficient
- **Remove "View more" links** if content can simply be scrolled
- Any element that duplicates an existing interaction = visual clutter to remove

---

## 3. Cognitive Load Reduction (Premium = Effortless)

**Principle:** The brain is "lazy" by design. It prefers what's easy to process. Premium = removing friction, not adding features.

### 3.1 Declare War on Cognitive Load

Review EVERY page and ask: "What can I remove?"

**Checklist for every screen:**
- [ ] Can any text be shorter without losing meaning?
- [ ] Are there redundant labels? (If a section says "Rewards", the button just says "Claim")
- [ ] Is there a single clear primary action?
- [ ] Can advanced options be hidden by default?
- [ ] Is the hierarchy guiding the eye to the right place?

### 3.2 White Space = Trust Signal

- White space is NOT "empty space" — it's a signal of confidence and exclusivity
- Use generous spacing between sections
- Let content "breathe"
- Each section should have ONE primary objective

```
BAD:  [Title][Subtitle][Button][Image][Stats][CTA][Footer] ← everything screams
GOOD: [Title + Subtitle]
                                    [Hero Image]

      [Single CTA Button]
                                    [Supporting Stats]
```

### 3.3 Predictable Navigation

- Keep menus simple and logical
- If navigation is easy to use, the brain interprets it as MORE trustworthy
- Consistent patterns across all screens
- Never hide primary actions in hamburger menus on desktop

### 3.4 Copywriting Rules

- **Eliminate redundancy:** If a section header already defines the group, don't repeat that word in each item
- **Use context to omit words:** Inside a "Rewards" section, the button says "Claim", not "Claim Rewards"
- **Shorter = Better:** Every word must earn its place
- **One idea per sentence**

```
BAD:  "Click here to claim your available reward points"
GOOD: "Claim Points"

BAD:  "Your appointment has been successfully booked and confirmed"
GOOD: "Appointment confirmed!"
```

---

## 4. Personalization by User Behavior

**Principle:** The design should mutate based on WHO is looking, not show a generic screen for everyone.

### 4.1 Three User Tiers

| Tier | Behavior | What to Show |
|------|----------|-------------|
| **New Users** | First 1-3 sessions | Simplified UI, welcome message, focus on "First Step" (configure a goal, make first booking) |
| **Returning Users** | Regular usage | Active plans, pending tasks, recent activity directly on home |
| **Power Users** | Heavy/daily usage | Advanced stats, personalized recommendations based on history, shortcuts |

### 4.2 Implementation Strategy

```tsx
// Determine user tier based on session count or activity
const userTier = useMemo(() => {
  if (user.sessionsCount <= 3) return 'new'
  if (user.actionsThisWeek > 20) return 'power'
  return 'returning'
}, [user])

// Render adaptive UI
switch (userTier) {
  case 'new': return <OnboardingHome />
  case 'power': return <PowerUserDashboard />
  default: return <StandardHome />
}
```

### 4.3 Dashboard Web Adaptation

- Use a "views" system where complex data (charts, reports) unlock or highlight for frequent admins
- Occasional users see clear summaries
- First-time visitors see guided tooltips

---

## 5. Smart Search Design

**Principle:** Search should NEVER be a blank page. It's a moment of support, not abandonment.

### 5.1 Before the User Types

When the search bar is tapped/focused, IMMEDIATELY show:

1. **Recent searches** (last 3-5)
2. **Popular/trending terms**
3. **Personalized suggestions** based on user's interests or history

### 5.2 While the User Types

- Live results appearing as they type (debounced 300ms)
- Category-organized results (People, Services, Appointments)
- Highlight matching text in results

### 5.3 Zero Results State

NEVER show just "No results found." Instead:

- Suggest similar terms: "Did you mean...?"
- Show related items: "You might be interested in..."
- Offer action: "Create new [item]?"

```
SEARCH UX FLOW:
──────────────────────────────────────
Focus bar    → Show recents + popular
Type 1 char  → Show autocomplete
Type 3 chars → Show live results
0 results    → Show alternatives + "Create new?"
──────────────────────────────────────
```

---

## 6. Post-Action Experience (After the Conversion)

**Principle:** Don't neglect the experience AFTER the user completes their primary task. This IS the "End" in Peak-End.

### 6.1 Visual Timeline

Replace text lists with visual timelines for status tracking:

```
●━━━━━━━●━━━━━━━○━━━━━━━○
Booked   Confirmed  In Progress  Completed
✓        ✓          ←current
```

### 6.2 Humanization

For service apps (delivery, appointments):
- Include photos and names of assigned professionals
- Quick contact buttons (call, message)
- Proactive info: answer common questions with visual icons BEFORE the user searches

### 6.3 Proactive Information

- Show estimated times with visual progress
- Answer FAQs inline (not buried in a help page)
- Provide next-step guidance automatically

---

## 7. Empty States Design

**Principle:** Empty screens are opportunities, not dead-ends. They should guide, delight, and motivate.

### 7.1 Components of a Great Empty State

1. **Illustration/Visual** (character, mascot, or contextual image)
2. **Clear headline** explaining the state
3. **Supportive body text** with guidance
4. **Primary CTA** to resolve the empty state

```
EMPTY STATE ANATOMY:
┌─────────────────────────┐
│                         │
│     [Illustration]      │
│                         │
│   No appointments yet   │  ← headline
│                         │
│  Book your first        │  ← supportive text
│  appointment to get     │
│  started                │
│                         │
│  [Book Now]             │  ← primary CTA
│                         │
└─────────────────────────┘
```

### 7.2 Illustration Variations

Create a base illustration/mascot and generate variations for different contexts:
- Searching (with magnifying glass)
- Sleeping (no activity)
- Celebrating (after achievement)
- Working (in progress)
- Confused (error state)

### 7.3 Animate Empty States

Use Lottie animations or CSS animations to bring empty states to life:
- Subtle breathing/floating motion
- Character looking around
- Elements appearing with staggered delays

---

## 8. Category Page Design

**Principle:** Achieve visual rhythm that enables rapid scanning.

### 8.1 What to Avoid

- Plain text lists with no visual distinction
- Inconsistent stock photos with poor contrast
- All items looking identical

### 8.2 What to Implement

- **Color-coded cards:** Soft solid backgrounds that visually group categories
- **Unified iconography/images:** Same artistic style across all category images
- **Visual rhythm:** Alternate card sizes or layouts for scanning ease
- **Progressive disclosure:** Show key info first, details on tap/click

```
CATEGORY CARDS:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 🟣 bg    │ │ 🔵 bg    │ │ 🟢 bg    │
│          │ │          │ │          │
│ [Icon]   │ │ [Icon]   │ │ [Icon]   │
│ Haircut  │ │ Color    │ │ Spa      │
│ 12 items │ │ 8 items  │ │ 5 items  │
└──────────┘ └──────────┘ └──────────┘
← Same style, different accent colors →
```

---

## 9. Smart Input Selection

**Principle:** Choose the input component based on CONTEXT OF USE, not just data type.

### 9.1 Decision Matrix

| Context | Best Input | Why |
|---------|-----------|-----|
| One-time setup (height, weight, age) | Slider / Scroll wheel | Precision not critical, feels playful |
| Repeated daily entry (calories, amounts) | Text field + stepper | Speed matters, keyboard is faster |
| Binary choice | Toggle switch | Clear on/off state |
| Selection from few options (3-6) | Segmented control / Radio | All options visible at once |
| Selection from many options (7+) | Dropdown / Search select | Reduces visual noise |
| Date selection | Calendar picker | Context-aware, shows availability |
| Time selection | Time wheel (mobile) / Time picker (web) | Natural mental model |

### 9.2 Rule of Thumb

> Sliders are for SETUP. Text fields are for REPEATED USE.

If a user does this action once → make it fun and visual (slider, wheel).
If a user does this action daily → make it fast and precise (keyboard, stepper).

---

## 10. Halo Effect (First Impressions in 50ms)

**Principle:** The brain forms an opinion about your product in 50 milliseconds. If the first impression is professional, users assume EVERYTHING is professional.

### 10.1 Mobile App First Impression

- Splash screen must be impeccable (no default white screen)
- First Home screen view must feel polished
- If the first image/headline feels professional, users trust the entire service

### 10.2 Dashboard Web First Impression

- Obsess over the "Hero" section (above the fold)
- Must be clean: clear value proposition + high-quality visuals
- Creates a "lens of trust" for everything below

### 10.3 Implementation Framework

1. **Engineer the first impression:** Decide what EXACT feeling you want in the first 50ms (Calm? Trust? Energy?)
2. **Extreme simplification:** Increase spacing, simplify navigation until clarity is priority #1
3. **Delight hunting:** Find every place where a subtle moment of delight can be added (hover states, animated loaders, transitions)

---

## 11. Conversion and Retention Patterns

### 11.1 Pricing Page (Dashboard/Web)

- Limit to 3-4 plans maximum
- Highlight monthly cost (what users search for) — reduce plan name size
- Show discount for annual clearly
- Show what the NEXT plan has that the CURRENT one doesn't

### 11.2 Data Visualization

- Use donut charts over lists for resource usage
- Add comparison toggles (compare items side by side)
- Use heat maps over bar charts for geographical data

### 11.3 Landing Page Credibility

- Use real product screenshots (styled/edited) — NOT generic icons
- Show actual UI cards, reports, or analytics as "product shots"
- Presentation IS credibility — a good graphic of your own interface elevates perceived value

---

## 12. Toast & Notification Patterns

**Principle:** Notifications must inform without interrupting. The wrong timing, placement, or frequency kills the user's flow.

### 12.1 Toast vs Snackbar

| Type | Has Action? | Duration | Use Case |
|------|------------|----------|----------|
| **Toast** | No | 3-5s auto-dismiss | Confirmations, status updates ("Saved!") |
| **Snackbar** | Yes (1 action) | 5-8s or until dismissed | Undo actions ("Deleted. Undo?") |
| **Banner** | Optional | Persistent until dismissed | System-wide alerts, maintenance notices |

### 12.2 Timing Rules

```
DURATION FORMULA:
──────────────────────────────────────
Short message (1-5 words)   → 3 seconds
Medium message (5-15 words) → 5 seconds
Long message (15+ words)    → 8 seconds or persistent
With action button          → minimum 5 seconds
──────────────────────────────────────
Alternative: ~100ms per character (20 chars = 2s base + 1s buffer)
```

### 12.3 Placement

| Platform | Default Position | Why |
|----------|-----------------|-----|
| **Web desktop** | Top-right corner | Peripheral vision, doesn't overlap content |
| **Web mobile** | Top center (below header) | Thumb-safe, doesn't cover bottom nav |
| **Mobile app** | Top of screen | Safe from bottom nav/gestures |

### 12.4 Stacking Rules

- **Mobile:** NEVER show more than 1 toast at a time — queue and replace
- **Desktop:** Stack maximum 3, newest on top, auto-dismiss oldest
- **Animation:** Slide + fade, 200-400ms entrance/exit

### 12.5 Semantic Colors

```
SUCCESS:  Green left border or icon  → "Changes saved"
ERROR:    Red left border or icon    → "Failed to save"
WARNING:  Amber left border or icon  → "Connection unstable"
INFO:     Blue left border or icon   → "New version available"
```

---

## 13. Form Validation UX

**Principle:** Validate inline, validate on blur, never validate prematurely. Good validation guides — bad validation punishes.

### 13.1 When to Validate

| Trigger | Pattern | When to Use |
|---------|---------|-------------|
| **On blur** (leaving field) | Best default | Most fields — email, name, phone |
| **On input** (while typing) | Only for length/format | Password strength, character limits |
| **On submit** | Required fields only | Empty required fields that weren't touched |

> **Key Rule:** NEVER show an error while the user is still typing (premature validation). Wait until they leave the field (blur event).

### 13.2 Error Message Anatomy

```
FIELD WITH ERROR:
┌──────────────────────────────┐
│ Email                        │ ← Label stays visible (NOT placeholder-only)
│ john@                        │ ← Field with red border (2px)
└──────────────────────────────┘
  ⚠ Enter a valid email address  ← Error: red, below field, specific guidance
```

**Error message rules:**
- Placed BELOW the input (never above, never in a tooltip)
- Red text + red border on the field
- Human-readable: "Enter a valid email" NOT "Error: Invalid format (RFC 5322)"
- Specific: "Password needs 8+ characters" NOT "Invalid password"
- Disappears immediately when the user corrects the input

### 13.3 Positive Validation (Green Feedback)

Show a green checkmark or green border when a field is valid. This creates momentum:

```
VALID FIELD:
┌──────────────────────────────┐
│ Email                        │
│ john@example.com          ✓  │ ← Green checkmark + green border
└──────────────────────────────┘
```

> Studies show inline validation with positive feedback increases form completion by ~22%.

### 13.4 Mobile-Specific Form UX

- Error messages below fields (vertical flow matches mobile reading)
- Use the correct keyboard type per field (email, phone, number)
- Persist labels (don't rely on placeholder text which disappears on focus)
- Group related fields and validate groups together

---

## 14. Onboarding & Progressive Disclosure

**Principle:** Don't show everything at once. Reveal features progressively as users demonstrate readiness.

### 14.1 Onboarding Checklist Pattern

Use a persistent checklist to guide new users through setup:

```
ONBOARDING CHECKLIST:
┌─────────────────────────────────┐
│ Get started with [App Name]     │
│ ━━━━━━━━━━━━━━━░░░░  60%       │
│                                 │
│ ✓ Create your account           │
│ ✓ Set up your profile           │
│ ✓ Add your first service        │
│ ○ Invite a team member          │
│ ○ Configure business hours      │
│                                 │
│ [Continue Setup]                │
└─────────────────────────────────┘
```

**Rules:**
- 5-7 steps maximum
- Show progress (percentage or X/Y)
- Allow dismissing/minimizing (but keep accessible)
- Celebrate completion of each step (micro-animation)
- Celebrate 100% completion with a Peak moment

### 14.2 Progressive Feature Disclosure

Reveal advanced features ONLY after the user has mastered basics:

| User Stage | Features Shown | Hidden Features |
|-----------|---------------|----------------|
| First session | Core workflow (create, view, edit) | Reports, integrations, bulk actions |
| After 3 sessions | Core + secondary (filters, search) | Advanced analytics, API settings |
| After 10 sessions | Full feature set | Nothing hidden |

### 14.3 Contextual Tooltips (Not Tours)

- **Avoid** long product tours (users skip them or forget)
- **Prefer** contextual tooltips that appear when the user reaches a feature naturally
- Show tooltip once, with "Got it" dismiss
- Store dismissed state per user

### 14.4 Gamification Elements

| Element | Implementation | Effect |
|---------|---------------|--------|
| Progress bars | Show % of profile/setup completion | Creates "completion urge" |
| Badges | Award on milestones (first booking, 10th client) | Positive reinforcement |
| Streaks | "5-day login streak!" | Encourages habit formation |
| Confetti | On checklist completion | Peak-End moment |

---

## 15. Optimistic UI (The "Instant" Illusion)

**Principle:** Users perceive speed not by actual latency, but by how quickly the UI acknowledges their action. Update the UI BEFORE the server responds.

### 15.1 When to Use Optimistic Updates

| Scenario | Optimistic? | Why |
|----------|------------|-----|
| Toggle a setting | YES | High success rate, easy to revert |
| Add item to list | YES | User expects instant feedback |
| Delete an item | YES + undo snackbar | Give 5s to undo before confirming |
| Edit a field | YES | Success rate >99% |
| Payment/booking | NO | Too risky — show real loading |
| File upload | NO | Can't fake progress |

### 15.2 The Optimistic Pattern

```
USER ACTION → IMMEDIATELY UPDATE UI → SEND TO SERVER
                                        │
                                   ┌────┴────┐
                                   │ Success  │ Error
                                   │ (silent) │ → Rollback + Toast
                                   └─────────┘
```

> **Key:** The user should never WAIT for the server on routine actions. Reserve loading spinners for high-stakes operations only.

### 15.3 Perceived Performance Hierarchy

From most effective to least:

```
PERCEIVED SPEED TECHNIQUES (ranked):
──────────────────────────────────────
1. Optimistic update    → 0ms perceived (instant)
2. Prefetch on intent   → Data ready before click
3. Skeleton screens     → Structure visible immediately
4. LQIP blur-up         → Image space reserved, feels fast
5. Progress indicator   → User sees progress
6. Branded loader       → Better than spinner, still waiting
7. Generic spinner      → WORST — feels slow always
──────────────────────────────────────
```

### 15.4 Prefetch Opportunities

| Trigger | What to Prefetch |
|---------|-----------------|
| Link hover (200ms) | Target page data |
| Search input focus | Popular/recent results |
| Tab hover | Tab content data |
| Scroll near bottom | Next page of paginated data |
| After login | Dashboard data (critical path) |

---

## 16. Error Recovery UX

**Principle:** Errors are inevitable. Premium apps don't just show errors — they help users RECOVER. Every error should include a recovery path.

### 16.1 Error Recovery Hierarchy

```
ERROR SEVERITY → RECOVERY STRATEGY:
──────────────────────────────────────
Validation error   → Inline fix guidance (field-level)
Failed mutation    → Retry button + rollback animation
Network timeout    → Auto-retry (3x) + manual retry
Offline            → Queue changes + sync indicator
Server error (500) → Apologize + retry + support link
Auth expired       → Silent refresh + retry original request
──────────────────────────────────────
```

### 16.2 Inline Retry Pattern

```
FAILED ACTION → RETRY FLOW:
┌──────────────────────────────────┐
│ ✗ Failed to save changes         │
│                                  │
│ [Retry]  [Discard Changes]       │
└──────────────────────────────────┘
```

**Rules:**
- Auto-retry silently up to 3 times (with exponential backoff: 1s, 2s, 4s)
- If all retries fail, show manual retry button
- ALWAYS offer a "discard" or "cancel" escape hatch
- Toast with retry: "Failed to save. [Retry]" (Snackbar with action)

### 16.3 Offline UX Pattern

```
OFFLINE DETECTION:
──────────────────────────────────────
1. Detect: navigator.onLine + fetch fail
2. Show: persistent banner "You're offline"
3. Queue: store mutations locally
4. Sync: when back online, replay queue
5. Confirm: "Changes synced!" toast
──────────────────────────────────────
```

**UI Rules when offline:**
- Show persistent banner (NOT a toast — it should stay)
- Dim or disable actions that require server
- Allow viewing cached/local data
- Queue actions that can be replayed later
- Show sync indicator when reconnecting

### 16.4 Error Boundary with Recovery

For React rendering errors, the Error Boundary should offer recovery, not just "something went wrong":

```
ERROR BOUNDARY UX:
┌──────────────────────────────────┐
│                                  │
│     [Illustration: confused]     │
│                                  │
│   Something unexpected happened  │
│                                  │
│   [Reload this section]          │  ← Primary: reload just this section
│   [Go to Dashboard]             │  ← Escape: safe navigation
│   [Report Issue]                │  ← Optional: feedback loop
│                                  │
└──────────────────────────────────┘
```

### 16.5 Optimistic Rollback Animation

When an optimistic update fails and must revert:
- Animate the revert (don't just snap back)
- Show brief red flash or shake on the reverted element
- Display toast explaining what happened
- The user should understand WHY the state changed back

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Generic empty states ("No data") | Feels broken, user doesn't know what to do | Illustration + guidance + CTA |
| Blank search page | Abandonment point | Show recents + suggestions |
| Same screen for all users | Irrelevant content frustrates | Personalize by tier |
| No celebration after key action | Missed emotional peak | Add micro-animation + copy |
| Abrupt session end | Bad "End" memory | Add summary + nudge |
| "No results" dead-end | User gives up | Suggest alternatives |
| Loading with blank spinner | Feels slow and broken | Branded animation |
| All text, no visual rhythm | Fatiguing to scan | Color-coded cards + icons |
| Toast shown during typing | Interrupts flow, causes errors | Queue toasts, show after pause |
| Error on every keystroke | Punishes before user finishes | Validate on blur, not on input |
| Placeholder-only labels | Label disappears on focus, user forgets | Persistent visible labels |
| Long product tour on first visit | Users skip/forget everything | Contextual tooltips instead |
| No positive form feedback | User unsure if field is correct | Green checkmark on valid fields |
| Loading spinner on simple mutations | Feels slow, breaks flow | Optimistic update + silent sync |
| Error with no recovery path | User stuck, abandons | Retry button + alternative action |
| "Something went wrong" with no guidance | Useless, user doesn't know what to do | Specific error + recovery action |
| Snapping back on optimistic rollback | Jarring, confusing | Animate revert + explain via toast |

---

## Checklist

Before shipping ANY screen, verify:

- [ ] Have I identified the Peak moment in this flow?
- [ ] Does the End of the task feel conclusive and rewarding?
- [ ] Have I minimized friction in error/loading states?
- [ ] Is there a micro-animation or visual detail that delights at the key moment?
- [ ] Can any text be shorter?
- [ ] Is there a single clear primary action per screen?
- [ ] Are empty states designed with illustration + CTA?
- [ ] Does search show suggestions before the user types?
- [ ] Is the first impression (above the fold) impeccable?
- [ ] Have I tested with different user tiers (new/returning/power)?
- [ ] Toasts: correct placement, proper timing (3-8s), max 1 on mobile?
- [ ] Form validation: inline on blur, not premature, errors below field?
- [ ] Form labels: persistent (not placeholder-only)?
- [ ] Positive validation feedback (green checkmark) on valid fields?
- [ ] Onboarding: checklist or progressive disclosure for new users?
- [ ] Contextual tooltips instead of long product tours?
- [ ] Routine mutations use optimistic updates (instant feel)?
- [ ] Errors include recovery path (retry button, alternative action)?
- [ ] Offline state shows persistent banner + queues changes?
- [ ] Error boundary has "reload section" + "go to dashboard" options?
- [ ] Delete actions use optimistic + undo snackbar (5s window)?

---

## Related Skills

- `premium-ui-design` - Visual design rules (color, typography, spacing)
- `mobile-ux-design` - Mobile-specific patterns (haptics, bottom nav)
- `frontend-design` - Implementation patterns (animations, Framer Motion)
- `accessibility` - WCAG compliance
- `shadcn-components` - Component patterns
