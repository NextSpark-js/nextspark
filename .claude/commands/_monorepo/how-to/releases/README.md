# Releases How-To Guide

This directory contains detailed instructions for managing NextSpark releases.

## Available Guides

| Guide | Description |
|-------|-------------|
| [npm-publish.md](./npm-publish.md) | Publish packages to npm registry |
| [npm-version.md](./npm-version.md) | Increment package versions with semantic versioning |
| [release-version.md](./release-version.md) | Create core version releases |

## Quick Reference

### Release Workflow (MANDATORY order)

```
/do:npm-version     →  List 15 packages, ask user, bump versions, commit
/do:npm-publish     →  Calls npm-version first, then: pnpm pkg:pack → pnpm pkg:publish
```

**CRITICAL:** NEVER use `npm publish` directly. It does NOT resolve `workspace:*` and BREAKS packages.

### All 15 Packages

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Themes (4):** theme-default, theme-blog, theme-crm, theme-productivity
**Plugins (4):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher

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
