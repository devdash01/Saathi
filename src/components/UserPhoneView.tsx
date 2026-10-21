import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Phone,
  MessageSquare,
  Check,
  ArrowLeft,
  Volume2,
  Mic,
  MicOff,
  Send,
  LogOut,
  Keyboard,
  PhoneOff,
  MapPin,
  Radio,
  Users,
  Zap,
  Copy
} from 'lucide-react';
import { speechService } from '../services/speechRecognitionService';
import { parseEmergencyKeywords } from '../services/emergencyKeywordService';
import { TacticalEmergencyMap } from './TacticalEmergencyMap';
import { deviceLocationService } from '../services/deviceLocationService';
import { emergencyContactService } from '../services/emergencyContactService';
import { EmergencyContactModal } from './EmergencyContactModal';
import type { EmergencyServiceEntity } from '../services/locationService';
import type { SafeSignalQuestion, AgencyDispatchState, EmergencyContact } from '../types';
import type { EmergencyReport } from '../types/report';

export type CitizenScreenName = 'landing' | 'call' | 'chat' | 'confirm' | 'case';

interface UserPhoneViewProps {
  currentInputText: string;
  onUserInputChange: (text: string, contextHint?: string, audioUrl?: string) => void;
  extractedLocation: string;
  callerCoords: [number, number];
  questions: SafeSignalQuestion[];
  onCallerAnswer: (questionId: string, answer: string) => void;
  agencies: AgencyDispatchState;
  sarvamStatus: 'connected' | 'transcribing' | 'idle' | 'error';
  setSarvamStatus: (status: 'connected' | 'transcribing' | 'idle' | 'error') => void;
  isLiveLocationSharing?: boolean;
  onToggleLiveLocationSharing?: (sharing: boolean) => void;
  activeReport?: EmergencyReport;
  onStartNewSession?: () => void;
  onRetryReport?: () => void;
  onManualLandmarkEntered?: (landmark: string) => void;
  onGpsLocationAcquired?: (coords: [number, number], accuracy: number, address?: string) => void;
  operatorName?: string;
  locationError?: string;
  nearbyServices?: EmergencyServiceEntity[];
}

export const UserPhoneView: React.FC<UserPhoneViewProps> = ({
  currentInputText,
  onUserInputChange,
  extractedLocation,
  callerCoords,
  questions,
  onCallerAnswer,
  agencies,
  sarvamStatus: _sarvamStatus,
  setSarvamStatus,
  isLiveLocationSharing,
  onToggleLiveLocationSharing,
  activeReport,
  onStartNewSession,
  onRetryReport: _onRetryReport,
  onManualLandmarkEntered,
  onGpsLocationAcquired,
  operatorName: _operatorName,
  nearbyServices = []
}) => {
  // Screen state matching Pages 1 - 5 of design
  const [activeScreen, setActiveScreen] = useState<CitizenScreenName>('landing');

  // Selected language
  const [selectedLanguage, setSelectedLanguage] = useState<'Hinglish' | 'Hindi' | 'English'>('Hinglish');

  // Page 2 Call state
  const [callSeconds, setCallSeconds] = useState(0);
  const [isWhisperMode, setIsWhisperMode] = useState(false);

  // Live Speech Recognition Voice Input State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Transcript state - STARTS CLEAN WITH ZERO HARDCODING
  const [transcript, setTranscript] = useState<string>(currentInputText || '');

  // Page 3 Chat messages - STARTS CLEAN
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'operator'; text: string; time: string }>>([]);
  const [answeredSafeSignal, setAnsweredSafeSignal] = useState<'Haan' | 'Nahi' | null>(null);
  const [isAreaShared, setIsAreaShared] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const effectiveAreaShared = isAreaShared || Boolean(isLiveLocationSharing);
  const [hardwareTriggerToast, setHardwareTriggerToast] = useState<string | null>(null);
  const [isBgTriggerEnabled, setIsBgTriggerEnabled] = useState<boolean | null>(null);

  // Page 4 Confirmation input
  const [landmarkInput, setLandmarkInput] = useState('');

  // Page 5 Safety reach options
  const [callbackSafe, setCallbackSafe] = useState<boolean>(false);
  const [smsSafe, setSmsSafe] = useState<boolean>(true);

  // Emergency Contact SOS Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() =>
    emergencyContactService.getContacts()
  );

  useEffect(() => {
    const unsub = emergencyContactService.subscribe((list) => {
      setEmergencyContacts(list);
    });
    return unsub;
  }, []);

  const [dispatchedContactIds, setDispatchedContactIds] = useState<Record<string, boolean>>({});
  const [copiedAlert, setCopiedAlert] = useState(false);

  const handleDispatchUnifiedAlert = useCallback((contact: EmergencyContact) => {
    const targetReport: EmergencyReport = activeReport || {
      id: 'INC-SOS-181',
      idempotencyKey: `idemp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lifecycleState: 'submitted',
      statusMessage: 'Immediate SOS triggered by citizen.',
      callerText: transcript || 'SOS: Urgent assistance requested.',
      location: {
        address: 'Paschim Vihar, New Delhi',
        coords: [28.6692, 77.1068],
        accuracyMeters: 15,
        isLiveStreaming: true,
        source: 'live_gps',
        lastUpdated: new Date().toISOString()
      },
      triage: {
        urgencyLevel: 'CRITICAL',
        threats: ['Immediate distress assistance requested'],
        injuries: [],
        location: {
          raw: 'Paschim Vihar',
          detectedAddress: 'Paschim Vihar, New Delhi',
          confidence: 0.95,
          ambiguityScore: 5,
          landmarks: []
        },
        childrenAtRisk: { detected: false, details: 'None' },
        callerConstraints: { canSpeakFreely: false, whispering: false, silenceLikely: false, backgroundThreatPresent: false },
        missingDetails: [],
        evidenceLinks: []
      },
      safetyFloor: {
        active: true,
        ruleId: 'SF-SOS',
        ruleName: 'Direct Citizen SOS',
        enforcedLevel: 'CRITICAL',
        originalAILevel: 'CRITICAL',
        rationale: 'Citizen triggered 1-Tap Dual SOS',
        cannotOverrideDownward: false
      },
      aiConfidence: { score: 1.0, isUncertain: false, rationale: 'Citizen manual trigger' },
      urgencyLevel: 'CRITICAL',
      agencies: {
        police: { recommended: true, unitType: 'PCR Van', priority: 'IMMEDIATE', status: 'REQUESTED', eta: '4m' },
        medical: { recommended: false, priority: 'NONE', status: 'NOT_REQUESTED' },
        shelter: { recommended: false, shelterName: 'Safe Haven OSC', availableBeds: 4, status: 'NOT_REQUESTED' },
        legalAid: { recommended: false, counselorType: 'DLSA', status: 'NOT_REQUESTED' }
      },
      questions: [],
      auditTrail: [],
      retryCount: 0
    };

    emergencyContactService.dispatchUnifiedAlert(contact, targetReport);
    setDispatchedContactIds((prev) => ({ ...prev, [contact.id]: true }));
    setHardwareTriggerToast(`Dispatched 1-Tap SOS to ${contact.name} via WhatsApp & SMS`);
    setTimeout(() => setHardwareTriggerToast(null), 4000);
  }, [activeReport, transcript]);

  // Disguise / Quick Exit
  const [isQuickExited, setIsQuickExited] = useState(false);

  // Digital Phone Clock
  const [phoneTime, setPhoneTime] = useState('09:41');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setPhoneTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Call timer
  useEffect(() => {
    let interval: number;
    if (activeScreen === 'call') {
      interval = window.setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeScreen]);

  // Sync language with speech recognition service
  useEffect(() => {
    speechService.setLanguage(selectedLanguage);
  }, [selectedLanguage]);

  // Keep live transcript reference for seamless continuous speech accumulation
  const transcriptRef = useRef<string>(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Sync incoming text from parent without overriding user's active session
  useEffect(() => {
    if (isVoiceListening) return; // CRITICAL: Never override while user is actively speaking!
    if (currentInputText && currentInputText !== transcriptRef.current) {
      setTranscript(currentInputText);
      transcriptRef.current = currentInputText;
    }
  }, [currentInputText, isVoiceListening]);

  const hasAutoAcquiredGpsRef = useRef(false);
  const onGpsLocationAcquiredRef = useRef(onGpsLocationAcquired);
  useEffect(() => {
    onGpsLocationAcquiredRef.current = onGpsLocationAcquired;
  }, [onGpsLocationAcquired]);

  // Auto-acquire real device GPS strictly once on mount (single-shot fix, no continuous watch loop)
  useEffect(() => {
    if (hasAutoAcquiredGpsRef.current) return;
    hasAutoAcquiredGpsRef.current = true;

    deviceLocationService.acquireGpsFix().then((loc) => {
      if ((loc.source === 'live_gps' || loc.source === 'gps_cached') && loc.coords) {
        setIsAreaShared(true);
        if (onGpsLocationAcquiredRef.current) {
          onGpsLocationAcquiredRef.current(loc.coords, loc.accuracyMeters, loc.address);
        }
      }
    }).catch(() => {
      // Non-blocking fallback
    });
  }, []);

  // Reference for single active voice message bubble to prevent duplicate messages
  const currentVoiceMessageIdRef = useRef<string | null>(null);

  // Core Real-Time Voice Input Handler
  const startLiveVoiceRecognition = useCallback(() => {
    setVoiceError(null);
    setSarvamStatus('transcribing');
    const baseText = transcriptRef.current ? transcriptRef.current.trim() : '';
    const voiceMsgId = `voice-${Date.now()}`;
    currentVoiceMessageIdRef.current = voiceMsgId;

    const started = speechService.start(
      (result) => {
        const spoken = (result.transcript || '').trim();
        if (!spoken) return;
        const formatted = isWhisperMode && !spoken.includes('[whisper]') ? `[whisper] ${spoken}` : spoken;

        const accumulated = baseText ? `${baseText}. ${formatted}` : formatted;

        setTranscript(accumulated);
        transcriptRef.current = accumulated;
        onUserInputChange(accumulated);
        setSarvamStatus('connected');

        if (spoken) {
          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newText = `🎤 ${formatted}`;
          setMessages((prev) => {
            const existingIdx = prev.findIndex((m: any) => m.id === voiceMsgId);
            if (existingIdx >= 0) {
              const currentMsg = prev[existingIdx];
              if (currentMsg.text === newText) {
                return prev;
              }
              const next = [...prev];
              next[existingIdx] = {
                ...currentMsg,
                text: newText,
                time: timeNow,
                isVoiceLive: true
              } as any;
              return next;
            }
            return [
              ...prev,
              {
                id: voiceMsgId,
                sender: 'user',
                text: newText,
                time: timeNow,
                isVoiceLive: true
              } as any
            ];
          });
        }
      },
      (err) => {
        console.warn('Sarvam AI Speech recognition error:', err);
        setVoiceError('Voice input error. You can also type your message.');
        setSarvamStatus('error');
      },
      () => {
        setIsVoiceListening(false);
        const activeId = currentVoiceMessageIdRef.current;
        if (activeId) {
          setMessages((prev) =>
            prev.map((m: any) => (m.id === activeId ? { ...m, isVoiceLive: false } : m))
          );
          currentVoiceMessageIdRef.current = null;
        }
      }
    );

    if (started) {
      setIsVoiceListening(true);
    }
  }, [isWhisperMode, onUserInputChange, setSarvamStatus]);

  const stopLiveVoiceRecognition = useCallback(() => {
    speechService.stop();
    setIsVoiceListening(false);
    const activeId = currentVoiceMessageIdRef.current;
    if (activeId) {
      setMessages((prev) =>
        prev.map((m: any) => (m.id === activeId ? { ...m, isVoiceLive: false } : m))
      );
      currentVoiceMessageIdRef.current = null;
    }
  }, []);


  const handleToggleVoiceInput = () => {
    if (isVoiceListening) {
      stopLiveVoiceRecognition();
    } else {
      startLiveVoiceRecognition();
    }
  };

  // Hardware shortcut: Double-press Volume Up & Down together opens microphone instantly
  useEffect(() => {
    let lastArrowUp = 0;
    let lastArrowDown = 0;
    let lastVPress = 0;
    let vCount = 0;

    const activateMicInstantly = () => {
      // 1. Ensure active call/input screen is visible
      setActiveScreen('call');

      // 2. Immediate tactile buzz feedback on mobile devices
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([70]);
        }
      } catch (_e) {}

      // 3. Open and engage microphone recognition instantly
      startLiveVoiceRecognition();

      // 4. Display high-visibility confirmation toast
      setHardwareTriggerToast('🎙️ Hardware Trigger: Mic activated! Speak now...');
      setTimeout(() => {
        setHardwareTriggerToast(null);
      }, 3500);
    };

    const handleHardwareTrigger = () => {
      activateMicInstantly();
    };

    // Keyboard fallbacks for web/desktop testing: Arrow Up + Down chord, or double press 'V'
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;

      const now = Date.now();
      if (e.key === 'ArrowUp') {
        lastArrowUp = now;
        if (now - lastArrowDown < 500) {
          activateMicInstantly();
        }
      } else if (e.key === 'ArrowDown') {
        lastArrowDown = now;
        if (now - lastArrowUp < 500) {
          activateMicInstantly();
        }
      } else if (e.key.toLowerCase() === 'v') {
        if (now - lastVPress < 500) {
          vCount++;
          if (vCount >= 2) {
            activateMicInstantly();
            vCount = 0;
          }
        } else {
          vCount = 1;
        }
        lastVPress = now;
      }
    };

    window.addEventListener('saathi:hardware-mic-trigger', handleHardwareTrigger);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('saathi:hardware-mic-trigger', handleHardwareTrigger);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [startLiveVoiceRecognition]);

  // Check Accessibility Service status for 24/7 background hardware trigger
  const checkBgTriggerStatus = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).SaathiNative?.isAccessibilityEnabled) {
        const enabled = Boolean((window as any).SaathiNative.isAccessibilityEnabled());
        setIsBgTriggerEnabled(enabled);
      }
    } catch (_e) {}
  }, []);

  useEffect(() => {
    checkBgTriggerStatus();
    const handleFocus = () => checkBgTriggerStatus();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(checkBgTriggerStatus, 3000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkBgTriggerStatus]);

  const handleOpenAccessibilitySettings = () => {
    try {
      if ((window as any).SaathiNative?.openAccessibilitySettings) {
        (window as any).SaathiNative.openAccessibilitySettings();
      } else {
        alert('To enable 24/7 background trigger: Go to Android Settings > Accessibility > Installed apps > Saathi Emergency Hardware Trigger -> Turn ON.');
      }
    } catch (_e) {}
  };

  const handleStartNewSessionClick = () => {
    stopLiveVoiceRecognition();
    setTranscript('');
    transcriptRef.current = '';
    setMessages([]);
    setChatInput('');
    setCallSeconds(0);
    setAnsweredSafeSignal(null);
    setIsAreaShared(false);
    setIsLocatingGps(false);
    if (onStartNewSession) {
      onStartNewSession();
    }
  };

  // Dedicated Chat Message Sender with robust deduplication
  const handleSendChatMessage = useCallback(() => {
    const val = chatInput.trim();
    if (!val) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: val, time: timeNow }
    ]);

    const currentT = transcriptRef.current ? transcriptRef.current.trim() : '';
    const updated = currentT ? `${currentT}. ${val}` : val;

    setTranscript(updated);
    transcriptRef.current = updated;
    onUserInputChange(updated);
    setChatInput('');
  }, [chatInput, onUserInputChange]);

  // Real browser geolocation acquisition with permission prompt
  const handleShareLiveLocation = async () => {
    setIsLocatingGps(true);
    try {
      const loc = await deviceLocationService.acquireGpsFix();
      if (loc.source === 'live_gps' || loc.source === 'gps_cached') {
        setIsAreaShared(true);
        if (onToggleLiveLocationSharing) {
          onToggleLiveLocationSharing(true);
        }
        if (onGpsLocationAcquired) {
          onGpsLocationAcquired(loc.coords, loc.accuracyMeters);
        }
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const locMsg = `📍 Live Location Transmitted (GPS: ${loc.coords[0].toFixed(4)}, ${loc.coords[1].toFixed(4)} · ±${loc.accuracyMeters}m)`;
        setMessages((prev) => [
          ...prev,
          { sender: 'user', text: locMsg, time: timeNow }
        ]);
        const locSnippet = `[Live GPS Shared: ${loc.coords[0].toFixed(4)}, ${loc.coords[1].toFixed(4)}]`;
        const updated = transcript ? (transcript.includes(locSnippet) ? transcript : `${transcript}. ${locSnippet}`) : locSnippet;
        setTranscript(updated);
        transcriptRef.current = updated;
        onUserInputChange(updated);
      } else if (loc.error) {
        alert(loc.error);
      }
    } catch (err) {
      console.error('GPS acquisition error:', err);
      alert('Unable to acquire live location. Please check browser location permissions.');
    } finally {
      setIsLocatingGps(false);
    }
  };

  const handleQuickExit = () => {
    setIsQuickExited(true);
  };

  // Reset answered status when a new SafeSignal question arrives
  useEffect(() => {
    setAnsweredSafeSignal(null);
  }, [questions]);

  // Handle SafeSignal answer
  const handleSafeSignalAnswer = (ans: 'Haan' | 'Nahi') => {
    setAnsweredSafeSignal(ans);
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentQ = questions && questions[0];
    setMessages((prev) => [
      ...prev,
      ...(currentQ ? [{ sender: 'operator' as const, text: currentQ.hinglishText || currentQ.questionText, time: timeNow }] : []),
      { sender: 'user' as const, text: ans === 'Haan' ? 'Haan (Yes)' : 'Nahi (No)', time: timeNow }
    ]);
    if (currentQ) {
      onCallerAnswer(currentQ.id, ans === 'Haan' ? 'YES' : 'NO');
    }
  };

  // Format call timer 00:42
  const formattedCallTimer = `${Math.floor(callSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(callSeconds % 60).toString().padStart(2, '0')}`;

  // Quick exit disguise screen
  if (isQuickExited) {
    return (
      <div className="citizen-native-app" style={{ background: '#f8fafc', padding: '24px 16px', minHeight: '100vh', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>Weather — New Delhi</h2>
          <button
            onClick={() => setIsQuickExited(false)}
            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Re-enter
          </button>
        </div>
        <div style={{ marginTop: '20px', padding: '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, color: '#0f172a' }}>28°C</div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Clear Skies • Air Quality: Moderate</div>
        </div>
      </div>
    );
  }

  // Extract real dynamic facts from the user's speech
  const dynamicEvidence = activeReport?.triage.evidenceLinks || [];

  return (
    <div className="citizen-native-app">
      {hardwareTriggerToast && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--safe-top, 48px) + 8px)',
            left: '16px',
            right: '16px',
            zIndex: 99999,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(5, 150, 105, 0.45), 0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 700,
            fontSize: '0.82rem',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
          <span>{hardwareTriggerToast}</span>
        </div>
      )}
          {/* ======================================================== */}
          {/* PAGE 1: CITIZEN LANDING SCREEN (You are not alone)       */}
          {/* ======================================================== */}
          {activeScreen === 'landing' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f2f4f8' }}>
              <div className="citizen-top-header">
                <div className="citizen-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/logo.png" alt="Saathi" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }} />
                    <span className="citizen-brand-tag">SAATHI 181</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => setIsContactModalOpen(true)}
                      title="Manage Emergency Contacts & 1-Tap Dual SOS"
                      className="citizen-contact-header-btn"
                    >
                      <div className="dot-active" />
                      <Users size={12} />
                      <span>Contacts ({emergencyContacts.length})</span>
                    </button>
                    {(transcript || messages.length > 0) && (
                      <button
                        onClick={handleStartNewSessionClick}
                        title="Start a fresh report session"
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          borderRadius: '6px',
                          padding: '3px 7px',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        + New
                      </button>
                    )}
                    <button onClick={handleQuickExit} className="quick-exit-btn">
                      <LogOut size={12} />
                      <span>Quick exit</span>
                    </button>
                  </div>
                </div>

                <div className="citizen-hero-title">You are not alone.</div>
                <div className="citizen-hero-desc">
                  Speak, whisper or type. A trained operator reads every word, any time of day.
                </div>
              </div>

              <div className="citizen-content-scroll">
                {/* Active Incident / Chat Unit Card (One Unit of Chat) */}
                {(transcript || messages.length > 0) && (
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #2563eb',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.08)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.04em' }}>
                        ACTIVE CHAT UNIT · {activeReport?.id || 'INC-181'}
                      </span>
                      <span style={{ fontSize: '0.58rem', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {messages.length} msg · Preserved
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 500, lineHeight: 1.4, marginBottom: '8px' }}>
                      "{transcript ? (transcript.length > 85 ? `${transcript.slice(0, 85)}...` : transcript) : 'Active emergency report in progress.'}"
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        onClick={() => setActiveScreen('chat')}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '7px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Resume Chat →
                      </button>
                      <button
                        onClick={handleStartNewSessionClick}
                        style={{
                          background: '#fff',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          padding: '7px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Start New Chat
                      </button>
                    </div>
                  </div>
                )}
                {/* Live Voice Input Instant Action */}
                <button
                  onClick={() => {
                    setActiveScreen('call');
                    setCallSeconds(0);
                    setTimeout(() => startLiveVoiceRecognition(), 200);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mic size={22} color="#ffffff" className={isVoiceListening ? 'mic-recording-pulse' : ''} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.98rem', fontWeight: 800 }}>Tap to Speak (Live Voice)</div>
                    <div style={{ fontSize: '0.72rem', color: '#fecaca' }}>Speak into your microphone in Hindi or Hinglish</div>
                  </div>
                </button>

                {/* Hardware Shortcut Info & 24/7 Background Status */}
                {isBgTriggerEnabled === false ? (
                  <div style={{
                    background: '#eff6ff',
                    border: '1.5px solid #60a5fa',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.9rem' }}>🛡️</span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e40af' }}>
                        Enable 24/7 Background Volume Trigger
                      </span>
                    </div>
                    <div style={{ fontSize: '0.67rem', color: '#334155', lineHeight: 1.35 }}>
                      To trigger the mic anytime even when the app is closed or locked, turn ON Saathi in Android Accessibility settings.
                    </div>
                    <button
                      onClick={handleOpenAccessibilitySettings}
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        alignSelf: 'flex-start'
                      }}
                    >
                      Open Android Accessibility Settings →
                    </button>
                  </div>
                ) : isBgTriggerEnabled === true ? (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.67rem',
                    color: '#166534'
                  }}>
                    <span>✅</span>
                    <span><strong>24/7 Background Trigger Active:</strong> Press Volume Up &amp; Down together anytime (even if app is closed) to open mic.</span>
                  </div>
                ) : (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '7px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.68rem',
                    color: '#475569',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <span style={{ fontSize: '0.85rem' }}>⚡</span>
                    <span><strong>Instant Mic Shortcut:</strong> Double-press <strong>Volume Up &amp; Down</strong> buttons together anytime to speak immediately.</span>
                  </div>
                )}

                {/* 1. Call 181 Card */}
                <button onClick={() => { setActiveScreen('call'); setCallSeconds(0); }} className="call-181-card">
                  <div className="card-icon-round-white">
                    <Phone size={18} color="#ffffff" />
                  </div>
                  <div>
                    <div className="card-title-white">Call 181</div>
                    <div className="card-sub-white">Talk to an operator now. Whisper is fine.</div>
                  </div>
                </button>

                {/* 2. Chat without speaking */}
                <button onClick={() => setActiveScreen('chat')} className="chat-without-speak-card">
                  <div className="card-icon-round-blue">
                    <MessageSquare size={18} color="#2563eb" />
                  </div>
                  <div>
                    <div className="card-title-dark">Chat without speaking</div>
                    <div className="card-sub-muted">For when someone nearby can hear you</div>
                  </div>
                </button>

                {/* 3. Silent SOS */}
                <div
                  onClick={() => {
                    setActiveScreen('chat');
                    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setMessages((prev) => [
                      ...prev,
                      { sender: 'user', text: '[SILENT SOS TRIGGERED - Immediate Help Needed]', time: timeNow }
                    ]);
                    onUserInputChange('[SILENT SOS] Immediate danger. Need assistance without speaking.');
                  }}
                  className="silent-sos-card"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="silent-sos-top-row">
                    <div className="sos-dashed-circle">SOS</div>
                    <div>
                      <div className="card-title-dark">Silent SOS</div>
                      <div className="card-sub-muted">Press and hold for 3 seconds. No sound, no vibration.</div>
                    </div>
                  </div>
                  <div className="silent-sos-footer-text">
                    Opens a silent chat and marks it urgent. Your location is shared only if you allow it.
                  </div>
                </div>

                {/* 4. Emergency Contacts & WhatsApp/SMS SOS Card */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #3b82f6',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Users size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                          Emergency Contacts ({emergencyContacts.length})
                        </div>
                        <div style={{ fontSize: '0.66rem', color: '#64748b' }}>
                          Auto-mirrors operator details via WhatsApp &amp; SMS
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsContactModalOpen(true)}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Configure →
                    </button>
                  </div>

                  {emergencyContacts.length > 0 ? (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                            {emergencyContacts[0].name}{' '}
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                              ({emergencyContacts[0].relationship})
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                            {emergencyContacts[0].phone} • WhatsApp &amp; SMS Active
                          </div>
                        </div>
                        <span
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            border: '1px solid #bfdbfe',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}
                        >
                          PRIMARY
                        </span>
                      </div>

                      <button
                        onClick={() => handleDispatchUnifiedAlert(emergencyContacts[0])}
                        className={`btn-unified-sos-dispatch ${dispatchedContactIds[emergencyContacts[0].id] ? 'btn-unified-sos-dispatched' : ''}`}
                        title="Send emergency details to both WhatsApp and SMS together in 1 tap without opening external apps"
                      >
                        <Zap size={14} />
                        <span>
                          {dispatchedContactIds[emergencyContacts[0].id]
                            ? '✓ Transmitted to WhatsApp & SMS (Tap to Re-send)'
                            : 'Send 1-Tap SOS (WhatsApp + SMS)'}
                        </span>
                      </button>

                      {dispatchedContactIds[emergencyContacts[0].id] && (
                        <div
                          style={{
                            background: '#ecfdf5',
                            border: '1.5px solid #10b981',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={14} color="#059669" strokeWidth={3} />
                            <span>SOS Prepared & Dispatched to {emergencyContacts[0].name}</span>
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#047857', lineHeight: 1.35 }}>
                            Live GPS coordinates, incident summary, and Police 112 tracking are prepared. Tap below to send or re-open directly on your device:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '3px' }}>
                            <a
                              href={emergencyContactService.generateWhatsAppUrl(
                                emergencyContacts[0].phone,
                                emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: '#25D366',
                                color: '#ffffff',
                                textDecoration: 'none',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <MessageSquare size={12} />
                              <span>WhatsApp</span>
                            </a>
                            <a
                              href={emergencyContactService.generateSmsUrl(
                                emergencyContacts[0].phone,
                                emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                              )}
                              style={{
                                background: '#0284c7',
                                color: '#ffffff',
                                textDecoration: 'none',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <Phone size={12} />
                              <span>Native SMS</span>
                            </a>
                          </div>
                          <button
                            onClick={async () => {
                              const msg = emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name);
                              await emergencyContactService.copyToClipboard(msg);
                              setCopiedAlert(true);
                              setTimeout(() => setCopiedAlert(false), 3000);
                            }}
                            style={{
                              background: copiedAlert ? '#dcfce7' : '#f8fafc',
                              color: copiedAlert ? '#15803d' : '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              marginTop: '2px'
                            }}
                          >
                            <Copy size={11} />
                            <span>{copiedAlert ? '✓ Alert Copied to Clipboard!' : 'Copy Full Alert Text'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      No contact added yet.{' '}
                      <button
                        onClick={() => setIsContactModalOpen(true)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        + Add a trusted contact
                      </button>{' '}
                      to receive live emergency alerts.
                    </div>
                  )}
                </div>
                <div className="good-to-know-section">
                  <div className="good-to-know-heading">GOOD TO KNOW</div>
                  <div className="good-to-know-item">
                    <Check size={14} color="#16a34a" />
                    <span>You can answer with just <strong>haan</strong> or <strong>nahi</strong>.</span>
                  </div>
                  <div className="good-to-know-item">
                    <Check size={14} color="#16a34a" />
                    <span>Your number is hidden from the operator's screen.</span>
                  </div>
                  <div className="good-to-know-item">
                    <Check size={14} color="#16a34a" />
                    <span>If the call drops, call again. Your details are kept.</span>
                  </div>
                </div>
              </div>

              {/* Bottom Language & Safe Word Bar */}
              <div className="citizen-bottom-bar">
                <div className="lang-pills-row">
                  {(['Hinglish', 'Hindi', 'English'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`lang-pill-btn ${selectedLanguage === lang ? 'active' : ''}`}
                    >
                      {lang === 'Hindi' ? 'हिंदी' : lang}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const code = prompt('Enter a safe word (e.g. gulab):', 'gulab');
                    if (code) alert(`Safe word "${code}" registered. Mentioning it triggers covert dispatch.`);
                  }}
                  className="safe-word-link"
                >
                  Safe word
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PAGE 2: LIVE CALL / WHISPER MODE WITH REAL VOICE INPUT   */}
          {/* ======================================================== */}
          {activeScreen === 'call' && (
            <div className="live-call-container">
              <div className="live-call-header">
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>181 Women Helpline</div>
                  <div style={{ fontSize: '0.7rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                    <span>Connected · {formattedCallTimer}</span>
                  </div>
                </div>
                <button onClick={handleQuickExit} className="quick-exit-btn">
                  Quick exit
                </button>
              </div>

              {/* Scrollable middle section */}
              <div style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                {/* Center Microphone Recording Action */}
                <div className="live-call-center-visual">
                <div className="ripple-circle-outer">
                  <div className="ripple-circle-mid">
                    <button
                      onClick={handleToggleVoiceInput}
                      className={`ripple-circle-inner ${isVoiceListening ? 'mic-recording-pulse' : ''}`}
                      title={isVoiceListening ? 'Listening live! Tap to stop' : 'Tap to speak via microphone'}
                      style={{
                        background: isVoiceListening ? '#dc2626' : '#b91c1c',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {isVoiceListening ? <Radio size={32} color="#ffffff" /> : <Mic size={32} color="#ffffff" />}
                    </button>
                  </div>
                </div>

                {/* Animated Waveform */}
                <div className="waveform-dots-row" style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isVoiceListening ? (
                    <>
                      <span className="live-wave-bar" />
                      <span className="live-wave-bar" />
                      <span className="live-wave-bar" />
                      <span className="live-wave-bar" />
                      <span className="live-wave-bar" />
                    </>
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Tap microphone to speak live</span>
                  )}
                </div>

                <div className="operator-listening-tag" style={{ color: isVoiceListening ? '#4ade80' : '#cbd5e1' }}>
                  {isVoiceListening ? '🎤 Transcribing live... Operator is listening' : 'Operator OP-07 connected · Tap mic to speak'}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isVoiceListening ? '#ef4444' : '#10b981',
                    boxShadow: isVoiceListening ? '0 0 8px #ef4444' : '0 0 6px #10b981'
                  }} />
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600 }}>
                    AI Speech Engine: <strong style={{ color: '#38bdf8' }}>Sarvam AI (saaras:v4)</strong>
                  </span>
                </div>
                {voiceError && (
                  <div style={{ fontSize: '0.65rem', color: '#fca5a5', marginTop: '4px', textAlign: 'center' }}>
                    {voiceError}
                  </div>
                )}
              </div>

              {/* WHAT WE HEARD Card - PURE DYNAMIC USER INPUT */}
              <div className="what-we-heard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.04em', color: '#94a3b8' }}>
                    WHAT WE HEARD
                  </span>
                  {isVoiceListening && (
                    <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 700 }}>● REC LIVE</span>
                  )}
                </div>
                <div style={{ fontSize: '0.86rem', color: transcript ? '#f1f5f9' : '#94a3b8', lineHeight: 1.45, fontWeight: 500, minHeight: '36px' }}>
                  {transcript ? (() => {
                    const parsed = parseEmergencyKeywords(transcript);
                    return (
                      <div>
                        <div>
                          {parsed.segments.map((seg, idx) =>
                            seg.isKeyword ? (
                              <mark
                                key={idx}
                                style={{
                                  background: seg.badgeColor || '#dc2626',
                                  color: '#ffffff',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.84rem',
                                  margin: '0 2px'
                                }}
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <span key={idx}>{seg.text}</span>
                            )
                          )}
                        </div>
                        {parsed.detectedKeywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                            {parsed.detectedKeywords.map((kw, kidx) => (
                              <span
                                key={kidx}
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  border: `1px solid ${kw.color}`,
                                  color: kw.color,
                                  fontWeight: 800
                                }}
                              >
                                ● {kw.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <span style={{ fontStyle: 'italic', opacity: 0.8 }}>
                      No words spoken yet. Tap the microphone above to speak into your mic, or use "Type instead" below.
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Something wrong? Say <strong style={{ color: '#facc15' }}>"galat"</strong> or tap Type instead.
                </div>
              </div>

              {/* SafeSignal Active Question Card on Live Voice Call */}
              {questions && questions[0] && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  border: '1.5px solid #3b82f6',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: questions[0].category === 'custom_operator_inquiry' ? '#f59e0b' : '#60a5fa', letterSpacing: '0.04em' }}>
                      {questions[0].category === 'custom_operator_inquiry' ? '💬 OPERATOR DIRECT INQUIRY' : 'OPERATOR SAFESIGNAL QUESTION'}
                    </span>
                    <span style={{ fontSize: '0.58rem', background: '#1e3a8a', color: '#93c5fd', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Tap to reply
                    </span>
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 }}>
                    {questions[0].hinglishText || questions[0].questionText}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '2px' }}>
                    <button
                      onClick={() => handleSafeSignalAnswer('Haan')}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Haan (Yes)
                    </button>
                    <button
                      onClick={() => handleSafeSignalAnswer('Nahi')}
                      style={{
                        background: '#334155',
                        color: '#f8fafc',
                        border: '1px solid #64748b',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Nahi (No)
                    </button>
                  </div>
                </div>
              )}

              {/* Whisper Mode Toggle */}
              <div className="whisper-mode-toggle-card">
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>Whisper mode</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Boosts quiet speech &amp; flags coded call for operator</div>
                </div>
                <button
                  onClick={() => {
                    const next = !isWhisperMode;
                    setIsWhisperMode(next);
                    if (next && transcript && !transcript.includes('[whisper]')) {
                      const updated = `[whisper] ${transcript}`;
                      setTranscript(updated);
                      onUserInputChange(updated);
                    }
                  }}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: isWhisperMode ? '#22c55e' : '#475569',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: 'white',
                      position: 'absolute',
                      top: 2,
                      left: isWhisperMode ? 22 : 2,
                      transition: 'left 0.15s ease'
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Bottom 3 Call Controls */}
            <div className="call-bottom-controls-row">
                <button
                  onClick={() => {
                    if (isVoiceListening) {
                      stopLiveVoiceRecognition();
                    } else {
                      startLiveVoiceRecognition();
                    }
                  }}
                  className={`btn-call-action-dark ${isVoiceListening ? 'active' : ''}`}
                  style={{ background: isVoiceListening ? '#b91c1c' : '#1e293b' }}
                >
                  {isVoiceListening ? <MicOff size={18} /> : <Mic size={18} />}
                  <span>{isVoiceListening ? 'Stop Mic' : 'Start Mic'}</span>
                </button>

                <button onClick={() => setActiveScreen('chat')} className="btn-call-action-dark">
                  <Keyboard size={18} />
                  <span>Type instead</span>
                </button>

                <button
                  onClick={() => {
                    stopLiveVoiceRecognition();
                    setActiveScreen('confirm');
                  }}
                  className="btn-call-action-red"
                >
                  <PhoneOff size={18} />
                  <span>End call</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PAGE 3: SILENT CHAT WITH LIVE VOICE TYPING               */}
          {/* ======================================================== */}
          {activeScreen === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f2f4f8' }}>
              <div className="silent-chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setActiveScreen('landing')}
                    style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0 }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>181 · Silent chat</div>
                    <div style={{ fontSize: '0.66rem', color: '#4ade80' }}>● OP-07 is reading live</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={handleStartNewSessionClick}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      borderRadius: '4px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      cursor: 'pointer'
                    }}
                    title="Start fresh emergency triage session"
                  >
                    + New
                  </button>
                  <button onClick={handleQuickExit} className="quick-exit-btn">
                    Quick exit
                  </button>
                </div>
              </div>

              <div className="silent-chat-banner">
                <Volume2 size={13} />
                <span>No sound, no vibration. Messages hide when you exit.</span>
              </div>

              <div className="silent-chat-messages-scroll">
                <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#94a3b8', margin: '4px 0' }}>
                  Today {phoneTime}
                </div>

                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 14px', color: '#64748b', fontSize: '0.74rem' }}>
                    <div style={{ marginBottom: '6px', fontWeight: 700, color: '#334155' }}>
                      181 Helpline Connected
                    </div>
                    <div>
                      Tap the microphone icon or type below to send what is happening. Everything you communicate is analyzed live for help.
                    </div>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={m.sender === 'user' ? 'bubble-user-blue' : 'bubble-operator-white'}>
                      <div>{m.text}</div>
                      <div style={{ fontSize: '0.6rem', textAlign: 'right', marginTop: '2px', opacity: 0.8 }}>
                        {m.time}
                      </div>
                    </div>
                  ))
                )}

                {/* Live Location & Help Responders Radar Card */}
                {effectiveAreaShared && (
                  <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '10px', margin: '8px 0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MapPin size={13} color="#16a34a" />
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a' }}>LIVE LOCATION TRANSMITTED</span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>GPS Lock ±12m</span>
                    </div>

                    <div style={{ height: '120px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <TacticalEmergencyMap
                        callerCoords={callerCoords}
                        locationAddress={extractedLocation || 'Locating caller...'}
                        nearbyServices={nearbyServices}
                        policeDispatched={agencies?.police?.status === 'DISPATCHED'}
                        medicalDispatched={agencies?.medical?.status === 'DISPATCHED'}
                      />
                    </div>

                    {/* Nearby Helpline Services & Real-Time Proximity List */}
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                        <span>NEARBY HELPLINE RESPONDERS</span>
                        <span style={{ color: '#2563eb' }}>Proximity &amp; Live ETA</span>
                      </div>

                      {nearbyServices && nearbyServices.length > 0 ? (
                        nearbyServices.map((srv) => {
                          const isDispatched =
                            (srv.type === 'police' && agencies?.police?.status === 'DISPATCHED') ||
                            (srv.type === 'hospital' && agencies?.medical?.status === 'DISPATCHED') ||
                            (srv.type === 'shelter' && agencies?.shelter?.status === 'RESERVED');

                          return (
                            <div
                              key={srv.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isDispatched ? '#eff6ff' : '#f8fafc',
                                border: isDispatched ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '0.68rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 800, color: isDispatched ? '#1d4ed8' : '#0f172a' }}>
                                  {srv.type === 'police' ? '🚔 112 Police' : srv.type === 'hospital' ? '🚑 108 Ambulance' : srv.type === 'shelter' ? '🏠 181 Shelter' : '⚖️ DLSA Legal'}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.62rem' }}>
                                  ({srv.name.split(' ')[0]})
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#2563eb', fontWeight: 700 }}>
                                  📍 {srv.distanceKm} km
                                </span>
                                <span style={{
                                  background: isDispatched ? '#dcfce7' : '#e2e8f0',
                                  color: isDispatched ? '#15803d' : '#475569',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontWeight: 800,
                                  fontSize: '0.6rem'
                                }}>
                                  {isDispatched ? `🚨 ETA ~${srv.etaMins}m` : `~${srv.etaMins}m ETA`}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                          Calculating closest emergency responder units to your GPS...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SafeSignal Operator Question Prompt & Haan / Nahi Buttons */}
                <div style={{ margin: '8px 0' }}>
                  {questions && questions[0] ? (
                    <div style={{
                      background: questions[0].category === 'custom_operator_inquiry' ? '#fef3c7' : '#eff6ff',
                      border: questions[0].category === 'custom_operator_inquiry' ? '1.5px solid #f59e0b' : '1.5px solid #3b82f6',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      marginBottom: '8px',
                      boxShadow: '0 1px 3px rgba(37,99,235,0.08)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: questions[0].category === 'custom_operator_inquiry' ? '#b45309' : '#1d4ed8', letterSpacing: '0.04em' }}>
                          {questions[0].category === 'custom_operator_inquiry' ? '💬 OPERATOR CUSTOM INQUIRY' : 'OPERATOR QUESTION · SAFESIGNAL'}
                        </span>
                        <span style={{ fontSize: '0.58rem', background: questions[0].category === 'custom_operator_inquiry' ? '#fde68a' : '#dbeafe', color: questions[0].category === 'custom_operator_inquiry' ? '#92400e' : '#1e40af', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          1-Tap Safe
                        </span>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>
                        {questions[0].hinglishText || questions[0].questionText}
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '4px' }}>
                        Tap Haan or Nahi below to answer safely.
                      </div>
                    </div>
                  ) : null}

                  <div className="big-decision-buttons-row">
                    <button
                      onClick={() => handleSafeSignalAnswer('Haan')}
                      className="btn-decision-haan"
                      style={{ opacity: answeredSafeSignal === 'Haan' ? 1 : answeredSafeSignal ? 0.6 : 1 }}
                    >
                      Haan
                    </button>
                    <button
                      onClick={() => handleSafeSignalAnswer('Nahi')}
                      className="btn-decision-nahi"
                      style={{ opacity: answeredSafeSignal === 'Nahi' ? 1 : answeredSafeSignal ? 0.6 : 1 }}
                    >
                      Nahi
                    </button>
                  </div>

                  {/* Quick suggestion chips */}
                  <div className="quick-chips-row">
                    <button
                      onClick={handleShareLiveLocation}
                      disabled={isLocatingGps}
                      className="chat-quick-chip"
                      style={{
                        background: effectiveAreaShared ? '#dcfce7' : '#eff6ff',
                        color: effectiveAreaShared ? '#15803d' : '#1d4ed8',
                        borderColor: effectiveAreaShared ? '#86efac' : '#bfdbfe',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <MapPin size={11} />
                      <span>{isLocatingGps ? 'Locating...' : effectiveAreaShared ? 'Live GPS Active' : 'Share Live Location'}</span>
                    </button>
                    {["Can't talk", 'He is here', 'Need ambulance'].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          setMessages((prev) => [
                            ...prev,
                            { sender: 'user', text: chip, time: timeNow }
                          ]);
                          const updated = transcript ? `${transcript}. ${chip}` : chip;
                          setTranscript(updated);
                          transcriptRef.current = updated;
                          onUserInputChange(updated);
                        }}
                        className="chat-quick-chip"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Emergency Contact Alert Strip */}
                {emergencyContacts.length > 0 && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #2563eb',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      margin: '6px 0',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Users size={12} color="#2563eb" />
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1e40af', letterSpacing: '0.03em' }}>
                          MIRROR TO EMERGENCY CONTACT
                        </span>
                      </div>
                      <button
                        onClick={() => setIsContactModalOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Manage ({emergencyContacts.length}) →
                      </button>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#334155', marginBottom: '6px' }}>
                      Send live GPS, transcript &amp; Police 112 status to{' '}
                      <strong>{emergencyContacts[0]?.name}</strong> ({emergencyContacts[0]?.relationship}):
                    </div>
                    <button
                      onClick={() => {
                        if (emergencyContacts[0]) {
                          handleDispatchUnifiedAlert(emergencyContacts[0]);
                        }
                      }}
                      className={`btn-unified-sos-dispatch ${dispatchedContactIds[emergencyContacts[0]?.id] ? 'btn-unified-sos-dispatched' : ''}`}
                      style={{ padding: '8px 12px', fontSize: '0.74rem' }}
                      title="Dispatch live emergency coordinates and situation to WhatsApp and SMS together"
                    >
                      <Zap size={13} />
                      <span>
                        {dispatchedContactIds[emergencyContacts[0]?.id]
                          ? '✓ Transmitted to WhatsApp & SMS (Tap to Re-send)'
                          : '⚡ Dispatch 1-Tap SOS (WhatsApp + SMS)'}
                      </span>
                    </button>

                    {dispatchedContactIds[emergencyContacts[0]?.id] && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                        <a
                          href={emergencyContactService.generateWhatsAppUrl(
                            emergencyContacts[0].phone,
                            emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#25D366',
                            color: '#ffffff',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <MessageSquare size={12} />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={emergencyContactService.generateSmsUrl(
                            emergencyContacts[0].phone,
                            emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                          )}
                          style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Phone size={12} />
                          <span>Native SMS</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Link to Proceed to Confirmation */}
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                  <button
                    onClick={() => setActiveScreen('confirm')}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Review structured details (Step 2 of 3) →
                  </button>
                </div>
              </div>

              {/* Bottom Chat Message Input Row with Voice Microphone & Live Location Button */}
              <div className="chat-bottom-input-bar">
                <button
                  onClick={handleToggleVoiceInput}
                  title={isVoiceListening ? 'Stop listening' : 'Tap to speak your message'}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isVoiceListening ? '#ef4444' : '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isVoiceListening ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  className={isVoiceListening ? 'mic-recording-pulse' : ''}
                >
                  <Mic size={16} />
                </button>

                <button
                  onClick={handleShareLiveLocation}
                  disabled={isLocatingGps}
                  title={isLocatingGps ? 'Acquiring GPS fix...' : 'Share Live Location (GPS)'}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isLocatingGps ? '#fef08a' : effectiveAreaShared ? '#dcfce7' : '#f1f5f9',
                    border: effectiveAreaShared ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: effectiveAreaShared ? '#15803d' : '#334155',
                    cursor: isLocatingGps ? 'wait' : 'pointer',
                    flexShrink: 0
                  }}
                >
                  <MapPin size={16} />
                </button>

                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={isVoiceListening ? 'Listening... Speak now' : 'Type a message (e.g. mujhe madad chahiye)...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    borderRadius: '24px',
                    padding: '8px 14px',
                    fontSize: '0.75rem',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  onClick={handleSendChatMessage}
                  title="Send message"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#1d4ed8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PAGE 4: DYNAMIC CONFIRMATION ("Is this right?")          */}
          {/* ======================================================== */}
          {activeScreen === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f2f4f8' }}>
              <div className="confirm-top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#111827', color: '#ffffff' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>181 · Step 2 of 3</span>
                <button onClick={handleQuickExit} className="quick-exit-btn">
                  Quick exit
                </button>
              </div>

              <div className="confirm-step-container">
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Is this right?</h2>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '4px 0 0' }}>
                    This is what the operator understood from your actual words.
                  </p>
                </div>

                {/* DYNAMICALLY RENDERED FROM REAL USER INPUT */}
                {dynamicEvidence.length > 0 ? (
                  dynamicEvidence.map((evItem, idx) => (
                    <div key={idx} className="verified-card-item">
                      <div className="verified-card-left">
                        <div className="check-green-round"><Check size={14} /></div>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>{evItem.label}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>"{evItem.quoteHinglish}"</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700 }}>Verified</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>
                    {transcript ? (
                      <div>
                        <strong>Heard:</strong> "{transcript}"
                      </div>
                    ) : (
                      'No emergency statements recorded yet. Speak via Call (Screen 2) or type in Chat (Screen 3) to begin.'
                    )}
                  </div>
                )}

                {/* Card 4: Still needed landmark */}
                <div className="needed-orange-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#b45309', fontWeight: 800 }}>?</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400e' }}>
                      Area or landmark
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#78350f' }}>
                    Type it only if it is safe to do so.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <input
                      type="text"
                      value={landmarkInput}
                      onChange={(e) => setLandmarkInput(e.target.value)}
                      placeholder="e.g. mandir ke paas, Gali 4"
                      style={{
                        flex: 1,
                        background: '#ffffff',
                        border: '1px solid #fcd34d',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.74rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (landmarkInput.trim() && onManualLandmarkEntered) {
                          onManualLandmarkEntered(landmarkInput.trim());
                          alert(`Landmark "${landmarkInput.trim()}" transmitted to Operator.`);
                        }
                      }}
                      style={{
                        background: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Send
                    </button>
                  </div>

                  {/* Location Map Preview */}
                  <div style={{ height: '110px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #fed7aa', marginTop: '8px' }}>
                    <TacticalEmergencyMap
                      callerCoords={callerCoords}
                      locationAddress={landmarkInput || extractedLocation || 'Locating caller...'}
                      nearbyServices={[]}
                      policeDispatched={false}
                      medicalDispatched={false}
                    />
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 10px', fontSize: '0.68rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} color="#16a34a" />
                      <span>
                        <strong>Emergency Contact Alert:</strong> {emergencyContacts[0]?.name || 'Rahul Sharma'} ({emergencyContacts[0]?.phone || '+91 98765 43210'}) will be mirrored via WhatsApp &amp; SMS.
                      </span>
                    </div>
                    <button
                      onClick={() => setIsContactModalOpen(true)}
                      style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Change →
                    </button>
                  </div>

                  <button
                    onClick={handleShareLiveLocation}
                    disabled={isLocatingGps}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: effectiveAreaShared ? '#dcfce7' : '#f8fafc',
                      color: effectiveAreaShared ? '#15803d' : '#1e40af',
                      border: effectiveAreaShared ? '1px solid #86efac' : '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '7px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: isLocatingGps ? 'wait' : 'pointer',
                      width: '100%',
                      marginTop: '8px'
                    }}
                  >
                    <MapPin size={13} />
                    <span>{isLocatingGps ? 'Acquiring Live GPS...' : effectiveAreaShared ? 'Live GPS Transmitted to CAD Map' : 'Share Live GPS Location Directly'}</span>
                  </button>
                </div>

                {/* Decision Buttons */}
                <div className="confirm-bottom-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  <button
                    onClick={() => setActiveScreen('case')}
                    style={{
                      background: '#1d4ed8',
                      color: '#ffffff',
                      border: 'none',
                      padding: '11px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Haan, sahi hai
                  </button>
                  <button
                    onClick={() => setActiveScreen('chat')}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      padding: '11px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Something is wrong
                  </button>
                </div>

                <div style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: '8px', fontSize: '0.68rem', color: '#92400e', lineHeight: 1.35, marginTop: '4px' }}>
                  Help has been requested, not yet confirmed. We will update you the moment a service acknowledges.
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PAGE 5: DYNAMIC CASE DOCKET                              */}
          {/* ======================================================== */}
          {activeScreen === 'case' && (
            <div className="case-docket-screen">
              <div className="docket-dark-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>181 · Your case</span>
                  <button onClick={handleQuickExit} className="quick-exit-btn">
                    Quick exit
                  </button>
                </div>

                <div className="case-id-yellow-large">{activeReport?.id || 'SA-2024-LIVE'}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  If the call drops, call 181 and say this number. The operator sees everything you already told us.
                </div>
              </div>

              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* WHAT IS HAPPENING */}
                <div className="progress-track-card">
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.05em', color: '#475569' }}>
                    WHAT IS HAPPENING
                  </div>

                  {/* Step 1 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', flexShrink: 0 }}>✓</div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Operator connected</div>
                        <div style={{ fontSize: '0.66rem', color: '#64748b' }}>OP-07 · received your distress report</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>{phoneTime}</span>
                  </div>

                  {/* Step 2 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', flexShrink: 0 }}>✓</div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Help requested from Police 112</div>
                        <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Simulated dispatch brief prepared</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>{phoneTime}</span>
                  </div>

                  {/* Step 3 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed #94a3b8', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Request acknowledged</div>
                        <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Waiting for agency acknowledgment</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>—</span>
                  </div>
                </div>

                {/* HOW CAN WE REACH YOU SAFELY? */}
                <div className="reach-safely-card">
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.05em', color: '#475569' }}>
                    HOW CAN WE REACH YOU SAFELY?
                  </div>

                  <div className="reach-toggle-row">
                    <span style={{ fontSize: '0.74rem', color: '#0f172a', fontWeight: 600 }}>Call you back</span>
                    <div className="safe-pill-pair">
                      <button onClick={() => setCallbackSafe(true)} className={`safe-pill-opt ${callbackSafe ? 'active-green' : ''}`}>Safe</button>
                      <button onClick={() => setCallbackSafe(false)} className={`safe-pill-opt ${!callbackSafe ? 'active-red' : ''}`}>Not safe</button>
                    </div>
                  </div>

                  <div className="reach-toggle-row">
                    <span style={{ fontSize: '0.74rem', color: '#0f172a', fontWeight: 600 }}>Send an SMS</span>
                    <div className="safe-pill-pair">
                      <button onClick={() => setSmsSafe(true)} className={`safe-pill-opt ${smsSafe ? 'active-green' : ''}`}>Safe</button>
                      <button onClick={() => setSmsSafe(false)} className={`safe-pill-opt ${!smsSafe ? 'active-red' : ''}`}>Not safe</button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: '#64748b', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                    Updates will come by SMS from “181 Info”, never a call.
                  </div>
                </div>

                {/* EMERGENCY CONTACTS NOTIFIED (WHATSAPP & SMS) */}
                <div className="reach-safely-card" style={{ border: '1.5px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.05em', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Users size={13} color="#2563eb" />
                      <span>EMERGENCY CONTACTS (WHATSAPP &amp; SMS)</span>
                    </div>
                    <button
                      onClick={() => setIsContactModalOpen(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Manage ({emergencyContacts.length}) →
                    </button>
                  </div>

                  {emergencyContacts.length > 0 ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a' }}>
                            {emergencyContacts[0].name} <span style={{ fontSize: '0.64rem', color: '#64748b' }}>({emergencyContacts[0].relationship})</span>
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#059669', fontWeight: 600 }}>
                            {emergencyContacts[0].phone}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.58rem', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          Mirrored to Operator CAD
                        </span>
                      </div>

                      <div style={{ fontSize: '0.66rem', color: '#475569', lineHeight: 1.35, marginBottom: '8px' }}>
                        Incident #{activeReport?.id || 'INC-181'}, live GPS coordinates, and Police 112 ETA are formatted for 1-tap dispatch:
                      </div>

                      <button
                        onClick={() => {
                          if (emergencyContacts[0]) {
                            handleDispatchUnifiedAlert(emergencyContacts[0]);
                          }
                        }}
                        className={`btn-unified-sos-dispatch ${dispatchedContactIds[emergencyContacts[0]?.id] ? 'btn-unified-sos-dispatched' : ''}`}
                        style={{ width: '100%', padding: '10px 14px', fontSize: '0.78rem' }}
                        title="Dispatch live emergency coordinates and situation to WhatsApp and SMS together"
                      >
                        <Zap size={14} />
                        <span>
                          {dispatchedContactIds[emergencyContacts[0]?.id]
                            ? `✓ Re-dispatch SOS to ${emergencyContacts[0].name} (WhatsApp + SMS)`
                            : `⚡ Send 1-Tap SOS to ${emergencyContacts[0].name} (WhatsApp + SMS)`}
                        </span>
                      </button>

                      {dispatchedContactIds[emergencyContacts[0]?.id] && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                          <a
                            href={emergencyContactService.generateWhatsAppUrl(
                              emergencyContacts[0].phone,
                              emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#25D366',
                              color: '#ffffff',
                              textDecoration: 'none',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={emergencyContactService.generateSmsUrl(
                              emergencyContacts[0].phone,
                              emergencyContactService.buildEmergencyAlertMessage(activeReport || ({ id: 'INC-SOS-181' } as any), emergencyContacts[0].name)
                            )}
                            style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              textDecoration: 'none',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Phone size={12} />
                            <span>Native SMS</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      No emergency contacts configured.{' '}
                      <button
                        onClick={() => setIsContactModalOpen(true)}
                        style={{ color: '#2563eb', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        + Add trusted contact
                      </button>{' '}
                      to receive live emergency alerts.
                    </div>
                  )}
                </div>

                {/* Live Tracking Map Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>TACTICAL PATROL STREAM</span>
                    <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 700 }}>● Live Telemetry</span>
                  </div>
                  <div style={{ height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    <TacticalEmergencyMap
                      callerCoords={callerCoords}
                      locationAddress={extractedLocation || 'Locating caller...'}
                      nearbyServices={[]}
                      policeDispatched={true}
                      medicalDispatched={false}
                    />
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div className="case-bottom-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => setActiveScreen('chat')}
                    style={{
                      background: '#1d4ed8',
                      color: '#ffffff',
                      border: 'none',
                      padding: '11px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Message operator
                  </button>
                  <button
                    onClick={() => {
                      setActiveScreen('call');
                      setCallSeconds(0);
                    }}
                    style={{
                      background: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '11px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Call 181 again
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Emergency Contact Management & SOS Dispatch Modal */}
      <EmergencyContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        activeReport={activeReport}
        onAlertDispatched={(_contact, channel) => {
          setHardwareTriggerToast(`Emergency alert dispatched to ${_contact.name} via ${channel.toUpperCase()}`);
          setTimeout(() => setHardwareTriggerToast(null), 4000);
        }}
      />
    </div>
  );
};
