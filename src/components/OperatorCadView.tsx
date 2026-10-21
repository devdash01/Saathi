import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Maximize2,
  Minimize2,
  Mic,
  Radio,
  Zap,
  Check
} from 'lucide-react';
import { TacticalEmergencyMap } from './TacticalEmergencyMap';
import { emergencyContactService } from '../services/emergencyContactService';
import type {
  StructuredTriage,
  SafetyFloor,
  AgencyDispatchState,
  SafeSignalQuestion,
  UrgencyLevel,
  EmergencyContact
} from '../types';
import type { EmergencyServiceEntity } from '../services/locationService';
import type { EmergencyReport, OperatorSession } from '../types/report';

export type OperatorCadTab = 'console' | 'incidents' | 'wallboard' | 'stresslab';

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
  onUpdateLocation?: (loc: string) => void;
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
  onOverridePriority,
  onCallerAnswer,
  onAppendInput,
  operatorSession: _operatorSession,
  aiConfidence: _aiConfidence,
  onUpdateLocation: _onUpdateLocation
}) => {
  // Navigation Tabs matching reference images: Console | Incidents | Wallboard | Stress Lab
  const [activeTab, setActiveTab] = useState<OperatorCadTab>('console');

  // Real-time ticking clock string (e.g. 09:41:35)
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(d.toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Queue filter on Console
  const [queueFilter, setQueueFilter] = useState<'all' | 'p1p2' | 'coded'>('all');
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

  // Emergency Contacts state for operator console (Guardian SOS)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() =>
    emergencyContactService.getContacts()
  );

  useEffect(() => {
    const unsub = emergencyContactService.subscribe((list) => {
      setEmergencyContacts(list);
    });
    return unsub;
  }, []);

  // Live Call Duration Timer & State (179s = 02:59 initially matching screenshot)
  const [callDuration, setCallDuration] = useState(179);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [isEscalatedToP1, setIsEscalatedToP1] = useState(false);

  // Restart duration when a new chat / report session is initiated by the user
  const prevReportIdRef = useRef<string | undefined>(activeReport?.id);
  useEffect(() => {
    if (activeReport?.id && prevReportIdRef.current && activeReport.id !== prevReportIdRef.current) {
      setCallDuration(0);
      setIsCallEnded(false);
      setIsEscalatedToP1(false);
    }
    prevReportIdRef.current = activeReport?.id;
  }, [activeReport?.id]);

  useEffect(() => {
    if (isCallEnded) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
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
  const [_stressSimRunCount, _setStressSimRunCount] = useState(1);

  // Incidents Tab selected incident (Page 8)
  const [selectedIncidentId, setSelectedIncidentId] = useState('INC-4A1C');
  const [incidentFilter, setIncidentFilter] = useState<'open' | 'closed' | 'linked'>('open');
  const [incidentSearchQuery, setIncidentSearchQuery] = useState('');
  const [eventLogFilter, setEventLogFilter] = useState<'all' | 'caller' | 'operator' | 'system' | 'units'>('all');

  // Handle SafeSignal button click on Console
  const handleSafeSignalSelect = (ans: 'Haan' | 'Nahi' | 'NoAnswer') => {
    setSelectedAnswer(ans);
    if (ans === 'Haan') {
      onDispatchAgency('police');
      setIsEscalatedToP1(true);
    }
    if (questions && questions[0] && onCallerAnswer) {
      onCallerAnswer(questions[0].id, ans === 'Haan' ? 'YES' : ans === 'Nahi' ? 'NO' : 'SILENCE');
    }
  };

  const handleEscalateToP1 = () => {
    setIsEscalatedToP1(true);
    if (onOverridePriority) {
      onOverridePriority('CRITICAL', 'Manual Operator Escalation to P1');
    }
    onDispatchAgency('police');
  };

  const effectiveUrgency = isEscalatedToP1 ? 'CRITICAL' : triage.urgencyLevel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#eaedf2', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ======================================================== */}
      {/* 1. TOP CAD NAVIGATION BAR (MATCHING SCREENSHOTS)          */}
      {/* ======================================================== */}
      <header className="cad-top-header-181">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '100%' }}>
          {/* Logo & CRC Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={17} color="#dc2626" style={{ fill: '#dc2626', stroke: '#dc2626' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 900, letterSpacing: '0.03em', color: '#0f172a' }}>
              SAATHI
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginLeft: '2px' }}>
              181 · DELHI CRC
            </span>
          </div>

          {/* Navigation Tabs */}
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
              onClick={() => setActiveTab('wallboard')}
              className={`cad-tab-link-181 ${activeTab === 'wallboard' ? 'active' : ''}`}
            >
              Wallboard
            </button>
            <button
              onClick={() => setActiveTab('stresslab')}
              className={`cad-tab-link-181 ${activeTab === 'stresslab' ? 'active' : ''}`}
            >
              Stress Lab
            </button>
          </nav>
        </div>

        {/* Top Status & Metrics Right */}
        <div className="cad-top-meta-right">
          {activeTab === 'wallboard' && (
            <>
              <span>Night shift 22:00–06:00 · Supervisor SV-02</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {currentTimeStr}
              </span>
            </>
          )}

          {activeTab === 'incidents' && (
            <>
              <span>Queue <strong style={{ color: '#0f172a' }}>5</strong></span>
              <span>Longest wait <strong style={{ color: '#dc2626' }}>08:26</strong></span>
              <span>OP-07</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {currentTimeStr}
              </span>
            </>
          )}

          {(activeTab === 'console' || activeTab === 'stresslab') && (
            <>
              <span>Queue <strong style={{ color: '#0f172a' }}>5</strong></span>
              <span>Longest wait <strong style={{ color: '#dc2626' }}>08:26</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                <span>ASR online</span>
              </span>
              <span>OP-07</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {currentTimeStr}
              </span>
            </>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. TAB: CONSOLE VIEW (IMAGE 3)                           */}
      {/* ======================================================== */}
      {activeTab === 'console' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Active Call Orange Banner (Matching Image 3) */}
          <div className="active-call-top-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Square Priority Block: P2 HIGH or P1 CRITICAL */}
              {effectiveUrgency === 'CRITICAL' ? (
                <div className="urgency-square-p1">
                  <div className="urgency-square-num">P1</div>
                  <div className="urgency-square-text">CRITICAL</div>
                </div>
              ) : (
                <div className="urgency-square-p2">
                  <div className="urgency-square-num">P2</div>
                  <div className="urgency-square-text">HIGH</div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeReport?.id ? (activeReport.id.startsWith('SA-') ? `INC-${activeReport.id.slice(-4)}` : activeReport.id) : 'INC-4A21'}{' '}
                  Domestic violence — coded call, abuser on premises
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>Caller 98XXX-X2666 · Airtel 4G · Hinglish</span>
                  <span>Area Paschim Vihar A-4 · ±600 m · unconfirmed</span>
                  <span style={{ color: '#ea580c', fontWeight: 700 }}>Floor P2 locked · 09:38:59</span>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'ping 1.5s infinite' }} />
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>LIVE</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.94rem', color: '#0f172a' }}>
                  {formatDuration(callDuration)}
                </span>
              </div>

              <button
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Mute / Unmute operator mic"
              >
                <Mic size={14} color="#334155" />
              </button>

              <button
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                Transfer
              </button>

              <button
                onClick={handleEscalateToP1}
                style={{
                  background: '#ffffff',
                  border: '1px solid #f87171',
                  color: '#dc2626',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Escalate to P1
              </button>

              {!isCallEnded ? (
                <button
                  onClick={() => setIsCallEnded(true)}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  End call
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsCallEnded(false);
                    setCallDuration(0);
                  }}
                  style={{
                    background: '#16a34a',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  New call
                </button>
              )}

              {/* Citizen Emergency Contact (Guardian SOS) 1-Tap Trigger */}
              {emergencyContacts[0] && (
                <button
                  onClick={() => {
                    if (activeReport) {
                      emergencyContactService.dispatchUnifiedAlert(emergencyContacts[0], activeReport);
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(5, 150, 105, 0.3)'
                  }}
                  title="Dispatch CAD alert directly to WhatsApp & SMS in 1 tap"
                >
                  <Zap size={12} />
                  <span>1-Tap SOS Contact</span>
                </button>
              )}
            </div>
          </div>

          {/* Situation Strip (6 Tiles Matching Image 3) */}
          <div className="cad-situation-strip">
            <div className="cad-situation-tile">
              <span className="sit-lbl">SITUATION</span>
              <span className="sit-val" style={{ color: '#2563eb' }}>
                Danger now <strong style={{ color: '#1d4ed8' }}>Asking</strong>
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Location</span>
              <span className="sit-val" style={{ color: isLocationConfirmed ? '#16a34a' : '#ea580c' }}>
                {isLocationConfirmed ? 'GPS Locked' : 'Area only'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Weapon</span>
              <span className="sit-val" style={{ color: (triage.threats || []).some(t => t.toLowerCase().includes('weapon') || t.toLowerCase().includes('knife')) ? '#dc2626' : '#64748b' }}>
                {(triage.threats || []).some(t => t.toLowerCase().includes('weapon') || t.toLowerCase().includes('knife')) ? 'Knife · reported' : 'Unknown'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Injury</span>
              <span className="sit-val" style={{ color: '#64748b' }}>
                Unknown
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Children</span>
              <span className="sit-val" style={{ color: triage.childrenAtRisk?.detected ? '#ea580c' : '#64748b' }}>
                {triage.childrenAtRisk?.detected ? 'Present · 2 children' : 'Unknown'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Can speak freely</span>
              <span className="sit-val" style={{ color: !triage.callerConstraints?.canSpeakFreely ? '#0f172a' : '#16a34a' }}>
                {!triage.callerConstraints?.canSpeakFreely ? 'No · confirmed' : 'Yes · open'}
              </span>
            </div>
          </div>

          {/* 3-Column Body Layout */}
          <div className="cad-console-page-layout">
            {/* COLUMN 1: QUEUE · 7 */}
            <aside className="cad-queue-column">
              <div style={{ padding: '8px 10px 4px', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>QUEUE · 7</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button
                    onClick={() => setQueueFilter('all')}
                    style={{
                      background: queueFilter === 'all' ? '#0f172a' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: queueFilter === 'all' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '3px',
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
                      background: queueFilter === 'p1p2' ? '#0f172a' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: queueFilter === 'p1p2' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '3px',
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
                      background: queueFilter === 'coded' ? '#0f172a' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: queueFilter === 'coded' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '3px',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Coded
                  </button>
                </div>
              </div>

              {/* Calls List */}
              <div className="queue-items-scroll">
                {/* Ringing Call Card */}
                <div className="queue-card-181" style={{ borderLeft: '3px solid #dc2626' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', animation: 'ping 1s infinite' }} />
                      <span style={{ color: '#dc2626', fontSize: '0.68rem', fontWeight: 800 }}>RINGING · INC-4A22</span>
                    </div>
                    <button
                      style={{
                        background: '#0f172a',
                        border: 'none',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Answer
                    </button>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b' }}>00:07 · no speech yet</div>
                </div>

                {/* Call 1: P1 INC-4A1C */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A1C' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A1C')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#dc2626', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P1 INC-4A1C
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.65rem' }}>01:15</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Knife · children present · OP-03
                  </div>
                </div>

                {/* Call 2: P2 INC-4A21 (Selected Active) */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A21' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A21')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#ea580c', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P2 INC-4A21
                    </span>
                    <span style={{ color: '#16a34a', fontSize: '0.65rem', fontWeight: 700 }}>02:59</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px', fontWeight: 700 }}>
                    Coded call · on your line
                  </div>
                </div>

                {/* Call 3: P2 INC-4A1D */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A1D' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A1D')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#ea580c', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P2 INC-4A1D
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.65rem' }}>00:42</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#c2410c', marginTop: '2px' }}>
                    Coded · "pizza bhej do" · unassigned
                  </div>
                </div>

                {/* Call 4: P3 INC-4A20 (Dropped wait) */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A20' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A20')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#d97706', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P3 INC-4A20
                    </span>
                    <span style={{ color: '#dc2626', fontSize: '0.65rem', fontWeight: 800 }}>08:26</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Dropped · safety unconfirmed
                  </div>
                </div>

                {/* Call 5: P3 INC-4A1E */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A1E' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A1E')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#d97706', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P3 INC-4A1E
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.65rem' }}>03:33</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Stalking · possible repeat
                  </div>
                </div>

                {/* Call 6: P4 INC-4A1F */}
                <div
                  className={`queue-card-181 ${selectedCallId === 'INC-4A1F' ? 'active' : ''}`}
                  onClick={() => setSelectedCallId('INC-4A1F')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ background: '#64748b', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P4 INC-4A1F
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.65rem' }}>06:29</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Legal help · custody
                  </div>
                </div>
              </div>

              {/* Bottom Priority Badges Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '6px 8px', borderTop: '1px solid #cbd5e1', gap: '4px', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#dc2626' }}>1</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P1</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#ea580c' }}>2</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P2</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#d97706' }}>2</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P3</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#64748b' }}>1</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P4</span>
                </div>
              </div>
            </aside>

            {/* COLUMN 2: LIVE TRANSCRIPT & NEXT SAFE QUESTION */}
            <main className="cad-active-call-column">
              {/* Live Transcript Box */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>LIVE TRANSCRIPT</span>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>hi-IN · saarika v2 · streaming</span>
                  </div>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Radio size={12} />
                    <span>WHISPER</span>
                  </span>
                </div>

                {/* Chronological Transcript Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.74rem', lineHeight: 1.45, color: '#1e293b' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:38:36</span>
                    <span style={{ color: '#64748b', fontWeight: 800, width: '54px' }}>SYSTEM</span>
                    <span>Call connected · network area Paschim Vihar</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:38:52</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '54px' }}>CALLER</span>
                    <span>Haan mummy, <span className="keyword-yellow-tag">sab theek hai</span><sup>4</sup>, khana bana rahi hoon...</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', color: '#7c3aed', fontStyle: 'italic' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:38:58</span>
                    <span style={{ fontWeight: 800, width: '54px' }}>AUDIO</span>
                    <span>Voice drops to whisper<sup>1</sup></span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:38:59</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '54px' }}>CALLER</span>
                    <span>
                      please... <span className="keyword-yellow-tag">kisi ko bhejo</span><sup>3</sup>... <span className="keyword-yellow-tag">woh ghar pe hai</span><sup>2</sup>{' '}
                      <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '0.66rem' }}>→ P2 FLOOR</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', color: '#7c3aed', fontStyle: 'italic' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:39:07</span>
                    <span style={{ fontWeight: 800, width: '54px' }}>AUDIO</span>
                    <span>Male voice, background: "kisse baat kar rahi hai?"<sup>5</sup></span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:39:10</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '54px' }}>CALLER</span>
                    <span>koi nahi... galat number hai</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:39:31</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '54px' }}>OP-07</span>
                    <span>Aap sirf haan ya na mein jawab dijiye. Kya aap ghar par hain?</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', color: '#16a34a' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:39:40</span>
                    <span style={{ fontWeight: 800, width: '54px' }}>DEVICE</span>
                    <span>Tap response: <strong>HAAN — at home</strong></span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:41:33</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '54px' }}>CALLER</span>
                    <span>woh... darwaze pe khada hai...</span>
                  </div>

                  {/* Dynamic Speech line if caller is speaking right now */}
                  {inputText && (
                    <div style={{ display: 'flex', gap: '8px', background: '#eff6ff', padding: '4px 6px', borderRadius: '4px' }}>
                      <span style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                      <span style={{ color: '#16a34a', fontWeight: 800, width: '54px' }}>CALLER</span>
                      <span style={{ fontWeight: 600 }}>{inputText}</span>
                    </div>
                  )}

                  {notesList.map((note, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', color: '#0284c7' }}>
                      <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>NOTE</span>
                      <span style={{ fontWeight: 800, width: '54px' }}>OP-07</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>

                {/* Add / correct a line row */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddManualNote();
                    }}
                    placeholder="Add or correct a line..."
                    style={{
                      flex: 1,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '6px 10px',
                      fontSize: '0.74rem',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    onClick={handleAddManualNote}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '6px 14px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0f172a'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* NEXT SAFE QUESTION Box (Matching Image 3) */}
              <div className="safesignal-box-181">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>NEXT SAFE QUESTION</span>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>targets: danger now</span>
                  </div>
                  <span style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Check size={12} strokeWidth={3} />
                    <span>SafeSignal 10/10</span>
                  </span>
                </div>

                {/* Big Question Prompt */}
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                    {questions && questions[0] ? `“${questions[0].hinglishText || questions[0].questionText}”` : '“Kya aap abhi khatre mein hain?”'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    Are you in danger right now? · one silent tap
                  </div>
                </div>

                {/* Buttons Row */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      alert('Speaking question aloud to caller on audio line.');
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Read aloud
                  </button>

                  <button
                    onClick={() => {
                      if (questions && questions[0] && onSendCustomQuestion) {
                        onSendCustomQuestion(questions[0].hinglishText || questions[0].questionText);
                        setIsCustomQuestionSent(true);
                        setTimeout(() => setIsCustomQuestionSent(false), 3000);
                      }
                    }}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 14px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Send to caller's phone
                  </button>
                </div>

                {/* 3 Decision Cards */}
                <div className="decision-3-grid">
                  <div
                    onClick={() => handleSafeSignalSelect('Haan')}
                    className="btn-operator-decision"
                    style={{
                      background: selectedAnswer === 'Haan' ? '#fee2e2' : '#ffffff',
                      borderColor: selectedAnswer === 'Haan' ? '#dc2626' : '#cbd5e1'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#dc2626' }}>[Y] Haan</strong>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#475569' }}>Escalate P1 · dispatch police</div>
                  </div>

                  <div
                    onClick={() => handleSafeSignalSelect('Nahi')}
                    className="btn-operator-decision"
                    style={{
                      background: selectedAnswer === 'Nahi' ? '#eff6ff' : '#ffffff',
                      borderColor: selectedAnswer === 'Nahi' ? '#2563eb' : '#cbd5e1'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0f172a' }}>[N] Nahi</strong>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#475569' }}>Hold P2 · not marked safe</div>
                  </div>

                  <div
                    onClick={() => handleSafeSignalSelect('NoAnswer')}
                    className="btn-operator-decision"
                    style={{
                      background: selectedAnswer === 'NoAnswer' ? '#f1f5f9' : '#ffffff',
                      borderColor: selectedAnswer === 'NoAnswer' ? '#64748b' : '#cbd5e1'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0f172a' }}>[S] No response</strong>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#475569' }}>Safety unconfirmed · retry 20 s</div>
                  </div>
                </div>

                {/* Queued Questions Strip */}
                <div style={{ fontSize: '0.66rem', color: '#2563eb', marginTop: '2px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b' }}>Queued:</span>
                  <span style={{ cursor: 'pointer' }}>Kya woh abhi aapke paas hai?</span>
                  <span style={{ cursor: 'pointer' }}>Kya bachche saath hain?</span>
                  <span style={{ cursor: 'pointer' }}>Kya chot lagi hai?</span>
                </div>

                {/* Custom Question Direct Input */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customQuestionInput}
                    onChange={(e) => setCustomQuestionInput(e.target.value)}
                    placeholder="Type custom safe binary question..."
                    style={{
                      flex: 1,
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '5px 8px',
                      fontSize: '0.72rem',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customQuestionInput.trim() && onSendCustomQuestion) {
                        onSendCustomQuestion(customQuestionInput.trim());
                        setCustomQuestionInput('');
                        setIsCustomQuestionSent(true);
                        setTimeout(() => setIsCustomQuestionSent(false), 3000);
                      }
                    }}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Send to Phone
                  </button>
                </div>
                {isCustomQuestionSent && (
                  <div style={{ fontSize: '0.64rem', color: '#16a34a', fontWeight: 700 }}>
                    ✓ Question transmitted silently to caller smartphone screen!
                  </div>
                )}
              </div>
            </main>

            {/* COLUMN 3: PRIORITY RATIONALE, MAP & RESOURCES */}
            <aside className="cad-assessment-column">
              {/* PRIORITY RATIONALE */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>PRIORITY RATIONALE</span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>advisory · operator decides</span>
                </div>

                {/* Spectrum Bar: P4 0:00  P3 0:22  P2 0:23 ■  P1 — */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#64748b' }}>
                    <span>P4 0:00</span>
                    <span>P3 0:22</span>
                    <span style={{ color: '#ea580c', fontWeight: 800 }}>P2 0:23 ■</span>
                    <span>P1 —</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: '25%', background: '#94a3b8' }} />
                    <div style={{ width: '25%', background: '#d97706' }} />
                    <div style={{ width: '25%', background: '#ea580c' }} />
                    <div style={{ width: '25%', background: '#f1f5f9' }} />
                  </div>
                </div>

                {/* Signals Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.66rem' }}>
                  <thead>
                    <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '3px', width: '14px' }}>#</th>
                      <th>SIGNAL</th>
                      <th style={{ textAlign: 'right' }}>EFFECT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 3px', color: '#64748b' }}>2</td>
                      <td><strong>“woh ghar pe hai”</strong> abuser present</td>
                      <td style={{ textAlign: 'right', color: '#ea580c', fontWeight: 800 }}>FLOOR P2</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 3px', color: '#64748b' }}>3</td>
                      <td><strong>“kisi ko bhejo”</strong> help request</td>
                      <td style={{ textAlign: 'right', color: '#ea580c', fontWeight: 800 }}>FLOOR P2</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 3px', color: '#64748b' }}>1</td>
                      <td>Whisper mid-sentence</td>
                      <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 800 }}>→ P3</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 3px', color: '#64748b' }}>4</td>
                      <td><strong>“sab theek hai”</strong> denial under duress</td>
                      <td style={{ textAlign: 'right', color: '#64748b', fontWeight: 800 }}>NO DOWNGRADE</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 3px', color: '#64748b' }}>5</td>
                      <td>Male voice + “galat number”</td>
                      <td style={{ textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>CODED</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                  P1 triggers: <span style={{ color: '#dc2626' }}>Haan to danger · weapon · injury · child at risk</span>
                </div>
              </div>

              {/* TACTICAL MAP & CELL AREA (Matching Image 3) */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 8px', fontSize: '0.66rem' }}>
                  <div style={{ fontWeight: 800, color: '#92400e' }}>CELL AREA · ±600 m</div>
                  <div style={{ color: '#78350f' }}>Paschim Vihar, A-4 block</div>
                </div>

                <div style={{ height: isMapExpanded ? '300px' : '150px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #cbd5e1', transition: 'height 0.2s' }}>
                  <TacticalEmergencyMap
                    callerCoords={callerCoords}
                    locationAddress={locationInput || extractedLocation || 'Paschim Vihar, A-4 block, New Delhi'}
                    nearbyServices={nearbyServices}
                    policeDispatched={agencies?.police?.status === 'DISPATCHED'}
                    medicalDispatched={agencies?.medical?.status === 'DISPATCHED'}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      alert('Silent GPS pin requested from cellular provider tower.');
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  >
                    Request GPS pin (silent)
                  </button>
                  <button
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                  >
                    {isMapExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>

              {/* NEAREST RESOURCES · ROAD ETA (Matching Image 3) */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>NEAREST RESOURCES</span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>road ETA</span>
                </div>

                {/* 112 Police */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#2563eb', color: 'white', fontWeight: 900, fontSize: '0.6rem', padding: '1px 5px', borderRadius: '2px' }}>
                      112
                    </span>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>PCR 14 · Paschim Vihar PS</div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>available · 0.9 km</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>3m</span>
                    <button
                      onClick={() => onDispatchAgency('police')}
                      style={{
                        background: agencies?.police?.status === 'DISPATCHED' ? '#16a34a' : '#2563eb',
                        border: 'none',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {agencies?.police?.status === 'DISPATCHED' ? 'Dispatched' : 'Dispatch'}
                    </button>
                  </div>
                </div>

                {/* 181 Sakhi OSC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#16a34a', color: 'white', fontWeight: 900, fontSize: '0.6rem', padding: '1px 5px', borderRadius: '2px' }}>
                      181
                    </span>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>One Stop Centre · Sakhi</div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>4 beds · 2.4 km</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>9m</span>
                    <button
                      onClick={() => onDispatchAgency('shelter')}
                      style={{
                        background: agencies?.shelter?.status === 'RESERVED' ? '#15803d' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: agencies?.shelter?.status === 'RESERVED' ? 'white' : '#0f172a',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {agencies?.shelter?.status === 'RESERVED' ? 'Held' : 'Hold bed'}
                    </button>
                  </div>
                </div>

                {/* 108 Ambulance */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#dc2626', color: 'white', fontWeight: 900, fontSize: '0.6rem', padding: '1px 5px', borderRadius: '2px' }}>
                      108
                    </span>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>Ambulance · Raja Garden</div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>available · 1.9 km</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>7m</span>
                    <button
                      onClick={() => onDispatchAgency('medical')}
                      style={{
                        background: agencies?.medical?.status === 'DISPATCHED' ? '#dc2626' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: agencies?.medical?.status === 'DISPATCHED' ? 'white' : '#0f172a',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {agencies?.medical?.status === 'DISPATCHED' ? 'Active' : 'Stand by'}
                    </button>
                  </div>
                </div>

                {/* Preserved Emergency Contact SOS Status */}
                {emergencyContacts[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', background: '#f0fdf4', borderRadius: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#059669', color: 'white', fontWeight: 900, fontSize: '0.58rem', padding: '1px 4px', borderRadius: '2px' }}>
                        SOS
                      </span>
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#14532d' }}>
                          {emergencyContacts[0].name} ({emergencyContacts[0].relationship})
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#166534' }}>
                          {emergencyContacts[0].phone} • WhatsApp &amp; SMS
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (activeReport) {
                          emergencyContactService.dispatchUnifiedAlert(emergencyContacts[0], activeReport);
                        }
                      }}
                      style={{
                        background: '#059669',
                        border: 'none',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Alert Now
                    </button>
                  </div>
                )}

                <div style={{ fontSize: '0.6rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                  Caller is told help is coming only after a unit acknowledges.
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TAB: INCIDENTS VIEW (IMAGE 2)                         */}
      {/* ======================================================== */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Active Incident Red Banner (Matching Image 2) */}
          <div className="active-call-top-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Square P1 Block */}
              <div className="urgency-square-p1">
                <div className="urgency-square-num">P1</div>
                <div className="urgency-square-text">CRITICAL</div>
              </div>

              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  INC-4A1C Assault with weapon — knife, two children present
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>Shiv Colony, Gali 4, near temple · <strong style={{ color: '#16a34a' }}>location confirmed</strong></span>
                  <span>Contact SMS only · <strong style={{ color: '#dc2626' }}>no callbacks</strong></span>
                  <span>Handled by OP-03</span>
                </div>
              </div>
            </div>

            {/* Right Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c' }}>CALL ENDED · OPEN</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>caller safety not confirmed</div>
              </div>

              <button
                onClick={() => alert('Incident docket brief exported as PDF.')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Export brief
              </button>

              <button
                onClick={() => alert('Silent SMS check-in sent to caller handset.')}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Send SMS check-in
              </button>
            </div>
          </div>

          {/* Metrics Strip (Matching Image 2) */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.72rem' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b' }}>METRICS</span>
            <span>Answered in <strong style={{ color: '#0f172a' }}>00:07</strong></span>
            <span>Priority set <strong style={{ color: '#0f172a' }}>00:02 after speech</strong></span>
            <span>First safe question <strong style={{ color: '#0f172a' }}>00:22</strong></span>
            <span>Call length <strong style={{ color: '#0f172a' }}>04:12</strong></span>
            <span>Police <strong style={{ color: '#2563eb' }}>En route · ack 09:47</strong></span>
          </div>

          {/* 3 Columns Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 340px', flex: 1, overflow: 'hidden' }}>
            {/* Col 1: THIS SHIFT · 23 */}
            <aside style={{ background: '#ffffff', borderRight: '1px solid #cbd5e1', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>THIS SHIFT · 23</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button
                    onClick={() => setIncidentFilter('open')}
                    style={{
                      background: incidentFilter === 'open' ? '#0f172a' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: incidentFilter === 'open' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setIncidentFilter('closed')}
                    style={{
                      background: incidentFilter === 'closed' ? '#0f172a' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: incidentFilter === 'closed' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Closed
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={incidentSearchQuery}
                onChange={(e) => setIncidentSearchQuery(e.target.value)}
                placeholder="Search id, words, place"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '5px 8px',
                  fontSize: '0.68rem',
                  outline: 'none',
                  color: '#0f172a'
                }}
              />

              {/* Incidents Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                {/* INC-4A1C */}
                <div
                  onClick={() => setSelectedIncidentId('INC-4A1C')}
                  style={{
                    background: selectedIncidentId === 'INC-4A1C' ? '#f8fafc' : '#ffffff',
                    border: selectedIncidentId === 'INC-4A1C' ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#dc2626', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P1 INC-4A1C
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#c2410c', fontWeight: 800 }}>NEEDS NOTE</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Knife · children · Shiv Colony
                  </div>
                </div>

                {/* INC-4A21 */}
                <div
                  onClick={() => setSelectedIncidentId('INC-4A21')}
                  style={{
                    background: selectedIncidentId === 'INC-4A21' ? '#eff6ff' : '#ffffff',
                    border: selectedIncidentId === 'INC-4A21' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#ea580c', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P2 INC-4A21
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#16a34a', fontWeight: 800 }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Coded call · abuser present
                  </div>
                </div>

                {/* INC-4A20 */}
                <div
                  onClick={() => setSelectedIncidentId('INC-4A20')}
                  style={{
                    background: selectedIncidentId === 'INC-4A20' ? '#eff6ff' : '#ffffff',
                    border: selectedIncidentId === 'INC-4A20' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#d97706', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P3 INC-4A20
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 800 }}>DROPPED</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Hello... [call cut]
                  </div>
                </div>

                {/* INC-4A1E */}
                <div
                  onClick={() => setSelectedIncidentId('INC-4A1E')}
                  style={{
                    background: selectedIncidentId === 'INC-4A1E' ? '#eff6ff' : '#ffffff',
                    border: selectedIncidentId === 'INC-4A1E' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#d97706', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P3 INC-4A1E
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>WAITING</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Stalking · possible repeat
                  </div>
                </div>

                {/* INC-4A1F */}
                <div
                  onClick={() => setSelectedIncidentId('INC-4A1F')}
                  style={{
                    background: selectedIncidentId === 'INC-4A1F' ? '#eff6ff' : '#ffffff',
                    border: selectedIncidentId === 'INC-4A1F' ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: '#64748b', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '2px' }}>
                      P4 INC-4A1F
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>WAITING</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    Legal help · custody
                  </div>
                </div>
              </div>
            </aside>

            {/* Col 2: EVENT LOG append-only · 11 entries */}
            <main style={{ padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>EVENT LOG</span>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>append-only · 11 entries</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.66rem', color: '#475569' }}>
                    {(['all', 'caller', 'operator', 'system', 'units'] as const).map((filter) => (
                      <span
                        key={filter}
                        onClick={() => setEventLogFilter(filter)}
                        style={{
                          cursor: 'pointer',
                          fontWeight: eventLogFilter === filter ? 800 : 500,
                          color: eventLogFilter === filter ? '#0f172a' : '#64748b',
                          textDecoration: eventLogFilter === filter ? 'underline' : 'none',
                          textTransform: 'capitalize'
                        }}
                      >
                        {filter}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 11 Entries Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem', lineHeight: 1.45, color: '#1e293b' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:44:09</span>
                    <span style={{ color: '#64748b', fontWeight: 800, width: '60px' }}>SYSTEM</span>
                    <span>Answered by OP-03 · Hinglish · transcript on</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:44:12</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '60px' }}>CALLER</span>
                    <span>
                      Madam mere pati ne <span className="keyword-yellow-tag">chaku</span> nikal liya hai, abhi <span className="keyword-yellow-tag">maar dalega</span>, Shiv Colony gali 4 mein hu, <span className="keyword-yellow-tag">bachche</span> bhi hain
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:44:14</span>
                    <span style={{ color: '#0284c7', fontWeight: 800, width: '60px' }}>SAATHI</span>
                    <span>
                      Suggested <span style={{ background: '#dc2626', color: 'white', padding: '1px 4px', borderRadius: '2px', fontWeight: 800, fontSize: '0.62rem' }}>P1</span> · weapon + threat to life + children · police, shelter
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:44:31</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>OP-03</span>
                    <span>Asked "Kya aapko ya kisi ko chot lagi hai?" — caller: nahi</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:44:58</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>OP-03</span>
                    <span>Location confirmed — Shiv Colony, Gali 4, near the temple</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:45:20</span>
                    <span style={{ color: '#dc2626', fontWeight: 800, width: '60px' }}>CALLER</span>
                    <span>Callback unsafe · SMS safe</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:45:41</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>OP-03</span>
                    <span>Handoff brief approved → Police 112, One Stop Centre</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:47:02</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>112</span>
                    <span>PCR 14 acknowledged · en route</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:47:30</span>
                    <span style={{ color: '#16a34a', fontWeight: 800, width: '60px' }}>181 OSC</span>
                    <span>Sakhi centre holding a bed for 3</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', color: '#c2410c' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:48:21</span>
                    <span style={{ fontWeight: 800, width: '60px' }}>SYSTEM</span>
                    <span>Caller disconnected · safety not confirmed</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>09:49:05</span>
                    <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>OP-03</span>
                    <span>SMS sent as "181 Info" — case number, how to reach us</span>
                  </div>
                </div>
              </div>
            </main>

            {/* Col 3: Unit Status, Case Summary, Possible Repeat, Close */}
            <aside style={{ background: '#ffffff', borderLeft: '1px solid #cbd5e1', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              {/* UNIT STATUS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>UNIT STATUS</span>

                {/* 112 PCR */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#2563eb', color: 'white', fontWeight: 900, fontSize: '0.6rem', padding: '1px 5px', borderRadius: '2px' }}>112</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>PCR 14 · Paschim Vihar PS</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>En route</span>
                  </div>
                  {/* Progress steps */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>
                    <span>REQ 09:45</span>
                    <span>ACK 09:47</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>ENRT 09:47</span>
                    <span>ONSC —</span>
                  </div>
                </div>

                {/* 181 One Stop Centre */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#16a34a', color: 'white', fontWeight: 900, fontSize: '0.6rem', padding: '1px 5px', borderRadius: '2px' }}>181</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>One Stop Centre · Sakhi</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>Bed held</span>
                  </div>
                  {/* Progress steps */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>
                    <span>REQ 09:45</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>HELD 09:47</span>
                    <span>ARRIVED —</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.58rem', color: '#64748b', fontStyle: 'italic' }}>
                  Statuses come from the unit, never assumed.
                </div>
              </div>

              {/* CASE SUMMARY */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>CASE SUMMARY</span>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px', fontSize: '0.66rem' }}>
                  <span style={{ color: '#64748b' }}>Threat</span>
                  <span style={{ color: '#0f172a' }}>Husband with knife · threat to life</span>
                  <span style={{ color: '#64748b' }}>At risk</span>
                  <span style={{ color: '#0f172a' }}>Caller, 2 children</span>
                  <span style={{ color: '#64748b' }}>Injuries</span>
                  <span style={{ color: '#0f172a' }}>None reported (asked 09:44)</span>
                  <span style={{ color: '#64748b' }}>Weapon</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>Knife · in hand</span>
                </div>
              </div>

              {/* POSSIBLE REPEAT */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>POSSIBLE REPEAT</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ea580c' }}>0.86</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#0f172a' }}>
                  INC-39B7 · 12 Sep · domestic abuse · closed, OSC referral
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                  name 0.94 · place 0.88 · phone —
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    onClick={() => alert('Linked incident to prior record INC-39B7.')}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0f172a'
                    }}
                  >
                    Link after review
                  </button>
                  <button
                    onClick={() => alert('Marked as separate incident.')}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#0f172a'
                    }}
                  >
                    Not same
                  </button>
                </div>
              </div>

              {/* CLOSE */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a' }}>CLOSE</span>
                <div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: '2px' }}>Outcome</div>
                  <select
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '5px',
                      fontSize: '0.68rem',
                      color: '#0f172a'
                    }}
                  >
                    <option>Service dispatched and confirmed</option>
                    <option>Referred to Sakhi OSC</option>
                    <option>Transferred to 112 PCR</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: '2px' }}>Closing note (required)</div>
                  <textarea
                    placeholder="What happened, what is still open"
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '6px',
                      fontSize: '0.66rem',
                      minHeight: '44px',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                </div>

                <button
                  disabled
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    borderRadius: '4px',
                    padding: '6px',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    cursor: 'not-allowed',
                    textAlign: 'center'
                  }}
                >
                  Locked until police confirm on scene
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TAB: WALLBOARD VIEW (IMAGE 1)                         */}
      {/* ======================================================== */}
      {activeTab === 'wallboard' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#eaedf2', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top 6 KPI Cards Strip with Dividers (Matching Image 1) */}
          <div className="wallboard-kpis-strip">
            {/* Card 1 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">CALLS WAITING</span>
              <span className="wallboard-kpi-val">5</span>
              <span className="wallboard-kpi-sub">1 ringing</span>
            </div>

            {/* Card 2: Longest Wait in Red */}
            <div className="wallboard-kpi-item longest-wait">
              <span className="wallboard-kpi-lbl" style={{ color: '#dc2626' }}>LONGEST WAIT</span>
              <span className="wallboard-kpi-val red">08:26</span>
              <span className="wallboard-kpi-sub">INC-4A20 dropped · no callback</span>
            </div>

            {/* Card 3 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">OPEN P1 / P2</span>
              <span className="wallboard-kpi-val">
                <span style={{ color: '#dc2626' }}>1</span> / <span style={{ color: '#ea580c' }}>2</span>
              </span>
              <span className="wallboard-kpi-sub" style={{ color: '#ea580c' }}>1 P2 unassigned</span>
            </div>

            {/* Card 4 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">CODED CALLS</span>
              <span className="wallboard-kpi-val">2</span>
              <span className="wallboard-kpi-sub">food order · wrong number</span>
            </div>

            {/* Card 5: Green */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">FIRST SAFE QUESTION</span>
              <span className="wallboard-kpi-val green">0:19</span>
              <span className="wallboard-kpi-sub">median this shift</span>
            </div>

            {/* Card 6 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">OPERATORS</span>
              <span className="wallboard-kpi-val">6 / 8</span>
              <span className="wallboard-kpi-sub">2 available</span>
            </div>
          </div>

          {/* Two-Column Main Content (Left 62%, Right 38%) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '14px' }}>
            {/* Left Column: Urgent Calls Table & Stacked Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* OPEN URGENT CALLS TABLE */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  OPEN URGENT CALLS
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
                  <thead>
                    <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '6px 4px', width: '36px' }}>PRI</th>
                      <th style={{ padding: '6px 4px' }}>INCIDENT</th>
                      <th style={{ padding: '6px 4px' }}>TYPE</th>
                      <th style={{ padding: '6px 4px' }}>OPERATOR</th>
                      <th style={{ padding: '6px 4px' }}>AGE</th>
                      <th style={{ padding: '6px 4px' }}>UNITS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 4px' }}>
                        <span style={{ background: '#dc2626', color: 'white', padding: '1px 5px', borderRadius: '2px', fontWeight: 800 }}>P1</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>INC-4A1C</td>
                      <td>Assault with weapon · children</td>
                      <td>OP-03</td>
                      <td style={{ fontFamily: 'monospace' }}>04:12</td>
                      <td style={{ color: '#2563eb', fontWeight: 600 }}>112 en route · ack 09:47</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 4px' }}>
                        <span style={{ background: '#ea580c', color: 'white', padding: '1px 5px', borderRadius: '2px', fontWeight: 800 }}>P2</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>INC-4A21</td>
                      <td>DV · coded call · abuser present</td>
                      <td>OP-07</td>
                      <td style={{ fontFamily: 'monospace' }}>02:59</td>
                      <td style={{ color: '#64748b' }}>Not requested</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 4px' }}>
                        <span style={{ background: '#ea580c', color: 'white', padding: '1px 5px', borderRadius: '2px', fontWeight: 800 }}>P2</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>INC-4A1D</td>
                      <td>Coded call · "pizza order"</td>
                      <td style={{ color: '#ea580c', fontWeight: 800 }}>UNASSIGNED</td>
                      <td style={{ fontFamily: 'monospace' }}>00:42</td>
                      <td style={{ color: '#64748b' }}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* CALLS PER HOUR · BY PRIORITY (Stacked Chart Matching Image 1) */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                    CALLS PER HOUR · BY PRIORITY
                  </span>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.64rem', fontWeight: 700 }}>
                    <span style={{ color: '#dc2626' }}>■ P1</span>
                    <span style={{ color: '#ea580c' }}>■ P2</span>
                    <span style={{ color: '#f59e0b' }}>■ P3</span>
                    <span style={{ color: '#94a3b8' }}>■ P4</span>
                  </div>
                </div>

                {/* Stacked Chart Graphic */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '170px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                  {[
                    { time: '04:00', total: 4, p1: 18, p2: 18, p3: 20, p4: 18 },
                    { time: '05:00', total: 6, p1: 22, p2: 38, p3: 28, p4: 20 },
                    { time: '06:00', total: 6, p1: 20, p2: 24, p3: 50, p4: 22 },
                    { time: '07:00', total: 9, p1: 42, p2: 50, p3: 40, p4: 18 },
                    { time: '08:00', total: 8, p1: 34, p2: 44, p3: 36, p4: 20 },
                    { time: '09:00 ►', total: 5, p1: 20, p2: 36, p3: 22, p4: 18 }
                  ].map((bar, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        {bar.total}
                      </span>
                      <div style={{ width: '42px', display: 'flex', flexDirection: 'column-reverse' }}>
                        <div style={{ height: `${bar.p1}px`, background: '#dc2626' }} />
                        <div style={{ height: `${bar.p2}px`, background: '#ea580c' }} />
                        <div style={{ height: `${bar.p3}px`, background: '#f59e0b' }} />
                        <div style={{ height: `${bar.p4}px`, background: '#94a3b8', borderRadius: '3px 3px 0 0' }} />
                      </div>
                      <span style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '6px', whiteSpace: 'nowrap' }}>
                        {bar.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Needs Supervisor & Operators Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* NEEDS SUPERVISOR · 3 (Matching Image 1) */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                  NEEDS SUPERVISOR · 3
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Alert 1: DROPPED */}
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '8px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '0.68rem' }}>DROPPED</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                        INC-4A20 cut after "Hello... hello..."
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '2px' }}>
                        No callback in 8 min · callback safety unknown — send SMS check first.
                      </div>
                    </div>
                    <button
                      onClick={() => alert('Assigned INC-4A20 to OP-01.')}
                      style={{
                        background: '#0f172a',
                        border: 'none',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '3px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Assign OP-01
                    </button>
                  </div>

                  {/* Alert 2: OVERRIDE */}
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '8px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <span style={{ color: '#ea580c', fontWeight: 900, fontSize: '0.68rem' }}>OVERRIDE</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                        INC-4A17 set to P3 below floor
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '2px' }}>
                        "Chaku" set a minimum of P2. Operator reason: "caller said it was a kitchen knife".
                      </div>
                    </div>
                    <button
                      onClick={() => alert('Reviewing override rationale for INC-4A17.')}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        padding: '4px 12px',
                        borderRadius: '3px',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Review
                    </button>
                  </div>

                  {/* Alert 3: REPEAT? */}
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#2563eb', fontWeight: 900, fontSize: '0.68rem' }}>REPEAT?</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                        INC-4A1E may match INC-3F02
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '2px' }}>
                        Name and place match · 0.82. Check before linking.
                      </div>
                    </div>
                    <button
                      onClick={() => alert('Comparing INC-4A1E with INC-3F02.')}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Compare
                    </button>
                  </div>
                </div>
              </div>

              {/* OPERATORS STATUS (Matching Image 1) */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>OPERATORS</span>
                  <span style={{ fontSize: '0.64rem', color: '#64748b' }}>6 busy · 2 free</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.68rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-01</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-02</span>
                    <span>On call · <span style={{ color: '#d97706', fontWeight: 800 }}>P3</span> INC-4A1B</span>
                    <span style={{ fontFamily: 'monospace' }}>05:10</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-03</span>
                    <span>Wrap-up · <span style={{ color: '#dc2626', fontWeight: 800 }}>P1</span> INC-4A1C</span>
                    <span style={{ fontFamily: 'monospace' }}>04:12</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-04</span>
                    <span>On call · <span style={{ color: '#64748b', fontWeight: 800 }}>P4</span> INC-4A1F</span>
                    <span style={{ fontFamily: 'monospace' }}>06:29</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-05</span>
                    <span>Notes</span>
                    <span style={{ fontFamily: 'monospace' }}>01:40</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-06</span>
                    <span>On call · <span style={{ color: '#d97706', fontWeight: 800 }}>P3</span> INC-4A1E</span>
                    <span style={{ fontFamily: 'monospace' }}>03:33</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-07</span>
                    <span>On call · <span style={{ color: '#ea580c', fontWeight: 800 }}>P2</span> INC-4A21</span>
                    <span style={{ fontFamily: 'monospace' }}>02:59</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-08</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. TAB: STRESS LAB VIEW (PAGE 9)                         */}
      {/* ======================================================== */}
      {activeTab === 'stresslab' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', background: '#eaedf2', padding: '14px', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '14px' }}>
            {/* Left: Base Call & Twists */}
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
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Call goes silent</div>
                      <div style={{ color: '#64748b', fontSize: '0.64rem' }}>No answer to safe questions</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Simulation Result & Rule Trace */}
            <div className="stresslab-result-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                WHAT SAATHI DOES WITH THIS TWIST
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
                <div>
                  <strong style={{ color: '#dc2626' }}>Safety Floor Triggered:</strong>
                  <span style={{ marginLeft: '6px' }}>Weapon ("chaku") locked priority to P1 Critical. Cannot be downgraded by conflicting denial.</span>
                </div>
                <div>
                  <strong style={{ color: '#2563eb' }}>Suggested Response:</strong>
                  <span style={{ marginLeft: '6px' }}>Police 112 dispatched immediately + Sakhi shelter bed reserved.</span>
                </div>
                <div>
                  <strong style={{ color: '#16a34a' }}>SafeSignal Protocol:</strong>
                  <span style={{ marginLeft: '6px' }}>Safe binary tap question transmitted: "Kya aap safe room mein band hain?".</span>
                </div>
              </div>

              {/* Safeguard Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#16a34a' }}>10/10</div>
                  <div style={{ fontSize: '0.64rem', color: '#166534' }}>Rules pass safety verification</div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1d4ed8' }}>0ms</div>
                  <div style={{ fontSize: '0.64rem', color: '#1e40af' }}>Deterministic rule floor evaluation</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
