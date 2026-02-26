---
description: "Full design regression: audit and polish ALL screens using premium design skills"
---

# do:design-regression

**Input:** {{{ input }}}

_(Pass `web`, `mobile`, or `all` as argument. Defaults to `all` if empty.)_

---

## Purpose

Systematically audit and improve EVERY screen in the application by applying ALL premium design principles documented in the 4 design skills. This is a visual quality regression — not a code review.

---

## Required Skills

Before executing, you **MUST** read ALL 4 design skills. Do NOT skip any.

```
1. .claude/skills/frontend-design/SKILL.md          ← Orchestrator (read first)
2. .claude/skills/premium-ux-patterns/SKILL.md       ← UX psychology (11 sections)
3. .claude/skills/premium-ui-design/SKILL.md         ← Visual design rules (15 sections)
4. .claude/skills/mobile-ux-design/SKILL.md          ← Mobile-specific patterns (10 sections)
```

After reading, internalize the FOUR CHECKLISTS:
- `premium-ux-patterns` → 10-item checklist (Peak-End, empty states, search, personalization)
- `premium-ui-design` → 17-item checklist (color layers, typography, spacing, dark mode, corners)
- `mobile-ux-design` → 16-item checklist (bottom nav, haptics, tap targets, transitions)
- `frontend-design` → 4-category checklist (Foundation, Polish, Delight, Mobile-Specific)

---

## Detailed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /do:design-regression                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE A: SKILL LOADING (MANDATORY)                             │
│  ──────────────────────────────────                             │
│  0. Read ALL 4 design skills (see Required Skills)              │
│     ↓                                                           │
│  PHASE B: EVALUATION                                            │
│  ───────────────────                                            │
│  1. Parse input argument (web/mobile/all)                       │
│     ↓                                                           │
│  2. Read /about from theme (if exists)                          │
│     - business.md (understand business context)                 │
│     - critical-flows.md (know high-impact screens)              │
│     ↓                                                           │
│  3. Evaluate current design state                               │
│     - How many screens exist per platform?                      │
│     - Are shared UI components used consistently?               │
│     - Does a design system / token system exist?                │
│     ↓                                                           │
│  4. Show evaluation summary and ask for confirmation            │
│     ↓                                                           │
│  PHASE C: DISCOVERY (Claude asks questions)                     │
│  ──────────────────────────────────────────                     │
│  5. Ask discovery questions (7 questions):                      │
│     ├── Q1: Platform (from input or ask)                        │
│     ├── Q2: Scope (full / specific / shared only)               │
│     ├── Q3: Focus Areas (multi-select categories)               │
│     ├── Q4: Mode (audit only / audit+fix / fix from report)     │
│     ├── Q5: Intensity (conservative / moderate / aggressive)    │
│     ├── Q6: Dark Mode (both / light / dark)                     │
│     └── Q7: Commit Strategy (per screen / per group / all)      │
│     ↓                                                           │
│  6. Collect discovery context                                   │
│     ↓                                                           │
│  PHASE D: SCREEN DISCOVERY                                      │
│  ────────────────────────                                       │
│  7. Map all screens per platform:                               │
│     ├── Web: templates/**/page.tsx + components/**/              │
│     └── Mobile: app/(app)/*.tsx + src/components/               │
│  8. Create screen inventory table with priorities               │
│  9. Show inventory and ask for confirmation                     │
│     ↓                                                           │
│  PHASE E: AUDIT (per screen)                                    │
│  ─────────────────────────                                      │
│  10. For EACH screen (HIGH priority first):                     │
│      ├── 2A. Visual Foundation (premium-ui-design)              │
│      ├── 2B. UX Psychology (premium-ux-patterns)                │
│      ├── 2C. Mobile-Specific (mobile-ux-design) *if mobile      │
│      └── 2D. Delight & Polish (frontend-design)                 │
│     ↓                                                           │
│  PHASE F: REPORT                                                │
│  ────────────────                                               │
│  11. Generate audit report (CRITICAL / IMPROVEMENTS / POLISH)   │
│  12. Show report and PAUSE for user approval                    │
│     ↓                                                           │
│  PHASE G: FIX (if mode includes fixing)                         │
│  ──────────────────────────────────────                         │
│  13. Fix order:                                                 │
│      ├── Shared components FIRST (cascade to all screens)       │
│      ├── HIGH priority screens                                  │
│      ├── MEDIUM priority screens                                │
│      └── LOW priority screens                                   │
│  14. Per screen: READ → IDENTIFY → FIX → VERIFY                │
│  15. Commit per strategy (Q7)                                   │
│     ↓                                                           │
│  PHASE H: VERIFY                                                │
│  ────────────────                                               │
│  16. Build check (pnpm build / APK build)                       │
│  17. Consistency check across all screens                       │
│  18. Screenshots if browser/device available                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase B: Evaluation

After loading skills, show the evaluation:

```
DESIGN REGRESSION EVALUATION

Platform: [from input or "all"]

┌─────────────────────────────────────────┐
│ Design State Assessment                 │
│ - Web screens found: X                  │
│ - Mobile screens found: X               │
│ - Shared UI components: X               │
│ - Design tokens/system: Yes/No          │
│ - Dark mode support: Yes/No             │
├─────────────────────────────────────────┤
│ Estimated Scope                         │
│ - Total screens to audit: X             │
│ - Estimated fix complexity: LOW/MED/HIGH│
└─────────────────────────────────────────┘

Proceed with design regression? [Yes/No]
```

---

## Phase C: Discovery Questions

After user confirms, ask these questions using `AskUserQuestion`:

```
DISCOVERY QUESTIONS

I need some context before we begin. Please answer:

─────────────────────────────────────────

1. PLATFORM
   Which platform(s) to audit?

   [1] Web only (dashboard + public pages)
   [2] Mobile only (React Native app)
   [3] All platforms (web + mobile)

> (Pre-filled from input argument if provided)

─────────────────────────────────────────

2. SCOPE
   What is the scope of this regression?

   [1] Full regression (ALL screens, ALL checklists)
   [2] Specific screens only (I'll specify which)
   [3] Shared components only (tokens, UI library)
   [4] Continue from previous audit report

> If [2]: Ask "Which screens? (comma-separated, e.g. W1, W2, M5)"
> If [4]: Read existing report from session folder

─────────────────────────────────────────

3. FOCUS AREAS (multi-select)
   Which design categories to prioritize?

   [1] All categories (full checklist)
   [2] Color & Dark Mode (4-layer system, OKLCH, dark backgrounds)
   [3] Typography & Spacing (font scale, 8pt grid, grouping)
   [4] Icons & Visual Elements (consistency, borders, shadows)
   [5] UX Psychology (hierarchy, empty states, loading, copy)
   [6] Animations & Delight (hover, press, stagger, transitions)
   [7] Mobile-Specific (nav, haptics, tap targets, safe areas)

> Multiple selections allowed (e.g., "2, 3, 6")

─────────────────────────────────────────

4. MODE
   What should this regression do?

   [1] Audit only (generate report, no code changes)
   [2] Audit + Fix (report first, then fix after approval)
   [3] Fix only (use existing audit report)

> If [3]: Must have an existing report to reference

─────────────────────────────────────────

5. INTENSITY
   How aggressive should the fixes be?

   [1] Conservative (fix only critical issues, minimal changes)
   [2] Moderate (fix critical + improvements, respect existing patterns)
   [3] Aggressive (full premium polish, rewrite components if needed)

> Only asked if Mode includes fixing ([2] or [3])

─────────────────────────────────────────

6. DARK MODE
   Should dark mode be audited?

   [1] Both modes (light + dark)
   [2] Light mode only
   [3] Dark mode only

─────────────────────────────────────────

7. COMMIT STRATEGY
   How should changes be committed?

   [1] Per screen (one commit per screen fixed)
   [2] Per group (shared components, then HIGH, then MEDIUM, etc.)
   [3] All at once (single commit at the end)

> Only asked if Mode includes fixing ([2] or [3])

─────────────────────────────────────────

Discovery complete!

Context collected:
├── Platform: [answer]
├── Scope: [answer]
├── Focus Areas: [answer]
├── Mode: [answer]
├── Intensity: [answer]
├── Dark Mode: [answer]
└── Commit Strategy: [answer]

Proceeding with design regression...
```

### Discovery Questions Reference

| Question | Audit Only | Audit + Fix | Fix Only |
|----------|:----------:|:-----------:|:--------:|
| Q1. Platform | ✓ | ✓ | ✓ |
| Q2. Scope | ✓ | ✓ | ✓ |
| Q3. Focus Areas | ✓ | ✓ | ✓ |
| Q4. Mode | ✓ | ✓ | ✓ |
| Q5. Intensity | - | ✓ | ✓ |
| Q6. Dark Mode | ✓ | ✓ | ✓ |
| Q7. Commit Strategy | - | ✓ | ✓ |

### Escalation Triggers

During discovery, if answers suggest scope changes:

| Answer | Implication | Action |
|--------|-------------|--------|
| Scope = All + Platform = All | Very large regression | Warn: "This will audit X+ screens. Consider splitting web/mobile into separate sessions." |
| Focus = All + Intensity = Aggressive | Heavy rewrite | Warn: "Aggressive + all categories may change many files. Consider moderate first." |
| No design tokens found | Foundation issue | Recommend: "Create shared design tokens before fixing individual screens." |
| No dark mode support detected | Missing feature | Ask: "Should we add dark mode support or skip dark mode audit?" |

---

## Phase D: Screen Discovery

Discover all screens dynamically (do NOT use hardcoded lists):

### Web Screens (if platform = `web` or `all`)

```bash
# Discover route pages
web/contents/themes/belleza/templates/**/page.tsx

# Discover component directories
web/contents/themes/belleza/components/*/
```

Build an inventory table from the actual file system:

| # | Screen | File(s) | Type | Priority |
|---|--------|---------|------|----------|
| W1 | ... | ... | Dashboard/Public/Auth | HIGH/MEDIUM/LOW |

**Priority Rules:**
- **HIGH**: User-facing critical flows (booking, dashboard home, agenda, login)
- **MEDIUM**: Secondary screens (analytics, lists, details, settings)
- **LOW**: Admin-only or rarely-accessed screens

### Mobile Screens (if platform = `mobile` or `all`)

```bash
# Tab/main screens
mobile/app/(app)/*.tsx

# Detail screens
mobile/app/(app)/**/[id].tsx

# Create forms
mobile/app/(app)/**/create.tsx

# Shared components
mobile/src/components/
```

| # | Screen | File(s) | Type | Priority |
|---|--------|---------|------|----------|
| M1 | ... | ... | Tab/Detail/Form/Nav | HIGH/MEDIUM/LOW |

### Shared Components (both platforms)

Also audit reusable UI components:
- **Web:** `components/ui/` (motion system, EmptyState, AnimatedCard, etc.)
- **Mobile:** `src/components/ui/` (animated-button, animated-card, badge, toast, shimmer, etc.)

---

## Phase E: Audit (Per-Screen Checklist)

For EACH screen (sorted by priority: HIGH first), run the applicable checklists based on Q3 (Focus Areas):

### Checklist 2A: Visual Foundation (premium-ui-design)

```
[ ] Color: Uses 4-layer system (neutrals, accent scale, semantic, OKLCH)?
[ ] Color: No pure black (#000) backgrounds in dark mode?
[ ] Typography: Max 4 font sizes? Dynamic numbers use tabular-nums/monospace?
[ ] Typography: Line height 1.1-1.3x for headings, 1.3-1.5x for body?
[ ] Typography: Body text max-width 600px (50-75 chars per line)?
[ ] Typography: Alignment consistent within each section (no mixing)?
[ ] Spacing: All values divisible by 8 (or 4 for micro)? Relationship multiplier applied?
[ ] Spacing: Card padding at least 32px? (16-24px on compact/mobile)
[ ] Spacing: 160px+ between major dashboard sections?
[ ] Shadows: Subtle or none? Tinted with background hue (no gray/black)?
[ ] Gradients: Single-hue only or flat colors?
[ ] Icons: All from same library? Same weight? No emojis as icons?
[ ] Borders: Subtle (85% white or 1px with opacity)? No thick borders?
[ ] Corner radius: Nested elements follow subtraction rule?
[ ] Large text (70px+): Negative letter-spacing applied?
[ ] Lines: Replaced with spacing or alternating backgrounds?
[ ] Layout: Dashboard content within ~960px max-width container?
[ ] Stat cards: Value dominates, label is small/muted?
[ ] Secondary buttons: Use primary color at 5% opacity?
```

### Checklist 2B: UX Psychology (premium-ux-patterns)

```
[ ] Clear visual hierarchy — eye knows where to go?
[ ] Single primary action per screen?
[ ] Copywriting: Can any text be shorter? Redundant labels removed?
[ ] Empty states: Have illustration + headline + CTA (not just "No data")?
[ ] Loading states: Skeleton screens (not generic spinners)?
[ ] Error states: Helpful copy + suggested action?
[ ] Cards: Information properly grouped and ordered by importance?
[ ] Labels removed where context makes them unnecessary?
```

### Checklist 2C: Mobile-Specific (mobile-ux-design) — Only for mobile screens

```
[ ] Bottom nav: 3-5 items? Filled/outline state differentiation?
[ ] Safe area: Respected (no overlap with home indicator)?
[ ] Tap targets: ALL interactive elements minimum 44x44px?
[ ] Haptic feedback: Added to significant interactions?
[ ] Keyboard types: Correct for each input (email, phone, numeric)?
[ ] Transitions: Spring physics (not linear)?
[ ] Pull-to-refresh: Custom animation + haptic?
[ ] Primary actions: In thumb-easy zone (bottom)?
[ ] Forms: Multi-step have progress indicator?
[ ] Navigation colors: Neutral (brand color for content only)?
```

### Checklist 2D: Delight & Polish (frontend-design)

```
[ ] Peak moment has celebration animation?
[ ] End moment has summary/progress?
[ ] Hover states on all interactive web elements?
[ ] Press animations on mobile interactive elements (scale spring)?
[ ] Staggered entrance animations for lists?
[ ] Page transitions between views?
[ ] Visual connectivity: Same patterns for same states across screens?
```

---

## Phase F: Audit Report

After auditing all screens, generate this report:

```
DESIGN REGRESSION REPORT
═══════════════════════════════════════════

Platform: [web/mobile/all]
Date: [date]
Screens Audited: [count]
Focus Areas: [from Q3]
Dark Mode: [from Q6]

═══════════════════════════════════════════

CRITICAL ISSUES (must fix)
──────────────────────────────────────────
1. [Screen] - [Issue] - [Skill reference] - [Checklist item]
2. ...

IMPROVEMENTS (should fix)
──────────────────────────────────────────
1. [Screen] - [Issue] - [Skill reference] - [Checklist item]
2. ...

POLISH (nice to have)
──────────────────────────────────────────
1. [Screen] - [Issue] - [Skill reference] - [Checklist item]
2. ...

═══════════════════════════════════════════

SUMMARY BY CATEGORY:
  Visual Foundation:  X issues (Y critical, Z improvements)
  UX Psychology:      X issues (Y critical, Z improvements)
  Mobile-Specific:    X issues (Y critical, Z improvements)
  Delight & Polish:   X issues (Y critical, Z improvements)

SUMMARY BY PRIORITY:
  HIGH screens:    X issues across Y screens
  MEDIUM screens:  X issues across Y screens
  LOW screens:     X issues across Y screens

═══════════════════════════════════════════
```

**IMPORTANT:** After showing the report, PAUSE and ask the user:

```
Report generated with X total issues.

What would you like to do?
[1] Proceed with fixing ALL issues
[2] Fix only CRITICAL issues
[3] Fix CRITICAL + IMPROVEMENTS (skip POLISH)
[4] Let me review first (pause here)
```

---

## Phase G: Fix (Screen by Screen)

After user approves, fix issues following this strategy:

### Fix Order

1. **Shared components FIRST** (fixes propagate to all screens)
   - Color tokens/variables
   - Spacing system
   - Icon library consistency
   - Typography scale
   - Shared UI components (buttons, cards, badges, etc.)

2. **HIGH priority screens** (most user-facing impact)

3. **MEDIUM priority screens**

4. **LOW priority screens**

### Per-Screen Fix Process

```
For each screen being fixed:

1. READ the screen's code completely
2. READ related components it imports
3. IDENTIFY all issues from the audit for THIS screen
4. APPLY fixes following skill patterns (respect Intensity from Q5)
5. VERIFY: Run the applicable checklist again mentally
6. COMMIT if strategy = per screen (Q7)
7. MOVE to next screen
```

### Fix Categories Reference

**Color fixes:**
- Replace `#000000` with `oklch(0.14 0.01 260)` in dark mode
- Replace random hex colors with theme tokens
- Ensure 4 background depth levels
- Check text hierarchy (heading/body/caption opacity levels)
- Use primary color at 5% opacity for secondary buttons (`bg-primary/5`)

**Shadow fixes:**
- Replace gray/black shadows with background-tinted shadows
- `box-shadow: 0 4px 12px oklch(same-hue-as-bg 0.05 hue / 0.12)`

**Typography fixes:**
- Reduce to max 4 font sizes if more exist
- Add `tabular-nums` / `font-variant-numeric: tabular-nums` to dynamic numbers
- Add negative letter-spacing to hero/title text (70px+)
- Fix line-height: 1.1-1.3x for headings, 1.3-1.5x for body
- Limit body text to max-width 600px / max-w-prose
- Fix mixed alignments (center titles with left-aligned body = bad)

**Spacing fixes:**
- Align all paddings/margins to 8pt grid
- Apply relationship multiplier: 8-16px within groups, 24-32px between groups, 48-64px between sections
- Dashboard major sections: 160px+ vertical breathing room
- Card internal padding: 32px minimum (16-24px compact/mobile)
- Dashboard content: max-width ~960px container

**Icon fixes:**
- Replace emojis with Phosphor Icons (web) or consistent icon library (mobile)
- Ensure single weight throughout
- Verify filled/outline state differentiation for navigation

**Component fixes:**
- Nested corner radius = outer - padding
- Cards: move secondary actions to triple-dot menu
- Remove redundant borders/lines
- Replace spinners with skeleton screens
- Add Lottie/illustration to empty states

**Animation fixes (web):**
- Add `whileHover={{ scale: 1.02 }}` to interactive cards
- Add `whileTap={{ scale: 0.97 }}` to buttons
- Wrap lists with stagger animation
- Add page transitions

**Animation fixes (mobile):**
- Add `withSpring(0.95, { damping: 15, stiffness: 300 })` to press feedback
- Add haptic feedback (light for taps, medium for nav, heavy for confirmations)
- Verify spring physics on all transitions

**Copy fixes:**
- Shorten button text where context provides meaning
- Remove redundant labels
- Ensure all strings use i18n (no hardcoded text)

---

## Phase H: Verify

After all fixes are applied:

1. **Build check:** Ensure `pnpm build` passes (web) or APK builds (mobile)
2. **Consistency check:** Verify same patterns used across ALL fixed screens
3. **Screenshots:** Take before/after screenshots of key screens (if browser/device available)
4. **Final commit** if strategy = all at once (Q7)

---

## Important Rules

- **Read ALL 4 skills BEFORE starting.** No exceptions.
- **Discover screens dynamically.** Don't use hardcoded screen lists.
- **Ask discovery questions BEFORE auditing.** Context determines what to check.
- **Audit BEFORE fixing.** Don't start fixing mid-audit.
- **Show report and PAUSE.** User must approve before any code changes.
- **Fix shared components FIRST.** Changes cascade to all screens.
- **One screen at a time.** Don't scatter changes across multiple screens simultaneously.
- **Don't over-engineer.** Apply the principles, but don't rewrite entire components unless intensity = aggressive.
- **Preserve functionality.** This is a visual/UX polish pass, not a feature refactor.
- **Respect the intensity level.** Conservative = minimal. Moderate = balanced. Aggressive = premium polish.

---

## Error Handling

```
If a skill file is missing:
├── Warn: "Skill [name] not found. Install it first."
└── Abort: Cannot proceed without all 4 skills.

If no screens found for platform:
├── Warn: "No [web/mobile] screens found."
└── If both platforms empty: Abort.
└── If one platform empty: Continue with the other.

If build fails after fixes:
├── Revert last screen's changes
├── Show: "Build failed after fixing [screen]. Reverting."
└── Continue with next screen (skip the broken one)

If user interrupts mid-audit:
├── Save partial report
└── Show: "Partial report saved. Resume with /do:design-regression (scope = continue from report)"
```

---

## Quick Start Examples

```bash
# Audit and polish ALL screens (web + mobile)
/do:design-regression all

# Only mobile app screens
/do:design-regression mobile

# Only web dashboard + public pages
/do:design-regression web
```

---

## Related Skills

| Skill | What It Provides |
|-------|-----------------|
| `frontend-design` | Orchestrator + implementation code patterns |
| `premium-ux-patterns` | UX psychology (11 sections, 10-item checklist) |
| `premium-ui-design` | Visual rules (15 sections, 17-item checklist) |
| `mobile-ux-design` | Mobile patterns (10 sections, 16-item checklist) |

## Related Commands

| Command | When to Use |
|---------|------------|
| `/session:review` | Code quality review (not design) |
| `/do:use-skills` | Load skills for a specific task |
| `/do:validate-blocks` | Validate page builder blocks |
