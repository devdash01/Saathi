import React from 'react';
import {
  AlertOctagon,
  Lock,
  Send,
  Flame,
  Baby,
  Navigation,
  HeartPulse
} from 'lucide-react';
import type { StructuredTriage, SafetyFloor, AgencyDispatchState } from '../types';

interface TriageSummaryCardProps {
  triage: StructuredTriage;
  safetyFloor: SafetyFloor;
  agencies: AgencyDispatchState;
  onDispatchAgency: (agencyKey: keyof AgencyDispatchState) => void;
}

export const TriageSummaryCard: React.FC<TriageSummaryCardProps> = ({
  triage,
  safetyFloor,
  agencies,
  onDispatchAgency
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Triage Level & Safety Floor Lock */}
      <div className="triage-level-banner">
        <div className="level-indicator">
          <AlertOctagon size={24} color="#ef4444" />
          <div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
              AI Triage Assessment
            </div>
            <div className="level-text">{triage.urgencyLevel} (TIER 1)</div>
          </div>
        </div>

        <div className="safety-floor-lock" title={safetyFloor.rationale}>
          <Lock size={12} />
          <span>Safety Floor Locked: AI Downgrade Blocked</span>
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
            {triage.childrenAtRisk.detected ? triage.childrenAtRisk.details : 'No dependents reported'}
          </div>
        </div>

        <div className="intel-block">
          <div className="intel-title">
            <Navigation size={12} color="#06b6d4" />
            <span>Access Point & Address</span>
          </div>
          <div className="intel-value">
            {triage.location.detectedAddress}
          </div>
        </div>

        <div className="intel-block">
          <div className="intel-title">
            <HeartPulse size={12} color="#ec4899" />
            <span>Medical Assessment</span>
          </div>
          <div className="intel-value">
            {triage.injuries[0] || 'No physical trauma reported yet'}
          </div>
        </div>
      </div>

      {/* 1-Click CAD Dispatch Matrix */}
      <div className="dispatch-actions-container">
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Multi-Agency CAD Actions
        </div>

        <div className="dispatch-grid">
          {/* Police 112 */}
          <button
            className={`dispatch-btn ${agencies.police.status === 'DISPATCHED' ? 'dispatched' : ''}`}
            onClick={() => onDispatchAgency('police')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Police 112 (Tactical Unit)</span>
              <Send size={12} />
            </div>
            <div className="dispatch-status">
              {agencies.police.status === 'DISPATCHED' ? `Dispatched (ETA ${agencies.police.eta || '3m'})` : 'Click to Dispatch 112'}
            </div>
          </button>

          {/* Medical 108 */}
          <button
            className={`dispatch-btn ${agencies.medical.status === 'DISPATCHED' ? 'dispatched' : ''}`}
            onClick={() => onDispatchAgency('medical')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Medical 108 (ALS)</span>
              <Send size={12} />
            </div>
            <div className="dispatch-status">
              {agencies.medical.status === 'DISPATCHED' ? `Dispatched (ETA ${agencies.medical.eta || '5m'})` : 'Click to Deploy 108'}
            </div>
          </button>

          {/* Shelter OSC */}
          <button
            className={`dispatch-btn ${agencies.shelter.status === 'RESERVED' ? 'dispatched' : ''}`}
            onClick={() => onDispatchAgency('shelter')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Shelter (One-Stop Centre)</span>
              <Send size={12} />
            </div>
            <div className="dispatch-status">
              {agencies.shelter.status === 'RESERVED' ? 'Bed Reserved' : 'Hold Emergency Bed'}
            </div>
          </button>

          {/* Legal Aid */}
          <button
            className={`dispatch-btn ${agencies.legalAid.status === 'ASSIGNED' ? 'dispatched' : ''}`}
            onClick={() => onDispatchAgency('legalAid')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Legal Aid (DLSA)</span>
              <Send size={12} />
            </div>
            <div className="dispatch-status">
              {agencies.legalAid.status === 'ASSIGNED' ? 'Counsel Assigned' : 'Assign Protection Officer'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
