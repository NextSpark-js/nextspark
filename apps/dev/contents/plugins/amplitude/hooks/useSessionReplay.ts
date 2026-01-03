import { useEffect, useState, useCallback } from 'react';
import { useAmplitudeContext } from '../providers/AmplitudeProvider';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  eventsCount: number;
  sessionId: string | null;
  recordingSize: number;
}

interface PrivacyControls {
  maskAllInputs: boolean;
  maskAllText: boolean;
  blockSelectors: string[];
  maskSelectors: string[];
  ignoredPages: string[];
  recordingSampleRate: number;
}

interface SessionReplayConfig {
  enabled: boolean;
  privacyMode: 'strict' | 'balanced' | 'permissive';
  sampleRate: number;
  maxDurationMs: number;
  maxEventsPerSession: number;
  blockClass: string;
  maskClass: string;
  ignoredPages: string[];
}

export const useSessionReplay = () => {
  const { isInitialized, config, consent, error } = useAmplitudeContext();
  
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    eventsCount: 0,
    sessionId: null,
    recordingSize: 0,
  });

  const [privacyControls, setPrivacyControls] = useState<PrivacyControls>({
    maskAllInputs: true,
    maskAllText: false,
    blockSelectors: [
      '[data-private]',
      '.sensitive-data',
      '#credit-card-form',
      'input[type="password"]',
      'input[type="email"]',
      '.user-details'
    ],
    maskSelectors: [
      'input[type="text"]',
      'textarea',
      '[data-mask]'
    ],
    ignoredPages: ['/admin', '/payment', '/settings'],
    recordingSampleRate: 0.1, // 10%
  });

  const canRecord = isInitialized && 
                   config?.enableSessionReplay && 
                   consent.sessionReplay && 
                   !error;

  const isCurrentPageIgnored = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const currentPath = window.location.pathname;
    return privacyControls.ignoredPages.some(page => currentPath.includes(page));
  }, [privacyControls.ignoredPages]);

  const shouldSample = useCallback(() => {
    return Math.random() < privacyControls.recordingSampleRate;
  }, [privacyControls.recordingSampleRate]);

  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!canRecord || isCurrentPageIgnored() || !shouldSample()) {
      return false;
    }

    if (recordingState.isRecording) {
      console.warn('Session replay is already recording');
      return true;
    }

    try {
      const sessionId = generateSessionId();
      
      // Initialize session replay (this would integrate with actual Amplitude Session Replay SDK)
      console.log(`[Session Replay] Starting recording with session ID: ${sessionId}`);
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        sessionId,
        duration: 0,
        eventsCount: 0,
        recordingSize: 0,
      }));

      // Store session info
      localStorage.setItem('amplitude_session_replay_id', sessionId);
      localStorage.setItem('amplitude_session_replay_start', Date.now().toString());

      return true;
    } catch (error) {
      console.error('[Session Replay] Failed to start recording:', error);
      return false;
    }
  }, [canRecord, isCurrentPageIgnored, shouldSample, recordingState.isRecording, generateSessionId]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!recordingState.isRecording) {
      console.warn('Session replay is not currently recording');
      return;
    }

    try {
      console.log(`[Session Replay] Stopping recording for session: ${recordingState.sessionId}`);
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
      }));

      // Clean up session info
      localStorage.removeItem('amplitude_session_replay_id');
      localStorage.removeItem('amplitude_session_replay_start');

    } catch (error) {
      console.error('[Session Replay] Failed to stop recording:', error);
    }
  }, [recordingState.isRecording, recordingState.sessionId]);

  const pauseRecording = useCallback(() => {
    if (!recordingState.isRecording || recordingState.isPaused) {
      return;
    }

    console.log('[Session Replay] Pausing recording');
    setRecordingState(prev => ({
      ...prev,
      isPaused: true,
    }));
  }, [recordingState.isRecording, recordingState.isPaused]);

  const resumeRecording = useCallback(() => {
    if (!recordingState.isRecording || !recordingState.isPaused) {
      return;
    }

    console.log('[Session Replay] Resuming recording');
    setRecordingState(prev => ({
      ...prev,
      isPaused: false,
    }));
  }, [recordingState.isRecording, recordingState.isPaused]);

  const updatePrivacyControls = useCallback((updates: Partial<PrivacyControls>) => {
    setPrivacyControls(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Auto-start recording when conditions are met
  useEffect(() => {
    if (canRecord && !recordingState.isRecording && !isCurrentPageIgnored()) {
      startRecording();
    }
  }, [canRecord, recordingState.isRecording, isCurrentPageIgnored, startRecording]);

  // Update recording duration
  useEffect(() => {
    if (!recordingState.isRecording || recordingState.isPaused) return;

    const interval = setInterval(() => {
      setRecordingState(prev => ({
        ...prev,
        duration: prev.duration + 1000,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingState.isRecording, recordingState.isPaused]);

  // Page visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && recordingState.isRecording && !recordingState.isPaused) {
        pauseRecording();
      } else if (!document.hidden && recordingState.isRecording && recordingState.isPaused) {
        resumeRecording();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [recordingState.isRecording, recordingState.isPaused, pauseRecording, resumeRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recordingState.isRecording) {
        stopRecording();
      }
    };
  }, [recordingState.isRecording, stopRecording]);

  return {
    // Core functions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    
    // State
    isRecording: recordingState.isRecording,
    canRecord,
    recordingState,
    privacyControls,
    
    // Privacy controls
    updatePrivacyControls,
    isCurrentPageIgnored,
  };
};

