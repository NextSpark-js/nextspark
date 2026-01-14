---
description: Live visual demo of a feature using Playwright browser automation
---

# Task Demo - Interactive Feature Demonstration

ultrathink You are performing a live visual demonstration of a feature using Playwright.

**Session or Feature to demo:**
{{{ input }}}

---

## Your Mission

Provide a live, visual demonstration of the feature by:
1. Preparing the environment (server, cache)
2. Launching a browser with Playwright
3. Authenticating with the appropriate user(s)
4. Walking through the feature interactively

---

## Phase 1: Environment Preparation

### Step 1.1: Check Current Server Status

```bash
# Check if dev server is already running
lsof -i :5173
```

### Step 1.2: Restart Server (if needed)

```bash
# Kill existing server if running
pkill -f "next dev" || true

# Clear Next.js cache for clean state
rm -rf .next/cache

# Start fresh dev server in background
pnpm dev &
```

### Step 1.3: Wait for Server Ready

```bash
# Wait for server to be ready (check localhost:5173)
# Use browser_navigate to verify
```

Use `mcp__playwright__browser_navigate` to `http://localhost:5173` and verify the page loads.

---

## Phase 2: Understand the Feature & User Requirements

### Step 2.1: Load Session Context (if provided)

```typescript
const sessionPath = `.claude/sessions/${sessionName}/`

// Load to understand what to demo
await Read(`${sessionPath}/requirements.md`)
await Read(`${sessionPath}/plan.md`)
await Read(`${sessionPath}/tests.md`)
```

### Step 2.2: Determine Required User Type

Based on the feature, select the appropriate user:

| Feature Location | User Type | DevKeyring User |
|-----------------|-----------|-----------------|
| `/superadmin/*` | Superadmin (product owner) | `superadmin@tmt.dev` |
| `/devtools/*` | Developer | `developer@tmt.dev` |
| `/dashboard/*` (owner features) | Team Owner | `carlos.mendoza@tmt.dev` or `ana.garcia@tmt.dev` |
| `/dashboard/*` (admin features) | Team Admin | `james.wilson@tmt.dev` or `sofia.lopez@tmt.dev` |
| `/dashboard/*` (member features) | Team Member | `emily.johnson@tmt.dev` or `diego.ramirez@tmt.dev` |
| `/dashboard/*` (viewer features) | Team Viewer | `sarah.davis@tmt.dev` |
| Public pages | No login needed | Skip authentication |

### User Reference (from `contents/themes/default/config/dev.config.ts`):

```typescript
// App Roles (special system access)
superadmin@tmt.dev    // SUPERADMIN - Full system access, /superadmin routes
developer@tmt.dev     // DEVELOPER - DevTools access, /devtools routes

// Team Roles (within teams)
carlos.mendoza@tmt.dev  // Everpoint Labs (owner), Riverstone (member)
james.wilson@tmt.dev    // Everpoint Labs (admin)
ana.garcia@tmt.dev      // Ironvale Global (owner)
sofia.lopez@tmt.dev     // Riverstone (owner), Ironvale (admin)
diego.ramirez@tmt.dev   // Everpoint Labs (editor)
emily.johnson@tmt.dev   // Everpoint (member), Riverstone (admin)
sarah.davis@tmt.dev     // Ironvale Global (viewer)

// All passwords: Test1234 (demo users) or Pandora1234 (core users)
```

### Multi-User Demos

Some features require demonstrating from multiple perspectives:
- **Permission-based features:** Show owner view, then member view
- **Team features:** Show from different team contexts
- **Role-based features:** Show what each role can/cannot do

---

## Phase 3: Authentication via DevKeyring

### Step 3.1: Navigate to Login

```typescript
// Navigate to login page
await browser_navigate({ url: 'http://localhost:5173/login' })
await browser_snapshot() // Verify page loaded
```

### Step 3.2: Check DevKeyring Availability

Take a snapshot and look for the DevKeyring component (`data-cy="devkeyring-container"`).

If DevKeyring is NOT visible:
- Environment may be production mode
- Fall back to manual login with email/password fields

### Step 3.3: Login with DevKeyring

```typescript
// 1. Click DevKeyring trigger to open dropdown
await browser_click({
  element: 'DevKeyring trigger button',
  ref: '[data-cy="devkeyring-trigger"]'
})

// 2. Wait for dropdown to appear
await browser_snapshot() // See user list

// 3. Click on the desired user (by email)
await browser_click({
  element: 'User item for [email]',
  ref: '[data-cy^="devkeyring-user-"]' // Contains the email
})

// 4. Form is now filled, submit login
await browser_click({
  element: 'Login submit button',
  ref: '[data-cy="login-submit"]'
})

// 5. Wait for redirect to dashboard
await browser_wait_for({ text: 'Dashboard' })
```

### Step 3.4: Alternative - Manual Login (if no DevKeyring)

```typescript
// Fill email
await browser_type({
  element: 'Email input',
  ref: '#email',
  text: 'user@email.com'
})

// Fill password
await browser_type({
  element: 'Password input',
  ref: '#password',
  text: 'password'
})

// Submit
await browser_click({
  element: 'Login button',
  ref: '[data-cy="login-submit"]'
})
```

---

## Phase 4: Feature Demonstration

### Demo Flow Guidelines:

1. **Start from entry point** - Usually dashboard sidebar navigation
2. **Show the main view** - List pages, overview screens
3. **Demonstrate CRUD operations** (if applicable):
   - Create new item
   - View/read item details
   - Edit/update item
   - Delete item (if safe to demo)
4. **Show special features** - Filters, search, export, etc.
5. **Demonstrate edge cases** - Empty states, validation errors

### Narration Style:

As you navigate, explain what you're doing:

```markdown
**[Screenshot/Snapshot]**

"Now I'm navigating to the Scheduled Actions page from the DevTools menu.
Notice the sidebar highlights the current section..."

**[Click action]**

"I'll click on 'New Action' to create a scheduled task. The form shows
fields for name, schedule (cron expression), and the action type..."
```

### Taking Screenshots:

Use `browser_take_screenshot` at key moments:
- After each major navigation
- Before and after important actions
- To capture final states

```typescript
await browser_take_screenshot({
  filename: 'demo-step-1-dashboard.png'
})
```

---

## Phase 5: Multi-User Demo (if required)

For features requiring multiple user perspectives:

### Step 5.1: Complete First User Demo

Document what was demonstrated with the first user.

### Step 5.2: Logout

```typescript
// Navigate to logout or use profile menu
await browser_navigate({ url: 'http://localhost:5173/api/auth/sign-out' })
// Or click logout button in profile dropdown
```

### Step 5.3: Login as Second User

Repeat Phase 3 with different user credentials.

### Step 5.4: Show Different Perspective

Navigate to same feature and show:
- What's visible/hidden for this role
- What actions are available/restricted
- Different UI elements based on permissions

---

## Phase 6: Wrap Up

### Step 6.1: Summary

After completing the demo:

```markdown
## Demo Complete!

**Feature Demonstrated:** [Feature Name]

**Users Used:**
- [User 1]: [What was shown]
- [User 2]: [What was shown]

**Key Screens Visited:**
1. [Screen 1] - [Purpose]
2. [Screen 2] - [Purpose]
...

**Actions Performed:**
- Created: [items]
- Viewed: [items]
- Modified: [items]

**Screenshots Captured:**
- demo-step-1-xxx.png
- demo-step-2-xxx.png
...
```

### Step 6.2: Clean Up

```typescript
// Close browser
await browser_close()

// Optionally stop dev server if started for demo
// pkill -f "next dev"
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check for port conflicts
lsof -i :5173
# Kill conflicting process
kill -9 [PID]
```

### DevKeyring Not Visible
- Check `NEXT_PUBLIC_APP_URL` is set to localhost
- Verify not running in production mode
- Check `dev.config.ts` has `devKeyring.enabled: true`

### Login Fails
- Verify user exists in database (run migrations)
- Check password hash matches
- Try manual login to see error message

### Page Not Loading
```typescript
// Check console for errors
await browser_console_messages({ level: 'error' })

// Check network requests
await browser_network_requests()
```

---

## User Interaction During Demo

The user can interrupt at any time:

- **"pause"** - Stop and explain current state
- **"go back"** - Navigate to previous screen
- **"show [X]"** - Navigate to specific section
- **"login as [role]"** - Switch to different user
- **"take screenshot"** - Capture current state
- **"stop"** - End demo

---

**Now prepare the environment and begin the demonstration.**
