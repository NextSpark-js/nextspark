import { z } from 'zod';

export type AmplitudeAPIKey = string & { __brand: 'AmplitudeAPIKey' };
export type UserId = string & { __brand: 'UserId' };
export type EventType = string & { __brand: 'EventType' };
export type EventProperties = Record<string, any>;
export type UserProperties = Record<string, any>;

export const AmplitudeAPIKeySchema = z.string().regex(/^[a-zA-Z0-9]{32}$/).brand('AmplitudeAPIKey');
export const UserIdSchema = z.string().min(1).brand('UserId');
export const EventTypeSchema = z.string().min(1).brand('EventType');
export const EventPropertiesSchema = z.record(z.string(), z.any());
export const UserPropertiesSchema = z.record(z.string(), z.any());

export interface AmplitudePluginConfig {
  apiKey: string;
  serverZone: 'US' | 'EU';
  enableSessionReplay: boolean;
  enableABTesting: boolean;
  sampleRate: number;
  enableConsentManagement: boolean;
  batchSize: number;
  flushInterval: number;
  debugMode: boolean;
  piiMaskingEnabled: boolean;
  rateLimitEventsPerMinute: number;
  errorRetryAttempts: number;
  errorRetryDelayMs: number;
}

export interface AmplitudeCore {
  init(apiKey: AmplitudeAPIKey, config: AmplitudePluginConfig): Promise<void>;
  track(eventType: EventType, properties?: EventProperties): Promise<void>;
  identify(userId: UserId, properties?: UserProperties): Promise<void>;
  setUserProperties(properties: UserProperties): Promise<void>;
  reset(): void;
  isInitialized(): boolean;
  shutdown(): void;
}

export interface UseAmplitudeResult {
  track: (eventType: EventType, properties?: EventProperties) => Promise<void>;
  identify: (userId: UserId, properties?: UserProperties) => Promise<void>;
  setUserProperties: (properties: UserProperties) => Promise<void>;
  reset: () => void;
  isInitialized: boolean;
  context: {
    config: AmplitudePluginConfig | null;
    consent: ConsentState;
    error: Error | null;
  };
  lastError: Error | null;
}

export interface UseExperimentResult {
  getVariant: (experimentId: string, userId: string) => string | null;
  trackExposure: (experimentId: string, variantId?: string) => Promise<void>;
  trackConversion: (experimentId: string, metricId?: string, value?: number) => Promise<void>;
  isInExperiment: (experimentId: string, userId: string) => boolean;
}

export interface UseSessionReplayResult {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isRecording: boolean;
  canRecord: boolean;
}

export interface AmplitudePluginContext {
  amplitude: AmplitudeCore | null;
  isInitialized: boolean;
  config: AmplitudePluginConfig | null;
  consent: ConsentState;
  updateConsent: (consent: ConsentState) => void;
  error: Error | null;
}

export type ConsentCategory = 'analytics' | 'sessionReplay' | 'experiments' | 'performance';
export type ConsentState = Record<ConsentCategory, boolean>;

export interface ConsentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentChange: (consent: ConsentState) => void;
  initialConsent?: Partial<ConsentState>;
  showBadge?: boolean;
  position?: 'bottom-left' | 'bottom-right' | 'center' | 'top';
  theme?: 'light' | 'dark' | 'auto';
  compactMode?: boolean;
  persistUserChoice?: boolean;
}

export function isAmplitudeAPIKey(key: string): key is AmplitudeAPIKey {
  return /^[a-zA-Z0-9]{32}$/.test(key);
}

export function isValidUserId(id: any): id is UserId {
  return typeof id === 'string' && id.trim().length > 0;
}

export function isAmplitudeEvent(event: any): event is { eventType: EventType; properties?: EventProperties } {
  return Boolean(event && typeof event.eventType === 'string' && event.eventType.length > 0);
}
