import { EventType } from '../types/amplitude.types';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  properties?: Record<string, any>;
}

export interface PerformanceStats {
  amplitudeCore: {
    initTime: number;
    trackingLatency: number[];
    errorRate: number;
    eventQueueSize: number;
    memoryUsage: number;
  };
  webVitals: {
    cls: number;
    fid: number;
    fcp: number;
    lcp: number;
    ttfb: number;
    inp: number;
  };
  browserMetrics: {
    memoryUsage: number;
    connectionType: string;
    devicePixelRatio: number;
    screenResolution: string;
    viewportSize: string;
  };
}

const performanceMetrics: PerformanceMetric[] = [];
const performanceObservers: PerformanceObserver[] = [];
const MAX_METRICS = 10000;
const CLEANUP_THRESHOLD = 12000;

// Internal performance stats
let amplitudeCoreStats = {
  initTime: 0,
  trackingLatency: [] as number[],
  errorCount: 0,
  successCount: 0,
  eventQueueSize: 0,
  memoryUsage: 0,
};

export function trackPerformanceMetric(name: EventType | string, value: number, unit: string = 'ms', properties?: Record<string, any>): void {
  if (typeof window === 'undefined') return;

  const metric: PerformanceMetric = {
    name: name as string,
    value,
    unit,
    timestamp: Date.now(),
    properties,
  };

  performanceMetrics.push(metric);

  // Update internal stats based on metric type
  updateInternalStats(name as string, value);

  // Cleanup old metrics if we exceed threshold
  if (performanceMetrics.length > CLEANUP_THRESHOLD) {
    performanceMetrics.splice(0, performanceMetrics.length - MAX_METRICS);
  }

  // Log to console in debug mode
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Performance] ${name}: ${value}${unit}`, properties);
  }
}

function updateInternalStats(name: string, value: number): void {
  switch (name) {
    case 'amplitude_init_success':
      amplitudeCoreStats.initTime = value;
      break;
    case 'amplitude_track_latency':
      amplitudeCoreStats.trackingLatency.push(value);
      if (amplitudeCoreStats.trackingLatency.length > 100) {
        amplitudeCoreStats.trackingLatency = amplitudeCoreStats.trackingLatency.slice(-50);
      }
      break;
    case 'amplitude_track_success':
    case 'amplitude_identify_success':
    case 'amplitude_user_properties_success':
      amplitudeCoreStats.successCount += value;
      break;
    case 'amplitude_track_error':
    case 'amplitude_identify_error':
    case 'amplitude_user_properties_error':
    case 'amplitude_init_error':
      amplitudeCoreStats.errorCount += value;
      break;
    case 'amplitude_queue_size':
      amplitudeCoreStats.eventQueueSize = value;
      break;
    case 'amplitude_memory_usage':
      amplitudeCoreStats.memoryUsage = value;
      break;
  }
}

export function getPerformanceMetrics(): PerformanceMetric[] {
  return [...performanceMetrics].sort((a, b) => b.timestamp - a.timestamp);
}

export function getPerformanceStats(): PerformanceStats {
  const stats: PerformanceStats = {
    amplitudeCore: {
      ...amplitudeCoreStats,
      errorRate: amplitudeCoreStats.errorCount / Math.max(amplitudeCoreStats.successCount + amplitudeCoreStats.errorCount, 1),
    },
    webVitals: {
      cls: 0,
      fid: 0,
      fcp: 0,
      lcp: 0,
      ttfb: 0,
      inp: 0,
    },
    browserMetrics: {
      memoryUsage: 0,
      connectionType: 'unknown',
      devicePixelRatio: 1,
      screenResolution: '0x0',
      viewportSize: '0x0',
    },
  };

  if (typeof window !== 'undefined') {
    // Browser metrics
    stats.browserMetrics = {
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      devicePixelRatio: window.devicePixelRatio || 1,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    };

    // Web Vitals from recent metrics
    const recentMetrics = performanceMetrics.filter(m => Date.now() - m.timestamp < 60000); // Last minute
    stats.webVitals = {
      cls: getLatestMetricValue(recentMetrics, 'CLS') || 0,
      fid: getLatestMetricValue(recentMetrics, 'FID') || 0,
      fcp: getLatestMetricValue(recentMetrics, 'FCP') || 0,
      lcp: getLatestMetricValue(recentMetrics, 'LCP') || 0,
      ttfb: getLatestMetricValue(recentMetrics, 'TTFB') || 0,
      inp: getLatestMetricValue(recentMetrics, 'INP') || 0,
    };
  }

  return stats;
}

function getLatestMetricValue(metrics: PerformanceMetric[], name: string): number | null {
  const metric = metrics.filter(m => m.name === name).sort((a, b) => b.timestamp - a.timestamp)[0];
  return metric?.value || null;
}

export function clearPerformanceMetrics(): void {
  performanceMetrics.length = 0;
  amplitudeCoreStats = {
    initTime: 0,
    trackingLatency: [],
    errorCount: 0,
    successCount: 0,
    eventQueueSize: 0,
    memoryUsage: 0,
  };
}

export function setupPerformanceObservers(): void {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        trackPerformanceMetric('LCP', entry.startTime + entry.duration, 'ms', {
          element: (entry as any).element?.tagName,
          url: window.location.href,
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    performanceObservers.push(lcpObserver);

    // Cumulative Layout Shift (CLS)
    const clsObserver = new PerformanceObserver((entryList) => {
      let cls = 0;
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          cls += (entry as any).value;
        }
      }
      if (cls > 0) {
        trackPerformanceMetric('CLS', cls, 'score', { url: window.location.href });
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
    performanceObservers.push(clsObserver);

    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          trackPerformanceMetric('FCP', entry.startTime, 'ms', { url: window.location.href });
        }
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });
    performanceObservers.push(fcpObserver);

    // Navigation Timing
    const navigationObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const navEntry = entry as PerformanceNavigationTiming;
        trackPerformanceMetric('TTFB', navEntry.responseStart - navEntry.requestStart, 'ms');
        trackPerformanceMetric('DOMContentLoaded', navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart, 'ms');
        trackPerformanceMetric('Load', navEntry.loadEventEnd - navEntry.loadEventStart, 'ms');
      }
    });
    navigationObserver.observe({ type: 'navigation', buffered: true });
    performanceObservers.push(navigationObserver);

    // Long Tasks
    const longTaskObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        trackPerformanceMetric('Long Task', entry.duration, 'ms', {
          name: entry.name,
          startTime: entry.startTime,
        });
      }
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });
    performanceObservers.push(longTaskObserver);

    // Resource Timing
    const resourceObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming;
        trackPerformanceMetric('Resource Load', entry.duration, 'ms', {
          name: entry.name,
          initiatorType: resourceEntry.initiatorType,
          transferSize: resourceEntry.transferSize,
          responseStatus: (resourceEntry as any).responseStatus,
        });
      }
    });
    resourceObserver.observe({ type: 'resource', buffered: true });
    performanceObservers.push(resourceObserver);

  } catch (error) {
    console.warn('[Performance] Failed to setup performance observers:', error);
  }
}

export function disconnectPerformanceObservers(): void {
  performanceObservers.forEach(observer => {
    try {
      observer.disconnect();
    } catch (error) {
      console.warn('[Performance] Failed to disconnect observer:', error);
    }
  });
  performanceObservers.length = 0;
}

// Memory monitoring
export function startMemoryMonitoring(intervalMs: number = 30000): () => void {
  if (typeof window === 'undefined') return () => {};

  const interval = setInterval(() => {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      trackPerformanceMetric('JS Heap Used', memory.usedJSHeapSize, 'bytes');
      trackPerformanceMetric('JS Heap Total', memory.totalJSHeapSize, 'bytes');
      trackPerformanceMetric('JS Heap Limit', memory.jsHeapSizeLimit, 'bytes');
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

// Connection monitoring
export function monitorConnection(): () => void {
  if (typeof window === 'undefined' || !(navigator as any).connection) return () => {};

  const connection = (navigator as any).connection;
  
  const handleConnectionChange = () => {
    trackPerformanceMetric('Connection Type', 1, 'event', {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    });
  };

  connection.addEventListener('change', handleConnectionChange);
  
  // Initial reading
  handleConnectionChange();

  return () => connection.removeEventListener('change', handleConnectionChange);
}

// Export for cleanup
export function shutdownPerformanceMonitoring(): void {
  disconnectPerformanceObservers();
  clearPerformanceMetrics();
}

