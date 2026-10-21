import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  MessageSquare,
  AlertTriangle,
  X,
  Trash2,
  CheckCircle,
  Copy,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  emergencyContactService
} from '../services/emergencyContactService';
import type { EmergencyContact, ContactRelationship, ContactNotificationLog } from '../types';
import type { EmergencyReport } from '../types/report';

interface EmergencyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeReport?: EmergencyReport;
  onAlertDispatched?: (contact: EmergencyContact, channel: 'whatsapp' | 'sms') => void;
}

const RELATIONSHIPS: ContactRelationship[] = [
  'Parent',
  'Spouse',
  'Sibling',
  'Child',
  'Friend',
  'Relative',
  'Guardian',
  'Colleague',
  'Other'
];

export const EmergencyContactModal: React.FC<EmergencyContactModalProps> = ({
  isOpen,
  onClose,
  activeReport,
  onAlertDispatched
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => emergencyContactService.getContacts());
  const [logs, setLogs] = useState<ContactNotificationLog[]>(() => emergencyContactService.getLogs());
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'preview' | 'logs'>('list');

  // Form State for Adding / Editing
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRel, setFormRel] = useState<ContactRelationship>('Sibling');
  const [formNotifyWhatsapp, setFormNotifyWhatsapp] = useState(true);
  const [formNotifySms, setFormNotifySms] = useState(true);
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copy indicator for live preview
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Subscribe to changes in contacts and logs
  useEffect(() => {
    const unsub = emergencyContactService.subscribe((updated) => {
      setContacts(updated);
      setLogs(emergencyContactService.getLogs());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Please enter the contact\'s full name.');
      return;
    }
    const digitsOnly = formPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setFormError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    emergencyContactService.addContact({
      name: formName.trim(),
      phone: formPhone.trim(),
      relationship: formRel,
      notifyWhatsapp: formNotifyWhatsapp,
      notifySms: formNotifySms,
      isPrimary: formIsPrimary
    });

    // Reset form
    setFormName('');
    setFormPhone('');
    setFormRel('Sibling');
    setFormNotifyWhatsapp(true);
    setFormNotifySms(true);
    setFormIsPrimary(false);
    setFormError(null);
    setActiveTab('list');
  };

  const handleDeleteContact = (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from your trusted emergency contacts?`)) {
      emergencyContactService.deleteContact(id);
    }
  };

  const handleDispatchAlert = (contact: EmergencyContact, channel: 'whatsapp' | 'sms') => {
    if (!activeReport) {
      alert('No active emergency report found to dispatch.');
      return;
    }

    const res = emergencyContactService.dispatchAlert(contact, activeReport, channel);
    if (onAlertDispatched) {
      onAlertDispatched(contact, channel);
    }
    setLogs(emergencyContactService.getLogs());
    if (res.success) {
      setActiveTab('logs');
    }
  };

  const sampleReportForPreview: EmergencyReport = activeReport || {
    id: 'SA-2024-1187',
    idempotencyKey: 'idemp-sample',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lifecycleState: 'submitted',
    statusMessage: 'Live emergency triage active.',
    callerText: 'Mujhe madad chahiye, ghar ke bahar 2 log peecha kar rahe hain.',
    location: {
      address: 'Paschim Vihar, New Delhi',
      coords: [28.6692, 77.1068],
      accuracyMeters: 15,
      isLiveStreaming: true,
      source: 'live_gps',
      lastUpdated: new Date().toISOString()
    },
    triage: {
      urgencyLevel: 'CRITICAL',
      threats: ['Immediate physical threat', 'Stalking at residence'],
      injuries: ['No overt physical trauma'],
      location: {
        raw: 'Paschim Vihar',
        detectedAddress: 'Paschim Vihar, New Delhi',
        confidence: 0.95,
        ambiguityScore: 5,
        landmarks: ['Near Metro Gate 2']
      },
      childrenAtRisk: { detected: false, details: 'None' },
      callerConstraints: { canSpeakFreely: false, whispering: true, silenceLikely: false, backgroundThreatPresent: true },
      missingDetails: [],
      evidenceLinks: []
    },
    safetyFloor: {
      active: true,
      ruleId: 'SF-01',
      ruleName: 'Perpetrator Immediate Proximity',
      enforcedLevel: 'CRITICAL',
      originalAILevel: 'CRITICAL',
      rationale: 'Active stalking with physical threat',
      cannotOverrideDownward: false
    },
    aiConfidence: { score: 0.98, isUncertain: false, rationale: 'High clarity speech signal' },
    urgencyLevel: 'CRITICAL',
    agencies: {
      police: { recommended: true, unitType: 'PCR Van PV-12', priority: 'IMMEDIATE', status: 'REQUESTED', eta: '4m' },
      medical: { recommended: false, priority: 'NONE', status: 'NOT_REQUESTED' },
      shelter: { recommended: true, shelterName: 'Safe Haven OSC', availableBeds: 4, status: 'STANDBY' },
      legalAid: { recommended: false, counselorType: 'DLSA', status: 'NOT_REQUESTED' }
    },
    questions: [],
    auditTrail: [],
    retryCount: 0
  };

  const previewMessage = emergencyContactService.buildEmergencyAlertMessage(
    sampleReportForPreview,
    primaryContact?.name || 'Contact'
  );

  const handleCopyPreview = () => {
    navigator.clipboard?.writeText(previewMessage);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  return (
    <div className="emergency-modal-backdrop" onClick={onClose}>
      <div
        className="emergency-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Grabber Handle */}
        <div className="emergency-sheet-handle" />

        {/* Modal Header */}
        <div className="emergency-modal-header" style={{ paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 className="emergency-modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                  EMERGENCY CONTACTS (SOS)
                </h2>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                >
                  WhatsApp &amp; SMS
                </span>
              </div>
              <p className="emergency-modal-subtitle" style={{ margin: '2px 0 0', fontSize: '0.72rem' }}>
                Operator CAD details are automatically mirrored to your trusted circle
              </p>
            </div>
          </div>
          <button onClick={onClose} className="emergency-close-btn" title="Close">
            <X size={18} color="#94a3b8" />
          </button>
        </div>

        {/* Active Emergency Banner if report is active */}
        {activeReport && (activeReport.callerText || activeReport.triage.threats.length > 0) && (
          <div
            style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              border: '1.5px solid #f87171',
              borderRadius: '10px',
              padding: '10px 12px',
              margin: '0 16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} color="#dc2626" />
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#991b1b' }}>
                  ACTIVE DISTRESS REPORT · {activeReport.id || 'INC-181'}
                </span>
              </div>
              <span
                style={{
                  background: '#b91c1c',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {activeReport.urgencyLevel}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#7f1d1d', lineHeight: 1.35 }}>
              Tap below to dispatch current Live GPS, transcript, and Police 112 ETA to{' '}
              <strong>{primaryContact?.name || 'Emergency Contact'}</strong>:
            </div>
            {primaryContact && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                <button
                  onClick={() => handleDispatchAlert(primaryContact, 'whatsapp')}
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37,211,102,0.3)'
                  }}
                >
                  <MessageSquare size={13} />
                  <span>Send WhatsApp Alert</span>
                </button>
                <button
                  onClick={() => handleDispatchAlert(primaryContact, 'sms')}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(2,132,199,0.3)'
                  }}
                >
                  <Phone size={13} />
                  <span>Send SMS Alert</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Strip */}
        <div className="emergency-tab-strip" style={{ margin: '0 16px 12px' }}>
          <button
            onClick={() => setActiveTab('list')}
            className={`emergency-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          >
            <Users size={13} />
            <span>Contacts ({contacts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`emergency-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          >
            <UserPlus size={13} />
            <span>+ Add Contact</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`emergency-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          >
            <Sparkles size={13} />
            <span>Alert Preview</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`emergency-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          >
            <Clock size={13} />
            <span>History ({logs.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {/* TAB 1: CONTACTS LIST */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {contacts.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1.5px dashed #cbd5e1'
                  }}
                >
                  <Users size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#334155' }}>
                    No Emergency Contacts Added Yet
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', maxWidth: '300px', margin: '4px auto 12px' }}>
                    Add trusted family or friends who should be immediately alerted via WhatsApp and SMS during an emergency.
                  </div>
                  <button
                    onClick={() => setActiveTab('add')}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add First Emergency Contact
                  </button>
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      background: '#ffffff',
                      border: contact.isPrimary ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      boxShadow: contact.isPrimary ? '0 2px 8px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: contact.isPrimary ? '#dbeafe' : '#f1f5f9',
                            color: contact.isPrimary ? '#1d4ed8' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem'
                          }}
                        >
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                              {contact.name}
                            </span>
                            {contact.isPrimary && (
                              <span
                                style={{
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  fontSize: '0.58rem',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span>{contact.relationship}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{contact.phone}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteContact(contact.id, contact.name)}
                        title="Remove contact"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Channels & Direct Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {contact.notifyWhatsapp && (
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            WhatsApp ✓
                          </span>
                        )}
                        {contact.notifySms && (
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            SMS ✓
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleDispatchAlert(contact, 'whatsapp')}
                          style={{
                            background: '#25D366',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 9px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Send WhatsApp Alert"
                        >
                          <MessageSquare size={12} />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          onClick={() => handleDispatchAlert(contact, 'sms')}
                          style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 9px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Send Native SMS"
                        >
                          <Phone size={12} />
                          <span>SMS</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <button
                onClick={() => setActiveTab('add')}
                style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px',
                  color: '#2563eb',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}
              >
                <UserPlus size={14} />
                <span>+ Add Another Emergency Contact</span>
              </button>
            </div>
          )}

          {/* TAB 2: ADD CONTACT FORM */}
          {activeTab === 'add' && (
            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {formError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#b91c1c',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Mobile Phone Number *
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Indian 10-digit mobile numbers are automatically formatted with +91 country prefix.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Relationship
                </label>
                <select
                  value={formRel}
                  onChange={(e) => setFormRel(e.target.value as ContactRelationship)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    outline: 'none',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notification Channel Toggles */}
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                  AUTOMATIC DISPATCH CHANNELS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formNotifyWhatsapp}
                      onChange={(e) => setFormNotifyWhatsapp(e.target.checked)}
                      style={{ accentColor: '#25D366' }}
                    />
                    <span>Notify via WhatsApp (Direct text with GPS Map Link)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formNotifySms}
                      onChange={(e) => setFormNotifySms(e.target.checked)}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <span>Notify via Native SMS (Offline cellular text fallback)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px' }}>
                    <input
                      type="checkbox"
                      checked={formIsPrimary}
                      onChange={(e) => setFormIsPrimary(e.target.checked)}
                      style={{ accentColor: '#2563eb' }}
                    />
                    <span style={{ fontWeight: 600 }}>Set as Primary Emergency Contact</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '9px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Save Emergency Contact
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ALERT PREVIEW */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>
                  STRUCTURED SOS PAYLOAD SENT TO CONTACT
                </span>
                <button
                  onClick={handleCopyPreview}
                  style={{
                    background: copiedPreview ? '#dcfce7' : '#f1f5f9',
                    color: copiedPreview ? '#15803d' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Copy size={11} />
                  <span>{copiedPreview ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              <div
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  border: '1px solid #334155',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}
              >
                {previewMessage}
              </div>

              <div style={{ fontSize: '0.68rem', color: '#64748b', background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                💡 <strong>Every detail shared with the Operator</strong> is delivered to this contact, including exact live GPS coordinates, Google Maps clickable link, caller statement, Police 112 dispatch ETA, and ERSS CAD case identifier.
              </div>
            </div>
          )}

          {/* TAB 4: DISPATCH HISTORY LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '0.76rem' }}>
                  No emergency alerts dispatched yet in this session.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a' }}>
                          {log.contactName}
                        </span>
                        <span
                          style={{
                            background: log.channel === 'whatsapp' ? '#dcfce7' : '#e0f2fe',
                            color: log.channel === 'whatsapp' ? '#15803d' : '#0369a1',
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px'
                          }}
                        >
                          {log.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '2px' }}>
                        {log.phone} • {new Date(log.sentAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.64rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle size={12} />
                      <span>Dispatched</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="emergency-modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '10px 16px' }}>
          <button onClick={onClose} className="emergency-return-btn">
            Done &amp; Return to SAATHI
          </button>
        </div>
      </div>
    </div>
  );
};
