import React from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Radio,
  UserCheck
} from 'lucide-react';

interface HeaderProps {
  activeView: 'dashboard' | 'whatif' | 'stresslab' | 'safepath' | 'continuity';
  setActiveView: (view: 'dashboard' | 'whatif' | 'stresslab' | 'safepath' | 'continuity') => void;
  piiMasked: boolean;
  setPiiMasked: (masked: boolean) => void;
  simulatedTimeRemaining: number;
  sarvamStatus: 'connected' | 'transcribing' | 'idle' | 'error';
  sarvamLatency?: number;
}

export const Header: React.FC<HeaderProps> = ({
  piiMasked,
  setPiiMasked,
  sarvamStatus,
  sarvamLatency = 280
}) => {
  return (
    <header className="top-nav">
      <div className="nav-brand-section">
        <div className="brand-icon-box">
          <ShieldAlert size={18} />
        </div>
        <div className="brand-title">
          <span>SAATHI</span>
          <span className="brand-tag">Helpline Triage Console</span>
        </div>
      </div>

      <div className="nav-center-telemetry">
        <div className="nav-system-status-pill">
          <span className="live-dot-green" />
          <span>SYSTEM ACTIVE • AI-ASSISTED TRIAGE & MULTI-AGENCY COORDINATION</span>
        </div>

        <div className="nav-sarvam-status-pill">
          <Radio size={13} color="#10b981" />
          <span>Sarvam AI saaras:v4 ({sarvamStatus === 'transcribing' ? 'Processing...' : `${sarvamLatency}ms`})</span>
        </div>
      </div>

      <div className="nav-right-actions">
        <div className="nav-duty-desk">
          <UserCheck size={13} />
          <span>OP-449 (Duty Desk)</span>
        </div>

        <button
          className="subtle-btn"
          onClick={() => setPiiMasked(!piiMasked)}
          title="Toggle PII Masking"
        >
          {piiMasked ? <Lock size={12} color="#10b981" /> : <Unlock size={12} color="#ef4444" />}
          <span>{piiMasked ? 'PII Protected' : 'PII Revealed'}</span>
        </button>
      </div>
    </header>
  );
};
