/**
 * ExperimentWrapper component for A/B testing integration
 * Provides declarative experiment participation with automatic exposure tracking
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { useExperiment } from '../hooks/useExperiment';

// Component props
export interface ExperimentWrapperProps {
  experimentId: string;
  userId?: string;
  children: ReactNode | ((variant: string | null, config: Record<string, any> | null) => ReactNode);
  fallback?: ReactNode;
  trackExposureOnMount?: boolean;
  trackExposureOnVisible?: boolean;
  exposureDelay?: number;
  className?: string;
  style?: React.CSSProperties;
  onVariantAssigned?: (variant: string | null, config: Record<string, any> | null) => void;
  onExposed?: (experimentId: string, variant: string) => void;
  onError?: (error: Error) => void;
}

// Intersection Observer hook for visibility tracking
const useIntersectionObserver = (
  elementRef: React.RefObject<Element | null>,
  callback: () => void,
  options: IntersectionObserverInit = {}
) => {
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!elementRef.current || !('IntersectionObserver' in window)) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        if (visible) {
          callback();
        }
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [elementRef, callback, options]);

  return isVisible;
};

/**
 * ExperimentWrapper Component
 */
export const ExperimentWrapper: React.FC<ExperimentWrapperProps> = ({
  experimentId,
  userId,
  children,
  fallback = null,
  trackExposureOnMount = true,
  trackExposureOnVisible = false,
  exposureDelay = 0,
  className,
  style,
  onVariantAssigned,
  onExposed,
  onError,
}) => {
  const {
    getVariant,
    isInExperiment,
    trackExposure,
    canRunExperiments,
    experiments,
    getExperimentConfig,
  } = useExperiment();

  const [variant, setVariant] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasTrackedExposure, setHasTrackedExposure] = useState(false);

  const elementRef = useRef<HTMLDivElement>(null);
  const exposureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine user ID
  const effectiveUserId = userId || 'anonymous';

  // Get experiment configuration
  const experiment = experiments.get(experimentId);

  // Track exposure when visible
  const handleVisibilityExposure = () => {
    if (trackExposureOnVisible && variant && !hasTrackedExposure) {
      handleExposure();
    }
  };

  // Use intersection observer for visibility tracking
  useIntersectionObserver(elementRef, handleVisibilityExposure, {
    threshold: 0.5, // Track when 50% visible
  });

  // Handle exposure tracking
  const handleExposure = () => {
    if (!variant || hasTrackedExposure || !canRunExperiments) return;

    const trackExposureWithDelay = () => {
      trackExposure(experimentId, variant)
        .then(() => {
          setHasTrackedExposure(true);
          onExposed?.(experimentId, variant);
          console.log(`[Experiment] Tracked exposure for ${experimentId}:${variant}`);
        })
        .catch((err) => {
          console.error('[Experiment] Failed to track exposure:', err);
          setError(err);
          onError?.(err);
        });
    };

    if (exposureDelay > 0) {
      exposureTimeoutRef.current = setTimeout(trackExposureWithDelay, exposureDelay);
    } else {
      trackExposureWithDelay();
    }
  };

  // Initialize experiment
  useEffect(() => {
    if (!canRunExperiments) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check if experiment exists
      if (!experiment) {
        console.warn(`[Experiment] Experiment ${experimentId} not found`);
        setVariant(null);
        setConfig(null);
        setIsLoading(false);
        return;
      }

      // Get variant assignment
      const assignedVariant = getVariant(experimentId, effectiveUserId);
      
      // Get variant config from experiment config
      let variantConfig: Record<string, any> | null = null;
      if (assignedVariant && experiment.variants) {
        const variantData = experiment.variants.find((v: any) => v.id === assignedVariant);
        variantConfig = variantData?.config || null;
      }

      setVariant(assignedVariant);
      setConfig(variantConfig);
      setIsLoading(false);

      // Notify parent of assignment
      onVariantAssigned?.(assignedVariant, variantConfig);

      console.log(`[Experiment] ${experimentId} assigned variant:`, assignedVariant);
    } catch (err) {
      console.error('[Experiment] Failed to initialize experiment:', err);
      const error = err instanceof Error ? err : new Error('Failed to initialize experiment');
      setError(error);
      setIsLoading(false);
      onError?.(error);
    }
  }, [
    experimentId,
    effectiveUserId,
    canRunExperiments,
    experiment,
    getVariant,
    getExperimentConfig,
    onVariantAssigned,
    onError,
  ]);

  // Track exposure on mount
  useEffect(() => {
    if (trackExposureOnMount && variant && !trackExposureOnVisible) {
      handleExposure();
    }
  }, [variant, trackExposureOnMount, trackExposureOnVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (exposureTimeoutRef.current) {
        clearTimeout(exposureTimeoutRef.current);
      }
    };
  }, []);

  // Handle loading state
  if (isLoading) {
    return (
      <div
        ref={elementRef}
        className={className}
        style={style}
        data-experiment-loading={experimentId}
      >
        {fallback}
      </div>
    );
  }

  // Handle error state
  if (error) {
    console.error(`[Experiment] Error in experiment ${experimentId}:`, error);
    return (
      <div
        ref={elementRef}
        className={className}
        style={style}
        data-experiment-error={experimentId}
      >
        {fallback}
      </div>
    );
  }

  // Handle no experiment or not in experiment
  if (!canRunExperiments || !experiment || !variant) {
    return (
      <div
        ref={elementRef}
        className={className}
        style={style}
        data-experiment-excluded={experimentId}
      >
        {fallback}
      </div>
    );
  }

  // Render experiment content
  const content = typeof children === 'function' 
    ? children(variant, config)
    : children;

  return (
    <div
      ref={elementRef}
      className={className}
      style={style}
      data-experiment={experimentId}
      data-variant={variant}
      data-exposed={hasTrackedExposure}
    >
      {content}
    </div>
  );
};

/**
 * Feature Flag Component (simplified experiment wrapper)
 */
export interface FeatureFlagProps {
  flag: string;
  userId?: string;
  children: ReactNode;
  fallback?: ReactNode;
  onEnabled?: (flag: string) => void;
  onDisabled?: (flag: string) => void;
}

export const FeatureFlag: React.FC<FeatureFlagProps> = ({
  flag,
  userId,
  children,
  fallback = null,
  onEnabled,
  onDisabled,
}) => {
  return (
    <ExperimentWrapper
      experimentId={flag}
      userId={userId}
      fallback={fallback}
      trackExposureOnMount={true}
      onVariantAssigned={(variant) => {
        if (variant === 'enabled' || variant === 'treatment') {
          onEnabled?.(flag);
        } else {
          onDisabled?.(flag);
        }
      }}
    >
      {(variant) => {
        // For feature flags, show content if variant is 'enabled' or 'treatment'
        if (variant === 'enabled' || variant === 'treatment') {
          return children;
        }
        return fallback;
      }}
    </ExperimentWrapper>
  );
};

/**
 * A/B Test Component (variant-based rendering)
 */
export interface ABTestProps {
  experimentId: string;
  userId?: string;
  variants: Record<string, ReactNode>;
  fallback?: ReactNode;
  onVariantShown?: (experimentId: string, variant: string) => void;
}

export const ABTest: React.FC<ABTestProps> = ({
  experimentId,
  userId,
  variants,
  fallback = null,
  onVariantShown,
}) => {
  return (
    <ExperimentWrapper
      experimentId={experimentId}
      userId={userId}
      fallback={fallback}
      trackExposureOnMount={true}
      onExposed={onVariantShown}
    >
      {(variant) => {
        if (variant && variants[variant]) {
          return variants[variant];
        }
        return fallback;
      }}
    </ExperimentWrapper>
  );
};

/**
 * Multivariate Test Component (config-based rendering)
 */
export interface MultivariateTestProps {
  experimentId: string;
  userId?: string;
  children: (config: Record<string, any> | null) => ReactNode;
  fallback?: ReactNode;
}

export const MultivariateTest: React.FC<MultivariateTestProps> = ({
  experimentId,
  userId,
  children,
  fallback = null,
}) => {
  return (
    <ExperimentWrapper
      experimentId={experimentId}
      userId={userId}
      fallback={fallback}
      trackExposureOnMount={true}
    >
      {(variant, config) => {
        if (variant && config) {
          return children(config);
        }
        return fallback;
      }}
    </ExperimentWrapper>
  );
};

/**
 * Hook for programmatic experiment access
 */
export const useExperimentComponent = (experimentId: string, userId?: string) => {
  const {
    getVariant,
    isInExperiment,
    trackExposure,
    trackConversion,
    canRunExperiments,
    getExperimentConfig,
  } = useExperiment();

  const effectiveUserId = userId || 'anonymous';

  const variant = canRunExperiments ? getVariant(experimentId, effectiveUserId) : null;
  
  // Get variant config from experiment config
  let config: Record<string, any> | null = null;
  if (canRunExperiments && variant) {
    const experiment = getExperimentConfig(experimentId);
    if (experiment?.variants) {
      const variantData = experiment.variants.find((v: any) => v.id === variant);
      config = variantData?.config || null;
    }
  }
  
  const inExperiment = canRunExperiments ? isInExperiment(experimentId, effectiveUserId) : false;

  const expose = () => {
    if (variant) {
      return trackExposure(experimentId, variant);
    }
  };

  const convert = (metricId?: string, value?: number) => {
    return trackConversion(experimentId, metricId, value);
  };

  return {
    variant,
    config,
    inExperiment,
    canRunExperiments,
    expose,
    convert,
  };
};

export default ExperimentWrapper;
