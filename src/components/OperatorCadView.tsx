import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  MapPin,
  Maximize2,
  Minimize2,
  PhoneOff,
  PhoneCall,
  Volume2,
  Mic,
  Clock,
  Globe,
  Activity,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { TacticalEmergencyMap } from './TacticalEmergencyMap';
import type {
  StructuredTriage,
  SafetyFloor,
  AgencyDispatchState,
  SafeSignalQuestion,
  UrgencyLevel,
  EvidenceItem
} from '../types';
import type { EmergencyServiceEntity } from '../services/locationService';
import type { EmergencyReport, OperatorSession } from '../types/report';

export type OperatorCadTab = 'console' | 'incidents' | 'stresslab' | 'wallboard';

interface OperatorCadProps {
  inputText: string;
  translatedText: string;
  extractedLocation: string;
  isExtractedFromSpeech: boolean;
  callerCoords: [number, number];
  nearbyServices: EmergencyServiceEntity[];
  audioUrl?: string;
  triage: StructuredTriage;
  safetyFloor: SafetyFloor;
  agencies: AgencyDispatchState;
  questions: SafeSignalQuestion[];
  onDispatchAgency: (key: keyof AgencyDispatchState) => void;
  onApproveQuestion: (id: string) => void;
  onSendToCaller: (id: string) => void;
  onApplySimulation: (simTriage: StructuredTriage, simAgencies: AgencyDispatchState) => void;
  sarvamStatus: 'connected' | 'transcribing' | 'idle' | 'error';
  sarvamLatency?: number;
  isLiveLocationSharing?: boolean;
  activeReport?: EmergencyReport;
  allReports?: EmergencyReport[];
  onSelectReport?: (repId: string) => void;
  onAcknowledgeReport?: () => void;
  onOverridePriority?: (newLevel: UrgencyLevel, reason: string) => void;
  onCallerAnswer?: (questionId: string, answer: string) => void;
  onSendCustomQuestion?: (hinglish: string, english?: string) => void;
  onAppendInput?: (newStatement: string) => void;
  operatorSession: OperatorSession;
  aiConfidence?: { score: number; isUncertain: boolean; rationale: string };
}

export const OperatorCadView: React.FC<OperatorCadProps> = ({
  inputText,
  translatedText: _translatedText,
  extractedLocation,
  callerCoords,
  nearbyServices,
  audioUrl: _audioUrl,
  triage,
  safetyFloor: _safetyFloor,
  agencies,
  questions,
  onDispatchAgency,
  onSendToCaller: _onSendToCaller,
  onSendCustomQuestion,
  activeReport,
  onAcknowledgeReport: _onAcknowledgeReport,
  onOverridePriority: _onOverridePriority,
  onCallerAnswer,
  onAppendInput,
  operatorSession: _operatorSession,
  aiConfidence: _aiConfidence
}) => {
  // 4 Top Navigation Tabs matching Pages 6 - 9
  const [activeTab, setActiveTab] = useState<OperatorCadTab>('console');

  // Queue filter on Console
  const [queueFilter, setQueueFilter] = useState<'all' | 'p1p2' | 'coded'>('all');

  // Selected Call in Queue
  const [selectedCallId, setSelectedCallId] = useState<string>('INC-4A21');

  // Manual note input in Live Transcript
  const [manualNote, setManualNote] = useState('');
  const [notesList, setNotesList] = useState<string[]>([]);

  const handleAddManualNote = () => {
    if (!manualNote.trim()) return;
    const note = manualNote.trim();
    setNotesList((prev) => [...prev, note]);
    setManualNote('');
    if (onAppendInput) {
      onAppendInput(note);
    }
  };

  // SafeSignal selection in Console
  const [selectedAnswer, setSelectedAnswer] = useState<'Haan' | 'Nahi' | 'NoAnswer' | null>(null);

  // Location input on right column
  const [locationInput, setLocationInput] = useState(extractedLocation || '');
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(Boolean(extractedLocation));
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Custom question state for operator
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [isCustomQuestionSent, setIsCustomQuestionSent] = useState(false);

  // Live Call Duration Timer & State (96s = 01:36 initially)
  const [callDuration, setCallDuration] = useState(96);
  const [isCallEnded, setIsCallEnded] = useState(false);

  // Restart duration when a new chat / report session is initiated by the user
  const prevReportIdRef = useRef<string | undefined>(activeReport?.id);
  useEffect(() => {
    if (activeReport?.id && prevReportIdRef.current && activeReport.id !== prevReportIdRef.current) {
      setCallDuration(0);
      setIsCallEnded(false);
    }
    prevReportIdRef.current = activeReport?.id;
  }, [activeReport?.id]);

  // Restart duration if caller input text is reset to empty (new chat initiated)
  const prevCallerTextRef = useRef<string>(inputText || '');
  useEffect(() => {
    if (prevCallerTextRef.current && (!inputText || inputText.trim() === '')) {
      setCallDuration(0);
      setIsCallEnded(false);
    }
    prevCallerTextRef.current = inputText || '';
  }, [inputText]);

  useEffect(() => {
    if (isCallEnded) return;
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCallEnded]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Sync extracted location dynamically
  useEffect(() => {
    if (extractedLocation) {
      setLocationInput(extractedLocation);
      setIsLocationConfirmed(true);
    }
  }, [extractedLocation]);

  // Stress Lab twist checkboxes (Page 9)
  const [stressTwists, setStressTwists] = useState({
    weapon: true,
    conflicting: true,
    silent: false,
    injuryLate: false,
    locationChanges: false
  });
  const [_stressSimRunCount, setStressSimRunCount] = useState(1);

  // Incidents Tab selected incident (Page 8)
  const [selectedIncidentId, setSelectedIncidentId] = useState('INC-4A1C');
  const [incidentFilter, setIncidentFilter] = useState<'open' | 'closed' | 'linked'>('open');

  // Handle SafeSignal button click on Console
  const handleSafeSignalSelect = (ans: 'Haan' | 'Nahi' | 'NoAnswer') => {
    setSelectedAnswer(ans);
    if (ans === 'Haan') {
      onDispatchAgency('police');
    }
    if (questions && questions[0] && onCallerAnswer) {
      onCallerAnswer(questions[0].id, ans === 'Haan' ? 'YES' : ans === 'Nahi' ? 'NO' : 'SILENCE');
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#eaedf2', color: '#0f172a' }}>
      {/* ======================================================== */}
      {/* TOP CAD NAVIGATION BAR (PAGES 6 - 9)                      */}
      {/* ======================================================== */}
      <header className="cad-top-header-181">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 800, letterSpacing: '0.02em', color: '#ffffff' }}>
            SAATHI <span style={{ color: '#94a3b8', fontWeight: 400 }}>181 Women Helpline · Delhi CRC</span>
          </span>

          <nav className="cad-nav-tabs-181">
            <button
              onClick={() => setActiveTab('console')}
              className={`cad-tab-link-181 ${activeTab === 'console' ? 'active' : ''}`}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`cad-tab-link-181 ${activeTab === 'incidents' ? 'active' : ''}`}
            >
              Incidents
            </button>
            <button
              onClick={() => setActiveTab('stresslab')}
              className={`cad-tab-link-181 ${activeTab === 'stresslab' ? 'active' : ''}`}
            >
              Stress Lab
            </button>
            <button
              onClick={() => setActiveTab('wallboard')}
              className={`cad-tab-link-181 ${activeTab === 'wallboard' ? 'active' : ''}`}
            >
              Wallboard
            </button>
          </nav>
        </div>

        {/* Top Status & Metrics Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem' }}>
          <span style={{ color: '#cbd5e1' }}>Waiting <strong style={{ color: '#ffffff' }}>5</strong></span>
          <span style={{ color: '#cbd5e1' }}>Longest <strong style={{ color: '#ef4444' }}>08:26</strong></span>
          <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span>OP-07 · On call</span>
          </span>
          <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>09:43:06</span>
        </div>
      </header>

      {/* ======================================================== */}
      {/* TAB 1: CONSOLE VIEW (PAGE 6)                             */}
      {/* ======================================================== */}
      {activeTab === 'console' && (
        <div className="cad-console-page-layout">
          {/* COLUMN 1: CALL QUEUE (7 open) */}
          <aside className="cad-queue-column">
            <div style={{ padding: '8px 10px 4px', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
              <span>CALL QUEUE</span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>7 open</span>
            </div>

            <div className="queue-filter-row">
              <button
                onClick={() => setQueueFilter('all')}
                style={{
                  background: queueFilter === 'all' ? '#1e293b' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: queueFilter === 'all' ? '#ffffff' : '#475569',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                onClick={() => setQueueFilter('p1p2')}
                style={{
                  background: queueFilter === 'p1p2' ? '#1e293b' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: queueFilter === 'p1p2' ? '#ffffff' : '#475569',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                P1–P2
              </button>
              <button
                onClick={() => setQueueFilter('coded')}
                style={{
                  background: queueFilter === 'coded' ? '#1e293b' : '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: queueFilter === 'coded' ? '#ffffff' : '#475569',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Coded calls
              </button>
            </div>

            <div className="queue-items-scroll">
              {/* Call 1: INC-4A22 */}
              <div className="queue-card-181" onClick={() => setSelectedCallId('INC-4A22')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', fontWeight: 800 }}>-- INC-4A22</span>
                  <span style={{ color: '#ef4444', fontSize: '0.66rem', fontWeight: 700 }}>00:07</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#475569' }}>Ringing · no speech yet</div>
                <button
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    marginTop: '2px',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Accept call A
                </button>
              </div>

              {/* Call 2: P1 INC-4A1C */}
              <div
                className={`queue-card-181 ${selectedCallId === 'INC-4A1C' ? 'active' : ''}`}
                onClick={() => setSelectedCallId('INC-4A1C')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#b91c1c', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>P1 INC-4A1C</span>
                  <span style={{ color: '#64748b', fontSize: '0.65rem' }}>01:15</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>Madam mere pati ne chaku nikal liya hai…</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>OP-03 · Physical violence · Shiv Colony</div>
              </div>

              {/* Call 3: Live Active Call */}
              <div
                className={`queue-card-181 ${selectedCallId === 'INC-4A21' ? 'active' : ''}`}
                onClick={() => setSelectedCallId('INC-4A21')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      background:
                        triage.urgencyLevel === 'CRITICAL'
                          ? '#b91c1c'
                          : triage.urgencyLevel === 'SEVERE'
                          ? '#ea580c'
                          : triage.urgencyLevel === 'MODERATE'
                          ? '#d97706'
                          : '#16a34a',
                      color: 'white',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '3px'
                    }}
                  >
                    {triage.urgencyLevel === 'CRITICAL'
                      ? 'P1'
                      : triage.urgencyLevel === 'SEVERE'
                      ? 'P2'
                      : triage.urgencyLevel === 'MODERATE'
                      ? 'P3'
                      : 'P4'}{' '}
                    INC-4A21
                  </span>
                  <span style={{ color: '#16a34a', fontSize: '0.65rem', fontWeight: 700 }}>00:42</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px', fontWeight: 600 }}>
                  {inputText ? (inputText.slice(0, 42) + (inputText.length > 42 ? '…' : '')) : 'Standby · Waiting for caller speech'}
                </div>
                <div style={{ fontSize: '0.6rem', color: !triage.callerConstraints.canSpeakFreely ? '#dc2626' : '#1d4ed8', fontWeight: 700 }}>
                  {!triage.callerConstraints.canSpeakFreely ? 'Coded call flagged · Live' : 'Live Connected · Operator OP-07'}
                </div>
              </div>

              {/* Call 4: P2 INC-4A1D */}
              <div className="queue-card-181" onClick={() => setSelectedCallId('INC-4A1D')}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#ea580c', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>P2 INC-4A1D</span>
                  <span style={{ color: '#64748b', fontSize: '0.65rem' }}>00:42</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>bhaiya ek pizza bhej do, address wahi hai…</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Waiting · Coded call: food order</div>
              </div>

              {/* Call 5: P3 INC-4A20 */}
              <div className="queue-card-181" onClick={() => setSelectedCallId('INC-4A20')}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#d97706', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>P3 INC-4A20</span>
                  <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>08:26</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>Hello? Hello… [call cut]</div>
                <div style={{ fontSize: '0.6rem', color: '#ef4444' }}>Dropped · safety unconfirmed · call back?</div>
              </div>

              {/* Call 6: P3 INC-4A1E */}
              <div className="queue-card-181" onClick={() => setSelectedCallId('INC-4A1E')}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#d97706', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>P3 INC-4A1E</span>
                  <span style={{ color: '#64748b', fontSize: '0.65rem' }}>03:33</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>Mere ghar ke bahar ek ladka roz khada…</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Waiting · Stalking</div>
              </div>

              {/* Call 7: P4 INC-4A1F */}
              <div className="queue-card-181" onClick={() => setSelectedCallId('INC-4A1F')}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#16a34a', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>P4 INC-4A1F</span>
                  <span style={{ color: '#64748b', fontSize: '0.65rem' }}>06:29</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>Mujhe talaq ke baad custody ke liye vakil…</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>Waiting · Legal help</div>
              </div>
            </div>

            {/* Bottom Priority Badges Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '6px 8px', borderTop: '1px solid #cbd5e1', gap: '4px', textAlign: 'center', background: '#f8fafc' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>1</div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>P1</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ea580c' }}>2</div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>P2</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706' }}>2</div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>P3</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a' }}>1</div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>P4</div>
              </div>
            </div>
          </aside>

          {/* COLUMN 2: ACTIVE CALL INC-4A21 */}
          <main className="cad-active-call-column">
            {/* Redesigned High-Readiness Active Call Command Bar */}
            <div className="active-call-meta-bar-v2">
              {/* Row 1: Tactical Call Status & Priority Strip */}
              <div className="active-call-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="live-call-beacon">
                    <span className="beacon-ping"></span>
                    <span className="beacon-dot"></span>
                  </span>
                  <span className="live-call-status-tag">
                    {isCallEnded ? 'CALL DISCONNECTED · RECORDING FILED' : 'LIVE INTERCEPT · ACTIVE CALL'}
                  </span>
                  <span className="incident-id-badge">
                    {activeReport?.id ? (activeReport.id.startsWith('SA-') ? `INC-${activeReport.id.slice(-4)}` : activeReport.id) : 'INC-4A21'}
                  </span>
                  {triage.urgencyLevel === 'CRITICAL' && (
                    <span className="badge-p1-pulse">
                      <ShieldAlert size={12} />
                      <span>🚨 P1 CRITICAL · DISPATCH REQUIRED</span>
                    </span>
                  )}
                  {triage.urgencyLevel === 'SEVERE' && (
                    <span className="badge-p2-urgent">⚠️ P2 URGENT · PRIORITY FLOOR LOCKED</span>
                  )}
                  {triage.urgencyLevel === 'MODERATE' && (
                    <span className="badge-p3-standard">⚡ P3 STANDARD HELPLINE</span>
                  )}
                  {triage.urgencyLevel === 'LOW' && (
                    <span className="badge-p4-deferred">🟢 P4 GENERAL INTAKE</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Acoustic Sensors */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`acoustic-badge ${triage.callerConstraints?.canSpeakFreely === false ? 'whisper-active' : ''}`} title="Acoustic sensor: Caller voice energy below standard threshold">
                      <Volume2 size={12} />
                      <span>Whispering</span>
                    </span>
                    <span className="acoustic-badge ambient-badge" title="Acoustic sensor: Secondary voice detected in background">
                      <Mic size={12} />
                      <span>Background voice heard</span>
                    </span>
                  </div>

                  {/* End Call / Resume Controls */}
                  {!isCallEnded ? (
                    <button
                      onClick={() => setIsCallEnded(true)}
                      className="btn-end-call"
                      title="Terminate live audio stream and transition to multi-agency safe handoff"
                    >
                      <PhoneOff size={13} />
                      <span>End call</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsCallEnded(false);
                        setCallDuration(0);
                      }}
                      className="btn-resume-call"
                      title="Initiate new inbound citizen triage session"
                    >
                      <PhoneCall size={13} />
                      <span>New call</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Real-time Telemetry Grid */}
              <div className="active-call-telemetry-grid">
                {/* Caller Info */}
                <div className="telemetry-cell">
                  <div className="telemetry-label">CALLER IDENTIFICATION</div>
                  <div className="telemetry-value-caller">
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 800 }}>98XXX-X2666</span>
                    <span className="carrier-tag">Airtel 4G · VoLTE</span>
                  </div>
                </div>

                {/* Duration with live ticking counter */}
                <div className="telemetry-cell">
                  <div className="telemetry-label">LIVE DURATION</div>
                  <div className="telemetry-value-duration">
                    <Clock size={13} style={{ color: '#0284c7' }} />
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 800, fontSize: '0.88rem' }}>
                      {formatDuration(callDuration)}
                    </span>
                    {!isCallEnded && <span className="rec-blinker">● REC</span>}
                  </div>
                </div>

                {/* Language */}
                <div className="telemetry-cell">
                  <div className="telemetry-label">LANGUAGE &amp; DIALECT</div>
                  <div className="telemetry-value">
                    <Globe size={13} style={{ color: '#6366f1' }} />
                    <span style={{ fontWeight: 700 }}>Hinglish</span>
                    <span className="lang-tag">hi-IN/en</span>
                  </div>
                </div>

                {/* Speech-to-Text */}
                <div className="telemetry-cell">
                  <div className="telemetry-label">SPEECH-TO-TEXT ASR</div>
                  <div className="telemetry-value-stt">
                    <Activity size={13} style={{ color: '#10b981' }} />
                    <span style={{ fontWeight: 800, color: '#047857' }}>Live · hi-IN</span>
                    <div className="audio-live-eq" title="Sarvam ASR streaming audio packets">
                      <span className="eq-bar bar-1"></span>
                      <span className="eq-bar bar-2"></span>
                      <span className="eq-bar bar-3"></span>
                      <span className="eq-bar bar-4"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Concluded Summary Notice if ended */}
            {isCallEnded && (
              <div className="call-ended-alert-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <div>
                    <strong style={{ color: '#065f46', fontSize: '0.74rem' }}>CALL DISPATCH CONCLUDED ({formatDuration(callDuration)})</strong>
                    <div style={{ fontSize: '0.66rem', color: '#047857' }}>
                      All danger flags, quote evidence, and safe signal responses are preserved in incident docket.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => {
                      alert('Safe Handoff brief generated and dispatched to 112 PCR.');
                    }}
                    className="btn-brief-download"
                  >
                    View Safe Handoff Brief
                  </button>
                </div>
              </div>
            )}

            {/* LIVE TRANSCRIPT */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>LIVE TRANSCRIPT</span>
                <span style={{ fontSize: '0.64rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>··|·||·|·||·|··</span>
                  <span>Caller speaking · transcribing</span>
                </span>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.76rem', lineHeight: 1.45, color: '#1e293b', minHeight: '80px' }}>
                {inputText ? (
                  <div>
                    <span style={{ color: '#16a34a', fontSize: '0.68rem', marginRight: '6px', fontWeight: 800 }}>Caller · live:</span>
                    <span>
                      {(() => {
                        const keywords = (triage.evidenceLinks || [])
                          .map((e: EvidenceItem) => e.quoteHinglish.toLowerCase().trim())
                          .filter((w: string) => w && w.length > 2);
                        if (!keywords.length) return inputText;
                        const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
                        const regex = new RegExp(`(${sortedKeywords.map((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
                        const parts = inputText.split(regex);
                        const evidenceMap = new Map((triage.evidenceLinks || []).map((e: EvidenceItem) => [e.quoteHinglish.toLowerCase().trim(), e]));

                        return parts.map((part, i) => {
                          const matchedEv = evidenceMap.get(part.toLowerCase());
                          if (matchedEv) {
                            if (matchedEv.category === 'location') {
                              return (
                                <mark key={i} className="transcript-location-highlight" title={`Location extracted: ${matchedEv.label}`}>
                                  📍 {part}
                                </mark>
                              );
                            }
                            return (
                              <mark key={i} className="transcript-word-highlight" title={matchedEv.label}>
                                {part}
                              </mark>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        });
                      })()}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic', padding: '14px 6px', textAlign: 'center' }}>
                    Standby · Waiting for caller speech. Citizen can speak into the microphone on the smartphone to the left, or send a chat message.
                  </div>
                )}

                {notesList.map((note, idx) => (
                  <div key={idx} style={{ color: '#0284c7' }}>
                    <span style={{ color: '#64748b', fontSize: '0.68rem', marginRight: '6px' }}>Note</span>
                    <span style={{ fontWeight: 700, marginRight: '6px' }}>Operator note ·</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Type what she said if the transcript missed or misheard it"
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: '#0f172a',
                    fontSize: '0.72rem',
                    outline: 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddManualNote();
                  }}
                />
                <button
                  onClick={handleAddManualNote}
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Add /
                </button>
              </div>
            </div>

            {/* PRIORITY TRAIL */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
                  PRIORITY TRAIL · HOW THIS CALL WAS RATED, WORD BY WORD
                </span>
                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>every step is in the activity log</span>
              </div>

              <div className="priority-trail-row">
                <span className="trail-chip">-- 00:00 connected</span>
                {triage.evidenceLinks && triage.evidenceLinks.length > 0 ? (
                  triage.evidenceLinks.map((ev: EvidenceItem, idx: number) => (
                    <React.Fragment key={idx}>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span
                        className="trail-chip"
                        style={{
                          background: ev.severity === 'critical'
                            ? '#fee2e2'
                            : ev.severity === 'high'
                            ? '#ffedd5'
                            : '#fef3c7',
                          color: ev.severity === 'critical'
                            ? '#991b1b'
                            : ev.severity === 'high'
                            ? '#c2410c'
                            : '#b45309',
                          borderColor: ev.severity === 'critical'
                            ? '#fca5a5'
                            : ev.severity === 'high'
                            ? '#fed7aa'
                            : '#fde68a'
                        }}
                      >
                        <strong>{ev.severity === 'critical' ? 'P1' : ev.severity === 'high' ? 'P2' : 'P3'}</strong> {ev.quoteHinglish}
                      </span>
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span className="trail-chip" style={{ borderStyle: 'dashed', borderColor: '#94a3b8', color: '#64748b' }}>
                      Awaiting caller speech...
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ASK THE CALLER NEXT · SAFESIGNAL */}
            <div className="safesignal-box-181">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1e40af', letterSpacing: '0.04em' }}>
                  ASK THE CALLER NEXT · SAFESIGNAL
                </span>
                <span style={{ fontSize: '0.64rem', color: '#2563eb' }}>
                  {questions && questions[0] ? `Checks: ${questions[0].category.replace(/_/g, ' ')}` : 'Next fact verification'}
                </span>
              </div>

              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                {questions && questions[0]
                  ? (questions[0].hinglishText || questions[0].questionText)
                  : inputText
                  ? 'No more safety questions needed currently. Keep listening.'
                  : 'Awaiting caller statement to suggest next safe yes/no question.'}
              </div>

              {/* Decision Buttons */}
              <div className="decision-3-grid">
                <button
                  onClick={() => handleSafeSignalSelect('Haan')}
                  className="btn-operator-decision"
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    boxShadow: selectedAnswer === 'Haan' ? '0 0 0 2px #ef4444' : 'none'
                  }}
                >
                  Haan / Yes <span style={{ opacity: 0.8, fontSize: '0.68rem', marginLeft: '4px' }}>Y</span>
                </button>

                <button
                  onClick={() => handleSafeSignalSelect('Nahi')}
                  className="btn-operator-decision"
                  style={{
                    background: selectedAnswer === 'Nahi' ? '#f1f5f9' : '#ffffff',
                    color: '#1e293b',
                    border: '1.5px solid #cbd5e1'
                  }}
                >
                  Nahi / No <span style={{ opacity: 0.7, fontSize: '0.68rem', marginLeft: '4px' }}>N</span>
                </button>

                <button
                  onClick={() => handleSafeSignalSelect('NoAnswer')}
                  className="btn-operator-decision"
                  style={{
                    background: selectedAnswer === 'NoAnswer' ? '#f1f5f9' : '#ffffff',
                    color: '#1e293b',
                    border: '1.5px solid #cbd5e1'
                  }}
                >
                  No answer <span style={{ opacity: 0.7, fontSize: '0.68rem', marginLeft: '4px' }}>S</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.64rem' }}>
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '6px', borderRadius: '4px' }}>
                  <strong style={{ color: '#991b1b' }}>If yes</strong>
                  <div style={{ color: '#7f1d1d' }}>Minimum P1 · police added</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '4px' }}>
                  <strong style={{ color: '#334155' }}>If no</strong>
                  <div style={{ color: '#475569' }}>No change. Not read as safe.</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '4px' }}>
                  <strong style={{ color: '#334155' }}>If silent</strong>
                  <div style={{ color: '#475569' }}>Stays unknown, safety unconfirmed</div>
                </div>
              </div>

              {/* OPERATOR CUSTOM QUESTION TRANSMISSION TO PHONE */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #dbeafe', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1d4ed8' }}>
                    ASK CUSTOM SAFE QUESTION (TRANSMIT DIRECT TO CALLER PHONE)
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#64748b' }}>
                    Binary 1-Tap Safe
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customQuestionInput}
                    onChange={(e) => setCustomQuestionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customQuestionInput.trim() && onSendCustomQuestion) {
                        onSendCustomQuestion(customQuestionInput.trim());
                        setCustomQuestionInput('');
                        setIsCustomQuestionSent(true);
                        setTimeout(() => setIsCustomQuestionSent(false), 3500);
                      }
                    }}
                    placeholder="Type custom Hinglish question, e.g. Kya aap safe room mein band hain?"
                    style={{
                      flex: 1,
                      border: '1.5px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      background: '#ffffff',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customQuestionInput.trim() && onSendCustomQuestion) {
                        onSendCustomQuestion(customQuestionInput.trim());
                        setCustomQuestionInput('');
                        setIsCustomQuestionSent(true);
                        setTimeout(() => setIsCustomQuestionSent(false), 3500);
                      }
                    }}
                    disabled={!customQuestionInput.trim()}
                    style={{
                      background: customQuestionInput.trim() ? '#2563eb' : '#94a3b8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: customQuestionInput.trim() ? 'pointer' : 'default',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Send to Phone →
                  </button>
                </div>

                {/* Quick Suggestion Chips */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    'Kya darwaza band hai?',
                    'Kya aap safe room mein hain?',
                    'Kya bachhe aapke sath hain?',
                    'Kya hathiyar dikh raha hai?'
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (onSendCustomQuestion) {
                          onSendCustomQuestion(chip);
                          setIsCustomQuestionSent(true);
                          setTimeout(() => setIsCustomQuestionSent(false), 3500);
                        }
                      }}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.64rem',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                {isCustomQuestionSent && (
                  <div style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✓ Question transmitted live to caller smartphone screen!
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* COLUMN 3: SAATHI ASSESSMENT & DISPATCH */}
          <aside className="cad-assessment-column">
            {/* Assessment Banner */}
            <div className="assessment-badge-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SAATHI ASSESSMENT</span>
                <span style={{ fontSize: '0.58rem', background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: '3px' }}>SUGGESTION</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>
                {triage.urgencyLevel === 'CRITICAL'
                  ? 'P1 Critical'
                  : triage.urgencyLevel === 'SEVERE'
                  ? 'P2 High'
                  : triage.urgencyLevel === 'MODERATE'
                  ? 'P3 Medium'
                  : 'P4 Low'}
              </div>
              <div style={{ fontSize: '0.65rem', display: 'flex', gap: '8px', opacity: 0.95, flexWrap: 'wrap' }}>
                <span>Threats: {triage.threats.join(', ') || 'General Enquiry'}</span>
                <span>Level: {triage.urgencyLevel}</span>
              </div>
            </div>

            {/* Operator Warning Rule if Coded Call */}
            {!triage.callerConstraints.canSpeakFreely && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c2410c' }}>
                  She may not be able to speak freely (Coded Call Flagged)
                </div>
                <div style={{ fontSize: '0.66rem', color: '#9a3412', marginTop: '2px' }}>
                  Do not repeat her words back or ask her to explain. Use yes/no questions only.
                </div>
              </div>
            )}

            {/* Why this priority */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                Why this priority
              </div>
              {triage.evidenceLinks && triage.evidenceLinks.length > 0 ? (
                <table className="why-priority-table">
                  <tbody>
                    {triage.evidenceLinks.map((ev: EvidenceItem, idx: number) => (
                      <tr key={idx}>
                        <td><span className="keyword-yellow-tag">{ev.quoteHinglish}</span></td>
                        <td style={{ color: '#334155' }}>{ev.label}</td>
                        <td style={{ textAlign: 'right', color: ev.severity === 'critical' ? '#dc2626' : ev.severity === 'high' ? '#ea580c' : '#64748b', fontWeight: 700 }}>
                          {ev.severity === 'critical' ? 'Critical' : ev.severity === 'high' ? 'High' : 'Context'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.68rem', fontStyle: 'italic', padding: '6px 0' }}>
                  No emergency signals detected yet. Listening to incoming citizen speech...
                </div>
              )}

              {/* DYNAMIC SITUATIONAL AWARENESS & UNKNOWNS CHECKLIST */}
              {(() => {
                const isLocKnown = Boolean(extractedLocation && extractedLocation.trim().length > 2 && isLocationConfirmed);
                const weaponEv = (triage.evidenceLinks || []).find((e: EvidenceItem) =>
                  e.category === 'threat' &&
                  (e.quoteHinglish.toLowerCase().includes('chaku') ||
                   e.quoteHinglish.toLowerCase().includes('hathiyar') ||
                   e.quoteHinglish.toLowerCase().includes('weapon') ||
                   e.quoteHinglish.toLowerCase().includes('bandook') ||
                   e.quoteHinglish.toLowerCase().includes('knife') ||
                   e.quoteHinglish.toLowerCase().includes('gun'))
                );
                const weaponAnsweredNo = (questions || []).some((q: SafeSignalQuestion) => q.category === 'weapon_visibility' && q.answer === 'NO');
                const violenceEv = (triage.evidenceLinks || []).find((e: EvidenceItem) =>
                  e.category === 'threat' ||
                  e.quoteHinglish.toLowerCase().includes('maar') ||
                  e.quoteHinglish.toLowerCase().includes('pitai') ||
                  e.quoteHinglish.toLowerCase().includes('chot')
                );
                const canSpeak = triage.callerConstraints.canSpeakFreely;
                const isCoded = !canSpeak || (triage.evidenceLinks || []).some((e: EvidenceItem) => e.label.toLowerCase().includes('coded'));
                const medicalEv = (triage.evidenceLinks || []).find((e: EvidenceItem) => e.category === 'injury');
                const childKnown = triage.childrenAtRisk.detected;

                const situationalItems = [
                  {
                    label: isLocKnown ? `Caller Location: ${extractedLocation}` : 'Where is she? (Exact landmark / gali unconfirmed)',
                    isKnown: isLocKnown,
                    statusText: isLocKnown ? 'GPS / Locality Locked' : 'Pending Caller Input'
                  },
                  {
                    label: weaponEv ? `Weapon reported: "${weaponEv.quoteHinglish}"` : weaponAnsweredNo ? 'No weapon present (Verified by caller)' : 'Is there a weapon or physical hazard?',
                    isKnown: Boolean(weaponEv || weaponAnsweredNo),
                    statusText: weaponEv ? 'Hazard Present' : weaponAnsweredNo ? 'Ruled Out' : 'Pending Verification'
                  },
                  {
                    label: violenceEv ? `Active Threat: ${violenceEv.label}` : 'Immediate physical violence level?',
                    isKnown: Boolean(violenceEv),
                    statusText: violenceEv ? 'Identified' : 'Unconfirmed'
                  },
                  {
                    label: isCoded ? 'Coded call detected: Abuser in the room (Whisper mode)' : 'Can caller speak freely without abuser hearing?',
                    isKnown: Boolean(isCoded || (inputText && inputText.length > 20)),
                    statusText: isCoded ? 'Restricted Speech' : 'Assessed'
                  },
                  {
                    label: medicalEv ? `Medical emergency: ${medicalEv.label}` : 'Urgent medical care / hospitalization required?',
                    isKnown: Boolean(medicalEv),
                    statusText: medicalEv ? 'Ambulance Required' : 'Not Reported'
                  },
                  {
                    label: childKnown ? `Minors at risk: ${triage.childrenAtRisk.details}` : 'Are minor children present on premises?',
                    isKnown: childKnown,
                    statusText: childKnown ? 'Childline 1098 Alert' : 'Unconfirmed'
                  }
                ];

                return (
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '8px', fontSize: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
                        SITUATIONAL AWARENESS &amp; UNKNOWNS
                      </span>
                      <span style={{ fontSize: '0.58rem', color: '#16a34a', fontWeight: 700 }}>
                        {situationalItems.filter(i => i.isKnown).length}/{situationalItems.length} Verified
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {situationalItems.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 7px',
                            borderRadius: '4px',
                            background: item.isKnown ? '#f0fdf4' : '#fffbeb',
                            border: item.isKnown ? '1px solid #bbf7d0' : '1px solid #fef3c7'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 900, color: item.isKnown ? '#16a34a' : '#d97706' }}>
                              {item.isKnown ? '✓' : '?'}
                            </span>
                            <span style={{ color: item.isKnown ? '#166534' : '#92400e', fontWeight: item.isKnown ? 700 : 500 }}>
                              {item.label}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: item.isKnown ? '#dcfce7' : '#fef3c7',
                              color: item.isKnown ? '#15803d' : '#b45309',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.statusText}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontStyle: 'italic', color: '#64748b', marginTop: '6px', fontSize: '0.6rem' }}>
                      {situationalItems.every(i => i.isKnown)
                        ? '✓ All critical situational parameters verified by SAATHI.'
                        : 'SAATHI actively cross-examines speech & SafeSignal taps to resolve remaining unknowns.'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* CALLER LOCATION & LIVE TACTICAL GIS RADAR */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#2563eb" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>CALLER TARGET LOCATION</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isLocationConfirmed ? '#16a34a' : '#ea580c', background: isLocationConfirmed ? '#dcfce7' : '#ffedd5', padding: '1px 6px', borderRadius: '4px' }}>
                    {isLocationConfirmed ? '● GPS Locked' : '○ Estimating'}
                  </span>
                  <button
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    title={isMapExpanded ? 'Minimize map' : 'Expand map'}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                  >
                    {isMapExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Area, gali, landmark"
                  style={{
                    flex: 1,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    color: '#0f172a',
                    fontSize: '0.72rem'
                  }}
                />
                <button
                  onClick={() => setIsLocationConfirmed(true)}
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Locate
                </button>
              </div>

              {/* TACTICAL MAP COMPONENT */}
              <div style={{ height: isMapExpanded ? '340px' : '200px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', marginTop: '2px', transition: 'height 0.2s ease' }}>
                <TacticalEmergencyMap
                  callerCoords={callerCoords}
                  locationAddress={locationInput || extractedLocation || 'Target Emergency Location'}
                  nearbyServices={nearbyServices}
                  policeDispatched={agencies?.police?.status === 'DISPATCHED'}
                  medicalDispatched={agencies?.medical?.status === 'DISPATCHED'}
                />
              </div>

              {/* Coordinates & Accuracy Radar Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: '#64748b', padding: '2px 4px' }}>
                <span>GPS: <strong style={{ color: '#0f172a' }}>{callerCoords[0].toFixed(4)}° N, {callerCoords[1].toFixed(4)}° E</strong></span>
                <span>Accuracy: <strong style={{ color: '#16a34a' }}>±12m Precision</strong></span>
              </div>
            </div>

            {/* LIVE HELPLINE FLEET DISPATCH & PROXIMITY COMMAND */}
            {(() => {
              const policeSrv = (nearbyServices || []).find((s: EmergencyServiceEntity) => s.type === 'police');
              const hospitalSrv = (nearbyServices || []).find((s: EmergencyServiceEntity) => s.type === 'hospital');
              const shelterSrv = (nearbyServices || []).find((s: EmergencyServiceEntity) => s.type === 'shelter');
              const legalSrv = (nearbyServices || []).find((s: EmergencyServiceEntity) => s.type === 'legal');

              const isPoliceDispatched = agencies?.police?.status === 'DISPATCHED';
              const isMedicalDispatched = agencies?.medical?.status === 'DISPATCHED';
              const isShelterReserved = agencies?.shelter?.status === 'RESERVED';
              const isLegalAssigned = agencies?.legalAid?.status === 'ASSIGNED';

              return (
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.5s infinite' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.03em' }}>
                        LIVE HELPLINE FLEET &amp; PROXIMITY
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#16a34a', fontWeight: 800, background: '#dcfce7', padding: '1px 6px', borderRadius: '3px' }}>
                      4 Responders Active
                    </span>
                  </div>

                  {/* 4 Emergency Units Fleet Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* 1. POLICE 112 */}
                    <div style={{
                      border: isPoliceDispatched ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      background: isPoliceDispatched ? '#eff6ff' : '#f8fafc',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#1d4ed8',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 900
                        }}>
                          112
                        </div>
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                            {policeSrv ? policeSrv.name : 'Police 112 PCR Beat Van'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>📍 {policeSrv ? policeSrv.distanceKm : '0.7'} km away</span>
                            <span>•</span>
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>⏱️ ~{policeSrv ? policeSrv.etaMins : '3'} min ETA</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDispatchAgency('police')}
                        style={{
                          background: isPoliceDispatched ? '#16a34a' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isPoliceDispatched ? '🚨 En Route' : 'Dispatch Now'}
                      </button>
                    </div>

                    {/* 2. AMBULANCE 108 */}
                    <div style={{
                      border: isMedicalDispatched ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                      background: isMedicalDispatched ? '#fef2f2' : '#f8fafc',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#dc2626',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 900
                        }}>
                          108
                        </div>
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                            {hospitalSrv ? hospitalSrv.name : '108 ALS Emergency Trauma Ambulance'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>📍 {hospitalSrv ? hospitalSrv.distanceKm : '1.2'} km away</span>
                            <span>•</span>
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>⏱️ ~{hospitalSrv ? hospitalSrv.etaMins : '5'} min ETA</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDispatchAgency('medical')}
                        style={{
                          background: isMedicalDispatched ? '#16a34a' : '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isMedicalDispatched ? '🚑 En Route' : 'Dispatch 108'}
                      </button>
                    </div>

                    {/* 3. SHELTER 181 */}
                    <div style={{
                      border: isShelterReserved ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                      background: isShelterReserved ? '#f0fdf4' : '#f8fafc',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#16a34a',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 900
                        }}>
                          181
                        </div>
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                            {shelterSrv ? shelterSrv.name : 'Sakhi One-Stop Crisis Centre (OSC)'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>📍 {shelterSrv ? shelterSrv.distanceKm : '1.8'} km away</span>
                            <span>•</span>
                            <span style={{ color: '#475569' }}>4 Emergency Beds Ready</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDispatchAgency('shelter')}
                        style={{
                          background: isShelterReserved ? '#15803d' : '#059669',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isShelterReserved ? '✓ Bed Held' : 'Reserve Bed'}
                      </button>
                    </div>

                    {/* 4. LEGAL AID 15100 */}
                    <div style={{
                      border: isLegalAssigned ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                      background: isLegalAssigned ? '#f5f3ff' : '#f8fafc',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#7c3aed',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.58rem',
                          fontWeight: 900
                        }}>
                          DLSA
                        </div>
                        <div>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                            {legalSrv ? legalSrv.name : 'District Legal Services Authority'}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>📍 {legalSrv ? legalSrv.distanceKm : '2.5'} km away</span>
                            <span>•</span>
                            <span style={{ color: '#475569' }}>Protection Officer Appointed</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDispatchAgency('legalAid')}
                        style={{
                          background: isLegalAssigned ? '#6d28d9' : '#7c3aed',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isLegalAssigned ? '✓ Assigned' : 'Assign DLSA'}
                      </button>
                    </div>
                  </div>

                  {/* One-Click Coordinated Dispatch All Button */}
                  <button
                    onClick={() => {
                      onDispatchAgency('police');
                      onDispatchAgency('medical');
                      onDispatchAgency('shelter');
                      onDispatchAgency('legalAid');
                    }}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                      border: 'none',
                      color: 'white',
                      borderRadius: '6px',
                      padding: '9px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                      marginTop: '4px'
                    }}
                  >
                    🚨 ONE-CLICK COORDINATED DISPATCH ALL RESPONDERS
                  </button>
                </div>
              );
            })()}
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: WALLBOARD VIEW (PAGE 7)                           */}
      {/* ======================================================== */}
      {activeTab === 'wallboard' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#eaedf2', padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 6 KPI Cards */}
          <div className="wallboard-kpis-grid">
            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>CALLS WAITING</div>
              <div className="wallboard-kpi-val">5</div>
              <div style={{ fontSize: '0.62rem', color: '#dc2626' }}>1 ringing now</div>
            </div>

            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>LONGEST WAIT</div>
              <div className="wallboard-kpi-val red">08:26</div>
              <div style={{ fontSize: '0.62rem', color: '#dc2626' }}>INC-4A20 dropped, not called back</div>
            </div>

            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>OPEN P1 / P2</div>
              <div className="wallboard-kpi-val">1 / 2</div>
              <div style={{ fontSize: '0.62rem', color: '#16a34a' }}>all assigned</div>
            </div>

            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>CODED CALLS FLAGGED</div>
              <div className="wallboard-kpi-val">2</div>
              <div style={{ fontSize: '0.62rem', color: '#64748b' }}>pizza order · cannot talk</div>
            </div>

            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>TIME TO FIRST SAFE QUESTION</div>
              <div className="wallboard-kpi-val">0:19</div>
              <div style={{ fontSize: '0.62rem', color: '#64748b' }}>median, this shift</div>
            </div>

            <div className="wallboard-kpi-card">
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 800 }}>OPERATORS</div>
              <div className="wallboard-kpi-val">6 / 8</div>
              <div style={{ fontSize: '0.62rem', color: '#16a34a' }}>on calls · 2 available</div>
            </div>
          </div>

          {/* Middle Row: Stacked Chart & Floor Operators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            {/* Left: Stacked Bar Chart */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>CALLS PER HOUR, BY PRIORITY</span>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.62rem', fontWeight: 700 }}>
                  <span style={{ color: '#dc2626' }}>■ P1</span>
                  <span style={{ color: '#ea580c' }}>■ P2</span>
                  <span style={{ color: '#d97706' }}>■ P3</span>
                  <span style={{ color: '#64748b' }}>■ P4</span>
                </div>
              </div>

              {/* Stacked Bars Visual */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '20px', borderBottom: '1px solid #e2e8f0' }}>
                {[
                  { time: '04:00', p1: 15, p2: 25, p3: 20, p4: 10 },
                  { time: '05:00', p1: 20, p2: 30, p3: 25, p4: 15 },
                  { time: '06:00', p1: 10, p2: 20, p3: 40, p4: 20 },
                  { time: '07:00', p1: 35, p2: 45, p3: 30, p4: 10 },
                  { time: '08:00', p1: 25, p2: 35, p3: 25, p4: 15 },
                  { time: '09:00 now', p1: 20, p2: 30, p3: 15, p4: 5 }
                ].map((col, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '45px' }}>
                    <div style={{ width: '30px', display: 'flex', flexDirection: 'column-reverse' }}>
                      <div style={{ height: `${col.p1}px`, background: '#dc2626', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ height: `${col.p2}px`, background: '#ea580c' }} />
                      <div style={{ height: `${col.p3}px`, background: '#d97706' }} />
                      <div style={{ height: `${col.p4}px`, background: '#94a3b8' }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>{col.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Operators on Floor */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                OPERATORS ON THE FLOOR
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span><strong>OP-03</strong> On call · INC-4A1C</span>
                  <span style={{ background: '#b91c1c', color: 'white', padding: '1px 5px', borderRadius: '3px', fontWeight: 800, fontSize: '0.62rem' }}>P1</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span><strong>OP-07</strong> On call · INC-4A21</span>
                  <span style={{ background: '#ea580c', color: 'white', padding: '1px 5px', borderRadius: '3px', fontWeight: 800, fontSize: '0.62rem' }}>P2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span><strong>OP-02</strong> On call · INC-4A1B</span>
                  <span style={{ background: '#d97706', color: 'white', padding: '1px 5px', borderRadius: '3px', fontWeight: 800, fontSize: '0.62rem' }}>P3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span><strong>OP-05</strong> Wrap-up · 01:40</span>
                  <span style={{ color: '#64748b', fontSize: '0.64rem' }}>notes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span><strong>OP-01</strong> Available</span>
                  <button style={{ background: '#2563eb', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                    Assign INC-4A20
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span><strong>OP-08</strong> Available</span>
                  <button style={{ background: '#2563eb', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                    Assign INC-4A1D
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Urgent Calls Table & Needs Attention */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>OPEN URGENT CALLS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '4px' }}>PRIORITY</th>
                    <th>INCIDENT</th>
                    <th>TYPE</th>
                    <th>OPERATOR</th>
                    <th>DURATION</th>
                    <th>HANDOFF</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 4px' }}><span style={{ background: '#b91c1c', color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 800 }}>P1</span></td>
                    <td>INC-4A1C</td>
                    <td>Weapon · child present</td>
                    <td>OP-03</td>
                    <td>04:12</td>
                    <td style={{ color: '#2563eb', fontWeight: 600 }}>Requested · not acknowledged</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 4px' }}><span style={{ background: '#ea580c', color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 800 }}>P2</span></td>
                    <td>INC-4A21</td>
                    <td>Coded call · cannot talk</td>
                    <td>OP-07</td>
                    <td>01:36</td>
                    <td style={{ color: '#64748b' }}>Not prepared</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 4px' }}><span style={{ background: '#ea580c', color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 800 }}>P2</span></td>
                    <td>INC-4A1D</td>
                    <td>Coded call · food order</td>
                    <td>Unassigned</td>
                    <td>00:42</td>
                    <td style={{ color: '#64748b' }}>Not prepared</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>NEEDS YOUR ATTENTION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.68rem' }}>
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '8px 10px', borderRadius: '6px' }}>
                  <strong style={{ color: '#be123c' }}>Dropped call, safety unconfirmed</strong>
                  <div style={{ color: '#4c0519', marginTop: '2px' }}>INC-4A20 cut after “Hello… hello…”. No callback in 8 min.</div>
                </div>

                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '8px 10px', borderRadius: '6px' }}>
                  <strong style={{ color: '#c2410c' }}>Operator overrode below the floor</strong>
                  <div style={{ color: '#7c2d12', marginTop: '2px' }}>INC-4A17 set to P3 although “chaku” set a minimum of High. Review the reason.</div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 10px', borderRadius: '6px' }}>
                  <strong style={{ color: '#1d4ed8' }}>Possible repeat case</strong>
                  <div style={{ color: '#1e3a8a', marginTop: '2px' }}>INC-4A1E matches INC-3F02 (name and place, 82%). Check before linking.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: INCIDENTS VIEW (PAGE 8)                           */}
      {/* ======================================================== */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 310px', flex: 1, overflow: 'hidden', background: '#eaedf2' }}>
          {/* Shift Incidents List */}
          <aside style={{ background: '#ffffff', borderRight: '1px solid #cbd5e1', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>INCIDENTS · THIS SHIFT</div>
            <input
              type="text"
              placeholder="Search id, words, place"
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', color: '#0f172a', fontSize: '0.68rem' }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setIncidentFilter('open')} style={{ flex: 1, padding: '3px', background: incidentFilter === 'open' ? '#1e293b' : '#ffffff', border: '1px solid #cbd5e1', color: incidentFilter === 'open' ? 'white' : '#475569', fontSize: '0.62rem', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}>Open</button>
              <button onClick={() => setIncidentFilter('closed')} style={{ flex: 1, padding: '3px', background: incidentFilter === 'closed' ? '#1e293b' : '#ffffff', border: '1px solid #cbd5e1', color: incidentFilter === 'closed' ? 'white' : '#475569', fontSize: '0.62rem', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}>Closed</button>
              <button onClick={() => setIncidentFilter('linked')} style={{ flex: 1, padding: '3px', background: incidentFilter === 'linked' ? '#1e293b' : '#ffffff', border: '1px solid #cbd5e1', color: incidentFilter === 'linked' ? 'white' : '#475569', fontSize: '0.62rem', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}>Linked</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
              <div
                onClick={() => setSelectedIncidentId('INC-4A1C')}
                style={{
                  background: selectedIncidentId === 'INC-4A1C' ? '#eff6ff' : '#ffffff',
                  border: selectedIncidentId === 'INC-4A1C' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#b91c1c', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 4px', borderRadius: '2px' }}>P1 INC-4A1C</span>
                  <span style={{ color: '#64748b', fontSize: '0.62rem' }}>Ended</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: '#1e293b', marginTop: '2px', fontWeight: 600 }}>Weapon · child · Shiv Colony Gali 4</div>
              </div>

              <div
                onClick={() => setSelectedIncidentId('INC-4A21')}
                style={{
                  background: selectedIncidentId === 'INC-4A21' ? '#eff6ff' : '#ffffff',
                  border: selectedIncidentId === 'INC-4A21' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#ea580c', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 4px', borderRadius: '2px' }}>P2 INC-4A21</span>
                  <span style={{ color: '#16a34a', fontSize: '0.62rem', fontWeight: 700 }}>Live</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: '#1e293b', marginTop: '2px' }}>Coded call · location unknown</div>
              </div>

              <div
                onClick={() => setSelectedIncidentId('INC-4A20')}
                style={{
                  background: selectedIncidentId === 'INC-4A20' ? '#eff6ff' : '#ffffff',
                  border: selectedIncidentId === 'INC-4A20' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#d97706', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 4px', borderRadius: '2px' }}>P3 INC-4A20</span>
                  <span style={{ color: '#ef4444', fontSize: '0.62rem' }}>Dropped</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: '#1e293b', marginTop: '2px' }}>Interrupted · safety unconfirmed</div>
              </div>

              <div
                onClick={() => setSelectedIncidentId('INC-4A1E')}
                style={{
                  background: selectedIncidentId === 'INC-4A1E' ? '#eff6ff' : '#ffffff',
                  border: selectedIncidentId === 'INC-4A1E' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ background: '#d97706', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 4px', borderRadius: '2px' }}>P3 INC-4A1E</span>
                  <span style={{ color: '#64748b', fontSize: '0.62rem' }}>Waiting</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: '#1e293b', marginTop: '2px' }}>Stalking · possible repeat</div>
              </div>
            </div>
          </aside>

          {/* Incident Timeline Middle Column */}
          <main style={{ padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ background: '#b91c1c', color: 'white', fontSize: '0.64rem', fontWeight: 800, padding: '2px 6px', borderRadius: '3px' }}>P1 Critical</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, marginLeft: '8px', color: '#0f172a' }}>INC-4A1C</span>
                  <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: '6px' }}>Physical violence · weapon · children present</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 600 }}>Caller 98XXX-X5531</span>
              </div>

              <div style={{ display: 'flex', gap: '14px', fontSize: '0.64rem', color: '#64748b', marginTop: '6px' }}>
                <span>Ringing · 09:44:02</span>
                <span>Connected · 09:44:09</span>
                <span>Ended · 09:48:21</span>
                <span style={{ color: '#d97706', fontWeight: 700 }}>Closed · needs a note</span>
              </div>
            </div>

            {/* TIMELINE */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', fontWeight: 800, color: '#475569' }}>
                <span>TIMELINE · EVERYTHING THAT HAPPENED</span>
                <span style={{ color: '#64748b' }}>append-only</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', lineHeight: 1.45, marginTop: '4px', color: '#1e293b' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:44:12</span>
                  <span style={{ color: '#334155', fontWeight: 700 }}>Caller: </span>
                  <span>Madam mere pati ne <span className="keyword-yellow-tag">chaku</span> nikal liya hai, abhi <span className="keyword-yellow-tag">maar dalega</span> , Shiv Colony gali 4 mein hu, <span className="keyword-yellow-tag">bachche</span> bhi hain</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:44:14</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>SAATHI: </span>
                  <span>Rated <span style={{ background: '#b91c1c', color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 800 }}>P1</span> · weapon + threat to life + children. Police and shelter suggested.</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:44:31</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>Operator: </span>
                  <span>Asked: “Kya aapko ya kisi ko chot lagi hai?” · Caller: nahi</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:44:58</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>Operator: </span>
                  <span>Location confirmed: Shiv Colony, Gali 4, near the temple</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:45:20</span>
                  <span style={{ color: '#334155', fontWeight: 700 }}>Caller: </span>
                  <span>Callback unsafe · SMS safe</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:45:41</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>Operator: </span>
                  <span>Handoff brief approved → Police 112, One Stop Centre</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:48:21</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>System: </span>
                  <span>Call ended: caller disconnected. Safety remains unconfirmed.</span>
                </div>

                <div>
                  <span style={{ color: '#64748b', fontSize: '0.66rem', marginRight: '6px' }}>09:49:05</span>
                  <span style={{ color: '#0284c7', fontWeight: 700 }}>Operator: </span>
                  <span>SMS sent from “181 Info”: your case number and how to reach us.</span>
                </div>
              </div>
            </div>
          </main>

          {/* Right Column: Case Summary & Close Incident */}
          <aside style={{ background: '#ffffff', borderLeft: '1px solid #cbd5e1', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>CASE SUMMARY</div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px', fontSize: '0.66rem', color: '#1e293b' }}>
                <span style={{ color: '#64748b' }}>Threat</span><span>Husband with a knife, threat to life</span>
                <span style={{ color: '#64748b' }}>People at risk</span><span>Caller, children</span>
                <span style={{ color: '#64748b' }}>Injuries</span><span>None reported (asked 09:44)</span>
                <span style={{ color: '#64748b' }}>Location</span><span>Shiv Colony, Gali 4 · confirmed</span>
                <span style={{ color: '#64748b' }}>Contact</span><span>SMS only · no callbacks</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>RESPONSE STATUS</div>
              <div style={{ fontSize: '0.66rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>Police 112</span>
                  <span style={{ color: '#2563eb' }}>Requested 09:45 · not yet acknowledged</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>One Stop Centre</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>Acknowledged 09:47</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                  Nothing is shown as confirmed until the service confirms it.
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155' }}>POSSIBLE REPEAT CASE</span>
                <span style={{ fontSize: '0.64rem', color: '#ea580c', fontWeight: 800 }}>86% match</span>
              </div>
              <div style={{ fontSize: '0.64rem', color: '#475569', marginTop: '3px' }}>
                INC-39B7 · 12 Sep · Domestic abuse · closed with OSC referral
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.62rem', color: '#64748b', margin: '4px 0' }}>
                <span>Name 0.94</span>
                <span>Phone —</span>
                <span>Place 0.88</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={{ flex: 1, background: '#2563eb', border: 'none', color: 'white', padding: '4px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer' }}>
                  Link after review
                </button>
                <button style={{ flex: 1, background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', padding: '4px', borderRadius: '4px', fontSize: '0.64rem', cursor: 'pointer' }}>
                  Not the same
                </button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>CLOSE INCIDENT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.66rem' }}>
                <select style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px', color: '#0f172a' }}>
                  <option>Service dispatched and confirmed</option>
                  <option>Referred to DLSA legal helpline</option>
                  <option>Caller confirmed safe with family</option>
                </select>
                <textarea
                  placeholder="Closing note (required): What happened, what is still open"
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px', color: '#0f172a', minHeight: '40px', fontSize: '0.66rem' }}
                />
                <button style={{ background: '#1e293b', border: 'none', color: 'white', padding: '5px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>
                  Close · waiting for police confirmation
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: STRESS LAB VIEW (PAGE 9)                          */}
      {/* ======================================================== */}
      {activeTab === 'stresslab' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#eaedf2', padding: '14px', gap: '14px' }}>
          {/* Top Row: Base Call + Twists (Left) & Result Flow (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '14px' }}>
            {/* Left: Base Call & Add a Twist (Page 9) */}
            <div className="stresslab-twists-col">
              <div>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>BASE CALL</div>
                <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 700, marginTop: '4px' }}>
                  “Pati se jhagda ho gaya hai, ghar mein tanav hai, Rampur gaon”
                </div>
                <div style={{ display: 'inline-block', background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 700, marginTop: '4px' }}>
                  P3 Medium · domestic setting
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  ADD A TWIST
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stressTwists.weapon}
                      onChange={(e) => setStressTwists((p) => ({ ...p, weapon: e.target.checked }))}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Weapon disclosed</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>“…wo chaku le aaya hai abhi”</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stressTwists.conflicting}
                      onChange={(e) => setStressTwists((p) => ({ ...p, conflicting: e.target.checked }))}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Conflicting details</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>“…nahi nahi, sab theek hai”</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stressTwists.silent}
                      onChange={(e) => setStressTwists((p) => ({ ...p, silent: e.target.checked }))}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Caller goes silent</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>[silence] [call cut]</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stressTwists.injuryLate}
                      onChange={(e) => setStressTwists((p) => ({ ...p, injuryLate: e.target.checked }))}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Injury disclosed late</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>answers haan to “chot lagi hai?”</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stressTwists.locationChanges}
                      onChange={(e) => setStressTwists((p) => ({ ...p, locationChanges: e.target.checked }))}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Location changes</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>Rampur gaon → bus stand ke paas</div>
                    </div>
                  </label>
                </div>

                <button
                  onClick={() => setStressSimRunCount((c) => c + 1)}
                  style={{
                    width: '100%',
                    background: '#2563eb',
                    border: 'none',
                    color: 'white',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    marginTop: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Run scenario
                </button>
              </div>
            </div>

            {/* Right: Simulation Result (Page 9) */}
            <div className="stresslab-result-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>
                  RESULT · BASE + WEAPON + CONFLICTING DETAILS
                </span>
                <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 800 }}>3 of 3 checks passed</span>
              </div>

              {/* Transition flow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#d97706', color: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 900 }}>P3 base</span>
                <ArrowRight size={14} color="#64748b" />
                <span style={{ background: '#b91c1c', color: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 900 }}>P1 + chaku abhi</span>
                <ArrowRight size={14} color="#64748b" />
                <span style={{ background: '#b91c1c', color: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 900 }}>P1 + “sab theek hai”</span>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '6px', lineHeight: 1.45 }}>
                <strong style={{ color: '#0f172a' }}>Floor held.</strong> A later “sab theek hai” does not undo a weapon and a threat said earlier. The call stays P1 and the operator is asked to confirm.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ color: '#16a34a', fontSize: '0.68rem', fontWeight: 800 }}>PASS · Priority went up</div>
                  <div style={{ color: '#334155', fontSize: '0.64rem', marginTop: '2px' }}>Weapon + immediacy set minimum Critical</div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ color: '#16a34a', fontSize: '0.68rem', fontWeight: 800 }}>PASS · Never went down</div>
                  <div style={{ color: '#334155', fontSize: '0.64rem', marginTop: '2px' }}>Denial did not lower the floor</div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ color: '#16a34a', fontSize: '0.68rem', fontWeight: 800 }}>PASS · Safe next question</div>
                  <div style={{ color: '#334155', fontSize: '0.64rem', marginTop: '2px' }}>“Kya aap abhi kisi khatre mein hain?”</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Emergencies Caught & Safeguards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>
                <span>EMERGENCIES CAUGHT · UNSEEN SET, BY CALL TYPE</span>
                <span style={{ color: '#64748b' }}>synthetic</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.7rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}><span>Denial</span><span style={{ fontWeight: 700 }}>100%</span></div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: '100%', height: '100%', background: '#16a34a' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}><span>Medical</span><span style={{ fontWeight: 700 }}>100%</span></div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: '100%', height: '100%', background: '#16a34a' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}><span>Direct</span><span style={{ fontWeight: 700 }}>96%</span></div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: '96%', height: '100%', background: '#16a34a' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}><span>Coded calls</span><span style={{ fontWeight: 700 }}>70%</span></div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: '70%', height: '100%', background: '#d97706' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}><span>Third party</span><span style={{ fontWeight: 700 }}>0%</span></div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ width: '0%', height: '100%', background: '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#b45309', marginTop: '2px' }}>
                    Known gap: a neighbour reporting someone else in danger is missed. Next on the fix list.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>
                SAFEGUARD CHECKS
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a' }}>10/10</div>
                  <div style={{ fontSize: '0.64rem', color: '#334155' }}>one-detail changes moved priority the right way</div>
                </div>

                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a' }}>7/7</div>
                  <div style={{ fontSize: '0.64rem', color: '#334155' }}>unsafe questions blocked</div>
                </div>

                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a' }}>79% <span style={{ fontSize: '0.74rem', color: '#64748b' }}>vs 50%</span></div>
                  <div style={{ fontSize: '0.64rem', color: '#334155' }}>emergencies caught with vs without minimum-priority rules</div>
                </div>

                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a' }}>69%</div>
                  <div style={{ fontSize: '0.64rem', color: '#334155' }}>caught with speech-to-text errors added</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
