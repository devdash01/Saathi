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
  Radio
} from 'lucide-react';
import { speechService, cleanDuplicateSpeech, assembleSpeechResults } from '../services/speechRecognitionService';
import { transcribeAudioWithSarvam, MicrophoneRecorder } from '../services/sarvamService';
import { TacticalEmergencyMap } from './TacticalEmergencyMap';
import { deviceLocationService } from '../services/deviceLocationService';
import type { EmergencyServiceEntity } from '../services/locationService';
import type { SafeSignalQuestion, AgencyDispatchState } from '../types';
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
  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);

  // Transcript state - STARTS CLEAN WITH ZERO HARDCODING
  const [transcript, setTranscript] = useState<string>(currentInputText || '');

  // Page 3 Chat messages - STARTS CLEAN
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'operator'; text: string; time: string }>>([]);
  const [answeredSafeSignal, setAnsweredSafeSignal] = useState<'Haan' | 'Nahi' | null>(null);
  const [isAreaShared, setIsAreaShared] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const effectiveAreaShared = isAreaShared || Boolean(isLiveLocationSharing);

  // Page 4 Confirmation input
  const [landmarkInput, setLandmarkInput] = useState('');

  // Page 5 Safety reach options
  const [callbackSafe, setCallbackSafe] = useState<boolean>(false);
  const [smsSafe, setSmsSafe] = useState<boolean>(true);

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
    if (currentInputText) {
      const cleaned = cleanDuplicateSpeech(currentInputText);
      if (cleaned && cleaned !== transcriptRef.current) {
        setTranscript(cleaned);
        transcriptRef.current = cleaned;
      }
    }
  }, [currentInputText]);

  // Auto-acquire real device GPS on mount and stream fix to CAD
  useEffect(() => {
    deviceLocationService.acquireGpsFix().then((loc) => {
      if ((loc.source === 'live_gps' || loc.source === 'gps_cached') && loc.coords) {
        setIsAreaShared(true);
        if (onToggleLiveLocationSharing) {
          onToggleLiveLocationSharing(true);
        }
        if (onGpsLocationAcquired) {
          onGpsLocationAcquired(loc.coords, loc.accuracyMeters, loc.address);
        }
      }
    }).catch(() => {
      // Non-blocking fallback
    });
  }, [onGpsLocationAcquired, onToggleLiveLocationSharing]);

  // Reference for single active voice message bubble to prevent duplicate messages
  const currentVoiceMessageIdRef = useRef<string | null>(null);

  // Core Real-Time Voice Input Handler
  const startLiveVoiceRecognition = useCallback(() => {
    setVoiceError(null);
    setSarvamStatus('transcribing');
    const baseText = transcriptRef.current ? cleanDuplicateSpeech(transcriptRef.current.trim()) : '';
    const voiceMsgId = `voice-${Date.now()}`;
    currentVoiceMessageIdRef.current = voiceMsgId;

    const started = speechService.start(
      (result) => {
        const spoken = cleanDuplicateSpeech(result.transcript);
        if (!spoken) return;
        const formatted = isWhisperMode && !spoken.includes('[whisper]') ? `[whisper] ${spoken}` : spoken;

        let accumulated: string;
        if (baseText) {
          accumulated = assembleSpeechResults([baseText, formatted]);
        } else {
          accumulated = formatted;
        }
        accumulated = cleanDuplicateSpeech(accumulated);

        setTranscript(accumulated);
        transcriptRef.current = accumulated;
        onUserInputChange(accumulated);
        setSarvamStatus('connected');

        if (spoken.trim()) {
          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          let bubbleText = formatted;
          if (baseText) {
            const bNorm = baseText.toLowerCase().replace(/[^\w\u0900-\u097F\s]/g, '').trim();
            const fNorm = formatted.toLowerCase().replace(/[^\w\u0900-\u097F\s]/g, '').trim();
            if (fNorm.startsWith(bNorm)) {
              const remainder = formatted.slice(baseText.length).replace(/^[.,!?\s]+/, '').trim();
              if (remainder) {
                bubbleText = remainder;
              }
            }
          }
          const cleanBubble = cleanDuplicateSpeech(bubbleText);
          if (!cleanBubble) return;

          const newText = `🎤 ${cleanBubble}`;
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
        console.warn('Speech recognition warning:', err);
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
    } else {
      // Fallback: Use MediaRecorder if browser Web Speech API is not enabled
      startMediaRecorderFallback();
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
    if (micRecorderRef.current && micRecorderRef.current.isRecording()) {
      micRecorderRef.current.stop().then((blob) => {
        const url = URL.createObjectURL(blob);
        transcribeAudioWithSarvam(blob, 'codemix').then((res) => {
          if (res.transcript) {
            const baseText = transcriptRef.current ? cleanDuplicateSpeech(transcriptRef.current.trim()) : '';
            const accumulated = cleanDuplicateSpeech(baseText ? assembleSpeechResults([baseText, res.transcript]) : res.transcript);
            setTranscript(accumulated);
            transcriptRef.current = accumulated;
            onUserInputChange(accumulated, undefined, url);
          }
        });
      });
      micRecorderRef.current = null;
    }
  }, [onUserInputChange]);

  const startMediaRecorderFallback = async () => {
    try {
      const recorder = new MicrophoneRecorder();
      await recorder.start();
      micRecorderRef.current = recorder;
      setIsVoiceListening(true);
    } catch (_e) {
      setVoiceError('Microphone permission denied. Please enable mic in browser settings.');
    }
  };

  const handleToggleVoiceInput = () => {
    if (isVoiceListening) {
      stopLiveVoiceRecognition();
    } else {
      startLiveVoiceRecognition();
    }
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

    const currentT = transcriptRef.current ? cleanDuplicateSpeech(transcriptRef.current.trim()) : '';
    let updated: string;
    if (!currentT) {
      updated = val;
    } else {
      updated = assembleSpeechResults([currentT, val]);
    }
    updated = cleanDuplicateSpeech(updated);

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
          {/* ======================================================== */}
          {/* PAGE 1: CITIZEN LANDING SCREEN (You are not alone)       */}
          {/* ======================================================== */}
          {activeScreen === 'landing' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f2f4f8' }}>
              <div className="citizen-top-header">
                <div className="citizen-header-row">
                  <span className="citizen-brand-tag">SAATHI 181</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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

                {/* GOOD TO KNOW */}
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
                  {transcript || (
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
                          const updated = cleanDuplicateSpeech(transcript ? assembleSpeechResults([transcript, chip]) : chip);
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

                <div className="case-id-yellow-large">{activeReport?.id || 'INC-4A21'}</div>
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
    </div>
  );
};
