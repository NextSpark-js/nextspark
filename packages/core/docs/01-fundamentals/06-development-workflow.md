# Development Workflow

## Introduction

This document describes the development workflow, from task planning to deployment. The workflow is optimized for AI-assisted development using Claude Code with the `.rules/` system.

**Core Principles:**
- **Zero Tolerance** - No errors, warnings, or failing tests
- **AI-Assisted** - Claude Code agents for automation
- **Task Tracking** - TodoWrite for complex tasks
- **Testing First** - Write tests before/during implementation
- **Type Safety** - TypeScript strict mode always

---

## 1. The .rules/ System

### Overview

The `.rules/` system provides modular, contextual guidelines for AI-assisted development with Claude Code.

**Directory Structure:**
```text
.rules/
├── core.md                   # Core development principles
├── testing.md                # Testing guidelines
├── components.md             # Component patterns
├── performance.md            # Performance rules
├── planning.md               # Task planning templates
├── auth.md                   # Authentication patterns
├── api.md                    # API development standards
├── i18n.md                   # Internationalization
├── documentation.md          # Documentation requirements
├── migration.md              # Migration guides
├── plugins.md                # Plugin development
├── dependencies.md           # Dependency management
└── dynamic-imports.md        # Import policy enforcement
```

### Rule Loading Strategy

**Automatic Context Loading:**
```typescript
// Claude Code automatically loads relevant rules based on task context

if (task.involves('development')) {
  await Read('.rules/core.md')
  await TodoWrite() // For complex tasks (3+ steps)
}

if (task.involves('testing') || task.involves('code_changes')) {
  await Read('.rules/testing.md')
  await launchAgent('test-writer-fixer')
}

if (task.involves('components') || task.involves('ui')) {
  await Read('.rules/components.md')
  await launchAgent('frontend-developer')
}

if (task.involves('api') || task.involves('entity')) {
  await Read('.rules/api.md')
  await launchAgent('backend-developer')
}
```

### Key Rules

**From `.rules/core.md`:**
- Zero tolerance for errors (TypeScript, linting, tests)
- Registry-based architecture (no dynamic imports)
- Build-time generation (17,255x performance)
- Type safety everywhere

**From `.rules/testing.md`:**
- Test coverage: 90%+ critical, 80%+ important
- Cypress E2E + Jest unit testing
- Global sessions for 3-5x faster E2E
- POM (Page Object Model) patterns

**From `.rules/components.md`:**
- shadcn/ui only (no modifications)
- CSS variables for theming
- Full accessibility (ARIA, keyboard nav)
- Compound component patterns

---

## 2. Zero Tolerance Policy

### No Errors Allowed

**TypeScript Errors:**
```bash
# ❌ PROHIBITED - Any TypeScript errors
tsc --noEmit
# Must show: "Found 0 errors"
```

**Linting Errors:**
```bash
# ❌ PROHIBITED - Any ESLint errors
npm run lint
# Must show: "✓ No ESLint warnings or errors"
```

**Test Failures:**
```bash
# ❌ PROHIBITED - Any test failures
npm test
# Must show: "All tests passed"

npm run test:e2e
# Must show: "All specs passed!"
```

### Enforcement

**Pre-Commit Hooks:**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run type-check && npm run lint && npm test"
    }
  }
}
```

**CI/CD Pipeline:**
```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: npx tsc --noEmit

- name: Lint
  run: npm run lint

- name: Unit Tests
  run: npm test

- name: E2E Tests
  run: npm run test:e2e
```

---

## 3. TodoWrite Integration

### When to Use TodoWrite

**Mandatory for:**
- Complex tasks (3+ steps)
- Multi-file changes
- New feature development
- Bug fixes requiring investigation
- Entity creation
- API endpoint development

**NOT needed for:**
- Single trivial tasks (1-2 steps)
- Simple documentation updates
- Minor text changes

### TodoWrite Format

```typescript
await TodoWrite({
  todos: [
    {
      content: "Research existing code and patterns",
      status: "completed",
      activeForm: "Researching code patterns"
    },
    {
      content: "Implement new feature with types",
      status: "in_progress",
      activeForm: "Implementing feature"
    },
    {
      content: "Write comprehensive tests (unit + E2E)",
      status: "pending",
      activeForm: "Writing tests"
    },
    {
      content: "Update documentation",
      status: "pending",
      activeForm: "Updating documentation"
    }
  ]
})
```

### Todo States

- **pending** - Not started
- **in_progress** - Currently working (ONLY ONE at a time)
- **completed** - Finished successfully

### Rules

1. **One in_progress** - Only one task marked as in_progress at any time
2. **Mark completed** - Mark tasks completed IMMEDIATELY after finishing
3. **Update frequently** - Update status as you work
4. **Detailed descriptions** - Clear, actionable task descriptions

---

## 4. Development Commands

### Setup & Installation

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Run database migrations
pnpm db:migrate

# Build registries (REQUIRED before dev)
pnpm registry:build
```

### Development

```bash
# Start dev server (port 5173)
pnpm dev

# Dev with registry watch mode
pnpm dev:watch

# Build registries (manually)
pnpm registry:build

# Build registries (watch mode)
pnpm registry:build-watch

# Build theme CSS
pnpm theme:build

# Build theme CSS (watch mode)
pnpm theme:build-watch
```

### Testing

```bash
# Run all tests
pnpm test

# Unit tests (Jest)
pnpm test:unit

# E2E tests (Cypress)
pnpm test:e2e

# E2E with UI
pnpm cy:open

# Specific test file
pnpm test path/to/test.test.ts
```

### Linting & Type Checking

```bash
# Lint code
pnpm lint

# Lint and fix
pnpm lint:fix

# Type check
pnpm type-check

# Check dynamic imports (enforce zero-import policy)
pnpm check:dynamic-imports
```

### Build & Deploy

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Build and start
pnpm build && pnpm start
```

---

## 5. Task Planning Workflow

### Step 1: Analyze Requirements

```typescript
// Load planning rules
await Read('.rules/planning.md')

// Use TodoWrite for complex tasks (3+ steps)
await TodoWrite({
  todos: [
    { content: "Analyze requirements and existing code", status: "in_progress", activeForm: "Analyzing requirements" },
    { content: "Plan implementation approach", status: "pending", activeForm: "Planning implementation" },
    { content: "Create task breakdown", status: "pending", activeForm: "Creating task breakdown" }
  ]
})
```

### Step 2: Break Down Tasks

**For Entity Creation:**
```typescript
await TodoWrite({
  todos: [
    { content: "Create entity config in contents/themes/default/entities/[entity]/", status: "pending", activeForm: "Creating entity config" },
    { content: "Define field definitions with validation", status: "pending", activeForm: "Defining fields" },
    { content: "Create database migration", status: "pending", activeForm: "Creating migration" },
    { content: "Add translations (en.json + es.json)", status: "pending", activeForm: "Adding translations" },
    { content: "Rebuild registries (pnpm registry:build)", status: "pending", activeForm: "Rebuilding registries" },
    { content: "Test CRUD operations via API", status: "pending", activeForm: "Testing CRUD" },
    { content: "Write unit tests for service layer", status: "pending", activeForm: "Writing unit tests" },
    { content: "Write E2E tests for dashboard", status: "pending", activeForm: "Writing E2E tests" }
  ]
})
```

**For API Endpoint:**
```typescript
await TodoWrite({
  todos: [
    { content: "Review API standards in .rules/api.md", status: "pending", activeForm: "Reviewing API standards" },
    { content: "Create route handler in app/api/v1/[endpoint]/route.ts", status: "pending", activeForm: "Creating route handler" },
    { content: "Implement dual authentication (session + API key)", status: "pending", activeForm: "Implementing auth" },
    { content: "Add service layer methods with RLS", status: "pending", activeForm: "Adding service methods" },
    { content: "Write API tests (unit + integration)", status: "pending", activeForm: "Writing tests" },
    { content: "Test with curl and Postman", status: "pending", activeForm: "Manual testing" }
  ]
})
```

### Step 3: Execute Tasks

```typescript
// Load relevant rules
await Read('.rules/core.md')
await Read('.rules/api.md')

// Mark first task as in_progress
await TodoWrite({ /* mark task 1 in_progress */ })

// Implement task 1
// ... code ...

// Mark task 1 completed, task 2 in_progress
await TodoWrite({ /* update statuses */ })

// Continue for all tasks
```

---

## 6. Claude Code Agent Integration

### Available Agents

**test-writer-fixer:**
- Runs after ANY code changes
- Writes missing tests
- Fixes failing tests
- Validates coverage

**frontend-developer:**
- Component development
- shadcn/ui integration
- Accessibility implementation
- Responsive design

**backend-developer:**
- API endpoint creation
- Service layer implementation
- Database operations
- Authentication

**api-architect:**
- API design
- Endpoint planning
- Response formatting
- Error handling

**performance-optimizer:**
- Bundle size optimization
- Code splitting
- Performance monitoring
- Core Web Vitals

### Agent Orchestration

**Single Agent (Focused Work):**
```typescript
// For specific domain work
await launchAgent('frontend-developer', {
  focus: 'component_system',
  requirements: ['shadcn/ui', 'accessibility', 'theme awareness']
})
```

**Multi-Agent (Complex Features):**
```typescript
// Phase 1: Architecture
await launchAgent('api-architect', {
  focus: 'endpoint_design',
  deliverables: ['API spec', 'response schemas']
})

// Phase 2: Implementation
await launchAgent('backend-developer', {
  focus: 'api_implementation',
  requirements: ['dual auth', 'RLS', 'type safety']
})

// Phase 3: Testing
await launchAgent('test-writer-fixer', {
  focus: 'comprehensive_testing',
  coverage: ['unit tests', 'E2E tests', '90%+ coverage']
})

// Phase 4: Optimization
await launchAgent('performance-optimizer', {
  focus: 'api_performance',
  targets: ['response time <100ms', 'memory usage']
})
```

---

## 7. Testing Workflow

### Test-Driven Development

**Recommended Flow:**
```bash
# 1. Write failing test
pnpm test:unit path/to/feature.test.ts
# Test fails (expected)

# 2. Implement feature
# ... code ...

# 3. Run test again
pnpm test:unit path/to/feature.test.ts
# Test passes

# 4. Write E2E test
pnpm cy:open
# Write spec, watch it fail

# 5. Fix implementation
# ... code ...

# 6. Run E2E test
pnpm test:e2e
# Test passes
```

### Test Coverage Requirements

**Critical Paths (90%+):**
- Authentication flows
- Payment processing
- Data mutations (CRUD)
- API endpoints

**Important Features (80%+):**
- Dashboard components
- Form validation
- Data fetching
- Navigation

**Optional (60%+):**
- UI components
- Utilities
- Formatters

### Running Tests

```bash
# All tests (quick)
pnpm test

# All tests (with coverage)
pnpm test:coverage

# Watch mode (development)
pnpm test:watch

# Specific test file
pnpm test auth.test.ts

# E2E (headless)
pnpm test:e2e

# E2E (with browser)
pnpm cy:open
```

---

## 8. Git Workflow

### Branch Strategy

```text
main                    # Production-ready code
├── feature/            # New features
├── fix/                # Bug fixes
├── refactor/           # Code improvements
└── docs/               # Documentation updates
```

### Branch Naming

```bash
# Features
git checkout -b feature/add-user-management
git checkout -b feature/implement-oauth

# Bug fixes
git checkout -b fix/auth-redirect-loop
git checkout -b fix/api-error-handling

# Refactoring
git checkout -b refactor/extract-service-layer
git checkout -b refactor/optimize-queries

# Documentation
git checkout -b docs/update-api-docs
git checkout -b docs/add-setup-guide
```

### Commit Messages

**Format:**
```text
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Add/update tests
- `docs`: Documentation
- `style`: Code style (formatting)
- `perf`: Performance improvement
- `chore`: Maintenance tasks

**Examples:**
```bash
# Good commits
git commit -m "feat(auth): add Google OAuth integration"
git commit -m "fix(api): resolve CORS error on /api/v1/tasks"
git commit -m "refactor(entities): extract common field definitions"
git commit -m "test(auth): add E2E tests for login flow"

# Bad commits (avoid)
git commit -m "fix bug"
git commit -m "updates"
git commit -m "WIP"
```

### Pull Request Process

**1. Create Branch:**
```bash
git checkout -b feature/my-feature
```

**2. Develop & Test:**
```bash
# Implement feature
# ... code ...

# Run tests
pnpm test
pnpm test:e2e

# Type check
pnpm type-check

# Lint
pnpm lint
```

**3. Commit Changes:**
```bash
git add .
git commit -m "feat(scope): descriptive message"
```

**4. Push & Create PR:**
```bash
git push origin feature/my-feature

# Create PR via GitHub UI or:
gh pr create --title "Feature: My Feature" --body "Description..."
```

**5. Address Review Comments:**
```bash
# Make changes
# ... code ...

git add .
git commit -m "fix: address review comments"
git push
```

**6. Merge:**
```bash
# After approval, merge via GitHub UI
# or use CLI:
gh pr merge --squash
```

---

## 9. Code Review Standards

### Reviewer Checklist

**Functionality:**
- [ ] Feature works as intended
- [ ] No bugs or regressions
- [ ] Edge cases handled

**Code Quality:**
- [ ] Follows TypeScript standards
- [ ] No `any` types
- [ ] Clear variable/function names
- [ ] Appropriate abstractions

**Testing:**
- [ ] Unit tests cover critical logic
- [ ] E2E tests cover user flows
- [ ] Tests are clear and maintainable
- [ ] Coverage meets requirements

**Architecture:**
- [ ] Uses registry-based access
- [ ] No dynamic imports (except UI)
- [ ] Proper service layer usage
- [ ] RLS implemented where needed

**Performance:**
- [ ] No unnecessary re-renders
- [ ] Proper memoization
- [ ] Efficient queries
- [ ] Bundle size acceptable

**Documentation:**
- [ ] Code is self-documenting
- [ ] Complex logic has comments
- [ ] API changes documented
- [ ] README updated if needed

### Common Issues

**❌ Import violations:**
```typescript
// REJECT - Direct import from contents
import { config } from '@/contents/themes/default/config/theme.config'

// ACCEPT - Registry-based access
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'
```

**❌ Type safety violations:**
```typescript
// REJECT - Using 'any'
const data: any = await fetchData()

// ACCEPT - Proper typing
const data: ApiResponse<Task> = await fetchData()
```

**❌ Missing tests:**
```typescript
// REJECT - No tests for critical feature
export function processPayment(amount: number) {
  // Complex payment logic
}

// ACCEPT - Comprehensive tests
describe('processPayment', () => {
  it('should process valid payment', async () => { /* ... */ })
  it('should reject invalid amount', async () => { /* ... */ })
  it('should handle network errors', async () => { /* ... */ })
})
```

---

## 10. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build registries
        run: pnpm registry:build

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:unit

      - name: E2E tests
        run: pnpm test:e2e

      - name: Build
        run: pnpm build
```

### Deployment

**Vercel (Recommended):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Environment Variables:**
```bash
# Required in Vercel dashboard:
DATABASE_URL=...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=...
RESEND_API_KEY=...
```

---

## Summary

**Workflow Steps:**
1. Load relevant `.rules/` files
2. Use TodoWrite for complex tasks (3+ steps)
3. Implement with zero tolerance (no errors)
4. Write tests (90%+ critical, 80%+ important)
5. Launch test-writer-fixer agent
6. Create pull request
7. Address review comments
8. Merge and deploy

**Zero Tolerance:**
- No TypeScript errors
- No linting errors
- No failing tests
- Fix issues, don't suppress

**Agent Integration:**
- test-writer-fixer after ALL code changes
- Specialized agents for domain work
- Multi-agent orchestration for complex features

**Testing:**
- Test-driven development preferred
- Unit tests + E2E tests required
- Coverage requirements enforced
- Global sessions for faster E2E

**Git Workflow:**
- Feature branches
- Descriptive commit messages
- Comprehensive PR descriptions
- Code review checklist

**Deployment:**
- CI/CD via GitHub Actions
- Automated testing before merge
- Vercel for production hosting

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
