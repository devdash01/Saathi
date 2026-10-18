import React, { useState } from 'react';
import { X, Sparkles, VolumeX, HeartPulse, DoorOpen, Baby, MapPinOff, ArrowRight, ShieldCheck } from 'lucide-react';
import type { StructuredTriage, AgencyDispatchState } from '../types';
import { simulateWhatIf } from '../services/triageEngine';
import type { WhatIfModification } from '../services/triageEngine';

interface WhatIfSimulatorModalProps {
  onClose: () => void;
  baseTriage: StructuredTriage;
  baseAgencies: AgencyDispatchState;
}

export const WhatIfSimulatorModal: React.FC<WhatIfSimulatorModalProps> = ({
  onClose,
  baseTriage,
  baseAgencies
}) => {
  const [mods, setMods] = useState<WhatIfModification>({
    callerWentSilent: false,
    injuryRevealed: false,
    perpetratorBreached: false,
    locationAmbiguous: false,
    childCryingDetected: false
  });

  const toggleMod = (key: keyof WhatIfModification) => {
    setMods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { simulatedTriage, simulatedSafetyFloor, simulatedAgencies, explanation } = simulateWhatIf(
    baseTriage,
    baseAgencies,
    mods
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Sparkles size={22} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>WHAT-IF ANALYSIS SIMULATOR</h2>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Simulate emergency condition shifts and audit safety floor resilience in real time
              </div>
            </div>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls: Toggle Hypothetical Variables */}
          <div>
            <h3 style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Simulate Live Call Variations (Click to Toggle):
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {/* Variable 1 */}
              <button
                onClick={() => toggleMod('callerWentSilent')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: mods.callerWentSilent ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: mods.callerWentSilent ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: mods.callerWentSilent ? '#fca5a5' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <VolumeX size={18} color={mods.callerWentSilent ? '#ef4444' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Caller Goes Silent</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sudden silence / audio drop</div>
                </div>
              </button>

              {/* Variable 2 */}
              <button
                onClick={() => toggleMod('injuryRevealed')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: mods.injuryRevealed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: mods.injuryRevealed ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: mods.injuryRevealed ? '#fca5a5' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <HeartPulse size={18} color={mods.injuryRevealed ? '#ef4444' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Injury Revealed Later</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Physical trauma / bleeding</div>
                </div>
              </button>

              {/* Variable 3 */}
              <button
                onClick={() => toggleMod('perpetratorBreached')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: mods.perpetratorBreached ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: mods.perpetratorBreached ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: mods.perpetratorBreached ? '#fca5a5' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <DoorOpen size={18} color={mods.perpetratorBreached ? '#ef4444' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Perpetrator Breaches Door</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Forced boundary entry</div>
                </div>
              </button>

              {/* Variable 4 */}
              <button
                onClick={() => toggleMod('childCryingDetected')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: mods.childCryingDetected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: mods.childCryingDetected ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                  color: mods.childCryingDetected ? '#fde047' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Baby size={18} color={mods.childCryingDetected ? '#f59e0b' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Child Distress Acoustic</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Acoustic infant crying detected</div>
                </div>
              </button>

              {/* Variable 5 */}
              <button
                onClick={() => toggleMod('locationAmbiguous')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: mods.locationAmbiguous ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: mods.locationAmbiguous ? '1px solid #06b6d4' : '1px solid var(--border-subtle)',
                  color: mods.locationAmbiguous ? '#67e8f9' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <MapPinOff size={18} color={mods.locationAmbiguous ? '#06b6d4' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Location Drift / Ambiguity</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ambiguity climbs to 85%</div>
                </div>
              </button>
            </div>
          </div>

          {/* Decision Delta Comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '16px',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {/* Baseline */}
            <div>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>
                BASELINE TRIAGE
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>
                {baseTriage.urgencyLevel}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '6px' }}>
                Police: <strong>{baseAgencies.police.status}</strong> ({baseAgencies.police.priority})
              </div>
              <div style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
                Medical: <strong>{baseAgencies.medical.status}</strong>
              </div>
            </div>

            <div style={{ color: '#818cf8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ArrowRight size={24} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>MUTATION</span>
            </div>

            {/* Simulated Result */}
            <div>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '4px' }}>
                SIMULATED RESPONSE (WITH WHAT-IF)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
                {simulatedTriage.urgencyLevel}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '6px' }}>
                Police: <strong style={{ color: '#fca5a5' }}>{simulatedAgencies.police.status}</strong> ({simulatedAgencies.police.priority})
              </div>
              <div style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
                Medical: <strong style={{ color: '#fca5a5' }}>{simulatedAgencies.medical.status}</strong>
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              gap: '12px'
            }}
          >
            <ShieldCheck size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>
                Safety Floor Resilience Audit:
              </div>
              <div style={{ fontSize: '0.8rem', color: '#d1fae5', lineHeight: 1.5 }}>
                {explanation}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '6px' }}>
                Rule Enforced: <strong>{simulatedSafetyFloor.ruleName}</strong> (Cannot override downward)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
