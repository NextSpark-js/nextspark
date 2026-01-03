import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAmplitude } from './useAmplitude';
import { debounce } from '../utils/debounce';
import { trackPerformanceMetric } from '../lib/performance';
import { EventType } from '../types/amplitude.types';

export const useAmplitudeEvents = () => {
  const { track, identify, setUserProperties, isInitialized, context } = useAmplitude();
  const router = useRouter();

  // Page View Tracking
  useEffect(() => {
    if (!isInitialized || !router) return;

    const handleRouteChange = (url: string) => {
      const startTime = performance.now();
      track('Page Viewed' as EventType, { path: url, referrer: document.referrer });
      const endTime = performance.now();
      trackPerformanceMetric('page_view_duration', endTime - startTime, 'ms', { path: url });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [isInitialized, router, track]);

  // Click Tracking
  const handleClick = useCallback(debounce((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    let eventName = 'Click';
    let properties: Record<string, any> = {};

    if (target.dataset.track) {
      eventName = target.dataset.track;
    } else if (target.tagName === 'BUTTON') {
      eventName = 'Button Click';
      properties.buttonText = target.innerText.substring(0, 100);
    } else if (target.tagName === 'A') {
      eventName = 'Link Click';
      properties.linkHref = (target as HTMLAnchorElement).href;
      properties.linkText = target.innerText.substring(0, 100);
    }

    properties.elementId = target.id;
    properties.elementClass = target.className;
    properties.pagePath = router?.asPath;

    if (eventName !== 'Click' || Object.keys(properties).length > 0) {
      track(eventName as EventType, properties);
    }
  }, 300), [track, router]);

  useEffect(() => {
    if (!isInitialized) return;
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [isInitialized, handleClick]);

  // Form Submission Tracking
  const handleFormSubmit = useCallback((event: Event) => {
    const form = event.target as HTMLFormElement;
    const formName = form.name || form.id || 'Unnamed Form';
    const properties: Record<string, any> = { formName, pagePath: router?.asPath };

    // Collect form field data, excluding sensitive fields
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      if (typeof value === 'string' && !/password|secret|token/i.test(key)) {
        properties[`field_${key}`] = value.substring(0, 200);
      }
    });

    track('Form Submitted' as EventType, properties);
  }, [track, router]);

  useEffect(() => {
    if (!isInitialized) return;
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });
    return () => {
      document.querySelectorAll('form').forEach(form => {
        form.removeEventListener('submit', handleFormSubmit);
      });
    };
  }, [isInitialized, handleFormSubmit]);

  return {
    trackPageView: (path: string) => track('Page Viewed' as EventType, { path }),
    trackClick: (element: string, properties?: Record<string, any>) => 
      track('Element Click' as EventType, { element, ...properties }),
    trackFormSubmit: (formName: string, properties?: Record<string, any>) => 
      track('Form Submitted' as EventType, { formName, ...properties }),
  };
};

