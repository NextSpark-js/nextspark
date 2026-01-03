import { useCallback, useRef, useEffect, useState } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';
import { EventProperties, EventType, UserProperties, UserId, isAmplitudeEvent, isValidUserId } from '../types/amplitude.types';
import { trackPerformanceMetric } from '../lib/performance';

const REQUEST_CACHE_TTL = 5000;

export const useAmplitude = () => {
  const { amplitude, isInitialized, config, consent, error: providerError } = useAmplitudeContext();
  const requestCache = useRef(new Map<string, { timestamp: number; promise: Promise<void> }>());
  const isOnline = true; // Placeholder
  const [lastError, setLastError] = useState<Error | null>(null);

  useEffect(() => {
    const cleanupCache = () => {
      const now = Date.now();
      for (const [key, entry] of requestCache.current.entries()) {
        if (now - entry.timestamp > REQUEST_CACHE_TTL) {
          requestCache.current.delete(key);
        }
      }
    };

    const interval = setInterval(cleanupCache, REQUEST_CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const checkPreconditions = useCallback((feature: string) => {
    if (!isInitialized) {
      throw new Error(`Amplitude not initialized - cannot ${feature}`);
    }
    if (!isOnline) {
      throw new Error(`Network offline - cannot ${feature}`);
    }
    if (providerError) {
      throw new Error(`Amplitude error: ${providerError.message}`);
    }
  }, [isInitialized, isOnline, providerError]);

  const track = useCallback(async (eventType: EventType, properties?: EventProperties) => {
    try {
      checkPreconditions('track event');
      
      if (!consent.analytics) {
        console.warn('[Amplitude] Analytics consent not granted, skipping track');
        return;
      }

      const cacheKey = `track_${eventType}_${JSON.stringify(properties)}`;
      const cached = requestCache.current.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
        return cached.promise;
      }

      const promise = amplitude!.track(eventType, properties);
      requestCache.current.set(cacheKey, { timestamp: Date.now(), promise });
      
      await promise;
      trackPerformanceMetric('amplitude_track_success', 1, 'counter');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Track failed');
      setLastError(err);
      trackPerformanceMetric('amplitude_track_error', 1, 'counter');
      throw err;
    }
  }, [amplitude, checkPreconditions, consent.analytics]);

  const identify = useCallback(async (userId: UserId, properties?: UserProperties) => {
    try {
      checkPreconditions('identify user');
      
      if (!consent.analytics) {
        console.warn('[Amplitude] Analytics consent not granted, skipping identify');
        return;
      }

      if (!isValidUserId(userId)) {
        throw new Error('Invalid user ID');
      }

      await amplitude!.identify(userId, properties);
      trackPerformanceMetric('amplitude_identify_success', 1, 'counter');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Identify failed');
      setLastError(err);
      trackPerformanceMetric('amplitude_identify_error', 1, 'counter');
      throw err;
    }
  }, [amplitude, checkPreconditions, consent.analytics]);

  const setUserProperties = useCallback(async (properties: UserProperties) => {
    try {
      checkPreconditions('set user properties');
      
      if (!consent.analytics) {
        console.warn('[Amplitude] Analytics consent not granted, skipping setUserProperties');
        return;
      }

      await amplitude!.setUserProperties(properties);
      trackPerformanceMetric('amplitude_user_properties_success', 1, 'counter');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('SetUserProperties failed');
      setLastError(err);
      trackPerformanceMetric('amplitude_user_properties_error', 1, 'counter');
      throw err;
    }
  }, [amplitude, checkPreconditions, consent.analytics]);

  const reset = useCallback(() => {
    try {
      checkPreconditions('reset');
      amplitude!.reset();
      trackPerformanceMetric('amplitude_reset', 1, 'counter');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Reset failed');
      setLastError(err);
      throw err;
    }
  }, [amplitude, checkPreconditions]);

  return {
    track,
    identify,
    setUserProperties,
    reset,
    isInitialized,
    context: { config, consent, error: providerError || lastError },
    lastError,
  };
};
