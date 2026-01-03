/**
 * Re-exports from Vercel AI SDK for use in themes and other plugins
 * This allows the 'ai' package to be isolated to the AI plugin workspace
 */

export { generateObject, generateText, streamText, streamObject } from 'ai'
export type { CoreMessage, LanguageModel } from 'ai'
