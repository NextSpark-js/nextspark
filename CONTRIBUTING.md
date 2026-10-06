# Contributing to NextSpark

Thank you for your interest in contributing to NextSpark! This document provides guidelines and information about contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/NextSpark-js/nextspark/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Open a [GitHub Discussion](https://github.com/NextSpark-js/nextspark/discussions) first
2. Describe the feature and its use case
3. Wait for feedback before implementing

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our coding standards
4. **Write tests** for new functionality
5. **Run tests** to ensure nothing is broken (build `ui` and `core` first, `pnpm build:core`; the suites that read `core/dist` fail without it):
   ```bash
   pnpm --filter @nextsparkjs/cli test
   pnpm exec tsx --test packages/core/tests/node/*.test.ts
   pnpm test:core
   ```
6. **Commit** with clear messages:
   ```bash
   git commit -m "feat: add new feature description"
   ```
7. **Push** and create a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `style:` | Code style (formatting, semicolons, etc.) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

## Development Setup

Contributing to this repository uses **pnpm 9** (the `packageManager` field pins `pnpm@9.0.0`). Projects created with NextSpark support pnpm 10 (>=10.34.6), 11 and 12; npm, yarn and bun are not supported.

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/nextspark.git
cd nextspark

# Install dependencies
pnpm install

# Build packages
pnpm build:core

# Run development server
pnpm dev
```

## Project Structure

```
nextspark/
├── packages/
│   ├── core/          # Main framework
│   ├── cli/           # CLI tool
│   └── create-nextspark/  # Project scaffolding
├── apps/
│   ├── dev/           # Development app
│   └── demo/          # Demo app
└── docs/              # Documentation
```

## Pull Request Guidelines

- Keep PRs focused on a single feature/fix
- Update documentation if needed
- Add tests for new functionality
- Ensure all tests pass
- Follow existing code style
- Be responsive to feedback

## Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, your PR will be merged
4. You'll be credited in the release notes

## Questions?

- Open a [GitHub Discussion](https://github.com/NextSpark-js/nextspark/discussions)
- Check existing [Issues](https://github.com/NextSpark-js/nextspark/issues)

---

Thank you for helping make NextSpark better!
