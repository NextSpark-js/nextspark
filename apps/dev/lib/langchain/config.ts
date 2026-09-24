/**
 * LangChain Orchestrator Configuration for Default Theme
 *
 * This file configures the tools available to the graph-based orchestrator.
 * Each tool represents an entity or capability the AI can work with.
 *
 * ARCHITECTURE:
 * - Theme defines tools and their handlers
 * - Plugin orchestrates based on this configuration
 * - No hardcoded entity knowledge in plugin
 */

import type { OrchestratorConfig } from '@/plugins/langchain/lib/graph/types'

// Import handler implementations
import { taskHandlerNode } from './handlers/task-handler'
import { customerHandlerNode } from './handlers/customer-handler'
import { pageHandlerNode } from './handlers/page-handler'

/**
 * Orchestrator configuration with all registered tools
 */
export const orchestratorConfig: OrchestratorConfig = {
    tools: [
        {
            name: 'task',
            description: 'Task/todo management (list, create, update, delete)',
            handler: taskHandlerNode,
            exampleParameters: 'title, description, priority (low/medium/high/urgent), status (todo/in-progress/review/done/blocked), dueDate',
        },
        {
            name: 'customer',
            description: 'Customer/contact management (list, create, update, delete, search)',
            handler: customerHandlerNode,
            exampleParameters: 'query, name, email, phone, accountNumber, fields to retrieve',
        },
        {
            name: 'page',
            description: 'Page/content management (list, create, update, delete)',
            handler: pageHandlerNode,
            exampleParameters: 'title, slug, status (draft/published), content',
        },
    ],
    systemIntents: ['greeting', 'clarification'],
}
