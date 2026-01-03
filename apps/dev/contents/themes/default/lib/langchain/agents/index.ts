import fs from 'fs'
import path from 'path'

const AGENTS_DIR = path.join(process.cwd(), 'contents/themes/default/lib/langchain/agents')

/**
 * Agent names that have .md prompt files in the agents directory.
 */
export type AgentName = 'orchestrator' | 'task-assistant' | 'customer-assistant' | 'page-assistant' | 'single-agent'

/**
 * Load a system prompt from markdown file
 *
 * @param agentName - Name of the agent (without .md extension)
 * @returns The system prompt content as a string
 * @throws Error if the agent prompt file is not found
 *
 * @example
 * ```typescript
 * const systemPrompt = loadSystemPrompt('task-assistant')
 * const agent = await createAgent({ systemPrompt, ... })
 * ```
 */
export function loadSystemPrompt(agentName: AgentName): string {
    const filePath = path.join(AGENTS_DIR, `${agentName}.md`)

    if (!fs.existsSync(filePath)) {
        throw new Error(`Agent prompt not found: ${agentName}. Expected file: ${filePath}`)
    }

    return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Get list of available agent names
 *
 * Scans the agents directory for .md files and returns their names
 *
 * @returns Array of agent names (without .md extension)
 */
export function getAvailableAgents(): string[] {
    if (!fs.existsSync(AGENTS_DIR)) {
        return []
    }

    const files = fs.readdirSync(AGENTS_DIR)
    return files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
}

/**
 * Check if an agent exists
 *
 * @param agentName - Name of the agent to check
 * @returns true if the agent prompt file exists
 */
export function agentExists(agentName: string): boolean {
    const filePath = path.join(AGENTS_DIR, `${agentName}.md`)
    return fs.existsSync(filePath)
}
