import React, { useState } from 'react';
import {
  PhoneCall,
  MessageSquare,
  ShieldAlert,
  AlertTriangle,
  X,
  Radio,
  Clock,
  ExternalLink,
  Users
} from 'lucide-react';
import {
  VERIFIED_INDIAN_HELPLINES,
  OFFLINE_LIFE_SAFETY_INSTRUCTIONS,
  generateEmergencySmsLink
} from '../services/emergencyFallbackService';
import { emergencyContactService } from '../services/emergencyContactService';

interface EmergencyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSituation: string;
  currentLocation: string;
}

export const EmergencyHelpModal: React.FC<EmergencyHelpModalProps> = ({
  isOpen,
  onClose,
  currentSituation,
  currentLocation
}) => {
  const [activeTab, setActiveTab] = useState<'call' | 'sms' | 'contact' | 'helplines' | 'offline'>('call');
  const [smsConfirmed, setSmsConfirmed] = useState(false);
  const contacts = emergencyContactService.getContacts();

  if (!isOpen) return null;

  const { smsUrl, formattedMessage } = generateEmergencySmsLink(
    '112',
    currentSituation || 'Immediate safety assistance required',
    currentLocation || 'Location unavailable'
  );

  return (
    <div className="emergency-modal-backdrop" onClick={onClose}>
      <div className="emergency-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Modal Grabber Handle */}
        <div className="emergency-sheet-handle" />

        {/* Modal Header */}
        <div className="emergency-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="emergency-icon-pill">
              <ShieldAlert size={16} color="#ffffff" />
            </div>
            <div>
              <h2 className="emergency-modal-title">EMERGENCY ASSISTANCE (112)</h2>
              <p className="emergency-modal-subtitle">Official Fallback When Internet Is Unavailable</p>
            </div>
          </div>
          <button onClick={onClose} className="emergency-close-btn" title="Close">
            <X size={18} color="#94a3b8" />
          </button>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="emergency-truth-banner">
          <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>
            <strong>PLATFORM NOTICE:</strong> A web app cannot guarantee delivery without cellular or Wi-Fi data. Telephone calls to <strong>112</strong> use direct cellular circuits and work without internet.
          </span>
        </div>

        {/* Fallback Method Navigation Tabs */}
        <div className="emergency-tab-strip">
          <button
            onClick={() => setActiveTab('call')}
            className={`emergency-tab-btn ${activeTab === 'call' ? 'active' : ''}`}
          >
            <PhoneCall size={13} />
            <span>1. Call 112</span>
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`emergency-tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
          >
            <MessageSquare size={13} />
            <span>2. SMS 112</span>
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`emergency-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
          >
            <Users size={13} />
            <span>Contacts</span>
          </button>
          <button
            onClick={() => setActiveTab('helplines')}
            className={`emergency-tab-btn ${activeTab === 'helplines' ? 'active' : ''}`}
          >
            <Radio size={13} />
            <span>Helplines</span>
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`emergency-tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
          >
            <Clock size={13} />
            <span>Safety Guide</span>
          </button>
        </div>

        {/* Tab 1: Direct 112 Telephone Call */}
        {activeTab === 'call' && (
          <div className="emergency-tab-body">
            <div className="emergency-call-card">
              <div className="call-card-badge">DIRECT CELLULAR CALL (NO DATA REQUIRED)</div>
              <h3 className="call-card-number">112</h3>
              <p className="call-card-desc">
                National Emergency Response Support System (ERSS) India.
                Tapping the button below opens your phone dialer with 112 pre-dialed.
              </p>

              <a href="tel:112" className="emergency-direct-call-btn">
                <PhoneCall size={18} />
                <span>TAP TO CALL 112 NOW</span>
              </a>

              <div className="call-card-disclaimer">
                <span>
                  • Does not require internet or mobile data.
                  <br />
                  • Works in "Emergency Calls Only" mode even with no SIM card balance.
                  <br />
                  • Saathi does not silently place calls without your deliberate tap.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Verified SMS Fallback */}
        {activeTab === 'sms' && (
          <div className="emergency-tab-body">
            <div className="emergency-sms-card">
              <div className="sms-card-title">Native SMS Fallback to 112</div>
              <p className="sms-card-sub">
                Review this prefilled distress message. Tapping opens your phone's SMS app. You must press "Send" in your native messaging app.
              </p>

              <div className="emergency-sms-preview">
                <div className="sms-to-badge">To: 112 (ERSS India)</div>
                <div className="sms-text-content">{formattedMessage}</div>
              </div>

              <a
                href={smsUrl}
                onClick={() => setSmsConfirmed(true)}
                className="emergency-direct-sms-btn"
              >
                <MessageSquare size={16} />
                <span>OPEN NATIVE SMS APP (112)</span>
                <ExternalLink size={14} />
              </a>

              {smsConfirmed && (
                <div className="sms-confirmed-notice">
                  <span>
                    ✓ Handoff opened. Please verify that your SMS app dispatched the text.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2.5: Personal Emergency Contacts SOS */}
        {activeTab === 'contact' && (
          <div className="emergency-tab-body">
            <div className="emergency-sms-card">
              <div className="sms-card-title">Personal Emergency Contacts SOS</div>
              <p className="sms-card-sub">
                Send prefilled SOS distress message with your location to your personal emergency contact via SMS or WhatsApp even offline.
              </p>

              {contacts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' }}>
                  {contacts.map((c) => {
                    const smsPayload = `EMERGENCY ALERT: I need immediate assistance.\nSituation: ${currentSituation || 'Emergency distress'}\nLocation: ${currentLocation || 'Unknown'}\nPlease reach out or coordinate with 112 ERSS.`;
                    const cleanPhone = emergencyContactService.getCleanPhoneForSms(c.phone);
                    const waPhone = emergencyContactService.getCleanPhoneForWhatsApp(c.phone);
                    const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(smsPayload)}`;
                    const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(smsPayload)}`;

                    return (
                      <div
                        key={c.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#0f172a' }}>
                            {c.name} <span style={{ fontSize: '0.66rem', color: '#64748b' }}>({c.relationship})</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#475569' }}>{c.phone}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#25D366',
                              color: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={smsLink}
                            style={{
                              background: '#0284c7',
                              color: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <PhoneCall size={12} />
                            <span>SMS</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.74rem' }}>
                  No emergency contacts configured.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Verified Helplines Directory */}
        {activeTab === 'helplines' && (
          <div className="emergency-tab-body helplines-scroll">
            <div className="helplines-list">
              {VERIFIED_INDIAN_HELPLINES.map((h) => (
                <div key={h.number} className="helpline-entry-row">
                  <div className="helpline-meta">
                    <div className="helpline-name">
                      {h.name} <span className="helpline-badge">{h.is24x7 ? '24x7' : ''}</span>
                    </div>
                    <div className="helpline-desc">{h.description}</div>
                  </div>
                  <a href={`tel:${h.number}`} className="helpline-dial-btn" title={`Call ${h.number}`}>
                    <PhoneCall size={14} />
                    <span>{h.number}</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Offline Life Safety Instructions */}
        {activeTab === 'offline' && (
          <div className="emergency-tab-body offline-scroll">
            <div className="offline-guide-list">
              {OFFLINE_LIFE_SAFETY_INSTRUCTIONS.map((item, idx) => (
                <div key={idx} className="offline-guide-card">
                  <div className="guide-card-header">
                    <span className="guide-step-num">{idx + 1}</span>
                    <span className="guide-step-title">{item.title}</span>
                  </div>
                  <p className="guide-step-desc">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Close */}
        <div className="emergency-modal-footer">
          <button onClick={onClose} className="emergency-return-btn">
            Return to SAATHI SafePath Screen
          </button>
        </div>
      </div>
    </div>
  );
};
