# CI Workflows Templates

This directory contains CI/CD workflow templates that can be installed into your project's `.github/workflows/` directory.

## Overview

The workflow system follows the **core-as-provider** pattern:
- **Core** provides workflow templates in `core/presets/ci-workflows/github/`
- **User** installs workflows via `npm run setup:ci`

## Available Workflows

| Workflow | Description | Trigger |
|----------|-------------|---------|
| `cypress-smoke.yml` | Runs smoke tests on PRs | Pull requests |
| `cypress-regression.yml` | Full regression suite | Nightly schedule |

> **Note:** Tag validation happens automatically during the registry build (`node core/scripts/build/registry.mjs`). No separate workflow needed.

## Installation

Run the setup command to copy workflows to your project:

```bash
npm run setup:ci
```

This copies all workflow templates from `core/presets/ci-workflows/github/` to `.github/workflows/`.

## Workflow Details

### cypress-smoke.yml

Runs critical path tests on every PR to catch breaking changes quickly.

**Configuration:**
- Uses `@smoke` tag to filter tests
- Runs on Ubuntu with Node.js 20
- Uploads artifacts on failure

### cypress-regression.yml

Full test suite run nightly for comprehensive coverage.

**Configuration:**
- Uses `@regression` tag (all tests)
- Scheduled for 2 AM UTC daily
- Can also be triggered manually
- Generates Allure reports

## Customization

After installation, you can customize workflows in `.github/workflows/`:

1. **Change theme**: Set `NEXT_PUBLIC_ACTIVE_THEME` environment variable
2. **Modify tags**: Adjust `grepTags` in test commands
3. **Add notifications**: Add Slack/Discord notifications on failure
4. **Parallel execution**: Configure matrix strategy for faster runs

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_ACTIVE_THEME` | Active theme for tests | `default` |
| `CYPRESS_BASE_URL` | Application URL | `http://localhost:5173` |

## Related Files

- `core/scripts/build/registry.mjs` - Registry build with tag validation
- `core/lib/registries/testing-registry.ts` - Auto-generated tag registry
- `scripts/setup-ci.mjs` - Workflow installation script
