# Accessibility (a11y)

> **1.0 target:** WCAG 2.2 AA for the `starter` template, checked two ways: axe in CI, which fails on any serious or critical finding, and a manual keyboard and focus pass over the starter's authentication flows, dashboard and task create, edit and delete. This is a target, not a claim: passing the checks is a release gate, and NextSpark does not certify that a project meets any law or standard. Content, customization and the accessibility of your own components are your responsibility. See [Stability](../22-stability-and-support/01-stability.md).

This guide covers the accessibility practices used in NextSpark's components and the checks that apply to them.

---

## 📋 Table of Contents

1. [Why Accessibility Matters](#why-accessibility-matters)
2. [ARIA Attributes and Landmarks](#aria-attributes-and-landmarks)
3. [Keyboard Navigation](#keyboard-navigation)
4. [Focus Management](#focus-management)
5. [Screen Reader Support](#screen-reader-support)
6. [Color and Visual Design](#color-and-visual-design)
7. [Semantic HTML](#semantic-html)
8. [Forms Accessibility](#forms-accessibility)
9. [Testing Accessibility](#testing-accessibility)
10. [WCAG Target](#wcag-target)
11. [Best Practices](#best-practices)
12. [Common Pitfalls](#common-pitfalls)

---

## Why Accessibility Matters

### Statistics

- **15% of the world's population** experiences some form of disability
- **Over 1 billion people** live with disabilities worldwide
- **100% of users** benefit from accessible design (mobile users, elderly, temporary disabilities)

### Benefits

✅ **Better SEO** - Semantic HTML improves search rankings
✅ **Improved UX** - Keyboard navigation helps power users
✅ **Wider Audience** - Reach users with assistive technologies
✅ **Code Quality** - Forces better architecture and structure

---

## ARIA Attributes and Landmarks

### Landmark Roles

Use landmarks to define regions of your page for screen reader users:

```typescript
function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Navigation */}
      <aside role="navigation" aria-label="Main navigation">
        <Sidebar />
      </aside>

      {/* Main content */}
      <main role="main" aria-labelledby="page-title">
        <h1 id="page-title">Dashboard</h1>
        {children}
      </main>

      {/* Complementary content */}
      <aside role="complementary" aria-label="Related information">
        <RecommendationPanel />
      </aside>
    </div>
  )
}
```

### Common ARIA Attributes

#### `aria-label` and `aria-labelledby`

```typescript
// aria-label: Direct label
<button aria-label="Close dialog">
  <XIcon className="h-4 w-4" />
</button>

// aria-labelledby: Reference to visible text
<section aria-labelledby="products-heading">
  <h2 id="products-heading">Products</h2>
  {/* Content */}
</section>

// Both together (labelledby takes precedence)
<nav aria-label="Main menu" aria-labelledby="nav-heading">
  <h2 id="nav-heading">Navigation</h2>
</nav>
```

#### `aria-describedby`

```typescript
function FormFieldWithHelp() {
  const { register, formState: { errors } } = useForm()

  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        {...register('email')}
        id="email"
        aria-describedby={errors.email ? 'email-error' : 'email-help'}
      />
      <p id="email-help" className="text-xs text-muted-foreground">
        We'll never share your email
      </p>
      {errors.email && (
        <p id="email-error" className="text-sm text-destructive">
          {errors.email.message}
        </p>
      )}
    </div>
  )
}
```

#### `aria-live` Regions

```typescript
function FormWithLiveRegion() {
  const [statusMessage, setStatusMessage] = useState('')

  const onSubmit = async (data: FormData) => {
    setStatusMessage('Submitting form...')

    try {
      await submitForm(data)
      setStatusMessage('Form submitted successfully')
    } catch (error) {
      setStatusMessage('Error submitting form. Please try again.')
    }
  }

  return (
    <>
      {/* Screen reader live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </>
  )
}
```

**Live Region Politeness Levels:**

| Value | When to Use | Behavior |
|-------|-------------|----------|
| `polite` | Status updates, success messages | Waits for current speech to finish |
| `assertive` | Errors, urgent alerts | Interrupts current speech |
| `off` | Default | No announcements |

#### `aria-current`

```typescript
function Navigation() {
  const pathname = usePathname()

  return (
    <nav role="navigation" aria-label="Main navigation">
      {navItems.map(item => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          className={cn(
            pathname === item.href && 'bg-accent text-accent-foreground'
          )}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  )
}
```

**`aria-current` Values:**

- `page` - Current page in navigation
- `step` - Current step in a process
- `location` - Current location in a map
- `date` - Current date in a calendar
- `time` - Current time in a schedule
- `true` - Generic current item

#### `aria-expanded` and `aria-controls`

```typescript
function Accordion() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="content-1"
      >
        Toggle Content
        {isOpen ? <ChevronUp /> : <ChevronDown />}
      </button>

      <div
        id="content-1"
        hidden={!isOpen}
        role="region"
        aria-labelledby="accordion-header-1"
      >
        <p>Content goes here</p>
      </div>
    </div>
  )
}
```

#### `aria-hidden`

```typescript
function IconButton() {
  return (
    <button aria-label="Delete item">
      {/* Hide decorative icon from screen readers */}
      <Trash2Icon className="h-4 w-4" aria-hidden="true" />
      {/* Visible text alternative for screen readers only */}
      <span className="sr-only">Delete</span>
    </button>
  )
}
```

---

## Keyboard Navigation

### Focus Indicators

Always provide visible focus indicators:

```css
/* globals.css */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Remove default browser outline */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### Tab Order

```typescript
function Modal({ isOpen, onClose }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>

        {/* Logical tab order: Cancel → Confirm → Close (X) */}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            tabIndex={0} // First in tab order
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            tabIndex={0} // Second in tab order
          >
            Confirm
          </Button>
        </DialogFooter>

        {/* Close button is last (handled by Radix UI) */}
      </DialogContent>
    </Dialog>
  )
}
```

### Skip Links

```typescript
// app/layout.tsx
export default function RootLayout({ children }: LayoutProps) {
  return (
    <html>
      <body>
        {/* Skip link - first focusable element */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
        >
          Skip to main content
        </a>

        <Header />

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        <Footer />
      </body>
    </html>
  )
}
```

### Keyboard Event Handlers

```typescript
function InteractiveCard({ onClick }: InteractiveCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Space or Enter activates the card
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer"
    >
      {/* Card content */}
    </div>
  )
}
```

### Escape Key Handling

```typescript
function Modal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Modal JSX
}
```

---

## Focus Management

### Focus Trap in Modals

```typescript
import { useEffect, useRef } from 'react'

function useF focusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    // Focus first element on mount
    firstElement?.focus()

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isActive])

  return containerRef
}

// Usage
function Modal({ isOpen, onClose }: ModalProps) {
  const modalRef = useFocusTrap(isOpen)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent ref={modalRef}>
        {/* Modal content */}
      </DialogContent>
    </Dialog>
  )
}
```

### Restore Focus After Modal Close

```typescript
function useRestoreFocus(isOpen: boolean) {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus()
      previousActiveElement.current = null
    }
  }, [isOpen])
}
```

### Programmatic Focus

```typescript
function SearchDialog() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus search input when dialog opens
    inputRef.current?.focus()
  }, [])

  return (
    <DialogContent>
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search..."
        aria-label="Search products"
      />
    </DialogContent>
  )
}
```

---

## Screen Reader Support

### Screen Reader Only Text

```css
/* globals.css */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### Usage Examples

```typescript
// Icon-only button
<button aria-label="Settings">
  <SettingsIcon className="h-4 w-4" aria-hidden="true" />
  <span className="sr-only">Settings</span>
</button>

// Loading indicator
<button disabled>
  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
  <span className="sr-only">Loading...</span>
</button>

// Status badge
<span className="flex items-center gap-2">
  <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
  <span>Active</span>
  <span className="sr-only">Status: Active</span>
</span>
```

### Accessible Names

```typescript
// ❌ WRONG - No accessible name
<button>
  <TrashIcon />
</button>

// ✅ CORRECT - aria-label
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

// ✅ CORRECT - Visible text
<button>
  <TrashIcon aria-hidden="true" />
  <span>Delete</span>
</button>

// ✅ CORRECT - aria-labelledby
<button aria-labelledby="delete-label">
  <TrashIcon aria-hidden="true" />
  <span id="delete-label">Delete item</span>
</button>
```

---

## Color and Visual Design

### Color Contrast Requirements

**WCAG 2.2 Level AA (the 1.0 target)**:
- **Normal text** (< 18pt): Contrast ratio ≥ 4.5:1
- **Large text** (≥ 18pt or 14pt bold): Contrast ratio ≥ 3:1
- **UI components and graphics**: Contrast ratio ≥ 3:1

**WCAG 2.2 Level AAA (Enhanced)**:
- **Normal text**: Contrast ratio ≥ 7:1
- **Large text**: Contrast ratio ≥ 4.5:1

### Checking Contrast

```typescript
// Use CSS variables for theme colors
// These are defined with proper contrast ratios

function Button({ variant = 'default' }: ButtonProps) {
  return (
    <button
      className={cn(
        // Default: bg-primary + text-primary-foreground (4.5:1 ratio)
        variant === 'default' && 'bg-primary text-primary-foreground',

        // Destructive: bg-destructive + text-destructive-foreground (4.5:1 ratio)
        variant === 'destructive' && 'bg-destructive text-destructive-foreground',

        // Outline: border + text maintain 4.5:1 against background
        variant === 'outline' && 'border border-input bg-background hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}
```

### Color Is Not the Only Visual Indicator

```typescript
// ❌ WRONG - Color only
<div>
  <span className="text-red-500">Error</span>
  <span className="text-green-500">Success</span>
</div>

// ✅ CORRECT - Color + icon + text
<div className="space-y-2">
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>Something went wrong</AlertDescription>
  </Alert>

  <Alert className="border-green-200 bg-green-50">
    <CheckCircle className="h-4 w-4 text-green-600" />
    <AlertTitle>Success</AlertTitle>
    <AlertDescription>Action completed successfully</AlertDescription>
  </Alert>
</div>
```

### Focus Indicators

```typescript
// ✅ CORRECT - Always visible focus indicator
<Button className="focus:ring-2 focus:ring-ring focus:ring-offset-2">
  Click me
</Button>

// ❌ WRONG - No focus indicator
<Button className="focus:outline-none">
  Click me
</Button>
```

---

## Semantic HTML

### Use Correct HTML Elements

```typescript
// ❌ WRONG - div as button
<div onClick={handleClick} className="cursor-pointer">
  Click me
</div>

// ✅ CORRECT - button element
<button onClick={handleClick}>
  Click me
</button>

// ❌ WRONG - div for navigation
<div>
  <a href="/home">Home</a>
  <a href="/about">About</a>
</div>

// ✅ CORRECT - nav element
<nav>
  <a href="/home">Home</a>
  <a href="/about">About</a>
</nav>
```

### Heading Hierarchy

```typescript
// ✅ CORRECT - Logical heading hierarchy
<article>
  <h1>Article Title</h1>

  <section>
    <h2>Section 1</h2>
    <p>Content...</p>

    <h3>Subsection 1.1</h3>
    <p>Content...</p>
  </section>

  <section>
    <h2>Section 2</h2>
    <p>Content...</p>
  </section>
</article>

// ❌ WRONG - Skipping heading levels
<article>
  <h1>Article Title</h1>
  <h4>Section</h4> {/* Skipped h2, h3 */}
</article>
```

### Lists

```typescript
// ✅ CORRECT - Semantic lists
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

// Feature list
<section aria-labelledby="features-heading">
  <h2 id="features-heading">Features</h2>
  <ul>
    <li>Fast performance</li>
    <li>Secure by default</li>
    <li>Easy to use</li>
  </ul>
</section>
```

---

## Forms Accessibility

### Label Association

```typescript
// ✅ CORRECT - Explicit label association
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    name="email"
  />
</div>

// ❌ WRONG - No label association
<div>
  <div>Email</div>
  <Input type="email" />
</div>
```

### Required Fields

```typescript
<div className="space-y-2">
  <Label htmlFor="email">
    Email
    <span className="text-destructive ml-1" aria-label="required">*</span>
  </Label>
  <Input
    id="email"
    type="email"
    required
    aria-required="true"
  />
</div>
```

### Error Messages

```typescript
function FormField() {
  const { register, formState: { errors } } = useForm()

  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        {...register('email')}
        id="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && (
        <p
          id="email-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {errors.email.message}
        </p>
      )}
    </div>
  )
}
```

### Fieldsets and Legends

```typescript
<fieldset>
  <legend>Shipping Address</legend>

  <div className="grid gap-4">
    <div>
      <Label htmlFor="street">Street</Label>
      <Input id="street" name="street" />
    </div>

    <div>
      <Label htmlFor="city">City</Label>
      <Input id="city" name="city" />
    </div>
  </div>
</fieldset>
```

---

## Testing Accessibility

### Automated Testing

#### ESLint Plugin

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'plugin:jsx-a11y/recommended'
  ],
  plugins: ['jsx-a11y'],
  rules: {
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/label-has-associated-control': 'error',
  }
}
```

#### Jest with jest-axe

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from './button'

expect.extend(toHaveNoViolations)

describe('Button Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <Button>Click me</Button>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have accessible name', () => {
    const { getByRole } = render(
      <Button aria-label="Close dialog">
        <XIcon />
      </Button>
    )

    expect(getByRole('button')).toHaveAccessibleName('Close dialog')
  })
})
```

#### Cypress with cypress-axe

```typescript
// cypress/support/commands.ts
import 'cypress-axe'

// In test
describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.injectAxe()
  })

  it('should not have accessibility violations', () => {
    cy.checkA11y()
  })

  it('should have proper heading structure', () => {
    cy.checkA11y(null, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
      }
    })
  })
})
```

### Checks that run for the starter

- **axe in CI.** The *Generated projects* workflow builds the `starter` from the packed packages and runs `scripts/accessibility/axe-scan.mjs` (axe-core with the WCAG 2.0, 2.1 and 2.2 A and AA rules, through Playwright). It scans the public pages and, signed in by email code, the dashboard, the task list (also with the row menu and the delete confirmation open), the task create, detail and edit pages and the profile settings. The job fails on any serious or critical violation and uploads the report as `starter-axe-report`. Moderate and minor findings are in the report and do not fail the job. axe's best-practice rules are reported but never block. With a Radix menu open, the rule `aria-hidden-focus` is switched off for that one state: the menu keeps Tab inside it, and axe flags the page behind it anyway.
- **Keyboard and focus pass (manual, one run).** A keyboard and focus pass was run on the starter at `0.1.0-beta.197` plus the fixes of this change set, with a Playwright script that is not part of the repository. It covered sign-in by email code, the dashboard, the task list, create, edit and delete (the row menu and the confirmation dialog) and the profile settings. In that flow every control was reachable with Tab, a focus ring (outline or box-shadow) showed on each stop, menus and dialogs kept Tab inside and gave focus back on Escape, and nothing trapped the keyboard. It found two defects that are fixed: the dashboard had no skip link, and focus fell to `<body>` when the confirmation dialog of a row action closed. It is a record of that run, not a test that runs on every change.
- **Not covered:** screen-reader testing, zoom and reflow, forced colors, touch target size beyond the 24 px check axe makes on the desktop viewport, the mobile layout, and pages outside those flows (superadmin, devtools, the page builder, the other templates). Also the WCAG 2.2 criteria axe cannot check (2.4.11 focus not obscured, 2.5.7 dragging, 3.3.7 redundant entry, 3.3.8 accessible authentication) and the contrast of the focus indicator: the pass only checks that an indicator is present. Automated rules find only part of the problems.

You can point the scan at your own built project: `node scripts/accessibility/axe-scan.mjs --app <project dir>`.

### Rules the starter's findings came from

- A `role="combobox"` button takes its accessible name from `aria-label` or a label, not from its text.
- Every input needs a label whose `htmlFor` matches the input's `id`.
- Use palette steps whose text reaches 4.5:1 (for example `-700` backgrounds under white text).
- After a dialog opened from a menu item closes, return focus to the control that opened the menu.
- A visible text must be part of the accessible name (2.5.3): an `aria-label` that does not contain the text the control shows fails, and so does text that is in the DOM but not in the label (an initials badge next to a labelled link). Drop the `aria-label`, or render decoration as generated content.
- Give each page one `<main>` and one top-level banner: the root layout renders no `<main>`, so each area (dashboard, settings, auth, public pages, superadmin, devtools) renders its own.

### Manual Testing

#### Keyboard Navigation Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Skip links work correctly
- [ ] Modals trap focus
- [ ] Escape key closes modals/dropdowns

#### Screen Reader Testing

**Tools:**
- **macOS**: VoiceOver (Cmd + F5)
- **Windows**: NVDA (free), JAWS (paid)
- **Linux**: Orca

**Testing Checklist:**
- [ ] All images have alt text
- [ ] Form labels are announced
- [ ] Error messages are announced
- [ ] Status updates are announced (aria-live)
- [ ] Navigation landmarks are identified
- [ ] Heading hierarchy is logical

---

## WCAG Target

The 1.0 target is WCAG 2.2 level AA, checked as described at the top of this page. Meeting a level also depends on content and customization that NextSpark does not control.

### WCAG 2.2 Levels

| Level | Requirement | Description |
|-------|-------------|-------------|
| **A** | Minimum | Basic accessibility features |
| **AA** | Mid-range | The 1.0 target |
| **AAA** | Highest | Enhanced accessibility |

### WCAG 2.2 Principles (POUR)

#### 1. **Perceivable**

Information must be presentable to users in ways they can perceive:

✅ Text alternatives for images
✅ Captions for videos
✅ Adaptable content structure
✅ Sufficient color contrast
✅ Resizable text

#### 2. **Operable**

Interface components must be operable:

✅ Keyboard accessible
✅ Enough time to read/use content
✅ No seizure-inducing flashing content
✅ Navigable structure
✅ Multiple input methods

#### 3. **Understandable**

Information and operation must be understandable:

✅ Readable text
✅ Predictable behavior
✅ Input assistance
✅ Error identification
✅ Error prevention

#### 4. **Robust**

Content must be robust enough to work with assistive technologies:

✅ Valid HTML
✅ Correct use of ARIA
✅ Compatible with current and future tools

---

## Best Practices

### 1. Use Radix UI Primitives

✅ **CORRECT**:
```typescript
import { Dialog } from '@radix-ui/react-dialog'

// Radix handles all accessibility automatically
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogTitle>Title</DialogTitle>
    <DialogDescription>Description</DialogDescription>
  </DialogContent>
</Dialog>
```

### 2. Test with Real Users

- Include users with disabilities in testing
- Use actual assistive technologies
- Don't rely solely on automated tools

### 3. Provide Text Alternatives

```typescript
// Images
<Image
  src="/product.jpg"
  alt="Blue running shoes with white laces"
  width={400}
  height={300}
/>

// Icons
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

// Videos
<video controls>
  <source src="video.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="captions.vtt"
    srclang="en"
    label="English"
  />
</video>
```

### 4. Mobile Accessibility

```typescript
// Touch targets minimum 44x44px
<button className="min-h-[44px] min-w-[44px] p-2">
  <Icon className="h-5 w-5" />
</button>

// Zoom support
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=5"
/>
```

---

## Common Pitfalls

### ❌ WRONG Patterns

```typescript
// 1. Missing alt text
<img src="product.jpg" />

// 2. Empty button
<button onClick={handleClick}>
  <Icon />
</button>

// 3. div as button
<div onClick={handleClick}>Click me</div>

// 4. Poor color contrast
<button className="bg-gray-200 text-gray-300">
  Low contrast
</button>

// 5. No focus indicator
<button className="focus:outline-none">
  Click me
</button>

// 6. Keyboard trap
<div onKeyDown={(e) => e.preventDefault()}>
  Content
</div>
```

### ✅ CORRECT Patterns

```typescript
// 1. Descriptive alt text
<img src="product.jpg" alt="Blue running shoes with white laces" />

// 2. Accessible button
<button onClick={handleClick} aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// 3. Semantic button
<button onClick={handleClick}>Click me</button>

// 4. Good contrast
<button className="bg-primary text-primary-foreground">
  High contrast
</button>

// 5. Visible focus
<button className="focus:ring-2 focus:ring-ring">
  Click me
</button>

// 6. Proper keyboard handling
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
  Content
</div>
```

---

## Related Documentation

- **[Forms and Validation](./06-forms-and-validation.md)** - Form accessibility patterns
- **[Component Architecture](./01-component-architecture.md)** - Semantic component structure
- **[shadcn/ui Integration](./02-shadcn-ui-integration.md)** - Accessible component library

---

## Resources

### Tools

- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/) - Free accessibility testing
- [WAVE Browser Extension](https://wave.webaim.org/extension/) - Visual accessibility analysis
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/) - Check contrast ratios

### Documentation

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [WebAIM](https://webaim.org/) - Comprehensive accessibility resource
- [A11y Project](https://www.a11yproject.com/) - Community-driven accessibility resource

### Testing

- [jest-axe](https://github.com/nickcolley/jest-axe) - Automated accessibility testing
- [cypress-axe](https://github.com/component-driven/cypress-axe) - Cypress accessibility plugin
- [pa11y](https://pa11y.org/) - Automated accessibility testing tool
