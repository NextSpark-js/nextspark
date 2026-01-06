import { EventType, EventProperties } from '../types/amplitude.types';
import { trackPerformanceMetric } from './performance';

interface QueuedEvent {
  id: string;
  eventType: EventType;
  properties?: EventProperties;
  timestamp: number;
  retries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  userId?: string;
}

interface QueueOptions {
  flushInterval?: number;
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxQueueSize?: number;
  persistenceEnabled?: boolean;
  priorityEnabled?: boolean;
}

export class EventQueue {
  private queue: QueuedEvent[] = [];
  private isProcessing = false;
  private flushInterval: number;
  private batchSize: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private maxQueueSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private sendBatchCallback: (events: QueuedEvent[]) => Promise<void>;
  private persistenceEnabled: boolean;
  private priorityEnabled: boolean;
  private storageKey = 'amplitude_event_queue';

  constructor(
    sendBatchCallback: (events: QueuedEvent[]) => Promise<void>,
    options: QueueOptions = {}
  ) {
    this.sendBatchCallback = sendBatchCallback;
    this.flushInterval = options.flushInterval || 10000; // 10 seconds
    this.batchSize = options.batchSize || 30;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.persistenceEnabled = options.persistenceEnabled || true;
    this.priorityEnabled = options.priorityEnabled || true;

    this.loadPersistedEvents();
    this.startFlushTimer();
    this.setupOnlineListener();
  }

  public enqueue(
    eventType: EventType, 
    properties?: EventProperties, 
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    userId?: string
  ): string {
    const event: QueuedEvent = {
      id: this.generateEventId(),
      eventType,
      properties,
      timestamp: Date.now(),
      retries: 0,
      priority,
      userId,
    };

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      this.removeOldestLowPriorityEvent();
    }

    // Insert based on priority if enabled
    if (this.priorityEnabled) {
      this.insertByPriority(event);
    } else {
      this.queue.push(event);
    }

    // Persist to storage
    if (this.persistenceEnabled) {
      this.persistEvents();
    }

    // Track queue metrics
    trackPerformanceMetric('amplitude_queue_size', this.queue.length, 'count');

    // Trigger immediate processing for critical events
    if (priority === 'critical') {
      this.processQueue();
    } else {
      // Normal processing
      this.scheduleProcessing();
    }

    return event.id;
  }

  private generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private insertByPriority(event: QueuedEvent): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const eventPriority = priorityOrder[event.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (eventPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, event);
  }

  private removeOldestLowPriorityEvent(): void {
    // Find and remove the oldest low priority event
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].priority === 'low') {
        this.queue.splice(i, 1);
        return;
      }
    }

    // If no low priority events, remove oldest normal priority
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].priority === 'normal') {
        this.queue.splice(i, 1);
        return;
      }
    }

    // Fallback: remove oldest event
    if (this.queue.length > 0) {
      this.queue.shift();
    }
  }

  private scheduleProcessing(): void {
    // Don't schedule if already processing or if queue is small
    if (this.isProcessing || this.queue.length < this.batchSize) {
      return;
    }

    // Use setTimeout for immediate processing to avoid blocking
    setTimeout(() => this.processQueue(), 0);
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => this.processQueue(true), this.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async processQueue(forceFlush = false): Promise<void> {
    if (this.isProcessing) return;

    // Don't process if offline (will be handled by online listener)
    if (!navigator.onLine && !forceFlush) return;

    // Don't process small queues unless forced
    if (this.queue.length === 0 || (this.queue.length < this.batchSize && !forceFlush)) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Take events to process (prioritize critical/high priority)
      const eventsToSend = this.selectEventsForBatch();
      
      if (eventsToSend.length === 0) {
        return;
      }

      // Remove from queue before sending
      this.removeEventsFromQueue(eventsToSend.map(e => e.id));

      // Send batch
      await this.sendBatchCallback(eventsToSend);

      // Track successful batch
      trackPerformanceMetric('amplitude_batch_sent', eventsToSend.length, 'count');
      trackPerformanceMetric('amplitude_batch_latency', Date.now() - startTime, 'ms');

      console.debug(`[Event Queue] Successfully sent ${eventsToSend.length} events`);

    } catch (error) {
      console.error('[Event Queue] Failed to send event batch:', error);
      
      // Re-queue events that failed, with retry logic
      const failedEvents = this.queue.splice(-this.batchSize); // Get last batch that was attempted
      await this.handleFailedEvents(failedEvents);

      // Track failed batch
      trackPerformanceMetric('amplitude_batch_error', 1, 'count');
      
    } finally {
      this.isProcessing = false;
      
      // Update persisted events
      if (this.persistenceEnabled) {
        this.persistEvents();
      }

      // Continue processing if there are more events
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  private selectEventsForBatch(): QueuedEvent[] {
    const batch: QueuedEvent[] = [];
    const criticalAndHigh = this.queue.filter(e => e.priority === 'critical' || e.priority === 'high');
    
    // Prioritize critical and high priority events
    if (criticalAndHigh.length > 0) {
      batch.push(...criticalAndHigh.slice(0, this.batchSize));
    }

    // Fill remaining space with normal/low priority events
    const remaining = this.batchSize - batch.length;
    if (remaining > 0) {
      const normalAndLow = this.queue.filter(e => e.priority === 'normal' || e.priority === 'low');
      batch.push(...normalAndLow.slice(0, remaining));
    }

    return batch;
  }

  private removeEventsFromQueue(eventIds: string[]): void {
    this.queue = this.queue.filter(event => !eventIds.includes(event.id));
  }

  private async handleFailedEvents(failedEvents: QueuedEvent[]): Promise<void> {
    for (const event of failedEvents) {
      event.retries += 1;

      if (event.retries < this.maxRetries) {
        // Calculate exponential backoff delay
        const delay = this.retryDelayMs * Math.pow(2, event.retries - 1);
        
        setTimeout(() => {
          // Re-add to queue with priority adjustment
          const adjustedPriority = event.retries >= 2 ? 'low' : event.priority;
          this.queue.unshift({ ...event, priority: adjustedPriority });
          
          if (this.persistenceEnabled) {
            this.persistEvents();
          }
        }, delay);
        
        console.debug(`[Event Queue] Retrying event ${event.id} in ${delay}ms (attempt ${event.retries})`);
      } else {
        console.warn(`[Event Queue] Discarding event ${event.id} after ${this.maxRetries} retries`);
        trackPerformanceMetric('amplitude_event_discarded', 1, 'count');
      }
    }
  }

  private loadPersistedEvents(): void {
    if (!this.persistenceEnabled || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const events = JSON.parse(stored) as QueuedEvent[];
        this.queue = events.filter(event => {
          // Remove very old events (older than 24 hours)
          return Date.now() - event.timestamp < 24 * 60 * 60 * 1000;
        });
        console.debug(`[Event Queue] Loaded ${this.queue.length} persisted events`);
      }
    } catch (error) {
      console.warn('[Event Queue] Failed to load persisted events:', error);
      // Clear corrupted storage
      localStorage.removeItem(this.storageKey);
    }
  }

  private persistEvents(): void {
    if (!this.persistenceEnabled || typeof localStorage === 'undefined') return;

    try {
      // Only persist recent events to avoid storage bloat
      const recentEvents = this.queue.filter(event => 
        Date.now() - event.timestamp < 12 * 60 * 60 * 1000 // 12 hours
      );
      localStorage.setItem(this.storageKey, JSON.stringify(recentEvents));
    } catch (error) {
      console.warn('[Event Queue] Failed to persist events:', error);
    }
  }

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.debug('[Event Queue] Connection restored, processing queued events');
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(true), 1000); // Give connection a moment to stabilize
      }
    };

    const handleOffline = () => {
      console.debug('[Event Queue] Connection lost, events will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public getQueueStats(): {
    total: number;
    byPriority: Record<string, number>;
    oldestTimestamp: number | null;
    averageAge: number;
  } {
    const byPriority = { critical: 0, high: 0, normal: 0, low: 0 };
    let oldestTimestamp: number | null = null;
    let totalAge = 0;

    for (const event of this.queue) {
      byPriority[event.priority]++;
      if (!oldestTimestamp || event.timestamp < oldestTimestamp) {
        oldestTimestamp = event.timestamp;
      }
      totalAge += Date.now() - event.timestamp;
    }

    return {
      total: this.queue.length,
      byPriority,
      oldestTimestamp,
      averageAge: this.queue.length > 0 ? totalAge / this.queue.length : 0,
    };
  }

  public clear(): void {
    this.queue = [];
    if (this.persistenceEnabled && typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    trackPerformanceMetric('amplitude_queue_cleared', 1, 'count');
  }

  public shutdown(): void {
    this.stopFlushTimer();
    
    // Attempt to send any remaining critical events
    const criticalEvents = this.queue.filter(e => e.priority === 'critical');
    if (criticalEvents.length > 0) {
      console.debug(`[Event Queue] Flushing ${criticalEvents.length} critical events before shutdown`);
      // Fire and forget - don't wait for completion
      this.sendBatchCallback(criticalEvents).catch(error => 
        console.warn('[Event Queue] Failed to send critical events during shutdown:', error)
      );
    }

    // Persist remaining events
    if (this.persistenceEnabled) {
      this.persistEvents();
    }

    console.debug('[Event Queue] Shutdown complete');
  }
}

