/**
 * Server-Only Environment Variable Access
 *
 * This module provides server-only access to plugin environment variables
 * preventing client-side access to sensitive configuration
 */

import { pluginEnv } from './plugin-env'

// Server-only environment getters
export async function getServerAnthropicApiKey(): Promise<string | undefined> {
  return pluginEnv.getAnthropicApiKey()
}

export async function getServerOpenAiApiKey(): Promise<string | undefined> {
  return pluginEnv.getOpenAiApiKey()
}

export async function getServerOllamaBaseUrl(): Promise<string> {
  return pluginEnv.getOllamaBaseUrl()
}

export async function getServerOllamaDefaultModel(): Promise<string> {
  return pluginEnv.getOllamaDefaultModel()
}

export async function isServerUseLocalAI(): Promise<boolean> {
  return pluginEnv.isUseLocalAI()
}

export async function getServerDefaultCloudModel(): Promise<string> {
  return pluginEnv.getDefaultCloudModel()
}

export async function getServerDefaultModel(): Promise<string> {
  return pluginEnv.getDefaultModel()
}

export async function isServerPluginEnabled(): Promise<boolean> {
  return pluginEnv.isPluginEnabled()
}

export async function isServerDebugEnabled(): Promise<boolean> {
  return pluginEnv.isDebugEnabled()
}

export async function getServerDefaultProvider(): Promise<string> {
  return pluginEnv.getDefaultProvider()
}

export async function getServerMaxTokens(): Promise<number> {
  return pluginEnv.getMaxTokens()
}

export async function getServerDefaultTemperature(): Promise<number> {
  return pluginEnv.getDefaultTemperature()
}

export async function isServerCostTrackingEnabled(): Promise<boolean> {
  return pluginEnv.isCostTrackingEnabled()
}

export async function getServerDailyCostLimit(): Promise<number> {
  return pluginEnv.getDailyCostLimit()
}

export async function getServerMonthlyCostLimit(): Promise<number> {
  return pluginEnv.getMonthlyCostLimit()
}

export async function getServerRateLimitRequestsPerMinute(): Promise<number> {
  return pluginEnv.getRateLimitRequestsPerMinute()
}

export async function getServerRateLimitTokensPerMinute(): Promise<number> {
  return pluginEnv.getRateLimitTokensPerMinute()
}

export async function validateServerPluginEnvironment(): Promise<{ valid: boolean; errors: string[] }> {
  return pluginEnv.validateEnvironment()
}

// Configuration object for API routes
export async function getServerPluginConfig() {
  return {
    anthropicApiKey: await getServerAnthropicApiKey(),
    openaiApiKey: await getServerOpenAiApiKey(),
    ollamaBaseUrl: await getServerOllamaBaseUrl(),
    ollamaDefaultModel: await getServerOllamaDefaultModel(),
    useLocalAI: await isServerUseLocalAI(),
    defaultCloudModel: await getServerDefaultCloudModel(),
    defaultModel: await getServerDefaultModel(),
    pluginEnabled: await isServerPluginEnabled(),
    debugEnabled: await isServerDebugEnabled(),
    defaultProvider: await getServerDefaultProvider(),
    maxTokens: await getServerMaxTokens(),
    defaultTemperature: await getServerDefaultTemperature(),
    costTrackingEnabled: await isServerCostTrackingEnabled(),
    dailyCostLimit: await getServerDailyCostLimit(),
    monthlyCostLimit: await getServerMonthlyCostLimit(),
    rateLimitRequestsPerMinute: await getServerRateLimitRequestsPerMinute(),
    rateLimitTokensPerMinute: await getServerRateLimitTokensPerMinute()
  }
}