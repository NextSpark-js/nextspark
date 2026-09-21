import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type OnboardingFileState = 'created' | 'preserved'
export interface AiOnboardingResult {
  agents: OnboardingFileState
  claude: OnboardingFileState
}

const AGENTS = `# NextSpark project guidance

Use the project-local CLI so guidance matches this project: \`pnpm nextspark skills list\` and \`pnpm nextspark skills get <name>\`.

- Blocks: \`pnpm nextspark skills get nextspark-blocks\`
- Auth and permissions: \`pnpm nextspark skills get nextspark-auth\`
- CLI, registries, and diagnostics: \`pnpm nextspark skills get nextspark-cli\`

Edit project source and configuration, not generated/framework output such as \`.nextspark/\` registries. Regenerate derived output through the documented CLI workflow.

The legacy Claude workflow pack is optional: install it explicitly with \`pnpm nextspark setup:ai\`; it is not installed by project creation.
`

const CLAUDE = `# Claude Code

Read [AGENTS.md](./AGENTS.md) for this project’s NextSpark guidance. Load an optional versioned guide with \`pnpm nextspark skills get <name>\`.
`

function writeIfAbsent(path: string, contents: string): OnboardingFileState {
  if (existsSync(path)) return 'preserved'
  writeFileSync(path, contents, 'utf8')
  return 'created'
}

/** Write small pointers only; never replace project-authored AI instruction files. */
export function writeAiOnboarding(projectRoot: string): AiOnboardingResult {
  const bytes = Buffer.byteLength(AGENTS) + Buffer.byteLength(CLAUDE)
  if (bytes > 4096) throw new Error(`AI onboarding exceeds its 4096-byte budget (${bytes} bytes)`)
  return {
    agents: writeIfAbsent(join(projectRoot, 'AGENTS.md'), AGENTS),
    claude: writeIfAbsent(join(projectRoot, 'CLAUDE.md'), CLAUDE),
  }
}
