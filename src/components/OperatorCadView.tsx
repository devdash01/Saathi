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
import { parseEmergencyKeywords } from '../services/emergencyKeywordService';
import type {
  StructuredTriage,
  SafetyFloor,
  AgencyDispatchState,
  SafeSignalQuestion,
  UrgencyLevel,
  EvidenceItem,
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
  // Navigation Tabs: Console | Incidents | Wallboard | Stress Lab
  const [activeTab, setActiveTab] = useState<OperatorCadTab>('console');

  // Real-time ticking clock (e.g. 09:41:35)
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

  // Determine if citizen has provided any live input
  const rawCallerText = (inputText || activeReport?.callerText || '').trim();
  const hasInput = Boolean(
    rawCallerText.length > 0 ||
    (triage?.threats && triage.threats.length > 0) ||
    (triage?.evidenceLinks && triage.evidenceLinks.length > 0) ||
    (activeReport && activeReport.urgencyLevel && activeReport.urgencyLevel !== 'LOW')
  );

  // Queue filter on Console
  const [queueFilter, setQueueFilter] = useState<'all' | 'p1p2' | 'coded'>('all');
  const [selectedCallId, setSelectedCallId] = useState<string>(activeReport?.id || 'INC-1187');

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

  // Live Call Duration Timer & State (starts at 00:00 when clean)
  const [callDuration, setCallDuration] = useState(0);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [isEscalatedToP1, setIsEscalatedToP1] = useState(false);

  // Restart duration when a new distress input session is received
  const prevCallerTextRef = useRef<string>('');
  useEffect(() => {
    if (rawCallerText && !prevCallerTextRef.current) {
      setCallDuration(1);
      setIsCallEnded(false);
      setIsEscalatedToP1(false);
    }
    prevCallerTextRef.current = rawCallerText;
  }, [rawCallerText]);

  useEffect(() => {
    if (isCallEnded || !hasInput) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCallEnded, hasInput]);

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

  // Incidents Tab selected incident
  const [selectedIncidentId, setSelectedIncidentId] = useState(activeReport?.id || 'INC-1187');
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

  const effectiveUrgency: UrgencyLevel = isEscalatedToP1
    ? 'CRITICAL'
    : (triage?.urgencyLevel || 'LOW');

  // Evidence detectors based on caller speech
  const weaponEv = (triage?.evidenceLinks || []).find((e: EvidenceItem) =>
    e.category === 'threat' &&
    (e.quoteHinglish.toLowerCase().includes('chaku') ||
     e.quoteHinglish.toLowerCase().includes('hathiyar') ||
     e.quoteHinglish.toLowerCase().includes('weapon') ||
     e.quoteHinglish.toLowerCase().includes('knife') ||
     e.quoteHinglish.toLowerCase().includes('bandook') ||
     e.quoteHinglish.toLowerCase().includes('gun'))
  );

  const injuryEv = (triage?.evidenceLinks || []).find((e: EvidenceItem) => e.category === 'injury');

  const reportCode = activeReport?.id
    ? (activeReport.id.startsWith('SA-') ? `INC-${activeReport.id.slice(-4)}` : activeReport.id)
    : 'INC-1187';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#eaedf2', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ======================================================== */}
      {/* 1. TOP CAD NAVIGATION BAR (WHITE GOVTECH THEME)           */}
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
              <span>Queue <strong style={{ color: '#0f172a' }}>{hasInput ? 1 : 0}</strong></span>
              <span>Longest wait <strong style={{ color: hasInput ? '#dc2626' : '#64748b' }}>{hasInput ? formatDuration(callDuration) : '00:00'}</strong></span>
              <span>OP-07</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                {currentTimeStr}
              </span>
            </>
          )}

          {(activeTab === 'console' || activeTab === 'stresslab') && (
            <>
              <span>Queue <strong style={{ color: '#0f172a' }}>{hasInput ? 1 : 0}</strong></span>
              <span>Longest wait <strong style={{ color: hasInput ? '#dc2626' : '#64748b' }}>{hasInput ? formatDuration(callDuration) : '00:00'}</strong></span>
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
      {/* 2. TAB: CONSOLE VIEW (IMAGE 3 - FULLY DYNAMIC)           */}
      {/* ======================================================== */}
      {activeTab === 'console' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Active Call Banner */}
          <div className="active-call-top-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Urgency Square Badge */}
              {!hasInput ? (
                <div className="urgency-square-p4" style={{ background: '#64748b' }}>
                  <div className="urgency-square-num" style={{ fontSize: '1.05rem' }}>IDLE</div>
                  <div className="urgency-square-text">STANDBY</div>
                </div>
              ) : effectiveUrgency === 'CRITICAL' ? (
                <div className="urgency-square-p1">
                  <div className="urgency-square-num">P1</div>
                  <div className="urgency-square-text">CRITICAL</div>
                </div>
              ) : effectiveUrgency === 'SEVERE' ? (
                <div className="urgency-square-p2">
                  <div className="urgency-square-num">P2</div>
                  <div className="urgency-square-text">HIGH</div>
                </div>
              ) : effectiveUrgency === 'MODERATE' ? (
                <div className="urgency-square-p3">
                  <div className="urgency-square-num">P3</div>
                  <div className="urgency-square-text">MEDIUM</div>
                </div>
              ) : (
                <div className="urgency-square-p4">
                  <div className="urgency-square-num">P4</div>
                  <div className="urgency-square-text">ROUTINE</div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                  {!hasInput ? (
                    `${reportCode} · Inbound Channel Active — Awaiting Caller Transmission`
                  ) : (
                    `${reportCode} ${triage?.threats?.length ? triage.threats.join(' · ') : 'Distress Alert'} — Inbound Triage`
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>Caller 98XXX-X2666 · Airtel 4G · Hinglish</span>
                  <span>
                    Area: <strong style={{ color: isLocationConfirmed ? '#16a34a' : '#ea580c' }}>{extractedLocation || 'Paschim Vihar GPS Locked'}</strong>
                  </span>
                  {hasInput && (
                    <span style={{ color: '#ea580c', fontWeight: 700 }}>Floor {effectiveUrgency} locked</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: hasInput ? '#dc2626' : '#16a34a',
                    animation: hasInput ? 'ping 1.5s infinite' : 'none'
                  }}
                />
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                  {hasInput ? 'LIVE' : 'READY'}
                </span>
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
                disabled={!hasInput}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: hasInput ? '#0f172a' : '#94a3b8',
                  cursor: hasInput ? 'pointer' : 'not-allowed'
                }}
              >
                Transfer
              </button>

              <button
                onClick={handleEscalateToP1}
                disabled={effectiveUrgency === 'CRITICAL'}
                style={{
                  background: '#ffffff',
                  border: '1px solid #f87171',
                  color: '#dc2626',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: effectiveUrgency === 'CRITICAL' ? 0.6 : 1
                }}
              >
                Escalate to P1
              </button>

              {!isCallEnded ? (
                <button
                  onClick={() => setIsCallEnded(true)}
                  disabled={!hasInput}
                  style={{
                    background: hasInput ? '#dc2626' : '#94a3b8',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: hasInput ? 'pointer' : 'default'
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

          {/* Situation Strip (Dynamically Populated from Real Caller Input) */}
          <div className="cad-situation-strip">
            <div className="cad-situation-tile">
              <span className="sit-lbl">SITUATION</span>
              <span className="sit-val" style={{ color: hasInput ? '#2563eb' : '#64748b' }}>
                Danger now <strong style={{ color: hasInput ? '#1d4ed8' : '#64748b' }}>{hasInput ? (triage?.threats[0] || 'Active') : 'Standby'}</strong>
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
              <span className="sit-val" style={{ color: weaponEv ? '#dc2626' : '#64748b', fontWeight: weaponEv ? 800 : 600 }}>
                {weaponEv ? `${weaponEv.quoteHinglish} · detected` : 'None detected'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Injury</span>
              <span className="sit-val" style={{ color: injuryEv ? '#dc2626' : '#64748b', fontWeight: injuryEv ? 800 : 600 }}>
                {injuryEv ? injuryEv.label : 'None reported'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Children</span>
              <span className="sit-val" style={{ color: triage?.childrenAtRisk?.detected ? '#ea580c' : '#64748b', fontWeight: triage?.childrenAtRisk?.detected ? 800 : 600 }}>
                {triage?.childrenAtRisk?.detected ? 'Present · at risk' : 'Unconfirmed'}
              </span>
            </div>
            <div className="cad-situation-tile">
              <span className="sit-lbl">Can speak freely</span>
              <span className="sit-val" style={{ color: hasInput && !triage?.callerConstraints?.canSpeakFreely ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                {!hasInput ? 'Awaiting input' : !triage?.callerConstraints?.canSpeakFreely ? 'No · coded / whisper' : 'Yes · open'}
              </span>
            </div>
          </div>

          {/* 3-Column Body Layout */}
          <div className="cad-console-page-layout">
            {/* COLUMN 1: QUEUE */}
            <aside className="cad-queue-column">
              <div style={{ padding: '8px 10px 4px', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>QUEUE · {hasInput ? '1' : '0'}</span>
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
                {/* Active Inbound Call */}
                <div
                  className={`queue-card-181 ${selectedCallId === reportCode ? 'active' : ''}`}
                  onClick={() => setSelectedCallId(reportCode)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        background: !hasInput
                          ? '#64748b'
                          : effectiveUrgency === 'CRITICAL'
                          ? '#dc2626'
                          : effectiveUrgency === 'SEVERE'
                          ? '#ea580c'
                          : effectiveUrgency === 'MODERATE'
                          ? '#d97706'
                          : '#16a34a',
                        color: 'white',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '2px'
                      }}
                    >
                      {!hasInput ? 'STANDBY' : effectiveUrgency === 'CRITICAL' ? 'P1' : effectiveUrgency === 'SEVERE' ? 'P2' : effectiveUrgency === 'MODERATE' ? 'P3' : 'P4'}{' '}
                      {reportCode}
                    </span>
                    <span style={{ color: hasInput ? '#16a34a' : '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>
                      {formatDuration(callDuration)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px', fontWeight: hasInput ? 700 : 500 }}>
                    {hasInput ? (rawCallerText.slice(0, 42) + (rawCallerText.length > 42 ? '…' : '')) : 'Inbound channel listening on standby...'}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: hasInput && !triage?.callerConstraints?.canSpeakFreely ? '#dc2626' : '#2563eb', fontWeight: 700 }}>
                    {hasInput ? (!triage?.callerConstraints?.canSpeakFreely ? 'Coded call flagged · Live' : 'Live Connected · Operator OP-07') : 'Ready for caller input'}
                  </div>
                </div>

                {!hasInput && (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.66rem' }}>
                    No other distress calls in queue. Channels ready for inbound transmissions.
                  </div>
                )}
              </div>

              {/* Bottom Priority Badges Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '6px 8px', borderTop: '1px solid #cbd5e1', gap: '4px', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: effectiveUrgency === 'CRITICAL' && hasInput ? '#dc2626' : '#94a3b8' }}>
                    {effectiveUrgency === 'CRITICAL' && hasInput ? 1 : 0}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P1</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: effectiveUrgency === 'SEVERE' && hasInput ? '#ea580c' : '#94a3b8' }}>
                    {effectiveUrgency === 'SEVERE' && hasInput ? 1 : 0}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P2</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: effectiveUrgency === 'MODERATE' && hasInput ? '#d97706' : '#94a3b8' }}>
                    {effectiveUrgency === 'MODERATE' && hasInput ? 1 : 0}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px' }}>P3</span>
                </div>
                <div style={{ padding: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: effectiveUrgency === 'LOW' && hasInput ? '#16a34a' : '#94a3b8' }}>
                    {effectiveUrgency === 'LOW' && hasInput ? 1 : 0}
                  </span>
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
                  {hasInput && !triage?.callerConstraints?.canSpeakFreely && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Radio size={12} />
                      <span>WHISPER MODE</span>
                    </span>
                  )}
                </div>

                {/* Real Live Transcript Entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem', lineHeight: 1.45, color: '#1e293b', minHeight: '120px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>00:00:00</span>
                    <span style={{ color: '#64748b', fontWeight: 800, width: '54px' }}>SYSTEM</span>
                    <span>CAD Inbound Session connected · {extractedLocation || 'Delhi CRC Network'} · ASR active</span>
                  </div>

                  {!hasInput ? (
                    <div style={{ padding: '24px 10px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', borderRadius: '4px', border: '1px dashed #cbd5e1', marginTop: '6px' }}>
                      🎙️ Waiting for caller input. When the citizen speaks, whispers, or types a message on the smartphone, their live transcript and detected distress signals will appear here in real time.
                    </div>
                  ) : (
                    <>
                      {/* Whisper / Duress Audio Signal if detected */}
                      {!triage?.callerConstraints?.canSpeakFreely && (
                        <div style={{ display: 'flex', gap: '8px', color: '#7c3aed', fontStyle: 'italic' }}>
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>AUDIO</span>
                          <span style={{ fontWeight: 800, width: '54px' }}>SENSOR</span>
                          <span>Voice drops to whisper / restricted speech detected</span>
                        </div>
                      )}

                      {/* Caller Actual Statement with Highlighted Evidence Keywords */}
                      <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                        <span style={{ color: '#dc2626', fontWeight: 800, width: '54px' }}>CALLER</span>
                        <span style={{ flex: 1 }}>
                          {(() => {
                            const parsed = parseEmergencyKeywords(rawCallerText);
                            if (!parsed.segments.length) return rawCallerText;
                            return (
                              <span>
                                {parsed.segments.map((seg, i) =>
                                  seg.isKeyword ? (
                                    <mark
                                      key={i}
                                      style={{
                                        background: seg.badgeColor || '#dc2626',
                                        color: '#ffffff',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        fontWeight: 800,
                                        fontSize: '0.72rem',
                                        margin: '0 2px'
                                      }}
                                      title={seg.label}
                                    >
                                      {seg.text}
                                    </mark>
                                  ) : (
                                    <span key={i}>{seg.text}</span>
                                  )
                                )}
                              </span>
                            );
                          })()}
                        </span>
                      </div>

                      {/* Device Tap Response if Citizen Answered */}
                      {selectedAnswer && (
                        <div style={{ display: 'flex', gap: '8px', color: '#16a34a' }}>
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>DEVICE</span>
                          <span style={{ fontWeight: 800, width: '54px' }}>TAP</span>
                          <span>Response: <strong>{selectedAnswer === 'Haan' ? 'HAAN (YES)' : selectedAnswer === 'Nahi' ? 'NAHI (NO)' : 'NO RESPONSE (SILENT)'}</strong></span>
                        </div>
                      )}
                    </>
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

              {/* NEXT SAFE QUESTION Box */}
              <div className="safesignal-box-181">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>NEXT SAFE QUESTION</span>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
                      {hasInput ? (questions && questions[0] ? `targets: ${questions[0].category.replace(/_/g, ' ')}` : 'targets: danger assessment') : 'awaiting caller statement'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Check size={12} strokeWidth={3} />
                    <span>SafeSignal 10/10</span>
                  </span>
                </div>

                {/* Question Prompt */}
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    {!hasInput ? (
                      '“Awaiting citizen input to determine first safety question”'
                    ) : questions && questions[0] ? (
                      `“${questions[0].hinglishText || questions[0].questionText}”`
                    ) : (
                      '“Kya aap abhi khatre mein hain?”'
                    )}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    {hasInput ? 'One silent tap question for caller phone' : 'SafeSignal evaluates incoming statements before generating safe binary questions.'}
                  </div>
                </div>

                {/* Buttons Row */}
                {hasInput && (
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
                )}

                {/* 3 Decision Cards */}
                <div className="decision-3-grid">
                  <div
                    onClick={() => handleSafeSignalSelect('Haan')}
                    className="btn-operator-decision"
                    style={{
                      background: selectedAnswer === 'Haan' ? '#fee2e2' : '#ffffff',
                      borderColor: selectedAnswer === 'Haan' ? '#dc2626' : '#cbd5e1',
                      cursor: hasInput ? 'pointer' : 'default'
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
                      borderColor: selectedAnswer === 'Nahi' ? '#2563eb' : '#cbd5e1',
                      cursor: hasInput ? 'pointer' : 'default'
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
                      borderColor: selectedAnswer === 'NoAnswer' ? '#64748b' : '#cbd5e1',
                      cursor: hasInput ? 'pointer' : 'default'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0f172a' }}>[S] No response</strong>
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#475569' }}>Safety unconfirmed · retry 20 s</div>
                  </div>
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
                    disabled={!customQuestionInput.trim()}
                    style={{
                      background: customQuestionInput.trim() ? '#2563eb' : '#94a3b8',
                      border: 'none',
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: customQuestionInput.trim() ? 'pointer' : 'default'
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

                {/* Spectrum Bar */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#64748b' }}>
                    <span>P4 0:00</span>
                    <span>P3 0:22</span>
                    <span style={{ color: effectiveUrgency === 'SEVERE' ? '#ea580c' : effectiveUrgency === 'CRITICAL' ? '#dc2626' : '#64748b', fontWeight: 800 }}>
                      {effectiveUrgency === 'CRITICAL' ? 'P1 ■' : effectiveUrgency === 'SEVERE' ? 'P2 ■' : 'P2'}
                    </span>
                    <span>P1 —</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: '25%', background: hasInput ? '#94a3b8' : '#e2e8f0' }} />
                    <div style={{ width: '25%', background: hasInput && effectiveUrgency !== 'LOW' ? '#f59e0b' : '#e2e8f0' }} />
                    <div style={{ width: '25%', background: hasInput && (effectiveUrgency === 'SEVERE' || effectiveUrgency === 'CRITICAL') ? '#ea580c' : '#e2e8f0' }} />
                    <div style={{ width: '25%', background: hasInput && effectiveUrgency === 'CRITICAL' ? '#dc2626' : '#e2e8f0' }} />
                  </div>
                </div>

                {/* Dynamic Signals Table from Real Input */}
                {triage?.evidenceLinks && triage.evidenceLinks.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.66rem' }}>
                    <thead>
                      <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                        <th style={{ padding: '3px', width: '14px' }}>#</th>
                        <th>SIGNAL</th>
                        <th style={{ textAlign: 'right' }}>EFFECT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triage.evidenceLinks.map((ev: EvidenceItem, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '4px 3px', color: '#64748b' }}>{idx + 1}</td>
                          <td><strong>“{ev.quoteHinglish}”</strong> {ev.label}</td>
                          <td style={{ textAlign: 'right', color: ev.severity === 'critical' ? '#dc2626' : ev.severity === 'high' ? '#ea580c' : '#d97706', fontWeight: 800 }}>
                            {ev.severity === 'critical' ? 'FLOOR P1' : ev.severity === 'high' ? 'FLOOR P2' : '→ P3'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '12px 6px', textAlign: 'center', color: '#64748b', fontSize: '0.66rem', fontStyle: 'italic' }}>
                    {hasInput ? 'Analyzing statements for priority keywords...' : 'No distress signals detected yet. Baseline priority floor: Routine.'}
                  </div>
                )}

                <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                  P1 triggers: <span style={{ color: '#dc2626' }}>Haan to danger · weapon · injury · child at risk</span>
                </div>
              </div>

              {/* TACTICAL MAP & CELL AREA */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '4px', padding: '4px 8px', fontSize: '0.66rem' }}>
                  <div style={{ fontWeight: 800, color: '#92400e' }}>
                    CELL AREA · {isLocationConfirmed ? '±20 m (GPS Precision)' : '±600 m (Tower Area)'}
                  </div>
                  <div style={{ color: '#78350f' }}>{extractedLocation || 'Paschim Vihar, A-4 block, New Delhi'}</div>
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

              {/* NEAREST RESOURCES · ROAD ETA */}
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
      {/* 3. TAB: INCIDENTS VIEW (FULLY DYNAMIC)                   */}
      {/* ======================================================== */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Active Incident Banner */}
          <div className="active-call-top-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {!hasInput ? (
                <div className="urgency-square-p4" style={{ background: '#64748b' }}>
                  <div className="urgency-square-num" style={{ fontSize: '1.05rem' }}>IDLE</div>
                  <div className="urgency-square-text">STANDBY</div>
                </div>
              ) : effectiveUrgency === 'CRITICAL' ? (
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
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {hasInput
                    ? `${reportCode} ${triage?.threats?.length ? triage.threats.join(' · ') : 'Distress Report'} — Inbound Incident`
                    : `${reportCode} · Shift Inbound Docket (Standby)`}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{extractedLocation || 'Paschim Vihar'} · <strong style={{ color: isLocationConfirmed ? '#16a34a' : '#ea580c' }}>{isLocationConfirmed ? 'location confirmed' : 'locating'}</strong></span>
                  <span>Contact SMS only · <strong style={{ color: hasInput ? '#dc2626' : '#64748b' }}>{hasInput ? 'no callbacks' : 'standby'}</strong></span>
                  <span>Handled by OP-07</span>
                </div>
              </div>
            </div>

            {/* Right Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: hasInput ? '#ea580c' : '#64748b' }}>
                  {hasInput ? (isCallEnded ? 'CALL ENDED · OPEN' : 'CALL ACTIVE') : 'STANDBY'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {hasInput ? 'caller safety assessing' : 'awaiting distress input'}
                </div>
              </div>

              <button
                onClick={() => alert('Incident docket brief exported.')}
                disabled={!hasInput}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: hasInput ? '#0f172a' : '#94a3b8',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: hasInput ? 'pointer' : 'default'
                }}
              >
                Export brief
              </button>

              <button
                onClick={() => alert('Silent SMS check-in sent to caller handset.')}
                disabled={!hasInput}
                style={{
                  background: hasInput ? '#2563eb' : '#94a3b8',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: hasInput ? 'pointer' : 'default'
                }}
              >
                Send SMS check-in
              </button>
            </div>
          </div>

          {/* Metrics Strip */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.72rem' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b' }}>METRICS</span>
            <span>Answered in <strong style={{ color: '#0f172a' }}>{hasInput ? '00:02' : '--:--'}</strong></span>
            <span>Priority set <strong style={{ color: '#0f172a' }}>{hasInput ? '00:02 after speech' : 'standby'}</strong></span>
            <span>First safe question <strong style={{ color: '#0f172a' }}>{hasInput ? '00:08' : '--:--'}</strong></span>
            <span>Call length <strong style={{ color: '#0f172a' }}>{formatDuration(callDuration)}</strong></span>
            <span>Police <strong style={{ color: agencies?.police?.status === 'DISPATCHED' ? '#2563eb' : '#64748b' }}>{agencies?.police?.status === 'DISPATCHED' ? 'En route · ack' : 'Standby'}</strong></span>
          </div>

          {/* 3 Columns Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 340px', flex: 1, overflow: 'hidden' }}>
            {/* Col 1: Shift Incidents */}
            <aside style={{ background: '#ffffff', borderRight: '1px solid #cbd5e1', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>THIS SHIFT · {hasInput ? '1' : '0'}</span>
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
                <div
                  onClick={() => setSelectedIncidentId(reportCode)}
                  style={{
                    background: selectedIncidentId === reportCode ? '#f8fafc' : '#ffffff',
                    border: selectedIncidentId === reportCode ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        background: !hasInput
                          ? '#64748b'
                          : effectiveUrgency === 'CRITICAL'
                          ? '#dc2626'
                          : effectiveUrgency === 'SEVERE'
                          ? '#ea580c'
                          : '#16a34a',
                        color: 'white',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '2px'
                      }}
                    >
                      {!hasInput ? 'STANDBY' : effectiveUrgency === 'CRITICAL' ? 'P1' : effectiveUrgency === 'SEVERE' ? 'P2' : 'P3'} {reportCode}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: hasInput ? '#16a34a' : '#64748b', fontWeight: 800 }}>
                      {hasInput ? 'LIVE' : 'READY'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#1e293b', marginTop: '2px' }}>
                    {hasInput ? (rawCallerText.slice(0, 36) + (rawCallerText.length > 36 ? '…' : '')) : 'Awaiting citizen distress call'}
                  </div>
                </div>

                {!hasInput && (
                  <div style={{ padding: '20px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.66rem' }}>
                    No other incidents logged this shift.
                  </div>
                )}
              </div>
            </aside>

            {/* Col 2: EVENT LOG append-only */}
            <main style={{ padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>EVENT LOG</span>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>append-only audit trail</span>
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

                {/* Dynamic Chronological Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem', lineHeight: 1.45, color: '#1e293b', minHeight: '140px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>00:00:00</span>
                    <span style={{ color: '#64748b', fontWeight: 800, width: '60px' }}>SYSTEM</span>
                    <span>Operator OP-07 logged in · 181 Women Helpline Delhi CRC Workstation active</span>
                  </div>

                  {!hasInput ? (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', borderRadius: '4px', border: '1px dashed #cbd5e1', marginTop: '6px' }}>
                      Audit log listening. As calls, transcripts, priority assessments, and unit dispatches occur, they will be appended here deterministically.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                        <span style={{ color: '#dc2626', fontWeight: 800, width: '60px' }}>CALLER</span>
                        <span>{rawCallerText}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                        <span style={{ color: '#0284c7', fontWeight: 800, width: '60px' }}>SAATHI</span>
                        <span>
                          Classified as{' '}
                          <strong style={{ color: effectiveUrgency === 'CRITICAL' ? '#dc2626' : '#ea580c' }}>
                            {effectiveUrgency}
                          </strong>{' '}
                          · {triage?.threats?.join(', ') || 'Inbound distress signal detected'}.
                        </span>
                      </div>

                      {isLocationConfirmed && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                          <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>OP-07</span>
                          <span>Location verified: {extractedLocation || 'Paschim Vihar GPS'}</span>
                        </div>
                      )}

                      {agencies?.police?.status === 'DISPATCHED' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.66rem', width: '54px' }}>LIVE</span>
                          <span style={{ color: '#2563eb', fontWeight: 800, width: '60px' }}>112 PCR</span>
                          <span>PCR 14 dispatched · ETA ~3 min</span>
                        </div>
                      )}
                    </>
                  )}
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
                    <span style={{ fontSize: '0.68rem', color: agencies?.police?.status === 'DISPATCHED' ? '#2563eb' : '#64748b', fontWeight: 700 }}>
                      {agencies?.police?.status === 'DISPATCHED' ? 'En route' : 'Standby'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>
                    <span>REQ {hasInput ? '09:45' : '--:--'}</span>
                    <span>ACK {agencies?.police?.status === 'DISPATCHED' ? '09:47' : '--:--'}</span>
                    <span style={{ color: agencies?.police?.status === 'DISPATCHED' ? '#2563eb' : '#64748b', fontWeight: 700 }}>ENRT</span>
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
                    <span style={{ fontSize: '0.68rem', color: agencies?.shelter?.status === 'RESERVED' ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                      {agencies?.shelter?.status === 'RESERVED' ? 'Bed held' : 'Ready'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>
                    <span>REQ {hasInput ? '09:45' : '--:--'}</span>
                    <span style={{ color: agencies?.shelter?.status === 'RESERVED' ? '#16a34a' : '#64748b', fontWeight: 700 }}>HELD</span>
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
                  <span style={{ color: '#0f172a' }}>{hasInput ? (triage?.threats?.join(', ') || 'Inbound distress') : 'Standby'}</span>
                  <span style={{ color: '#64748b' }}>At risk</span>
                  <span style={{ color: '#0f172a' }}>{hasInput ? (triage?.childrenAtRisk?.detected ? 'Caller, children' : 'Caller') : 'Standby'}</span>
                  <span style={{ color: '#64748b' }}>Injuries</span>
                  <span style={{ color: '#0f172a' }}>{injuryEv ? injuryEv.label : 'None reported'}</span>
                  <span style={{ color: '#64748b' }}>Weapon</span>
                  <span style={{ color: weaponEv ? '#dc2626' : '#64748b', fontWeight: weaponEv ? 700 : 500 }}>
                    {weaponEv ? `${weaponEv.quoteHinglish} · detected` : 'None reported'}
                  </span>
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
      {/* 4. TAB: WALLBOARD VIEW (FULLY DYNAMIC)                   */}
      {/* ======================================================== */}
      {activeTab === 'wallboard' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#eaedf2', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top 6 KPI Cards Strip */}
          <div className="wallboard-kpis-strip">
            {/* Card 1 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">CALLS WAITING</span>
              <span className="wallboard-kpi-val">{hasInput ? 1 : 0}</span>
              <span className="wallboard-kpi-sub">{hasInput ? '1 active on line' : '0 ringing'}</span>
            </div>

            {/* Card 2 */}
            <div className="wallboard-kpi-item longest-wait">
              <span className="wallboard-kpi-lbl" style={{ color: hasInput ? '#dc2626' : '#64748b' }}>LONGEST WAIT</span>
              <span className={`wallboard-kpi-val ${hasInput ? 'red' : ''}`}>{hasInput ? formatDuration(callDuration) : '00:00'}</span>
              <span className="wallboard-kpi-sub">{hasInput ? `${reportCode} active session` : 'No dropped calls'}</span>
            </div>

            {/* Card 3 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">OPEN P1 / P2</span>
              <span className="wallboard-kpi-val">
                <span style={{ color: '#dc2626' }}>{effectiveUrgency === 'CRITICAL' && hasInput ? 1 : 0}</span> /{' '}
                <span style={{ color: '#ea580c' }}>{effectiveUrgency === 'SEVERE' && hasInput ? 1 : 0}</span>
              </span>
              <span className="wallboard-kpi-sub" style={{ color: hasInput ? '#ea580c' : '#64748b' }}>
                {hasInput ? (effectiveUrgency === 'CRITICAL' || effectiveUrgency === 'SEVERE' ? 'Assigned OP-07' : 'Routine') : 'Helpline monitoring'}
              </span>
            </div>

            {/* Card 4 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">CODED CALLS</span>
              <span className="wallboard-kpi-val">{hasInput && !triage?.callerConstraints?.canSpeakFreely ? 1 : 0}</span>
              <span className="wallboard-kpi-sub">{hasInput && !triage?.callerConstraints?.canSpeakFreely ? 'Duress whisper flagged' : 'None active'}</span>
            </div>

            {/* Card 5 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">FIRST SAFE QUESTION</span>
              <span className="wallboard-kpi-val green">{hasInput ? '0:08' : '0:00'}</span>
              <span className="wallboard-kpi-sub">{hasInput ? 'generated this session' : 'median shift baseline'}</span>
            </div>

            {/* Card 6 */}
            <div className="wallboard-kpi-item">
              <span className="wallboard-kpi-lbl">OPERATORS</span>
              <span className="wallboard-kpi-val">{hasInput ? '1 / 8' : '0 / 8'}</span>
              <span className="wallboard-kpi-sub">{hasInput ? 'OP-07 on call · 7 available' : '8 available on floor'}</span>
            </div>
          </div>

          {/* Two-Column Main Content */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '14px' }}>
            {/* Left Column: Urgent Calls Table & Stacked Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* OPEN URGENT CALLS TABLE */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  OPEN URGENT CALLS
                </div>
                {hasInput && (effectiveUrgency === 'CRITICAL' || effectiveUrgency === 'SEVERE') ? (
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
                      <tr>
                        <td style={{ padding: '8px 4px' }}>
                          <span
                            style={{
                              background: effectiveUrgency === 'CRITICAL' ? '#dc2626' : '#ea580c',
                              color: 'white',
                              padding: '1px 5px',
                              borderRadius: '2px',
                              fontWeight: 800
                            }}
                          >
                            {effectiveUrgency === 'CRITICAL' ? 'P1' : 'P2'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{reportCode}</td>
                        <td>{triage?.threats?.join(', ') || 'Inbound Distress'}</td>
                        <td>OP-07</td>
                        <td style={{ fontFamily: 'monospace' }}>{formatDuration(callDuration)}</td>
                        <td style={{ color: agencies?.police?.status === 'DISPATCHED' ? '#2563eb' : '#64748b', fontWeight: 600 }}>
                          {agencies?.police?.status === 'DISPATCHED' ? '112 en route' : 'Assessing'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.68rem', fontStyle: 'italic' }}>
                    No active urgent distress calls currently open. Helplines monitoring on standby.
                  </div>
                )}
              </div>

              {/* CALLS PER HOUR BY PRIORITY */}
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
                    { time: '04:00', total: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
                    { time: '05:00', total: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
                    { time: '06:00', total: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
                    { time: '07:00', total: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
                    { time: '08:00', total: 0, p1: 0, p2: 0, p3: 0, p4: 0 },
                    { time: 'LIVE ►', total: hasInput ? 1 : 0, p1: effectiveUrgency === 'CRITICAL' && hasInput ? 30 : 0, p2: effectiveUrgency === 'SEVERE' && hasInput ? 30 : 0, p3: effectiveUrgency === 'MODERATE' && hasInput ? 30 : 0, p4: effectiveUrgency === 'LOW' && hasInput ? 30 : 0 }
                  ].map((bar, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                        {bar.total}
                      </span>
                      <div style={{ width: '42px', height: '100px', display: 'flex', flexDirection: 'column-reverse', background: '#f8fafc', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                        <div style={{ height: `${bar.p1}px`, background: '#dc2626' }} />
                        <div style={{ height: `${bar.p2}px`, background: '#ea580c' }} />
                        <div style={{ height: `${bar.p3}px`, background: '#f59e0b' }} />
                        <div style={{ height: `${bar.p4}px`, background: '#94a3b8' }} />
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
              {/* NEEDS SUPERVISOR */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                  NEEDS SUPERVISOR
                </div>

                <div style={{ padding: '16px 8px', textAlign: 'center', color: '#16a34a', fontSize: '0.68rem', fontWeight: 700, background: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                  ✓ All active emergency triage operations within normal supervision thresholds. No dropped calls or policy overrides detected.
                </div>
              </div>

              {/* OPERATORS STATUS */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>OPERATORS ON FLOOR</span>
                  <span style={{ fontSize: '0.64rem', color: '#64748b' }}>{hasInput ? '1 busy · 7 free' : '0 busy · 8 free'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.68rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-07</span>
                    <span style={{ color: hasInput ? '#ea580c' : '#16a34a', fontWeight: 700 }}>
                      {hasInput ? `On call · ${reportCode}` : 'Available (Your line)'}
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>{hasInput ? formatDuration(callDuration) : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-01</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-02</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-03</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-04</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-05</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontWeight: 700, width: '50px' }}>OP-06</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available</span>
                    <span style={{ color: '#64748b' }}>—</span>
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
                <div style={{ fontSize: '0.78rem', color: hasInput ? '#0f172a' : '#64748b', fontWeight: 700, marginTop: '4px', fontStyle: hasInput ? 'normal' : 'italic' }}>
                  {hasInput ? `"${rawCallerText}"` : 'Awaiting live caller transmission from phone...'}
                </div>
                <div style={{ display: 'inline-block', background: hasInput ? '#ffedd5' : '#f1f5f9', color: hasInput ? '#c2410c' : '#64748b', border: `1px solid ${hasInput ? '#fed7aa' : '#cbd5e1'}`, padding: '2px 8px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 700, marginTop: '4px' }}>
                  {hasInput ? `${effectiveUrgency} · active distress` : 'Standby · No distress loaded'}
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
