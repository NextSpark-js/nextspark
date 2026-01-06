import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AmplitudeCore } from '../lib/amplitude-core';
import { amplitudePlugin } from '../plugin.config';
import { AmplitudePluginConfig, AmplitudePluginContext, ConsentState, isAmplitudeAPIKey } from '../types/amplitude.types';

const AmplitudeContext = createContext<AmplitudePluginContext | undefined>(undefined);

export const AmplitudeProvider: React.FC<{ children: React.ReactNode; overrideConfig?: Partial<AmplitudePluginConfig> }> = ({ 
  children, 
  overrideConfig 
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [consent, setConsent] = useState<ConsentState>({ 
    analytics: false, 
    sessionReplay: false, 
    experiments: false, 
    performance: false 
  });

  // TODO: Fix plugin config schema integration
  const pluginConfig = overrideConfig as AmplitudePluginConfig;
  const configLoading = false;
  const configError = null;

  const currentConfig = useRef<AmplitudePluginConfig | null>(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = pluginConfig?.errorRetryAttempts || 3;
  const RETRY_DELAY_MS = pluginConfig?.errorRetryDelayMs || 1000;

  const initializeAmplitude = useCallback(async (config: AmplitudePluginConfig) => {
    if (!config.apiKey || !isAmplitudeAPIKey(config.apiKey)) {
      throw new Error('Invalid Amplitude API key');
    }

    try {
      await AmplitudeCore.init(config.apiKey as any, config);
      setIsInitialized(true);
      setError(null);
      retryCount.current = 0;
      console.log('[Amplitude] Successfully initialized');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize Amplitude');
      
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        console.warn(`[Amplitude] Initialization failed, retrying in ${RETRY_DELAY_MS}ms (attempt ${retryCount.current}/${MAX_RETRIES})`);
        
        setTimeout(() => {
          initializeAmplitude(config);
        }, RETRY_DELAY_MS);
      } else {
        setError(error);
        setIsInitialized(false);
        console.error('[Amplitude] Initialization failed after max retries:', error);
      }
    }
  }, [MAX_RETRIES, RETRY_DELAY_MS]);

  const updateConsent = useCallback((newConsent: ConsentState) => {
    setConsent(newConsent);
    localStorage.setItem('amplitude_consent', JSON.stringify(newConsent));
  }, []);

  useEffect(() => {
    const savedConsent = localStorage.getItem('amplitude_consent');
    if (savedConsent) {
      try {
        setConsent(JSON.parse(savedConsent));
      } catch (error) {
        console.warn('[Amplitude] Failed to parse saved consent:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (pluginConfig && !configLoading && !configError && !isInitialized && !error) {
      currentConfig.current = { ...pluginConfig, ...overrideConfig };
      initializeAmplitude(currentConfig.current);
    }
  }, [pluginConfig, configLoading, configError, isInitialized, error, initializeAmplitude, overrideConfig]);

  const contextValue: AmplitudePluginContext = {
    amplitude: AmplitudeCore,
    isInitialized,
    config: currentConfig.current,
    consent,
    updateConsent,
    error,
  };

  if (configLoading) {
    return <div>Loading Amplitude configuration...</div>;
  }

  if (error && !isInitialized) {
    return <div>Amplitude initialization failed: {error.message}</div>;
  }

  return (
    <AmplitudeContext.Provider value={contextValue}>
      {children}
    </AmplitudeContext.Provider>
  );
};

export const useAmplitudeContext = () => {
  const context = useContext(AmplitudeContext);
  if (context === undefined) {
    throw new Error('useAmplitudeContext must be used within an AmplitudeProvider');
  }
  return context;
};
