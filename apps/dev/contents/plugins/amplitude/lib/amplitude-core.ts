import { AmplitudeAPIKey, AmplitudePluginConfig, EventProperties, EventType, UserProperties, UserId } from '../types/amplitude.types';
import { trackPerformanceMetric, getPerformanceMetrics } from './performance';
import { EventQueue } from './queue';
import { DataSanitizer } from './security';

class AmplitudeCoreWrapper {
  private initialized = false;
  private config: AmplitudePluginConfig | null = null;
  private eventQueue: EventQueue;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.eventQueue = new EventQueue(this.sendEventsBatch.bind(this));
  }

  public async init(apiKey: AmplitudeAPIKey, config: AmplitudePluginConfig): Promise<void> {
    try {
      // Check for double initialization
      if (this.initialized) {
        throw new Error('Amplitude is already initialized');
      }

      // Validate API key (must be at least 32 characters)
      if (!apiKey || apiKey.length < 32) {
        throw new Error('Invalid API key: Must be at least 32 characters');
      }

      this.config = config;

      // Initialize Amplitude SDK (mock for now)
      console.log(`[Amplitude Core] Initializing with API key: ${apiKey.substring(0, 8)}...`);

      // Simulate async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      this.initialized = true;
      this.startHealthChecks();

      trackPerformanceMetric('amplitude_init_success', 1, 'counter');
      console.log('[Amplitude Core] Successfully initialized');
    } catch (error) {
      trackPerformanceMetric('amplitude_init_error', 1, 'counter');
      throw new Error(`Failed to initialize Amplitude: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async track(eventType: EventType, properties?: EventProperties): Promise<void> {
    if (!this.initialized) {
      throw new Error('Amplitude not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Sanitize properties
      const sanitizedProperties = this.config?.piiMaskingEnabled 
        ? DataSanitizer.sanitizeEventProperties(properties, [])
        : properties;

      // Add to queue for batch processing
      await this.eventQueue.enqueue(eventType, sanitizedProperties);
      
      const latency = Date.now() - startTime;
      trackPerformanceMetric('amplitude_track_latency', latency, 'timing');
    } catch (error) {
      trackPerformanceMetric('amplitude_track_error', 1, 'counter');
      throw error;
    }
  }

  private async sendEventsBatch(events: Array<{ eventType: EventType; properties?: EventProperties; timestamp?: number }>): Promise<void> {
    if (!this.initialized || events.length === 0) return;

    try {
      // Mock sending to Amplitude API
      console.log(`[Amplitude Core] Sending batch of ${events.length} events`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      
      trackPerformanceMetric('amplitude_batch_sent', events.length, 'counter');
    } catch (error) {
      trackPerformanceMetric('amplitude_batch_error', 1, 'counter');
      throw error;
    }
  }

  public async identify(userId: UserId, properties?: UserProperties): Promise<void> {
    if (!this.initialized) {
      throw new Error('Amplitude not initialized');
    }

    try {
      // Sanitize user properties
      const sanitizedProperties = this.config?.piiMaskingEnabled 
        ? DataSanitizer.sanitizeUserProperties(properties, [])
        : properties;

      // Mock identify call
      console.log(`[Amplitude Core] Identifying user: ${userId}`);
      
      trackPerformanceMetric('amplitude_identify_success', 1, 'counter');
    } catch (error) {
      trackPerformanceMetric('amplitude_identify_error', 1, 'counter');
      throw error;
    }
  }

  public async setUserProperties(properties: UserProperties): Promise<void> {
    if (!this.initialized) {
      throw new Error('Amplitude not initialized');
    }

    try {
      // Sanitize user properties
      const sanitizedProperties = this.config?.piiMaskingEnabled 
        ? DataSanitizer.sanitizeUserProperties(properties, [])
        : properties;

      // Mock setUserProperties call
      console.log('[Amplitude Core] Setting user properties');
      
      trackPerformanceMetric('amplitude_user_properties_success', 1, 'counter');
    } catch (error) {
      trackPerformanceMetric('amplitude_user_properties_error', 1, 'counter');
      throw error;
    }
  }

  public reset(): void {
    if (!this.initialized) {
      throw new Error('Amplitude not initialized');
    }

    try {
      // Mock reset call
      console.log('[Amplitude Core] Resetting user session');
      
      trackPerformanceMetric('amplitude_reset', 1, 'counter');
    } catch (error) {
      trackPerformanceMetric('amplitude_reset_error', 1, 'counter');
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.eventQueue.shutdown();
    this.initialized = false;
    
    console.log('[Amplitude Core] Shutdown complete');
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const metrics = getPerformanceMetrics();
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      trackPerformanceMetric('amplitude_memory_usage', memoryUsage, 'gauge');
      trackPerformanceMetric('amplitude_health_check', 1, 'counter');
      
      // Check for performance issues
      if (memoryUsage > 50 * 1024 * 1024) { // 50MB
        console.warn('[Amplitude Core] High memory usage detected:', memoryUsage);
      }
    }, 30000); // Every 30 seconds
  }
}

export const AmplitudeCore = new AmplitudeCoreWrapper();
