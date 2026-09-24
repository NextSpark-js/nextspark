# Package Versioning

Version the publishable NextSpark packages together unless the maintainer
explicitly requests a narrower release.

## Publishable packages

### Core packages

- `packages/core`
- `packages/ui`
- `packages/mobile`
- `packages/testing`
- `packages/cli`
- `packages/create-nextspark-app`
- `packages/ai-workflow`

### Plugins

- `plugins/ai`
- `plugins/amplitude`
- `plugins/social-media-publisher`
- `plugins/walkme`

Project templates under `packages/core/templates/projects/` are payloads inside
`@nextsparkjs/core`; they are not independently versioned or published.
`apps/dev/plugins/langchain` is project-local and is not a published package.

## Workflow

1. Read the current versions from the 11 package manifests.
2. Inspect changes since the last tag and ask the maintainer for the release
   type when it is not already explicit.
3. Use `scripts/packages/version.sh <type>` to update publishable packages.
4. Verify internal `@nextsparkjs/*` ranges remain consistent.
5. Review the diff and run the package test/build gates before committing.

Use `pnpm pkg:pack` and `pnpm pkg:publish` for packaging and publication. Never
run `npm publish` directly because it does not resolve `workspace:*` ranges.
