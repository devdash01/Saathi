import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  VolumeX,
  PhoneOff
} from 'lucide-react';
import type { AgencyDispatchState } from '../types';

interface SafePathModalProps {
  onClose: () => void;
  agencies: AgencyDispatchState;
}

export const SafePathModal: React.FC<SafePathModalProps> = ({ onClose, agencies }) => {
  const [camouflage, setCamouflage] = useState<boolean>(false);
  const [safeToSpeak, setSafeToSpeak] = useState<string>('no');
  const [safeCallback, setSafeCallback] = useState<string>('no_call');
  const [correctedLocation, setCorrectedLocation] = useState<string>('');
  const [locationSent, setLocationSent] = useState<boolean>(false);
  const [calcInput, setCalcInput] = useState<string>('124 + 86');

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <ShieldCheck size={22} color="#10b981" />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>SAFEPATH: CALLER REASSURANCE PORTAL</h2>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Encrypted mobile channel delivered via silent SMS / Web link
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Quick Camouflage Toggle */}
            <button
              onClick={() => setCamouflage(!camouflage)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: camouflage ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: camouflage ? 'white' : '#fca5a5',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Instantly disguise app as calculator or recipe if someone approaches!"
            >
              {camouflage ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{camouflage ? 'Exit Disguise' : 'Quick Disguise (Covert)'}</span>
            </button>

            <button className="close-modal-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ background: '#090d16', padding: '24px 16px' }}>
          {/* Mobile Shell Simulation */}
          <div className="mobile-device-shell">
            <div className="mobile-notch" />

            {camouflage ? (
              /* CAMOUFLAGE SCREEN (CALCULATOR / RECIPE / WEATHER) */
              <div className="camouflage-screen">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Simple Calculator</span>
                  <button
                    onClick={() => setCamouflage(false)}
                    style={{ fontSize: '0.7rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    (Tap twice to return)
                  </button>
                </div>

                <div
                  style={{
                    background: '#e2e8f0',
                    padding: '14px',
                    borderRadius: '8px',
                    textAlign: 'right',
                    fontSize: '1.4rem',
                    fontFamily: 'monospace',
                    marginBottom: '16px',
                    color: '#0f172a'
                  }}
                >
                  {calcInput}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
                    <button
                      key={btn}
                      style={{
                        padding: '12px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#1e293b'
                      }}
                      onClick={() => {
                        if (btn === 'C') setCalcInput('');
                        else if (btn === '=') setCalcInput('210');
                        else setCalcInput((prev) => prev + btn);
                      }}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* REAL SAFEPATH PORTAL SCREEN */
              <div className="mobile-screen-content">
                {/* Status Bar Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    padding: '10px 14px',
                    borderRadius: '12px'
                  }}
                >
                  <ShieldCheck size={20} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                      You Have Been Heard
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                      Helpline Case ID: #DL-90412 • Secure Channel
                    </div>
                  </div>
                </div>

                {/* Transparent Dispatch Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Transparent Action Pipeline
                  </div>

                  <div className="timeline-list">
                    {/* Step 1 */}
                    <div className="timeline-step completed">
                      <div className="timeline-step-dot" />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                        1. Distress Call Triaged in 00:08s
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Critical danger signs recognized. Rule-based safety floor active.
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="timeline-step completed">
                      <div className="timeline-step-dot" />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                        2. Dedicated Operator Assigned
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Operator #OP-449 coordinating emergency services.
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="timeline-step completed">
                      <div className="timeline-step-dot" style={{ background: '#ef4444' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fca5a5' }}>
                        3. Police Alert Dispatched (112)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                        {agencies.police.unitType} • ETA ~{agencies.police.eta || '4 mins'}
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="timeline-step">
                      <div className="timeline-step-dot" style={{ background: '#64748b' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>
                        4. Ground Unit Arrival & Safe Contact
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Officers will arrive discreetly without sirens to protect your safety.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Realistic Reassurance Notice */}
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    color: '#bfdbfe',
                    lineHeight: 1.45
                  }}
                >
                  <strong>What happens next:</strong> Please remain locked inside with your child. Do not confront anyone outside. Updates are verified in real-time.
                </div>

                {/* Safety Mode Controls for Caller */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8' }}>
                    YOUR CURRENT SAFETY PREFERENCES:
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setSafeToSpeak(safeToSpeak === 'no' ? 'yes' : 'no')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        background: safeToSpeak === 'no' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: safeToSpeak === 'no' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: safeToSpeak === 'no' ? '#fca5a5' : '#cbd5e1',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <VolumeX size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {safeToSpeak === 'no' ? 'Cannot Speak (Whisper/Mute)' : 'Safe to Speak'}
                    </button>

                    <button
                      onClick={() => setSafeCallback(safeCallback === 'no_call' ? 'can_call' : 'no_call')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        background: safeCallback === 'no_call' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: safeCallback === 'no_call' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: safeCallback === 'no_call' ? '#fca5a5' : '#cbd5e1',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <PhoneOff size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {safeCallback === 'no_call' ? 'Do NOT Call (SMS Only)' : 'Callback Safe'}
                    </button>
                  </div>
                </div>

                {/* Location Correction Feature */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    Need to correct apartment / floor number?
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="e.g. Flat 402, 4th Floor rear stairs"
                      value={correctedLocation}
                      onChange={(e) => setCorrectedLocation(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: 'white',
                        fontSize: '0.75rem'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (correctedLocation) setLocationSent(true);
                      }}
                      style={{
                        padding: '6px 10px',
                        background: '#3b82f6',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {locationSent ? 'Updated' : 'Send'}
                    </button>
                  </div>

                  {locationSent && (
                    <span style={{ fontSize: '0.7rem', color: '#34d399' }}>
                      ✓ Updated location dispatched directly to responding unit
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
