import React, { useState, useEffect, useCallback } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';
import { ConsentState, ConsentCategory } from '../types/amplitude.types';

interface ConsentManagerProps {
  onConsentChange?: (consent: ConsentState) => void;
  initialConsent?: ConsentState;
  showBadge?: boolean;
  position?: 'bottom-left' | 'bottom-right' | 'center' | 'top';
  theme?: 'light' | 'dark' | 'auto';
  compactMode?: boolean;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({ 
  onConsentChange, 
  initialConsent,
  showBadge = true,
  position = 'bottom-right',
  theme = 'auto',
  compactMode = false
}) => {
  const { consent: currentConsent, updateConsent } = useAmplitudeContext();
  const [localConsent, setLocalConsent] = useState<ConsentState>(initialConsent || currentConsent);
  const [showModal, setShowModal] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Check if user has previously interacted with consent
  useEffect(() => {
    const storedConsent = localStorage.getItem('amplitude_consent');
    const hasStoredConsent = !!storedConsent;
    setHasInteracted(hasStoredConsent);

    if (storedConsent) {
      try {
        const parsed = JSON.parse(storedConsent);
        setLocalConsent(parsed);
      } catch (error) {
        console.warn('[Consent Manager] Failed to parse stored consent:', error);
      }
    } else if (initialConsent) {
      setLocalConsent(initialConsent);
    } else {
      // Show modal if no previous consent
      setShowModal(true);
    }
  }, [initialConsent]);

  // Sync consent changes
  useEffect(() => {
    updateConsent(localConsent);
    localStorage.setItem('amplitude_consent', JSON.stringify(localConsent));
    if (onConsentChange) {
      onConsentChange(localConsent);
    }
  }, [localConsent, updateConsent, onConsentChange]);

  const handleToggle = useCallback((category: ConsentCategory) => {
    setLocalConsent(prev => ({ ...prev, [category]: !prev[category] }));
    setHasInteracted(true);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setLocalConsent({ 
      analytics: true, 
      sessionReplay: true, 
      experiments: true, 
      performance: true 
    });
    setShowModal(false);
    setHasInteracted(true);
  }, []);

  const handleRejectAll = useCallback(() => {
    setLocalConsent({ 
      analytics: false, 
      sessionReplay: false, 
      experiments: false, 
      performance: false 
    });
    setShowModal(false);
    setHasInteracted(true);
  }, []);

  const handleSavePreferences = useCallback(() => {
    setShowModal(false);
    setHasInteracted(true);
  }, []);

  const getConsentSummary = () => {
    const categories = Object.keys(localConsent) as ConsentCategory[];
    const granted = categories.filter(cat => localConsent[cat]);
    return {
      total: categories.length,
      granted: granted.length,
      percentage: Math.round((granted.length / categories.length) * 100)
    };
  };

  const consentSummary = getConsentSummary();

  if (!showModal && showBadge && hasInteracted) {
    return (
      <button 
        onClick={() => setShowModal(true)} 
        className={`amplitude-consent-badge amplitude-consent-badge--${position} amplitude-consent-badge--${theme}`}
        aria-label="Manage Privacy Preferences"
      >
        <span className="amplitude-consent-badge__icon">🛡️</span>
        <span className="amplitude-consent-badge__text">
          Privacy ({consentSummary.granted}/{consentSummary.total})
        </span>
      </button>
    );
  }

  if (!showModal) return null;

  return (
    <div className={`amplitude-consent-modal amplitude-consent-modal--${position} amplitude-consent-modal--${theme}`}>
      <div className="amplitude-consent-modal__backdrop" onClick={() => setShowModal(false)} />
      <div className={`amplitude-consent-modal__content ${compactMode ? 'amplitude-consent-modal__content--compact' : ''}`}>
        <div className="amplitude-consent-modal__header">
          <h2 className="amplitude-consent-modal__title">Privacy Preferences</h2>
          <button 
            className="amplitude-consent-modal__close"
            onClick={() => setShowModal(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="amplitude-consent-modal__body">
          <p className="amplitude-consent-modal__description">
            We use cookies and other tracking technologies to improve your experience. 
            Please review your preferences below.
          </p>

          <div className="amplitude-consent-modal__categories">
            <div className="amplitude-consent-category">
              <label className="amplitude-consent-category__label">
                <input
                  type="checkbox"
                  checked={localConsent.analytics}
                  onChange={() => handleToggle('analytics')}
                  className="amplitude-consent-category__checkbox"
                />
                <span className="amplitude-consent-category__name">Analytics</span>
              </label>
              <p className="amplitude-consent-category__description">
                Collects anonymous usage data to help us improve our service.
              </p>
            </div>

            <div className="amplitude-consent-category">
              <label className="amplitude-consent-category__label">
                <input
                  type="checkbox"
                  checked={localConsent.sessionReplay}
                  onChange={() => handleToggle('sessionReplay')}
                  className="amplitude-consent-category__checkbox"
                />
                <span className="amplitude-consent-category__name">Session Replay</span>
              </label>
              <p className="amplitude-consent-category__description">
                Records user sessions for debugging and user experience improvements.
              </p>
            </div>

            <div className="amplitude-consent-category">
              <label className="amplitude-consent-category__label">
                <input
                  type="checkbox"
                  checked={localConsent.experiments}
                  onChange={() => handleToggle('experiments')}
                  className="amplitude-consent-category__checkbox"
                />
                <span className="amplitude-consent-category__name">A/B Testing</span>
              </label>
              <p className="amplitude-consent-category__description">
                Participate in experiments to help us test new features and improvements.
              </p>
            </div>

            <div className="amplitude-consent-category">
              <label className="amplitude-consent-category__label">
                <input
                  type="checkbox"
                  checked={localConsent.performance}
                  onChange={() => handleToggle('performance')}
                  className="amplitude-consent-category__checkbox"
                />
                <span className="amplitude-consent-category__name">Performance</span>
              </label>
              <p className="amplitude-consent-category__description">
                Collects app performance metrics to monitor and improve system performance.
              </p>
            </div>
          </div>
        </div>

        <div className="amplitude-consent-modal__actions">
          <button 
            onClick={handleRejectAll}
            className="amplitude-consent-modal__button amplitude-consent-modal__button--secondary"
          >
            Reject All
          </button>
          <button 
            onClick={handleSavePreferences}
            className="amplitude-consent-modal__button amplitude-consent-modal__button--primary"
          >
            Save Preferences
          </button>
          <button 
            onClick={handleAcceptAll}
            className="amplitude-consent-modal__button amplitude-consent-modal__button--accent"
          >
            Accept All
          </button>
        </div>

        <div className="amplitude-consent-modal__footer">
          <p className="amplitude-consent-modal__footer-text">
            You can change these preferences at any time in your privacy settings.
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook for easier consent management
export const useConsent = () => {
  const { consent, updateConsent } = useAmplitudeContext();
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  const openConsentModal = useCallback(() => setIsConsentModalOpen(true), []);
  const closeConsentModal = useCallback(() => setIsConsentModalOpen(false), []);

  const hasConsent = useCallback((category: ConsentCategory): boolean => {
    return consent[category];
  }, [consent]);

  const getConsentStatus = useCallback(() => {
    const categories = Object.keys(consent) as ConsentCategory[];
    const granted = categories.filter(cat => consent[cat]);
    return {
      total: categories.length,
      granted: granted.length,
      percentage: Math.round((granted.length / categories.length) * 100)
    };
  }, [consent]);

  return {
    consent,
    updateConsent,
    isConsentModalOpen,
    openConsentModal,
    closeConsentModal,
    hasConsent,
    getConsentStatus,
  };
};

