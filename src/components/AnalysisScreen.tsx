import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Flame,
  Baby,
  HeartPulse,
  Navigation,
  Lock,
  AlertOctagon,
  Send,
  HelpCircle,
  Check,
  Smartphone,
  Eye,
  EyeOff,
  VolumeX,
  ShieldCheck,
  Download,
  Radio,
  Activity,
  Clock,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { TacticalEmergencyMap } from './TacticalEmergencyMap';
import type { StructuredTriage, SafetyFloor, AgencyDispatchState, SafeSignalQuestion } from '../types';
import type { EmergencyServiceEntity } from '../services/locationService';
import { simulateWhatIf, type WhatIfModification } from '../services/triageEngine';

interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'stt' | 'triage' | 'safesignal' | 'dispatch' | 'caller_response' | 'safety_floor';
}

interface AnalysisScreenProps {
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
  onBackToIntake: () => void;
  onDispatchAgency: (key: keyof AgencyDispatchState) => void;
  onApproveQuestion: (id: string) => void;
  onSendToCaller: (id: string) => void;
  onCallerAnswer: (questionId: string, answer: string) => void;
  onApplySimulation?: (triage: StructuredTriage, agencies: AgencyDispatchState) => void;
  scenarioId: string;
  initialTab?: 'dispatch' | 'safepath' | 'whatif' | 'continuity';
}

export const AnalysisScreen: React.FC<AnalysisScreenProps> = ({
  inputText,
  translatedText,
  extractedLocation,
  isExtractedFromSpeech,
  callerCoords,
  nearbyServices,
  triage,
  safetyFloor,
  agencies,
  questions,
  onBackToIntake,
  onDispatchAgency,
  onApproveQuestion,
  onSendToCaller,
  onCallerAnswer,
  onApplySimulation,
  scenarioId,
  initialTab = 'dispatch'
}) => {
  // Operational Workspace Tab
  const [activeTab, setActiveTab] = useState<'dispatch' | 'safepath' | 'whatif' | 'continuity'>(initialTab);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  // SafePath Phone Camouflage state
  const [phoneCamouflage, setPhoneCamouflage] = useState<boolean>(false);
  const [calcInput, setCalcInput] = useState<string>('248 + 152');

  // What-If live simulation state
  const [whatIfMods, setWhatIfMods] = useState<WhatIfModification>({
    callerWentSilent: false,
    injuryRevealed: false,
    perpetratorBreached: false,
    locationAmbiguous: false,
    childCryingDetected: false
  });

  // Incident continuity live audit timeline
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    {
      id: 'evt-1',
      timestamp: '00:01',
      title: 'Inbound Distress Stream Captured',
      description: 'Incoming Hinglish audio stream ingested via Sarvam AI Indic STT (saaras:v4).',
      type: 'stt'
    },
    {
      id: 'evt-2',
      timestamp: '00:02',
      title: 'Real-Time Neural Indic Translation',
      description: 'Sarvam AI neural model completed formal English translation within 280ms.',
      type: 'stt'
    },
    {
      id: 'evt-3',
      timestamp: '00:04',
      title: 'Spoken Location Extracted & Geocoded',
      description: `Target resolved to ${extractedLocation} (${callerCoords[0].toFixed(4)}, ${callerCoords[1].toFixed(4)}) via Nominatim GIS.`,
      type: 'triage'
    },
    {
      id: 'evt-4',
      timestamp: '00:06',
      title: `Safety Floor Enforced: ${safetyFloor.ruleId}`,
      description: `${safetyFloor.ruleName}. AI downward reclassification strictly blocked.`,
      type: 'safety_floor'
    }
  ]);

  // Handle What-If toggle
  const toggleWhatIf = (key: keyof WhatIfModification) => {
    setWhatIfMods(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const simulatedResult = simulateWhatIf(triage, agencies, whatIfMods);

  // Handle applying What-If directly to live CAD
  const handleApplyWhatIf = () => {
    if (onApplySimulation) {
      onApplySimulation(simulatedResult.simulatedTriage, simulatedResult.simulatedAgencies);
    }
    // Add timeline entry
    const newEvt: TimelineEvent = {
      id: `evt-${Date.now()}`,
      timestamp: '00:11',
      title: 'What-If Simulation Applied to Live CAD',
      description: simulatedResult.explanation,
      type: 'dispatch'
    };
    setTimelineEvents(prev => [...prev, newEvt]);
    setActiveTab('dispatch');
  };

  // SafePath: Caller tapping an answer on their phone screen
  const handlePhoneAnswer = (qId: string, answerText: string) => {
    onCallerAnswer(qId, answerText);
    const newEvt: TimelineEvent = {
      id: `evt-${Date.now()}`,
      timestamp: '00:10',
      title: `SafePath: Discrete Caller Response Received`,
      description: `Caller tapped: "${answerText}" under covert phone disguise.`,
      type: 'caller_response'
    };
    setTimelineEvents(prev => [...prev, newEvt]);
  };

  // Extract key phrases for real-world visual highlighting
  const getHighlightedKeywords = () => {
    const list: Array<{ word: string; category: string; label: string }> = [];
    const lower = (inputText + ' ' + (translatedText || '')).toLowerCase();

    if (lower.includes('ghar ke bahar') || lower.includes('bahar aa gaya') || lower.includes('bahar') || lower.includes('outside the house')) {
      list.push({ word: 'ghar ke bahar aa gaya', category: 'threat', label: 'Perimeter Threat' });
    }
    if (lower.includes('bachcha') || lower.includes('bacche') || lower.includes('child')) {
      list.push({ word: 'bachcha bhi mere saath', category: 'child', label: 'Child in Direct Danger' });
    }
    if (lower.includes('zyada der baat nahi') || lower.includes('baat nahi kar') || lower.includes('talk for long')) {
      list.push({ word: 'zyada der baat nahi kar sakti', category: 'safety', label: 'Speech Suppression' });
    }
    if (lower.includes('khoon') || lower.includes('sir') || lower.includes('blood') || lower.includes('bleeding')) {
      list.push({ word: 'sir se khoon nikal raha hai', category: 'injury', label: 'Active Bleeding' });
    }
    if (lower.includes('darwaza') || lower.includes('room') || lower.includes('band') || lower.includes('locked')) {
      list.push({ word: 'room bahar se band kar diya', category: 'threat', label: 'Confinement' });
    }
    if (lower.includes('auto') || lower.includes('galat') || lower.includes('sunsaan') || lower.includes('deserted')) {
      list.push({ word: 'galat sunsaan raste', category: 'threat', label: 'Transit Abduction' });
    }
    return list;
  };

  const detectedKeywords = getHighlightedKeywords();
  const sentQuestionCount = questions.filter(q => q.status === 'sent_to_caller').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ padding: '10px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBackToIntake}
          className="subtle-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Receive New Call / Audio Intake</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={13} color="#f87171" />
            <span>Target: <strong style={{ color: '#f8fafc' }}>{extractedLocation}</strong></span>
            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: isExtractedFromSpeech ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isExtractedFromSpeech ? '#38bdf8' : '#f59e0b', fontWeight: 600 }}>
              {isExtractedFromSpeech ? 'Spoken in Audio' : 'Cell Tower Triangulation'}
            </span>
          </span>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Triage SLA Met (&lt;10s)</span>
          </span>
        </div>
      </div>

      {/* Unified Operational Tabs Navigation Bar */}
      <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('dispatch')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'dispatch' ? '2px solid #ef4444' : '2px solid transparent',
              color: activeTab === 'dispatch' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Radio size={14} color={activeTab === 'dispatch' ? '#ef4444' : 'currentColor'} />
            <span>1. Tactical CAD & GIS Dispatch</span>
          </button>

          <button
            onClick={() => setActiveTab('safepath')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'safepath' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'safepath' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Smartphone size={14} color={activeTab === 'safepath' ? '#10b981' : 'currentColor'} />
            <span>2. SafePath Live Caller Channel</span>
            {sentQuestionCount > 0 && (
              <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'black', padding: '1px 6px', borderRadius: '9999px', fontWeight: 800 }}>
                {sentQuestionCount} ACTIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('whatif')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'whatif' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'whatif' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={14} color={activeTab === 'whatif' ? '#818cf8' : 'currentColor'} />
            <span>3. What-If Adaptive Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('continuity')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'continuity' ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeTab === 'continuity' ? '#f8fafc' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Clock size={14} color={activeTab === 'continuity' ? '#f59e0b' : 'currentColor'} />
            <span>4. Continuity & Audit Log</span>
            <span style={{ fontSize: '0.65rem', background: 'var(--border-medium)', color: 'var(--text-dim)', padding: '1px 6px', borderRadius: '9999px' }}>
              {timelineEvents.length}
            </span>
          </button>
        </div>

        {/* Live Acoustic Stress Telemetry Snippet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={12} color="#ef4444" />
            <span>Distress Score: <strong style={{ color: '#f87171' }}>86% Severe</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <VolumeX size={12} color="#38bdf8" />
            <span>Speech Mode: <strong style={{ color: '#38bdf8' }}>Whisper Suppressed</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={12} color="#10b981" />
            <span>Safety Floor: <strong style={{ color: '#34d399' }}>Locked (CRITICAL)</strong></span>
          </div>
        </div>
      </div>

      {/* TAB 1: TACTICAL CAD & GIS DISPATCH */}
      {activeTab === 'dispatch' && (
        <div className="main-workspace">
          {/* Column 1: Live Input Analysis, Keyword Extractor & Dynamic SafeSignal Questions */}
          <div className="workspace-col">
            {/* Incoming Utterance Analysis Header */}
            <div className="section-header">
              <span className="section-title">
                <Sparkles size={14} color="#38bdf8" />
                <span>Incoming Speech & Keyword Analysis</span>
              </span>
              <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'var(--accent-green-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                Sarvam AI saaras:v4 Transcribed
              </span>
            </div>

            {/* Transcript Box with Real Sarvam Translation */}
            <div className="transcript-section">
              <div className="transcript-quote-box">
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                  Analyzed Caller Utterance:
                </div>
                <div className="indic-text">
                  “{inputText}”
                </div>
                <div className="english-text">
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>Sarvam AI English Translation:</span> “{translatedText || 'Translating speech to English via Sarvam AI neural model...'}”
                </div>
              </div>

              {/* Extracted Keywords Row */}
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Extracted Red-Flag Keywords:
                </div>
                <div className="evidence-chips-row">
                  {detectedKeywords.map((kw, i) => (
                    <div
                      key={i}
                      className={`evidence-chip ${kw.category}`}
                      style={selectedKeyword === kw.word ? { borderColor: 'var(--accent-blue)', background: 'var(--bg-hover)' } : {}}
                      onClick={() => setSelectedKeyword(selectedKeyword === kw.word ? null : kw.word)}
                    >
                      <span style={{ fontWeight: 600 }}>{kw.label}:</span>
                      <span style={{ color: 'var(--text-muted)' }}>“{kw.word}”</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SafeSignal: Dynamic Situational Questions */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-title">
                  <HelpCircle size={14} color="#06b6d4" />
                  <span>SafeSignal: Dynamic Questions for Missing Info</span>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, background: 'var(--accent-green-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                  Situational & Context-Aware
                </span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Questions generated specifically for current emergency context. Approving and sending pushes live to caller's disguised SafePath mobile device:
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {questions.map((q) => {
                  const isApproved = q.status === 'approved' || q.status === 'sent_to_caller';
                  const isSent = q.status === 'sent_to_caller';

                  return (
                    <div
                      key={q.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: isSent ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                          {q.category.replace('_', ' ')} • {q.responseType.replace('_', ' ')}
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>{q.riskRating}</span>
                      </div>

                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {q.questionText}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {q.hinglishText}
                      </div>

                      {q.callerAnswer && (
                        <div
                          style={{
                            background: 'var(--accent-green-subtle)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '0.76rem',
                            color: '#6ee7b7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Caller Response Received: <strong>{q.callerAnswer}</strong></span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        {!isApproved && (
                          <button
                            className="subtle-btn"
                            onClick={() => onApproveQuestion(q.id)}
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            <Check size={11} color="#10b981" />
                            <span>Approve Question</span>
                          </button>
                        )}

                        {isApproved && !isSent && (
                          <button
                            className="subtle-btn"
                            onClick={() => {
                              onSendToCaller(q.id);
                              const newEvt: TimelineEvent = {
                                id: `evt-${Date.now()}`,
                                timestamp: '00:09',
                                title: 'SafeSignal Question Sent',
                                description: `Sent to caller phone: "${q.questionText}"`,
                                type: 'safesignal'
                              };
                              setTimelineEvents(prev => [...prev, newEvt]);
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.72rem', background: 'var(--accent-blue)', color: 'white', fontWeight: 700 }}
                          >
                            <Send size={11} />
                            <span>Send to SafePath Phone</span>
                          </button>
                        )}

                        {isSent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <Smartphone size={11} />
                              <span>Sent to SafePath Phone</span>
                            </span>
                            <button
                              onClick={() => setActiveTab('safepath')}
                              style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', cursor: 'pointer' }}
                            >
                              View on Phone →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column 2: Tactical GIS Map (Updated to Location) & Multi-Agency Dispatch */}
          <div className="workspace-col">
            {/* Tactical GIS Map */}
            <TacticalEmergencyMap
              scenarioId={scenarioId}
              callerCoords={callerCoords}
              locationAddress={extractedLocation}
              nearbyServices={nearbyServices}
              policeDispatched={agencies.police.status === 'DISPATCHED'}
              medicalDispatched={agencies.medical.status === 'DISPATCHED'}
            />

            {/* Triage Urgency & Safety Floor Lock */}
            <div className="triage-level-banner">
              <div className="level-indicator">
                <AlertOctagon size={24} color="#ef4444" />
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    Assessed Urgency Level
                  </div>
                  <div className="level-text">{triage.urgencyLevel} (TIER 1)</div>
                </div>
              </div>

              <div className="safety-floor-lock" title={safetyFloor.rationale}>
                <Lock size={12} />
                <span>Safety Floor Active: AI Cannot Downgrade</span>
              </div>
            </div>

            {/* Structured Intelligence Grid */}
            <div className="intel-grid">
              <div className="intel-block">
                <div className="intel-title">
                  <Flame size={12} color="#ef4444" />
                  <span>Threats & Proximity</span>
                </div>
                <div className="intel-value">
                  {triage.threats[0] || 'Suspect in immediate perimeter'}
                </div>
              </div>

              <div className="intel-block">
                <div className="intel-title">
                  <Baby size={12} color="#f59e0b" />
                  <span>Dependent at Risk</span>
                </div>
                <div className="intel-value" style={{ color: triage.childrenAtRisk.detected ? '#fcd34d' : 'var(--text-main)' }}>
                  {triage.childrenAtRisk.detected ? triage.childrenAtRisk.details : 'No minor dependents detected'}
                </div>
              </div>

              <div className="intel-block">
                <div className="intel-title">
                  <Navigation size={12} color="#06b6d4" />
                  <span>Extracted Audio Location</span>
                </div>
                <div className="intel-value">
                  {extractedLocation}
                </div>
              </div>

              <div className="intel-block">
                <div className="intel-title">
                  <HeartPulse size={12} color="#ec4899" />
                  <span>Medical Assessment</span>
                </div>
                <div className="intel-value">
                  {triage.injuries[0] || 'No overt physical trauma reported'}
                </div>
              </div>
            </div>

            {/* Real-time Nearby Help Services Proximity Matrix */}
            <div className="dispatch-actions-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Real-Time Nearby Help Services ({nearbyServices.length} Units Mapped)
                </div>
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                  Live GPS Geocoded
                </span>
              </div>

              <div className="dispatch-grid">
                {/* Police Service Card */}
                {nearbyServices.find(s => s.type === 'police') && (() => {
                  const s = nearbyServices.find(srv => srv.type === 'police')!;
                  const isDispatched = agencies.police.status === 'DISPATCHED';
                  return (
                    <button
                      className={`dispatch-btn ${isDispatched ? 'dispatched' : ''}`}
                      onClick={() => onDispatchAgency('police')}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                          PCR 112
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, display: 'flex', gap: '8px' }}>
                        <span>Distance: {s.distanceKm} km</span>
                        <span>ETA: {s.etaMins} mins</span>
                      </div>
                      <div className="dispatch-status" style={{ marginTop: '4px' }}>
                        {isDispatched ? `✓ Unit En Route (${s.etaMins}m ETA)` : `Dispatch Unit (${s.contactNumber})`}
                      </div>
                    </button>
                  );
                })()}

                {/* Medical Service Card */}
                {nearbyServices.find(s => s.type === 'hospital') && (() => {
                  const s = nearbyServices.find(srv => srv.type === 'hospital')!;
                  const isDispatched = agencies.medical.status === 'DISPATCHED';
                  return (
                    <button
                      className={`dispatch-btn ${isDispatched ? 'dispatched' : ''}`}
                      onClick={() => onDispatchAgency('medical')}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6' }}>
                          108 ALS
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#f472b6', fontWeight: 600, display: 'flex', gap: '8px' }}>
                        <span>Distance: {s.distanceKm} km</span>
                        <span>ETA: {s.etaMins} mins</span>
                      </div>
                      <div className="dispatch-status" style={{ marginTop: '4px' }}>
                        {isDispatched ? `✓ ALS Ambulance Deployed (${s.etaMins}m ETA)` : `Deploy 108 Ambulance (${s.contactNumber})`}
                      </div>
                    </button>
                  );
                })()}

                {/* Shelter Service Card */}
                {nearbyServices.find(s => s.type === 'shelter') && (() => {
                  const s = nearbyServices.find(srv => srv.type === 'shelter')!;
                  const isReserved = agencies.shelter.status === 'RESERVED';
                  return (
                    <button
                      className={`dispatch-btn ${isReserved ? 'dispatched' : ''}`}
                      onClick={() => onDispatchAgency('shelter')}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd' }}>
                          Sakhi 181
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 600, display: 'flex', gap: '8px' }}>
                        <span>Distance: {s.distanceKm} km</span>
                        <span>ETA: {s.etaMins} mins</span>
                      </div>
                      <div className="dispatch-status" style={{ marginTop: '4px' }}>
                        {isReserved ? '✓ Emergency Safe Bed Reserved' : `Reserve Shelter Bed (${s.contactNumber})`}
                      </div>
                    </button>
                  );
                })()}

                {/* Legal Aid Service Card */}
                {nearbyServices.find(s => s.type === 'legal') && (() => {
                  const s = nearbyServices.find(srv => srv.type === 'legal')!;
                  const isAssigned = agencies.legalAid.status === 'ASSIGNED';
                  return (
                    <button
                      className={`dispatch-btn ${isAssigned ? 'dispatched' : ''}`}
                      onClick={() => onDispatchAgency('legalAid')}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}>
                          DLSA 15100
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 600, display: 'flex', gap: '8px' }}>
                        <span>Distance: {s.distanceKm} km</span>
                        <span>Transit: {s.etaMins} mins</span>
                      </div>
                      <div className="dispatch-status" style={{ marginTop: '4px' }}>
                        {isAssigned ? '✓ Protection Officer Assigned' : `Assign Legal Officer (${s.contactNumber})`}
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SAFEPATH LIVE CALLER CHANNEL (TWO-WAY PHONE SIMULATOR) */}
      {activeTab === 'safepath' && (
        <div style={{ maxWidth: '840px', margin: '24px auto', width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={18} color="#10b981" />
                <span>SafePath: Live Caller Mobile Simulator</span>
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                This is the real-time view delivered silently to the caller's phone. SafeSignal questions sent from CAD appear directly here.
              </div>
            </div>

            <button
              onClick={() => setPhoneCamouflage(!phoneCamouflage)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                background: phoneCamouflage ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: phoneCamouflage ? 'white' : '#fca5a5',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {phoneCamouflage ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{phoneCamouflage ? 'Exit Disguise' : 'Quick Disguise (Calculator Mode)'}</span>
            </button>
          </div>

          {/* Smartphone Frame Container */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div style={{ width: '360px', height: '620px', background: '#090d16', border: '10px solid #1e293b', borderRadius: '36px', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              
              {/* Phone Speaker Notch */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '130px', height: '18px', background: '#1e293b', borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px', zIndex: 30 }} />

              {/* Status Bar */}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', zIndex: 20 }}>
                <span>02:14 AM</span>
                <span>LTE • 78%</span>
              </div>

              {/* Phone Content: Disguised Calculator */}
              {phoneCamouflage ? (
                <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'right', marginTop: '40px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{calcInput}</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 700, color: '#f8fafc' }}>400</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
                    {['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='].map((key, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (key === '=') setCalcInput('400');
                          else setCalcInput(prev => prev + key);
                        }}
                        style={{
                          height: '48px',
                          borderRadius: '50%',
                          background: key === '=' ? '#ef4444' : '#1e293b',
                          border: 'none',
                          color: 'white',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.65rem', textAlign: 'center', color: '#475569' }}>
                    Calculator Utility v2.4 (Covert Mode Active)
                  </div>
                </div>
              ) : (
                /* Phone Content: SafePath Reassurance & Live Questions */
                <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                  
                  {/* Reassurance Banner */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <ShieldCheck size={28} color="#10b981" style={{ margin: '0 auto 4px auto' }} />
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#6ee7b7' }}>HELP IS ACTIVE</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                      Police & Medical have received your location. Stay hidden and do not speak unless safe.
                    </div>
                  </div>

                  {/* Incoming SafeSignal Questions from CAD */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>
                      Emergency Questions from Dispatcher:
                    </div>

                    {questions.filter(q => q.status === 'sent_to_caller').length === 0 ? (
                      <div style={{ padding: '16px', borderRadius: '8px', background: '#1e293b', textAlign: 'center', color: '#64748b', fontSize: '0.74rem' }}>
                        No questions currently pending. Operator is dispatching emergency units.
                      </div>
                    ) : (
                      questions.filter(q => q.status === 'sent_to_caller').map(q => (
                        <div key={q.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                            {q.hinglishText || q.questionText}
                          </div>

                          {q.callerAnswer ? (
                            <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '6px', borderRadius: '4px' }}>
                              ✓ Answer Sent: {q.callerAnswer}
                            </div>
                          ) : (
                            /* Interactive Response Buttons for Caller */
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                              {q.responseType === 'covert_tap' ? (
                                <>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, '1 Tap: Vehicle Moving / Safe')}
                                    style={{ flex: 1, padding: '8px', background: '#0284c7', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    1 Tap (Moving)
                                  </button>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, '2 Taps: Threat Near / Cannot Speak')}
                                    style={{ flex: 1, padding: '8px', background: '#ef4444', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    2 Taps (Threat Near)
                                  </button>
                                </>
                              ) : q.responseType === 'yes_no_only' ? (
                                <>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, 'YES (Confirmed Safe / True)')}
                                    style={{ flex: 1, padding: '8px', background: '#10b981', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    YES
                                  </button>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, 'NO (Danger / False)')}
                                    style={{ flex: 1, padding: '8px', background: '#ef4444', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    NO
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, 'Locked from inside')}
                                    style={{ flex: 1, padding: '6px', background: '#334155', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.68rem', cursor: 'pointer' }}
                                  >
                                    Locked Inside
                                  </button>
                                  <button
                                    onClick={() => handlePhoneAnswer(q.id, 'Locked from outside')}
                                    style={{ flex: 1, padding: '6px', background: '#ef4444', border: 'none', borderRadius: '6px', color: 'white', fontSize: '0.68rem', cursor: 'pointer' }}
                                  >
                                    Locked Outside
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Responding Units Arrival ETA */}
                  <div style={{ marginTop: 'auto', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                      Responding Units Tracker:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#93c5fd' }}>
                        <span>Police Patrol DL-03:</span>
                        <strong>{agencies.police.status === 'DISPATCHED' ? 'En Route (3m)' : 'Standby'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6' }}>
                        <span>Medical 108 Ambulance:</span>
                        <strong>{agencies.medical.status === 'DISPATCHED' ? 'En Route (5m)' : 'Standby'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WHAT-IF ADAPTIVE INTELLIGENCE SANDBOX */}
      {activeTab === 'whatif' && (
        <div style={{ maxWidth: '900px', margin: '24px auto', width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#818cf8" />
              <span>What-If Adaptive Intelligence Sandbox</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Simulate call condition changes in real-time. Verify non-downgrade safety floor guardrails and push simulations directly to live CAD dispatch.
            </p>
          </div>

          {/* Condition Switches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <button
              onClick={() => toggleWhatIf('callerWentSilent')}
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: whatIfMods.callerWentSilent ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-elevated)',
                border: whatIfMods.callerWentSilent ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: whatIfMods.callerWentSilent ? '#fca5a5' : '#f8fafc' }}>
                1. Caller Sudden Silence
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tests rule SF-04: Urgency remains locked at CRITICAL to prevent abandonment.
              </div>
            </button>

            <button
              onClick={() => toggleWhatIf('injuryRevealed')}
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: whatIfMods.injuryRevealed ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-elevated)',
                border: whatIfMods.injuryRevealed ? '1px solid #ec4899' : '1px solid var(--border-subtle)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: whatIfMods.injuryRevealed ? '#f472b6' : '#f8fafc' }}>
                2. Acute Bleeding Revealed
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Escalates 108 Ambulance ALS unit priority to IMMEDIATE with siren routing.
              </div>
            </button>

            <button
              onClick={() => toggleWhatIf('perpetratorBreached')}
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: whatIfMods.perpetratorBreached ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-elevated)',
                border: whatIfMods.perpetratorBreached ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: whatIfMods.perpetratorBreached ? '#fca5a5' : '#f8fafc' }}>
                3. Inner Door Breached
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Alerts Police 112 tactical unit with sirens-off covert approach protocol.
              </div>
            </button>

            <button
              onClick={() => toggleWhatIf('childCryingDetected')}
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: whatIfMods.childCryingDetected ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-elevated)',
                border: whatIfMods.childCryingDetected ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: whatIfMods.childCryingDetected ? '#fcd34d' : '#f8fafc' }}>
                4. Child Distress Confirmed
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Notifies Sakhi One-Stop Crisis Centre for immediate trauma safe intake.
              </div>
            </button>
          </div>

          {/* Simulation Output Card */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Simulated Urgency & Safety Floor
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>
                  {simulatedResult.simulatedTriage.urgencyLevel} (TIER 1 OVERRIDE)
                </div>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '6px 14px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700 }}>
                Safety Floor Guardrail Active
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5, background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: '6px' }}>
              <strong>Triage Engine Analysis:</strong> {simulatedResult.explanation}
            </div>

            {/* Apply Action Button */}
            <button
              onClick={handleApplyWhatIf}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '8px',
                background: 'var(--accent-red)',
                color: 'white',
                border: 'none',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
              }}
            >
              <RefreshCw size={15} />
              <span>APPLY THIS SIMULATION TO LIVE CAD DISPATCH WORKFLOW</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: INCIDENT CONTINUITY & TIMELINE AUDIT */}
      {activeTab === 'continuity' && (
        <div style={{ maxWidth: '840px', margin: '24px auto', width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#f59e0b" />
                <span>Incident Continuity & Real-Time Audit Log</span>
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Immutable chronologic chain of call intake, STT transcription, safety floor locks, and multi-agency dispatch.
              </div>
            </div>

            <button
              onClick={() => {
                const dossier = `--- SAATHI EMERGENCY CAD DOSSIER ---\nIncident: Case ${scenarioId}\nTarget: ${extractedLocation}\nCoordinates: ${callerCoords[0]}, ${callerCoords[1]}\nUrgency: ${triage.urgencyLevel} (Safety Floor Locked)\nUtterance: ${inputText}\nEnglish Translation: ${translatedText}\n\nTimeline:\n${timelineEvents.map(e => `[${e.timestamp}] ${e.title}: ${e.description}`).join('\n')}\n\nNearby Units:\n${nearbyServices.map(s => `${s.name} (${s.distanceKm}km, ETA ${s.etaMins}m)`).join('\n')}`;
                const blob = new Blob([dossier], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SAATHI_CAD_DOSSIER_${scenarioId}.txt`;
                a.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-medium)',
                color: '#f8fafc',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
              <span>Export Handover Dossier</span>
            </button>
          </div>

          {/* Timeline Feed */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {timelineEvents.map((evt, idx) => (
              <div key={evt.id || idx} style={{ display: 'flex', gap: '14px', borderLeft: '2px solid var(--border-medium)', paddingLeft: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-5px', top: '3px', width: '8px', height: '8px', borderRadius: '50%', background: evt.type === 'safety_floor' ? '#ef4444' : evt.type === 'caller_response' ? '#10b981' : '#38bdf8' }} />
                
                <div style={{ minWidth: '50px', fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {evt.timestamp}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                    {evt.title}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {evt.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
