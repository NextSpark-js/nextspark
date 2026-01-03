/**
 * ============================================================================
 * AGENT HELPERS FACTORY
 * ============================================================================
 *
 * Provides utility functions for working with agent configurations.
 * Themes define their agents in langchain.config.ts, then use these helpers.
 *
 * USAGE:
 * ```typescript
 * // In theme's langchain.config.ts
 * import { createAgentHelpers } from '@/plugins/langchain/lib/agent-helpers'
 *
 * export const AGENTS = { ... }
 * export const helpers = createAgentHelpers(AGENTS)
 * // or destructure: export const { getAgentConfig, getAgentTools } = createAgentHelpers(AGENTS)
 * ```
 *
 * ============================================================================
 */

import type {
    AgentDefinition,
    AgentContext,
    SessionConfig,
    ToolDefinition,
    ThemeLangChainConfig,
} from '../types/langchain.types'

/**
 * Agent helpers interface - all utilities for working with agent configs
 */
export interface AgentHelpers {
    /** Get complete configuration for an agent */
    getAgentConfig: (agentName: string) => AgentDefinition | undefined

    /** Get model configuration (provider, model, temperature) */
    getAgentModelConfig: (agentName: string) => Partial<{
        provider: 'openai' | 'anthropic' | 'ollama'
        model: string
        temperature: number
    }> | undefined

    /** Get tools for an agent with runtime context */
    getAgentTools: (agentName: string, context: AgentContext) => ToolDefinition<any>[]

    /** Get system prompt name (to be loaded from .md file) */
    getAgentPromptName: (agentName: string) => string | undefined

    /** Get session configuration for an agent (TTL, maxMessages) */
    getAgentSessionConfig: (agentName: string) => SessionConfig | undefined

    /** Get enrichContext function for an agent */
    getAgentEnrichContext: (agentName: string) => ((context: AgentContext) => Promise<AgentContext>) | undefined

    /** Check if an agent is configured */
    hasAgent: (agentName: string) => boolean

    /** Get all configured agent names */
    getAgentNames: () => string[]
}

/**
 * Create agent helper functions bound to a specific agents configuration.
 *
 * @param agents - Record of agent name to AgentDefinition
 * @param defaults - Optional default values for provider/model/temperature
 * @returns Object with all helper functions
 *
 * @example
 * ```typescript
 * const AGENTS = {
 *     'single-agent': {
 *         provider: 'ollama',
 *         model: 'llama3.2:3b',
 *         temperature: 0.3,
 *         systemPrompt: 'single-agent',
 *         createTools: (ctx) => [...tools],
 *     },
 * }
 *
 * const helpers = createAgentHelpers(AGENTS)
 * const config = helpers.getAgentConfig('single-agent')
 * const tools = helpers.getAgentTools('single-agent', { userId, teamId })
 * ```
 */
export function createAgentHelpers(
    agents: Record<string, AgentDefinition>,
    defaults?: {
        provider?: 'openai' | 'anthropic' | 'ollama'
        model?: string
        temperature?: number
    }
): AgentHelpers {
    return {
        /**
         * Get complete configuration for an agent
         */
        getAgentConfig(agentName: string): AgentDefinition | undefined {
            return agents[agentName]
        },

        /**
         * Get model configuration for an agent (provider, model, temperature)
         */
        getAgentModelConfig(agentName: string): Partial<{
            provider: 'openai' | 'anthropic' | 'ollama'
            model: string
            temperature: number
        }> | undefined {
            const agent = agents[agentName]
            if (!agent) {
                // Fall back to defaults if provided
                if (defaults?.provider) {
                    return {
                        provider: defaults.provider,
                        model: defaults.model,
                        temperature: defaults.temperature,
                    }
                }
                return undefined
            }

            return {
                provider: agent.provider,
                model: agent.model,
                temperature: agent.temperature,
            }
        },

        /**
         * Get tools for an agent with runtime context
         */
        getAgentTools(
            agentName: string,
            context: AgentContext
        ): ToolDefinition<any>[] {
            const agent = agents[agentName]
            if (!agent?.createTools) {
                return []
            }
            return agent.createTools(context) as ToolDefinition<any>[]
        },

        /**
         * Get system prompt name for an agent
         * Returns the prompt name to be loaded from .md file
         */
        getAgentPromptName(agentName: string): string | undefined {
            const agent = agents[agentName]
            return agent?.systemPrompt
        },

        /**
         * Get session configuration for an agent (TTL, maxMessages)
         */
        getAgentSessionConfig(agentName: string): SessionConfig | undefined {
            const agent = agents[agentName]
            return agent?.sessionConfig
        },

        /**
         * Get enrichContext function for an agent
         */
        getAgentEnrichContext(
            agentName: string
        ): ((context: AgentContext) => Promise<AgentContext>) | undefined {
            const agent = agents[agentName]
            return agent?.enrichContext
        },

        /**
         * Check if an agent is configured
         */
        hasAgent(agentName: string): boolean {
            return agentName in agents
        },

        /**
         * Get all configured agent names
         */
        getAgentNames(): string[] {
            return Object.keys(agents)
        },
    }
}

/**
 * Create helpers from a full ThemeLangChainConfig
 * Convenience function that extracts agents and defaults
 */
export function createHelpersFromConfig(config: ThemeLangChainConfig): AgentHelpers {
    return createAgentHelpers(
        config.agents || {},
        {
            provider: config.defaultProvider,
            model: config.defaultModel,
            temperature: config.defaultTemperature,
        }
    )
}
