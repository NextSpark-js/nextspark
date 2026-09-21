export interface SkillGuide {
  name: string
  description: string
  content: string
}

/**
 * These guides deliberately live in TypeScript rather than a repository-level
 * directory: tsup includes them in the installed CLI artifact.
 */
export const SKILL_GUIDES: readonly SkillGuide[] = [
  {
    name: 'nextspark-auth',
    description: 'Implement Better Auth, permissions, and protected NextSpark APIs.',
    content: `# NextSpark auth

Use this guide when changing sign-in, authorization, or protected API behavior.

- In an API route import \`authenticateRequest\` and \`createAuthFailureResponse\` from \`@nextsparkjs/core/lib/api/auth/dual-auth\`. Use \`authenticateRequest(request, { requiredScope: 'resource:read' })\`; API keys fail closed unless the route declares \`requiredScope\` (or deliberately uses \`allowAnyScope\`).
- Return \`createAuthFailureResponse(authResult)\` when \`!authResult.success || !authResult.user\`; this preserves the distinction between missing credentials (401) and a rejected API-key scope (403).
- Configure roles and entity permissions in \`contents/themes/{theme}/config/permissions.config.ts\` with \`PERMISSIONS_CONFIG_OVERRIDES\`. Enforce those permissions at the server/API boundary, not only in hidden UI controls.
- Add focused session, missing-credential, insufficient-scope, and allowed-path tests. Do not expose API keys or other secrets in browser code.

Keep project source and theme configuration authoritative; generated registries are derived output.`,
  },
  {
    name: 'nextspark-blocks',
    description: 'Create and evolve page-builder blocks and their source configuration.',
    content: `# NextSpark blocks

Use this guide when adding or changing a page-builder block.

- Create exactly \`config.ts\`, \`schema.ts\`, \`fields.ts\`, \`component.tsx\`, and \`index.ts\` in \`contents/themes/{theme}/blocks/{slug}/\`. The source tree is project-owned; do not edit generated registry files.
- In \`schema.ts\`, extend \`baseBlockSchema\` from \`@nextsparkjs/core/types/blocks\` for block-specific Zod fields. In \`fields.ts\`, combine \`baseContentFields\`, \`baseDesignFields\`, and \`baseAdvancedFields\` with matching \`FieldDefinition\` entries; give added fields stable names and defaults.
- Export the block config, schema, fields, and component through \`index.ts\`. Keep \`config.ts\` aligned with its slug, scope, and category, and keep component styles within the active theme conventions.
- After changing source, run \`pnpm nextspark generate\` (or \`pnpm nextspark registry:build\`) and verify both the rendered block and editor data. Use \`pnpm nextspark dev:registry\` while iterating on registry-backed source.

Generated registries under \`.nextspark/\` are framework output. Treat them as rebuildable, not as the source of truth.`,
  },
  {
    name: 'nextspark-cli',
    description: 'Use the project-local NextSpark CLI safely for generation, registries, and diagnostics.',
    content: `# NextSpark CLI

Use the CLI installed with this project so commands and guidance match its framework version.

- Run \`pnpm nextspark doctor\` before diagnosing a project setup problem.
- Run \`pnpm nextspark generate\` or \`pnpm nextspark registry:build\` after changing entities, themes, blocks, or other registry source. Use \`pnpm nextspark dev:registry\` while creating registry-backed source; use \`pnpm nextspark dev\` for normal development.
- Read \`pnpm nextspark <command> --help\` before sync or setup operations, and preserve user-authored project files.

Project source belongs in the app/content configuration. Files generated under \`.nextspark/\` or other framework output locations should be regenerated rather than hand-maintained.`,
  },
] as const

export function findSkillGuide(name: string): SkillGuide | undefined {
  return SKILL_GUIDES.find((guide) => guide.name === name)
}
