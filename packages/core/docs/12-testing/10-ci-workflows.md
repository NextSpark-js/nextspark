# CI Workflow Templates

## Introduction

The CI workflow system provides pre-built GitHub Actions templates for automated testing. These templates follow the **core-as-provider** pattern where core provides the infrastructure and themes opt-in by configuration.

**Available Workflows:**

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `cypress-smoke.yml` | Fast critical path tests | PR (main/develop) |
| `cypress-regression.yml` | Full test suite | Nightly 2 AM UTC |

> **Note:** Tag validation happens automatically during the registry build. No separate workflow needed.

---

## Installation

### Quick Setup

Install all workflow templates:

```bash
pnpm setup:ci
```

This copies workflows from `core/templates/ci-workflows/github/` to `.github/workflows/`.

### Command Options

```bash
# List available workflows without installing
pnpm setup:ci -- --list

# Force overwrite existing workflows
pnpm setup:ci -- --force

# Show help
pnpm setup:ci -- --help
```

### Output Example

```text
🔍 CI Workflow Setup

Available workflows:
  ✓ cypress-smoke.yml (Smoke tests on PR)
  ✓ cypress-regression.yml (Nightly regression)

Installing to .github/workflows/...
  ✓ Created cypress-smoke.yml
  ✓ Created cypress-regression.yml

✅ CI workflows installed successfully!
```

---

## Workflow Details

### cypress-smoke.yml

Runs critical path tests on every PR to catch breaking changes quickly.

**Triggers:**
- Pull requests to `main` or `develop`

**Configuration:**
- Uses `@smoke` tag to filter critical path tests
- Runs on Ubuntu with Node.js 20
- Uploads artifacts on failure

**Workflow:**

```yaml
name: Cypress Smoke Tests

on:
  pull_request:
    branches: [main, develop]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_ACTIVE_THEME: ${{ vars.ACTIVE_THEME || 'default' }}

      - name: Start server and run tests
        uses: cypress-io/github-action@v6
        with:
          start: pnpm start
          wait-on: 'http://localhost:5173'
          config-file: contents/themes/${{ vars.ACTIVE_THEME || 'default' }}/tests/cypress.config.ts
        env:
          CYPRESS_grepTags: '@smoke'

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-screenshots
          path: contents/themes/*/tests/cypress/screenshots
```

---

### cypress-regression.yml

Full test suite run nightly for comprehensive coverage.

**Triggers:**
- Scheduled: 2 AM UTC daily
- Manual: workflow_dispatch

**Configuration:**
- Uses `@regression` tag for full test suite
- Generates Allure reports
- Uploads report as artifact

**Workflow:**

```yaml
name: Cypress Regression Tests

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:

jobs:
  regression-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_ACTIVE_THEME: ${{ vars.ACTIVE_THEME || 'default' }}

      - name: Start server and run tests
        uses: cypress-io/github-action@v6
        with:
          start: pnpm start
          wait-on: 'http://localhost:5173'
          config-file: contents/themes/${{ vars.ACTIVE_THEME || 'default' }}/tests/cypress.config.ts
        env:
          CYPRESS_grepTags: '@regression'

      - name: Generate Allure Report
        if: always()
        run: |
          npx allure generate contents/themes/${{ vars.ACTIVE_THEME || 'default' }}/tests/cypress/allure-results \
            -o contents/themes/${{ vars.ACTIVE_THEME || 'default' }}/tests/cypress/allure-report --clean

      - name: Upload Allure Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: allure-report
          path: contents/themes/*/tests/cypress/allure-report
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_ACTIVE_THEME` | Active theme for tests | `default` |
| `CYPRESS_BASE_URL` | Application URL | `http://localhost:5173` |
| `CYPRESS_grepTags` | Tag filter for tests | (varies by workflow) |

### Setting Repository Variables

1. Go to repository Settings > Secrets and variables > Actions
2. Click "Variables" tab
3. Add variable `ACTIVE_THEME` with your theme name

---

## Customization

After installation, customize workflows in `.github/workflows/`:

### Change Active Theme

```yaml
env:
  NEXT_PUBLIC_ACTIVE_THEME: 'my-custom-theme'
```

### Modify Tag Filters

```yaml
# Run specific feature tests
env:
  CYPRESS_grepTags: '@feat-customers'

# Combine tags (AND logic)
env:
  CYPRESS_grepTags: '@api+@smoke'

# Exclude tags
env:
  CYPRESS_grepTags: '-@slow'
```

### Add Notifications

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    channel-id: 'your-channel'
    payload: |
      {
        "text": "Cypress tests failed! ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Parallel Execution

```yaml
jobs:
  tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        feature: [customers, tasks, users, auth]
    steps:
      # ... setup steps ...
      - name: Run tests
        env:
          CYPRESS_grepTags: '@feat-${{ matrix.feature }}'
```

---

## CI/CD Strategy

### Recommended Pipeline

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Developer   │     │   GitHub     │     │   Nightly    │
│   Commits    │────▶│   PR Check   │     │   Schedule   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
 ┌───────────┐       ┌───────────┐       ┌───────────┐
 │ Pre-commit│       │  Validate │       │ Regression│
 │ --staged  │       │   Tags    │       │   Tests   │
 └───────────┘       │  + Smoke  │       │ + Allure  │
                     └───────────┘       └───────────┘
```

### Stage Recommendations

| Stage | Workflow | Tags | Purpose |
|-------|----------|------|---------|
| PR Checks | smoke + validate | `@smoke` | Fast feedback on critical paths |
| Merge Queue | sanity | `@sanity` | Quick health check before merge |
| Nightly | regression | `@regression` | Comprehensive coverage |
| Pre-release | flows | `flow-` | End-to-end user journeys |

---

## Troubleshooting

### Workflow not triggering

Check paths match your file locations:
```yaml
on:
  pull_request:
    paths:
      - 'contents/themes/**/tests/**/*.cy.ts'
```

### Theme not found

Set the `ACTIVE_THEME` variable in repository settings or hardcode:
```yaml
env:
  NEXT_PUBLIC_ACTIVE_THEME: 'default'
```

### Tests timing out

Increase timeout in Cypress config or GitHub Actions:
```yaml
- uses: cypress-io/github-action@v6
  timeout-minutes: 30
```

### Allure report not generated

Ensure allure-results directory exists:
```yaml
- name: Generate Allure Report
  if: always()
  run: |
    mkdir -p allure-results
    npx allure generate ...
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install workflows | `pnpm setup:ci` |
| List available | `pnpm setup:ci -- --list` |
| Force reinstall | `pnpm setup:ci -- --force` |

---

## Next Steps

- [Tag Validation System](./09-tag-validation-system.md) - Understand tag validation
- [Allure Reporting](./11-allure-reporting.md) - Rich HTML reports
- [E2E Testing with Cypress](./03-e2e-testing-cypress.md) - Full Cypress guide

---

**Last Updated:** 2025-12-13
**Version:** 1.1.0
**Status:** Complete
