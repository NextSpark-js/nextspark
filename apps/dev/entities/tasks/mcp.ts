import type { McpEntityOverride } from '@nextsparkjs/core/lib/mcp'

/**
 * Reference example of the MCP theme extension point: deletion of tasks is
 * intentionally not exposed to LLM tool-callers on this sample entity, and
 * the entity description is tailored for the MCP surface.
 */
const tasksMcpOverride: McpEntityOverride = {
  excludeOperations: ['delete'],
  describe: {
    entity: 'A to-do item owned by a team member.',
  },
}

export default tasksMcpOverride
