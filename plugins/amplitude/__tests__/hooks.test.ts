/**
 * Test suite for Amplitude hooks
 */

import { renderHook, act } from '@testing-library/react';
import { useAmplitude } from '../hooks/useAmplitude';
import { useExperiment } from '../hooks/useExperiment';
import { useSessionReplay } from '../hooks/useSessionReplay';
import { AmplitudeProvider } from '../providers/AmplitudeProvider';
import React from 'react';

// Mock context
const mockAmplitudeContext = {
  amplitude: {
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    setUserProperties: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
  },
  isInitialized: true,
  config: {
    apiKey: 'test-key',
    serverZone: 'US' as const,
    enableSessionReplay: true,
    enableABTesting: true,
    sampleRate: 1,
    enableConsentManagement: true,
    batchSize: 30,
    flushInterval: 10000,
    debugMode: false,
    piiMaskingEnabled: true,
    rateLimitEventsPerMinute: 1000,
    errorRetryAttempts: 3,
    errorRetryDelayMs: 1000,
  },
  consent: {
    analytics: true,
    sessionReplay: true,
    experiments: true,
    performance: true,
  },
  updateConsent: jest.fn(),
  error: null,
};

// Mock the context hook
jest.mock('../providers/AmplitudeProvider', () => ({
  useAmplitudeContext: () => mockAmplitudeContext,
  AmplitudeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock performance tracking
jest.mock('../lib/performance', () => ({
  trackPerformanceMetric: jest.fn(),
  getPerformanceStats: jest.fn(() => ({
    amplitudeCore: {
      initTime: 100,
      trackingLatency: [50, 60, 70],
      errorRate: 0.01,
      eventQueueSize: 5,
      memoryUsage: 1024 * 1024,
    },
    webVitals: {
      cls: 0.1,
      fid: 50,
      fcp: 1000,
      lcp: 2000,
      ttfb: 200,
      inp: 100,
    },
    browserMetrics: {
      memoryUsage: 1024 * 1024,
      connectionType: '4g',
      devicePixelRatio: 2,
      screenResolution: '1920x1080',
      viewportSize: '1200x800',
    },
  })),
  getPerformanceMetrics: jest.fn(() => []),
}));

// Mock security audit logger
jest.mock('../lib/security', () => ({
  auditLogger: {
    log: jest.fn(),
  },
}));

describe('useAmplitude hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide amplitude tracking functions', () => {
    const { result } = renderHook(() => useAmplitude());

    expect(result.current).toHaveProperty('track');
    expect(result.current).toHaveProperty('identify');
    expect(result.current).toHaveProperty('setUserProperties');
    expect(result.current).toHaveProperty('reset');
    expect(result.current).toHaveProperty('isInitialized');
    expect(result.current).toHaveProperty('context');
  });

  it('should track events successfully', async () => {
    const { result } = renderHook(() => useAmplitude());

    await act(async () => {
      await result.current.track('Test Event' as any, { test: 'value' });
    });

    expect(mockAmplitudeContext.amplitude.track).toHaveBeenCalledWith(
      'Test Event',
      { test: 'value' }
    );
  });

  it('should identify users successfully', async () => {
    const { result } = renderHook(() => useAmplitude());

    await act(async () => {
      await result.current.identify('user123' as any, { name: 'Test User' });
    });

    expect(mockAmplitudeContext.amplitude.identify).toHaveBeenCalledWith(
      'user123',
      { name: 'Test User' }
    );
  });

  it('should set user properties successfully', async () => {
    const { result } = renderHook(() => useAmplitude());

    await act(async () => {
      await result.current.setUserProperties({ plan: 'premium' });
    });

    expect(mockAmplitudeContext.amplitude.setUserProperties).toHaveBeenCalledWith(
      { plan: 'premium' }
    );
  });

  it('should reset amplitude successfully', () => {
    const { result } = renderHook(() => useAmplitude());

    act(() => {
      result.current.reset();
    });

    expect(mockAmplitudeContext.amplitude.reset).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Tracking failed');
    mockAmplitudeContext.amplitude.track.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAmplitude());

    await act(async () => {
      await expect(result.current.track('Test Event' as any))
        .rejects.toThrow('Tracking failed');
    });

    expect(result.current.lastError).toEqual(error);
  });

  it('should respect consent settings', async () => {
    // Temporarily modify the mock context's consent
    const originalConsent = { ...mockAmplitudeContext.consent };
    mockAmplitudeContext.consent = {
      analytics: false,
      sessionReplay: false,
      experiments: false,
      performance: false,
    };

    const { result } = renderHook(() => useAmplitude());

    await act(async () => {
      await result.current.track('Test Event' as any);
    });

    // Should not call amplitude.track when consent is not granted
    expect(mockAmplitudeContext.amplitude.track).not.toHaveBeenCalled();

    // Restore original consent
    mockAmplitudeContext.consent = originalConsent;
  });
});

describe('useExperiment hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  it('should provide experiment functions', () => {
    const { result } = renderHook(() => useExperiment());

    expect(result.current).toHaveProperty('getVariant');
    expect(result.current).toHaveProperty('trackExposure');
    expect(result.current).toHaveProperty('trackConversion');
    expect(result.current).toHaveProperty('isInExperiment');
    expect(result.current).toHaveProperty('registerExperiment');
    expect(result.current).toHaveProperty('canRunExperiments');
  });

  it('should register experiments', () => {
    const { result } = renderHook(() => useExperiment());

    const experimentConfig = {
      id: 'test-experiment',
      name: 'Test Experiment',
      description: 'A test experiment',
      status: 'running' as const,
      variants: [
        { id: 'control', name: 'Control', description: 'Control variant', allocation: 50, isControl: true, config: {} },
        { id: 'treatment', name: 'Treatment', description: 'Treatment variant', allocation: 50, isControl: false, config: {} },
      ],
      targeting: {},
      metrics: [],
      startDate: new Date(),
      sampleSize: 1000,
      confidenceLevel: 0.95,
      minimumDetectableEffect: 0.05,
      allocations: { control: 50, treatment: 50 },
      stickiness: 'user' as const,
    };

    act(() => {
      result.current.registerExperiment(experimentConfig);
    });

    expect(result.current.experiments.has('test-experiment')).toBe(true);
  });

  it('should track experiment exposure', async () => {
    const { result } = renderHook(() => useExperiment());

    // First register the experiment so it can be found
    const experimentConfig = {
      id: 'test-experiment',
      name: 'Test Experiment',
      description: 'A test experiment',
      status: 'running' as const,
      variants: [
        { id: 'control', name: 'Control', description: 'Control variant', allocation: 50, isControl: true, config: {} },
        { id: 'treatment', name: 'Treatment', description: 'Treatment variant', allocation: 50, isControl: false, config: {} },
      ],
      targeting: {},
      metrics: [],
      startDate: new Date(),
      sampleSize: 1000,
      confidenceLevel: 0.95,
      minimumDetectableEffect: 0.05,
      allocations: { control: 50, treatment: 50 },
      stickiness: 'user' as const,
    };

    act(() => {
      result.current.registerExperiment(experimentConfig);
    });

    await act(async () => {
      await result.current.trackExposure('test-experiment', 'control');
    });

    expect(mockAmplitudeContext.amplitude.track).toHaveBeenCalledWith(
      'Experiment Exposed',
      expect.objectContaining({
        experiment_id: 'test-experiment',
        variant_id: 'control',
      })
    );
  });

  it('should track experiment conversion', async () => {
    const { result } = renderHook(() => useExperiment());

    // Register the experiment first
    const experimentConfig = {
      id: 'test-experiment',
      name: 'Test Experiment',
      description: 'A test experiment',
      status: 'running' as const,
      variants: [
        { id: 'control', name: 'Control', description: 'Control variant', allocation: 50, isControl: true, config: {} },
        { id: 'treatment', name: 'Treatment', description: 'Treatment variant', allocation: 50, isControl: false, config: {} },
      ],
      targeting: {},
      metrics: [],
      startDate: new Date(),
      sampleSize: 1000,
      confidenceLevel: 0.95,
      minimumDetectableEffect: 0.05,
      allocations: { control: 50, treatment: 50 },
      stickiness: 'user' as const,
    };

    act(() => {
      result.current.registerExperiment(experimentConfig);
    });

    // Track exposure first
    await act(async () => {
      await result.current.trackExposure('test-experiment', 'control');
    });

    // Then track conversion
    await act(async () => {
      await result.current.trackConversion('test-experiment', 'purchase', 99.99);
    });

    expect(mockAmplitudeContext.amplitude.track).toHaveBeenCalledWith(
      'Experiment Converted',
      expect.objectContaining({
        experiment_id: 'test-experiment',
        metric_id: 'purchase',
        conversion_value: 99.99,
      })
    );
  });
});

describe('useSessionReplay hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock DOM methods
    Object.defineProperty(window, 'MutationObserver', {
      value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
      })),
      writable: true,
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/test',
        pathname: '/test',
      },
      writable: true,
    });

    // Mock document
    Object.defineProperty(document, 'title', {
      value: 'Test Page',
      writable: true,
    });

    Object.defineProperty(document, 'referrer', {
      value: 'https://example.com',
      writable: true,
    });
  });

  it('should provide session replay functions', () => {
    const { result } = renderHook(() => useSessionReplay());

    expect(result.current).toHaveProperty('startRecording');
    expect(result.current).toHaveProperty('stopRecording');
    expect(result.current).toHaveProperty('pauseRecording');
    expect(result.current).toHaveProperty('resumeRecording');
    expect(result.current).toHaveProperty('isRecording');
    expect(result.current).toHaveProperty('canRecord');
  });

  it('should start recording when consent is granted', async () => {
    // Mock Math.random to always pass sampling check (default 10% sample rate)
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.05); // Less than 0.1 (10% sample rate)

    const { result } = renderHook(() => useSessionReplay());

    await act(async () => {
      const started = await result.current.startRecording();
      expect(started).toBe(true);
    });

    expect(result.current.isRecording).toBe(true);

    // Restore Math.random
    Math.random = originalRandom;
  });

  it('should not start recording without consent', async () => {
    // Temporarily modify the mock context's consent
    const originalConsent = { ...mockAmplitudeContext.consent };
    mockAmplitudeContext.consent = {
      analytics: true,
      sessionReplay: false, // No session replay consent
      experiments: true,
      performance: true,
    };

    const { result } = renderHook(() => useSessionReplay());

    await act(async () => {
      const started = await result.current.startRecording();
      expect(started).toBe(false);
    });

    expect(result.current.isRecording).toBe(false);

    // Restore original consent
    mockAmplitudeContext.consent = originalConsent;
  });

  it('should stop recording successfully', async () => {
    const { result } = renderHook(() => useSessionReplay());

    // Start recording first
    await act(async () => {
      await result.current.startRecording();
    });

    // Then stop it
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it('should pause and resume recording', async () => {
    // Mock Math.random to always pass sampling check (default 10% sample rate)
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.05); // Less than 0.1 (10% sample rate)

    const { result } = renderHook(() => useSessionReplay());

    // Start recording first
    await act(async () => {
      await result.current.startRecording();
    });

    // Pause recording
    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.recordingState.isPaused).toBe(true);

    // Resume recording
    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.recordingState.isPaused).toBe(false);

    // Restore Math.random
    Math.random = originalRandom;
  });
});
