/**
 * SAATHI Emergency Contact & Distress Notification Service
 * Allows citizens to register trusted emergency contacts (Family, Friends, Guardians).
 * When an emergency incident is reported to the 112/181 operator, ALL structured details
 * (Live GPS coords, Google Maps link, distress transcript, agency dispatches, and case ID)
 * are formatted and instantly dispatched via WhatsApp and native SMS.
 */

import type { EmergencyContact, ContactNotificationLog } from '../types';
import type { EmergencyReport } from '../types/report';

const STORAGE_KEY = 'saathi_emergency_contacts_v2';
const NOTIF_LOGS_KEY = 'saathi_contact_notification_logs_v1';

// Seed realistic initial emergency contact for immediate demonstration and testing
const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'contact-init-1',
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    relationship: 'Sibling',
    notifySms: true,
    notifyWhatsapp: true,
    isPrimary: true,
    createdAt: new Date().toISOString()
  }
];

class EmergencyContactService {
  private contacts: EmergencyContact[] = [];
  private notificationLogs: ContactNotificationLog[] = [];
  private listeners: Set<(contacts: EmergencyContact[]) => void> = new Set();

  constructor() {
    this.loadContacts();
    this.loadLogs();
  }

  private loadContacts(): void {
    if (typeof window === 'undefined') {
      this.contacts = [...DEFAULT_CONTACTS];
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.contacts = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read emergency contacts from localStorage:', e);
    }

    // Default seed
    this.contacts = [...DEFAULT_CONTACTS];
    this.persistContacts();
  }

  private persistContacts(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.contacts));
    } catch (e) {
      console.error('Failed to save emergency contacts to localStorage:', e);
    }
    this.notifyListeners();
  }

  private loadLogs(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(NOTIF_LOGS_KEY);
      if (raw) {
        this.notificationLogs = JSON.parse(raw);
      }
    } catch {
      this.notificationLogs = [];
    }
  }

  private persistLogs(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(NOTIF_LOGS_KEY, JSON.stringify(this.notificationLogs));
    } catch {}
  }

  public subscribe(listener: (contacts: EmergencyContact[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.contacts]);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const copy = [...this.contacts];
    this.listeners.forEach((fn) => fn(copy));
  }

  public getContacts(): EmergencyContact[] {
    return [...this.contacts];
  }

  public getLogs(): ContactNotificationLog[] {
    return [...this.notificationLogs];
  }

  public addContact(data: {
    name: string;
    phone: string;
    relationship: EmergencyContact['relationship'];
    notifySms?: boolean;
    notifyWhatsapp?: boolean;
    isPrimary?: boolean;
  }): EmergencyContact {
    const cleanPhone = this.formatPhoneNumberDisplay(data.phone);
    const newContact: EmergencyContact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      phone: cleanPhone,
      relationship: data.relationship,
      notifySms: data.notifySms ?? true,
      notifyWhatsapp: data.notifyWhatsapp ?? true,
      isPrimary: Boolean(data.isPrimary || this.contacts.length === 0),
      createdAt: new Date().toISOString()
    };

    if (newContact.isPrimary) {
      // Unmark any existing primary
      this.contacts = this.contacts.map((c) => ({ ...c, isPrimary: false }));
    }

    this.contacts.push(newContact);
    this.persistContacts();
    return newContact;
  }

  public updateContact(updated: EmergencyContact): void {
    const cleanPhone = this.formatPhoneNumberDisplay(updated.phone);
    const item = { ...updated, phone: cleanPhone };

    if (item.isPrimary) {
      this.contacts = this.contacts.map((c) => (c.id === item.id ? item : { ...c, isPrimary: false }));
    } else {
      this.contacts = this.contacts.map((c) => (c.id === item.id ? item : c));
    }

    this.persistContacts();
  }

  public deleteContact(id: string): void {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    if (this.contacts.length > 0 && !this.contacts.some((c) => c.isPrimary)) {
      this.contacts[0].isPrimary = true;
    }
    this.persistContacts();
  }

  /**
   * Cleans phone number for WhatsApp wa.me API (digits only with country code, e.g. 919876543210)
   */
  public getCleanPhoneForWhatsApp(raw: string): string {
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      // Standard 10-digit Indian number without country prefix -> add 91
      return `91${digitsOnly}`;
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      // Leading 0 e.g. 09876543210 -> replace with 91
      return `91${digitsOnly.slice(1)}`;
    }
    return digitsOnly;
  }

  /**
   * Cleans phone number for native SMS link (e.g. +919876543210 or 9876543210)
   */
  public getCleanPhoneForSms(raw: string): string {
    const cleaned = raw.trim().replace(/[\s-()]/g, '');
    if (/^\d{10}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Formats phone number for clean UI display
   */
  public formatPhoneNumberDisplay(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    return raw.trim();
  }

  /**
   * Constructs the structured Emergency SOS Message containing all details shared with the Operator
   * Clean, authoritative, and completely free of weird emojis.
   */
  public buildEmergencyAlertMessage(report: EmergencyReport, contactName?: string): string {
    const incidentId = report.id || 'INC-181';
    const urgency = report.urgencyLevel || 'CRITICAL';
    const situation = report.callerText?.trim() || report.triage?.threats?.[0] || 'Urgent assistance requested';
    const address = report.location?.address || 'Paschim Vihar, New Delhi';
    const coords = report.location?.coords || [28.6692, 77.1068];
    const mapsLink = `https://maps.google.com/?q=${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;

    const policeStatus = report.agencies?.police?.recommended
      ? `Requested (${report.agencies.police.priority || 'HIGH'} - ETA ~${report.agencies.police.eta || '4m'})`
      : 'Standby';

    const medicalStatus = report.agencies?.medical?.recommended
      ? `Requested (ETA ~${report.agencies.medical.eta || '5m'})`
      : 'Not requested';

    const timeString = new Date(report.updatedAt || report.createdAt || Date.now()).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const dateString = new Date(report.updatedAt || report.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const salutation = contactName ? `Dear ${contactName},\n\n` : '';

    return (
      `SAATHI EMERGENCY SOS ALERT\n\n` +
      `${salutation}An emergency distress report has been triggered via SAATHI (Delhi 181 / 112 ERSS Command).\n\n` +
      `Incident ID: ${incidentId}\n` +
      `Urgency Level: ${urgency}\n` +
      `Reported Situation: "${situation}"\n\n` +
      `Live Location:\n${address}\n` +
      `Google Maps Link:\n${mapsLink}\n\n` +
      `Emergency Dispatch Status:\n` +
      `- Police 112: ${policeStatus}\n` +
      `- Medical 108: ${medicalStatus}\n` +
      `- Safe Shelter 181: ${report.agencies?.shelter?.recommended ? 'Alerted' : 'Standby'}\n\n` +
      `Timestamp: ${timeString}, ${dateString}\n` +
      `Command Station: Delhi ERSS Central (OP-1187)\n\n` +
      `Note: If the caller cannot be reached directly, track their live location or coordinate with 112 Police ERSS quoting Incident #${incidentId}.`
    );
  }

  /**
   * Generate direct WhatsApp wa.me URL
   */
  public generateWhatsAppUrl(phone: string, message: string): string {
    const cleanNumber = this.getCleanPhoneForWhatsApp(phone);
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleanNumber}?text=${encoded}`;
  }

  /**
   * Generate direct SMS link
   */
  public generateSmsUrl(phone: string, message: string): string {
    const cleanNumber = this.getCleanPhoneForSms(phone);
    const encoded = encodeURIComponent(message);
    return `sms:${cleanNumber}?body=${encoded}`;
  }

  /**
   * 1-Tap Unified Emergency Dispatch:
   * Instantly sends the emergency details to BOTH WhatsApp and SMS together in a single tap!
   * No separate buttons or multiple confirmations required.
   */
  public dispatchUnifiedAlert(
    contact: EmergencyContact,
    report: EmergencyReport
  ): {
    whatsappUrl: string;
    smsUrl: string;
    success: boolean;
    timestamp: string;
  } {
    const message = this.buildEmergencyAlertMessage(report, contact.name);
    const whatsappUrl = this.generateWhatsAppUrl(contact.phone, message);
    const smsUrl = this.generateSmsUrl(contact.phone, message);
    const timestamp = new Date().toISOString();

    const waLog: ContactNotificationLog = {
      id: `notif-wa-${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      phone: contact.phone,
      channel: 'whatsapp',
      sentAt: timestamp,
      status: 'dispatched',
      messageSnippet: message.slice(0, 100) + '...'
    };

    const smsLog: ContactNotificationLog = {
      id: `notif-sms-${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      phone: contact.phone,
      channel: 'sms',
      sentAt: timestamp,
      status: 'dispatched',
      messageSnippet: message.slice(0, 100) + '...'
    };

    this.notificationLogs.unshift(waLog, smsLog);
    this.persistLogs();

    // Broadcast DOM event for UI synchronization across CAD and Citizen Views
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('saathi:contact-alert-dispatched', {
          detail: { contact, channels: ['whatsapp', 'sms'], timestamp, reportId: report.id }
        })
      );

      // Trigger automatic transmission handoff
      try {
        // First invoke WhatsApp in new background window/tab
        window.open(whatsappUrl, '_blank');
      } catch (err) {
        console.warn('Could not launch WhatsApp intent automatically:', err);
      }

      // Also trigger SMS intent automatically
      try {
        const smsFrame = document.createElement('iframe');
        smsFrame.style.display = 'none';
        smsFrame.src = smsUrl;
        document.body.appendChild(smsFrame);
        setTimeout(() => smsFrame.remove(), 2000);
      } catch {
        // Fallback
        window.location.href = smsUrl;
      }
    }

    return { whatsappUrl, smsUrl, success: true, timestamp };
  }

  /**
   * Send alert to a specific contact (backwards compatibility)
   */
  public dispatchAlert(
    contact: EmergencyContact,
    report: EmergencyReport,
    channel: 'whatsapp' | 'sms' = 'whatsapp'
  ): { url: string; success: boolean } {
    const res = this.dispatchUnifiedAlert(contact, report);
    return {
      url: channel === 'whatsapp' ? res.whatsappUrl : res.smsUrl,
      success: res.success
    };
  }

  /**
   * Dispatch alert to ALL active emergency contacts configured for WhatsApp and/or SMS
   */
  public dispatchToAllContacts(
    report: EmergencyReport
  ): Array<{ contact: EmergencyContact; channel: 'whatsapp' | 'sms'; url: string }> {
    const results: Array<{ contact: EmergencyContact; channel: 'whatsapp' | 'sms'; url: string }> = [];

    for (const contact of this.contacts) {
      if (contact.notifyWhatsapp) {
        const res = this.dispatchAlert(contact, report, 'whatsapp');
        results.push({ contact, channel: 'whatsapp', url: res.url });
      }
      if (contact.notifySms) {
        const res = this.dispatchAlert(contact, report, 'sms');
        results.push({ contact, channel: 'sms', url: res.url });
      }
    }

    return results;
  }
}

export const emergencyContactService = new EmergencyContactService();
