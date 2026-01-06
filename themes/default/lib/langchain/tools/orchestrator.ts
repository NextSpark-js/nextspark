import { z } from 'zod'
import { ToolDefinition } from '@/plugins/langchain/lib/tools-builder'

/**
 * Agent types that can be routed to
 */
export type AgentType = 'task' | 'customer' | 'page'

/**
 * Routing result structure
 */
export interface RoutingResult {
    agent: AgentType
    message: string
}

/**
 * Clarification result structure
 */
export interface ClarificationResult {
    action: 'clarify'
    question: string
    options: Array<{ label: string; description: string }>
}

/**
 * Create orchestrator routing tools
 *
 * These tools don't execute operations directly; they return routing decisions
 * that the orchestrator handler uses to delegate to specialized agents.
 */
export function createOrchestratorTools(): ToolDefinition<any>[] {
    return [
        {
            name: 'route_to_task',
            description: 'Route the request to the task management agent. Use when the user wants to manage tasks, to-dos, work items, deadlines, or project-related items.',
            schema: z.object({
                message: z.string().describe('The user message to forward to the task agent'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({
                    agent: 'task',
                    message,
                } as RoutingResult)
            },
        },
        {
            name: 'route_to_customer',
            description: 'Route the request to the customer management agent. Use when the user wants to manage customers, clients, accounts, contacts, offices, sales representatives, or sales-related data.',
            schema: z.object({
                message: z.string().describe('The user message to forward to the customer agent'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({
                    agent: 'customer',
                    message,
                } as RoutingResult)
            },
        },
        {
            name: 'route_to_page',
            description: 'Route the request to the page/content management agent. Use when the user wants to manage pages, website content, blocks, landing pages, SEO, or publishing.',
            schema: z.object({
                message: z.string().describe('The user message to forward to the page agent'),
            }),
            func: async ({ message }) => {
                return JSON.stringify({
                    agent: 'page',
                    message,
                } as RoutingResult)
            },
        },
        {
            name: 'ask_clarification',
            description: 'Ask the user for clarification when the request is ambiguous and you cannot determine which agent should handle it. Provide 2-3 specific options.',
            schema: z.object({
                question: z.string().describe('The clarification question to ask the user'),
                options: z.array(z.object({
                    label: z.string().describe('Short label for the option (e.g., "Tarea", "Cliente", "Página")'),
                    description: z.string().describe('Brief description of what this option means'),
                })).min(2).max(4).describe('Options to present to the user'),
            }),
            func: async ({ question, options }) => {
                return JSON.stringify({
                    action: 'clarify',
                    question,
                    options,
                } as ClarificationResult)
            },
        },
    ]
}
