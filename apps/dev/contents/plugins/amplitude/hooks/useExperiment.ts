import { useState, useEffect, useCallback } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';
import { EventProperties, EventType } from '../types/amplitude.types';

interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ExperimentVariant[];
  targeting: ExperimentTargeting;
  metrics: string[];
  startDate: Date;
  endDate?: Date;
  sampleSize?: number;
  confidenceLevel?: number;
  minimumDetectableEffect?: number;
  allocations: Record<string, number>;
  stickiness: 'user' | 'device' | 'session';
}

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  allocation: number;
  isControl: boolean;
  config: Record<string, any>;
}

interface ExperimentTargeting {
  userProperties?: Record<string, any>;
  geolocation?: string[];
  deviceType?: string[];
  timeRange?: { start: string; end: string };
}

interface ExperimentExposure {
  experimentId: string;
  variantId: string;
  userId?: string;
  timestamp: number;
  properties?: EventProperties;
}

interface ExperimentConversion {
  experimentId: string;
  variantId: string;
  metricId: string;
  value?: number;
  userId?: string;
  timestamp: number;
}

export const useExperiment = () => {
  const { amplitude, isInitialized, config, consent, error } = useAmplitudeContext();
  const [experiments, setExperiments] = useState<Map<string, ExperimentConfig>>(new Map());
  const [exposures, setExposures] = useState<Map<string, ExperimentExposure>>(new Map());
  const [conversions, setConversions] = useState<ExperimentConversion[]>([]);

  const canRunExperiments = isInitialized && config?.enableABTesting && consent.experiments;

  const registerExperiment = useCallback((experiment: ExperimentConfig) => {
    setExperiments(prev => new Map(prev.set(experiment.id, experiment)));
  }, []);

  const getVariant = useCallback((experimentId: string, userId: string): string | null => {
    if (!canRunExperiments) return null;

    const experiment = experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return null;

    // Check if user was already assigned
    const exposureKey = `${experimentId}_${userId}`;
    const existingExposure = exposures.get(exposureKey);
    if (existingExposure) {
      return existingExposure.variantId;
    }

    // Simple hash-based assignment for deterministic results
    const hash = Array.from(userId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const totalAllocation = Object.values(experiment.allocations).reduce((sum, val) => sum + val, 0);
    const assignment = hash % totalAllocation;

    let currentThreshold = 0;
    for (const [variantId, allocation] of Object.entries(experiment.allocations)) {
      currentThreshold += allocation;
      if (assignment < currentThreshold) {
        return variantId;
      }
    }

    // Fallback to control
    const controlVariant = experiment.variants.find(v => v.isControl);
    return controlVariant?.id || experiment.variants[0]?.id || null;
  }, [canRunExperiments, experiments, exposures]);

  const trackExposure = useCallback(async (experimentId: string, variantId?: string, properties?: EventProperties) => {
    if (!canRunExperiments || !amplitude) return;

    const experiment = experiments.get(experimentId);
    if (!experiment) {
      console.warn(`Experiment ${experimentId} not found`);
      return;
    }

    const actualVariantId = variantId || getVariant(experimentId, 'current-user');
    if (!actualVariantId) return;

    const exposureKey = `${experimentId}_current-user`;
    const exposure: ExperimentExposure = {
      experimentId,
      variantId: actualVariantId,
      userId: 'current-user',
      timestamp: Date.now(),
      properties
    };

    setExposures(prev => new Map(prev.set(exposureKey, exposure)));

    await amplitude.track('Experiment Exposed' as EventType, {
      experiment_id: experimentId,
      experiment_name: experiment.name,
      variant_id: actualVariantId,
      variant_name: experiment.variants.find(v => v.id === actualVariantId)?.name,
      is_control: experiment.variants.find(v => v.id === actualVariantId)?.isControl,
      ...properties
    });
  }, [canRunExperiments, amplitude, experiments, getVariant]);

  const trackConversion = useCallback(async (experimentId: string, metricId?: string, value?: number, properties?: EventProperties) => {
    if (!canRunExperiments || !amplitude) return;

    const exposureKey = `${experimentId}_current-user`;
    const exposure = exposures.get(exposureKey);
    
    if (!exposure) {
      console.warn(`No exposure found for experiment ${experimentId}. Must track exposure before conversion.`);
      return;
    }

    const conversion: ExperimentConversion = {
      experimentId,
      variantId: exposure.variantId,
      metricId: metricId || 'default',
      value,
      userId: 'current-user',
      timestamp: Date.now()
    };

    setConversions(prev => [...prev, conversion]);

    await amplitude.track('Experiment Converted' as EventType, {
      experiment_id: experimentId,
      variant_id: exposure.variantId,
      metric_id: metricId,
      conversion_value: value,
      time_to_conversion: Date.now() - exposure.timestamp,
      ...properties
    });
  }, [canRunExperiments, amplitude, exposures]);

  const isInExperiment = useCallback((experimentId: string, userId: string): boolean => {
    const variant = getVariant(experimentId, userId);
    return variant !== null;
  }, [getVariant]);

  const getExperimentConfig = useCallback((experimentId: string): ExperimentConfig | null => {
    return experiments.get(experimentId) || null;
  }, [experiments]);

  const getAllExperiments = useCallback((): ExperimentConfig[] => {
    return Array.from(experiments.values());
  }, [experiments]);

  return {
    // Core functions
    getVariant,
    trackExposure,
    trackConversion,
    isInExperiment,
    registerExperiment,
    
    // State getters
    experiments,
    exposures,
    conversions,
    canRunExperiments,
    
    // Utility functions
    getExperimentConfig,
    getAllExperiments,
  };
};

