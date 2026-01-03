/**
 * Prompt Renderer for LangChain
 *
 * Renders system prompts using Handlebars templates.
 * Allows themes to inject dynamic context data into agent prompts.
 *
 * @example
 * // Template with variables
 * const template = 'Hello {{user.name}} from {{company.name}}!'
 * const context = { user: { name: 'John' }, company: { name: 'Acme' } }
 * const result = renderPrompt(template, context)
 * // => 'Hello John from Acme!'
 *
 * @example
 * // Template with conditionals
 * const template = `
 * {{#if isAdmin}}
 * You have admin privileges.
 * {{else}}
 * You are a regular user.
 * {{/if}}
 * `
 *
 * @example
 * // Template with loops
 * const template = `
 * Recent items:
 * {{#each items}}
 * - {{this.name}}: {{this.status}}
 * {{/each}}
 * `
 */

import Handlebars from 'handlebars'
import type { AgentContext } from '../types/langchain.types'
import { config } from '../plugin.config'

/**
 * Check if a template contains Handlebars syntax
 */
export function hasTemplateVariables(template: string): boolean {
    // Match {{ }} patterns (Handlebars syntax)
    return /\{\{[^}]+\}\}/.test(template)
}

/**
 * Render a prompt template with context data
 *
 * Uses Handlebars for template rendering, supporting:
 * - Variables: {{key}}, {{nested.key}}
 * - Conditionals: {{#if condition}}...{{/if}}
 * - Loops: {{#each items}}...{{/each}}
 * - Built-in helpers: {{#unless}}, {{#with}}, etc.
 *
 * @param template - The prompt template (may contain Handlebars syntax)
 * @param context - The context data to inject into the template
 * @returns Rendered prompt string
 */
export function renderPrompt(template: string, context: AgentContext): string {
    // If no template variables, return as-is (optimization)
    if (!hasTemplateVariables(template)) {
        return template
    }

    try {
        const compiled = Handlebars.compile(template, {
            // Strict mode: throw error if variable is not found
            strict: false,
            // Don't escape HTML (prompts are not rendered in browser)
            noEscape: true,
        })

        return compiled(context)
    } catch (error) {
        // Log error and return original template if rendering fails
        if (config.debug) {
            console.error('[PromptRenderer] Failed to render template:', error)
        }
        return template
    }
}

/**
 * Pre-compile a template for performance (optional)
 * Use when rendering the same template multiple times
 */
export function compilePrompt(template: string): (context: AgentContext) => string {
    const compiled = Handlebars.compile(template, {
        strict: false,
        noEscape: true,
    })

    return (context: AgentContext) => compiled(context)
}
