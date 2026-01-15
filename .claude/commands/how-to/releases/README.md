# Releases How-To Guide

This directory contains detailed instructions for managing NextSpark releases.

## Available Guides

| Guide | Description |
|-------|-------------|
| [npm-publish.md](./npm-publish.md) | Publish packages to npm registry |
| [npm-version.md](./npm-version.md) | Increment package versions with semantic versioning |
| [release-version.md](./release-version.md) | Create core version releases |

## Quick Reference

### Release Workflow

1. **Version Bump** → `do:npm-version`
2. **Package** → Build tarballs
3. **Publish** → `do:npm-publish`
4. **Release** → `do:release-version`

### Semantic Versioning

| Type | When to use | Example |
|------|-------------|---------|
| MAJOR | Breaking changes | 1.0.0 → 2.0.0 |
| MINOR | New features (backwards compatible) | 1.0.0 → 1.1.0 |
| PATCH | Bug fixes | 1.0.0 → 1.0.1 |

### NPM Tags

| Tag | Use Case |
|-----|----------|
| `latest` | Stable releases |
| `beta` | Pre-release testing |
| `alpha` | Early development |
| `next` | Upcoming features |

## Related Commands

- `/do:npm-publish` - Quick publish command
- `/do:npm-version` - Quick version command
- `/do:release-version` - Quick release command
