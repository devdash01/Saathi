import React, { useState } from 'react';
import { X, History, AlertTriangle, UserCheck, MapPin, Phone, Calendar } from 'lucide-react';
import { MOCK_INCIDENT_HISTORY } from '../data/mockScenarios';
import type { IncidentRecord } from '../types';

interface IncidentContinuityModalProps {
  onClose: () => void;
  piiMasked: boolean;
}

export const IncidentContinuityModal: React.FC<IncidentContinuityModalProps> = ({ onClose, piiMasked }) => {
  const [incidents] = useState<IncidentRecord[]>(MOCK_INCIDENT_HISTORY);
  const [patternVerified, setPatternVerified] = useState<boolean>(false);

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <History size={22} color="#f59e0b" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>INCIDENT CONTINUITY & PATTERN RECOGNITION</h2>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Preserving critical response history across call drops & correlating repeat incidents
              </div>
            </div>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Repeat Caller Alert Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.05) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#f59e0b" />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fde047' }}>
                  CORRELATED REPEAT INCIDENT PATTERN DETECTED
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  fontWeight: 700
                }}
              >
                CONFIDENCE: 94% CORRELATION
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#fef3c7', lineHeight: 1.5 }}>
              Current caller (<strong>{piiMasked ? '+91 98*** **412' : '+91 98101 44412'}</strong>) matches an earlier distress report recorded <strong>8 days ago</strong> in Rohini Sector 16. Threat profile has escalated from verbal harassment to immediate residential perimeter stalking.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(245, 158, 11, 0.2)',
                paddingTop: '10px'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#fde047', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={patternVerified}
                  onChange={(e) => setPatternVerified(e.target.checked)}
                />
                <span>Operator Human Verification: Confirm linkage to historical case #DEL-2026-89104</span>
              </label>

              {patternVerified && (
                <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                  ✓ Pattern Verified by Operator
                </span>
              )}
            </div>
          </div>

          {/* Incident Timeline Cards */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '12px' }}>
              Historical Incident Records for Sector & Caller Hash
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>
                        Case {inc.caseId}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: inc.urgency === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: inc.urgency === 'CRITICAL' ? '#fca5a5' : '#fcd34d'
                        }}
                      >
                        {inc.urgency}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{inc.status}</span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} />
                      <span>{inc.timestamp}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="#f87171" />
                      <span>{inc.locationArea}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} color="#94a3b8" />
                      <span>{piiMasked ? inc.callerPhoneMasked : '+91 98101 44412'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserCheck size={13} color="#34d399" />
                      <span>{inc.officerAssigned}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', background: 'rgba(0, 0, 0, 0.25)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    {inc.continuityNotes}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {inc.keyPhrases.map((phrase, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.7rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#94a3b8'
                        }}
                      >
                        “{phrase}”
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
