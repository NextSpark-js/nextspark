/**
 * ============================================================================
 * LANGCHAIN CONFIGURATION
 * ============================================================================
 *
 * Central configuration for the LangChain plugin in this theme.
 * Includes both observability settings and agent definitions.
 *
 * ============================================================================
 */

import type { ObservabilityConfig } from '@/plugins/langchain/types/observability.types'
import type {
  ThemeLangChainConfig,
  AgentDefinition,
  AgentContext,
} from '@/plugins/langchain/types/langchain.types'
import { createAgentHelpers } from '@/plugins/langchain/lib/agent-helpers'

// Tool factories (relative imports since we're inside lib/langchain/)
import { createTaskTools } from './tools/tasks'
import { createCustomerTools } from './tools/customers'
import { createPageTools } from './tools/pages'
import { createOrchestratorTools } from './tools/orchestrator'

// ============================================================================
// OBSERVABILITY CONFIGURATION
// ============================================================================

export interface LangChainObservabilityConfig {
  /** Observability configuration */
  observability: ObservabilityConfig
}

export const observabilityConfig: LangChainObservabilityConfig = {
  observability: {
    /** Enable observability tracing */
    enabled: true,

    /** Data retention settings */
    retention: {
      /** Days to keep trace data */
      traces: 30,
    },

    /** Sampling configuration */
    sampling: {
      /** Sample rate (0.0-1.0) - 1.0 = 100% */
      rate: 1.0,
      /** Always trace errors regardless of sample rate */
      alwaysTraceErrors: true,
    },

    /** PII and content processing */
    pii: {
      /** Mask inputs for PII (email, phone, card, SSN patterns) */
      maskInputs: false,
      /** Mask outputs for PII */
      maskOutputs: false,
      /** Truncate content at this length (characters) */
      truncateAt: 10000,
    },
  },
}

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

/**
 * All agents available in this theme.
 *
 * Each agent has:
 * - provider: LLM provider (ollama, openai, anthropic)
 * - model: Model name
 * - temperature: Creativity level (0-1)
 * - createTools: Factory function that returns tools for this agent
 * - systemPrompt: Name of the .md file in /agents folder
 * - description: What this agent does (documentation)
 * - sessionConfig: (optional) Memory customization (TTL, maxMessages)
 * - enrichContext: (optional) Fetch runtime data for prompt templates
 */
export const AGENTS: Record<string, AgentDefinition> = {
  // ========================================================================
  // SINGLE AGENT - Uses Ollama (local, fast)
  // Model configured via LANGCHAIN_OLLAMA_MODEL in .env
  // ========================================================================
  'single-agent': {
    provider: 'ollama',
    // model: uses LANGCHAIN_OLLAMA_MODEL from .env
    temperature: 0.3,
    description: 'Unified agent with access to all entity tools (tasks, customers, pages)',
    systemPrompt: 'single-agent', // loads from agents/single-agent.md
    createTools: (context: AgentContext) => [
      ...createTaskTools(context),
      ...createCustomerTools(context),
      ...createPageTools(context),
    ],
  },

  // ========================================================================
  // ORCHESTRATOR - Uses Anthropic Claude for reliable intent classification
  // ========================================================================
  'orchestrator': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307', // Claude 3 Haiku - fast and reliable
    temperature: 0.1, // Low temperature for consistent routing
    description: 'Analyzes user intent and routes to the appropriate specialized agent',
    systemPrompt: 'orchestrator', // loads from agents/orchestrator.md
    createTools: () => createOrchestratorTools(),
  },

  // ========================================================================
  // SUB-AGENTS - Use OpenAI GPT-4o-mini (fast and cost-effective)
  // ========================================================================
  'task-assistant': {
    provider: 'openai',
    model: 'gpt-4o-mini', // Fast and cheap for simple operations
    temperature: 0.3,
    description: 'Specialized agent for task management (CRUD operations)',
    systemPrompt: 'task-assistant', // loads from agents/task-assistant.md
    createTools: (context: AgentContext) => createTaskTools(context),
  },

  'customer-assistant': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    description: 'Specialized agent for customer management (CRUD operations)',
    systemPrompt: 'customer-assistant', // loads from agents/customer-assistant.md
    createTools: (context: AgentContext) => createCustomerTools(context),
  },

  'page-assistant': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    description: 'Specialized agent for page/content management with blocks',
    systemPrompt: 'page-assistant', // loads from agents/page-assistant.md
    createTools: (context: AgentContext) => createPageTools(context),
  },

  // ========================================================================
  // DEMO AGENT - Example with sessionConfig + enrichContext
  // This agent demonstrates advanced features for reference
  // ========================================================================
  'demo-assistant': {
    provider: 'ollama',
    temperature: 0.4,
    description: 'Demo agent showing sessionConfig and enrichContext usage',
    systemPrompt: 'single-agent', // Reuses single-agent prompt for demo

    // Memory customization: conversations expire after 48 hours
    sessionConfig: {
      ttlHours: 48,
      maxMessages: 100,
    },

    // Enrich context with runtime data for Handlebars templates
    // This data is available in system prompts as {{user.name}}, etc.
    enrichContext: async ({ userId, teamId }) => {
      // In production, you would fetch real user/team data:
      // const user = await UsersService.getById(userId)
      // const team = await TeamsService.getById(teamId)

      return {
        userId,
        teamId,
        // Example enriched data for prompt templates
        user: {
          name: 'Demo User',
          role: 'admin',
        },
        company: {
          name: 'Acme Corp',
          timezone: 'America/Argentina/Buenos_Aires',
        },
      }
    },

    createTools: (context: AgentContext) => [
      ...createTaskTools(context),
      ...createCustomerTools(context),
    ],
  },
}

// ============================================================================
// THEME CONFIG (for plugin compatibility)
// ============================================================================

export const langchainConfig: ThemeLangChainConfig = {
  defaultProvider: 'ollama',
  defaultTemperature: 0.3,
  agents: AGENTS,
  observability: observabilityConfig.observability,
}

// ============================================================================
// HELPERS (from plugin factory)
// ============================================================================

/**
 * Helper functions created from the plugin's factory.
 * These provide convenient access to agent configuration.
 */
const helpers = createAgentHelpers(AGENTS, {
  provider: langchainConfig.defaultProvider,
  model: langchainConfig.defaultModel,
  temperature: langchainConfig.defaultTemperature,
})

// Re-export individual helpers for convenience
export const {
  getAgentConfig,
  getAgentModelConfig,
  getAgentTools,
  getAgentPromptName,
  getAgentSessionConfig,
  getAgentEnrichContext,
  hasAgent,
  getAgentNames,
} = helpers
