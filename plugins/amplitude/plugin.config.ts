import { z } from 'zod';
import type { PluginConfig } from '@nextsparkjs/core/types/plugin';

const AmplitudePluginConfigSchema = z.object({
  apiKey: z.string().regex(/^[a-zA-Z0-9]{32}$/, "Invalid Amplitude API Key format").describe("Amplitude API Key"),
  serverZone: z.enum(['US', 'EU']).default('US').describe("Amplitude server zone"),
  enableSessionReplay: z.boolean().default(false).describe("Enable session replay recording"),
  enableABTesting: z.boolean().default(false).describe("Enable A/B testing experiments"),
  sampleRate: z.number().min(0).max(1).default(1).describe("Event sampling rate (0-1)"),
  enableConsentManagement: z.boolean().default(true).describe("Enable GDPR/CCPA consent management"),
  batchSize: z.number().min(1).max(100).default(30).describe("Number of events to batch before sending"),
  flushInterval: z.number().min(1000).max(60000).default(10000).describe("Interval in ms to flush event queue"),
  debugMode: z.boolean().default(false).describe("Enable debug logging for Amplitude plugin"),
  piiMaskingEnabled: z.boolean().default(true).describe("Enable automatic PII masking"),
  rateLimitEventsPerMinute: z.number().min(10).max(5000).default(1000).describe("Max events per minute per user/IP"),
  errorRetryAttempts: z.number().min(0).max(5).default(3).describe("Number of retry attempts for failed events"),
  errorRetryDelayMs: z.number().min(100).max(10000).default(1000).describe("Delay in ms between retry attempts"),
});

export const amplitudePlugin: PluginConfig = {
  name: 'amplitude',
  version: '1.0.0',
  displayName: 'Amplitude Analytics',
  description: 'Advanced user analytics and behavioral tracking plugin for SaaS applications.',
  enabled: true,
  dependencies: [],

  // Plugin components that can be used throughout the app
  components: {
    ConsentManager: undefined, // Would contain actual component
    AnalyticsDashboard: undefined,
    ExperimentWrapper: undefined,
    PerformanceMonitor: undefined
  },

  // Plugin services/hooks that can be used by other parts of the app
  services: {
    // Would contain amplitude-specific services
  },

  // Plugin lifecycle hooks
  hooks: {
    async onLoad() {
      console.log('[Amplitude Plugin] Loading...');
    },
    async onActivate() {
      console.log('[Amplitude Plugin] Activated');
    },
    async onDeactivate() {
      console.log('[Amplitude Plugin] Deactivated');
    },
    async onUnload() {
      console.log('[Amplitude Plugin] Unloaded');
    }
  }
};

export default amplitudePlugin;
