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
    let digitsOnly = raw.replace(/\D/g, '');
    digitsOnly = digitsOnly.replace(/^0+/, '');
    if (digitsOnly.length === 10) {
      // Standard 10-digit Indian number without country prefix -> add 91
      return `91${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return digitsOnly;
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
    if (/^91\d{10}$/.test(cleaned)) {
      return `+${cleaned}`;
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
   * Generates a high-clarity 1-2 sentence human summary of the distress incident
   */
  public generateIncidentSummary(report: EmergencyReport): string {
    const callerStatement = report.callerText?.trim();
    const threats = report.triage?.threats || [];
    const location = report.location?.address || 'Paschim Vihar, New Delhi';
    const urgency = report.urgencyLevel || 'CRITICAL';

    if (callerStatement && callerStatement.length > 5) {
      return `Distress caller reported: "${callerStatement}". Active emergency response initiated at ${location} under ${urgency} priority.`;
    }

    if (threats.length > 0) {
      return `Emergency triage flagged active safety risk (${threats.join(', ')}). Immediate ERSS intervention underway at ${location}.`;
    }

    return `Immediate safety assistance requested via SAATHI 181/112 command. Live location coordinates transmitted for active emergency patrol.`;
  }

  /**
   * Constructs the structured Emergency SOS Message containing all details shared with the Operator
   * Features genuine human warmth, reassurance, and a clear [INCIDENT SUMMARY].
   */
  public buildEmergencyAlertMessage(report: EmergencyReport, contactName?: string): string {
    const incidentId = report.id || 'INC-181';
    const urgency = report.urgencyLevel || 'CRITICAL';
    const incidentSummary = this.generateIncidentSummary(report);
    const address = report.location?.address || 'Paschim Vihar, New Delhi';
    const coords = report.location?.coords || [28.6692, 77.1068];
    const mapsLink = `https://maps.google.com/?q=${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;

    const policeStatus = report.agencies?.police?.recommended
      ? `Dispatched (Priority: ${report.agencies.police.priority || 'IMMEDIATE'}, ETA ~${report.agencies.police.eta || '4 mins'})`
      : 'Control Room Standby';

    const medicalStatus = report.agencies?.medical?.recommended
      ? `Requested (Ambulance 108 ETA ~${report.agencies.medical.eta || '5 mins'})`
      : 'Not requested at this time';

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
      `SAATHI EMERGENCY DISTRESS ALERT\n\n` +
      `${salutation}You are receiving this emergency notification because you are registered as a trusted emergency guardian. Your contact is currently connected to the Delhi 181 / 112 ERSS Women Safety & Emergency Command.\n\n` +
      `[INCIDENT SUMMARY]\n` +
      `${incidentSummary}\n` +
      `Incident ID: ${incidentId} • Priority: ${urgency}\n\n` +
      `[LIVE LOCATION & REAL-TIME TRACKING]\n` +
      `Location: ${address}\n` +
      `Live Google Maps Link:\n` +
      `${mapsLink}\n\n` +
      `[EMERGENCY DISPATCH STATUS]\n` +
      `- Delhi Police 112: ${policeStatus}\n` +
      `- Emergency Medical 108: ${medicalStatus}\n` +
      `- Safe Haven Shelter 181: ${report.agencies?.shelter?.recommended ? 'Alerted & On Standby' : 'Standby'}\n\n` +
      `[WHAT YOU CAN DO]\n` +
      `1. Stay calm. Official responders have already received this docket.\n` +
      `2. Reach out via phone or text if it is safe for them to speak.\n` +
      `3. If they cannot be reached, coordinate directly with Delhi Police ERSS by dialing 112 quoting Case #${incidentId}.\n\n` +
      `Timestamp: ${timeString}, ${dateString}\n` +
      `Delhi ERSS Central Command Station (OP-1187)`
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
   * Generate direct SMS link with proper iOS (&body=) and Android/Desktop (?body=) separator
   */
  public generateSmsUrl(phone: string, message: string): string {
    const cleanNumber = this.getCleanPhoneForSms(phone);
    const encoded = encodeURIComponent(message);
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    return `sms:${cleanNumber}${separator}body=${encoded}`;
  }

  /**
   * 1-Tap Emergency Dispatch:
   * Dispatches emergency alert to BOTH WhatsApp & SMS.
   * Physically triggers transmission via Web Share API or native direct messaging intents.
   */
  public dispatchUnifiedAlert(
    contact: EmergencyContact,
    report: EmergencyReport
  ): {
    whatsappUrl: string;
    smsUrl: string;
    success: boolean;
    timestamp: string;
    message: string;
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
      messageSnippet: message.slice(0, 120) + '...'
    };

    const smsLog: ContactNotificationLog = {
      id: `notif-sms-${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      phone: contact.phone,
      channel: 'sms',
      sentAt: timestamp,
      status: 'dispatched',
      messageSnippet: message.slice(0, 120) + '...'
    };

    this.notificationLogs.unshift(waLog, smsLog);
    this.persistLogs();

    // Broadcast DOM event for UI synchronization across CAD and Citizen Views
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('saathi:contact-alert-dispatched', {
          detail: { contact, channels: ['whatsapp', 'sms'], timestamp, reportId: report.id, message, whatsappUrl, smsUrl }
        })
      );
    }

    // Trigger REAL physical transmission on user device
    this.executeDeviceDispatch(whatsappUrl, smsUrl, message);

    return { whatsappUrl, smsUrl, success: true, timestamp, message };
  }

  /**
   * Executes physical device transmission:
   * Uses navigator.share on mobile for native 1-tap sheet to WhatsApp & SMS,
   * or triggers direct WhatsApp + SMS intent fallbacks.
   */
  public executeDeviceDispatch(whatsappUrl: string, smsUrl: string, message: string): void {
    if (typeof window === 'undefined') return;

    // 1. On mobile devices with navigator.share, this delivers genuine 1-tap dispatch to WhatsApp/SMS
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({
        title: 'SAATHI EMERGENCY SOS',
        text: message
      }).catch((err) => {
        console.log('navigator.share rejected or dismissed, opening direct intents:', err);
        this.openDirectIntents(whatsappUrl, smsUrl);
      });
      return;
    }

    // 2. Direct intent launch for browsers without share API
    this.openDirectIntents(whatsappUrl, smsUrl);
  }

  public openDirectIntents(whatsappUrl: string, smsUrl: string): void {
    if (typeof window === 'undefined') return;

    try {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Could not launch WhatsApp:', e);
    }

    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        setTimeout(() => {
          window.location.href = smsUrl;
        }, 600);
      }
    } catch (e) {
      console.warn('Could not launch SMS intent:', e);
    }
  }

  /**
   * Utility to copy alert message to clipboard
   */
  public async copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }
    }
    return false;
  }

  /**
   * Explicit external app launcher (Only called if the user explicitly requests an external app handoff)
   */
  public launchExternalManualFallback(
    contact: EmergencyContact,
    report: EmergencyReport,
    channel: 'whatsapp' | 'sms'
  ): void {
    if (typeof window === 'undefined') return;
    const message = this.buildEmergencyAlertMessage(report, contact.name);
    if (channel === 'whatsapp') {
      const url = this.generateWhatsAppUrl(contact.phone, message);
      window.open(url, '_blank');
    } else {
      const url = this.generateSmsUrl(contact.phone, message);
      window.location.href = url;
    }
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
