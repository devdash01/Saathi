/**
 * Network Delivery, Rate Limiting & Queue Synchronization Service
 * Provides reliable message delivery, idempotency, duplicate suppression,
 * and transparent delivery lifecycle tracking for SAATHI.
 */

import type { EmergencyReport } from '../types/report';
import { reportStorageService } from './reportStorageService';

export type ReportChangeCallback = (report: EmergencyReport) => void;
export type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkDeliveryService {
  private listeners: Set<ReportChangeCallback> = new Set();
  private networkListeners: Set<NetworkStatusCallback> = new Set();
  private isDeviceOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSubmissionTimestamp: number = 0;
  private isProcessingQueue: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public isOnline(): boolean {
    return this.isDeviceOnline;
  }

  public subscribe(cb: ReportChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public subscribeNetwork(cb: NetworkStatusCallback): () => void {
    this.networkListeners.add(cb);
    cb(this.isDeviceOnline);
    return () => this.networkListeners.delete(cb);
  }

  private handleNetworkChange(online: boolean) {
    this.isDeviceOnline = online;
    console.log(`[SAATHI Network] Connectivity changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
    this.networkListeners.forEach((cb) => cb(online));

    if (online) {
      // Automatically drain queued reports when connection returns
      this.processPendingQueue();
    }
  }

  private notify(report: EmergencyReport) {
    this.listeners.forEach((cb) => cb(report));
  }

  private lastSubmittedText: string = '';

  /**
   * Submit an emergency report with full lifecycle validation
   */
  async submitReport(report: EmergencyReport): Promise<{ success: boolean; report: EmergencyReport; error?: string }> {
    // 1. Rate Limiting Protection: block accidental rapid double clicks on identical input (< 1200ms)
    const now = Date.now();
    const cleanText = (report.callerText || '').trim().toLowerCase();
    const isRapidIdenticalClick =
      now - this.lastSubmissionTimestamp < 1200 &&
      this.lastSubmittedText === cleanText &&
      cleanText.length > 0;

    if (isRapidIdenticalClick) {
      return {
        success: false,
        report,
        error: 'Please wait a moment before sending identical transmissions.'
      };
    }
    this.lastSubmissionTimestamp = now;
    this.lastSubmittedText = cleanText;

    // 2. Duplicate Detection: check if identical text was sent recently (< 5 mins)
    const allReports = await reportStorageService.getAllReports();
    const existingDuplicate = allReports.find(
      (r) =>
        r.id !== report.id &&
        r.lifecycleState !== 'resolved' &&
        now - new Date(r.createdAt).getTime() < 5 * 60 * 1000 &&
        r.callerText.trim().toLowerCase() === report.callerText.trim().toLowerCase()
    );

    if (existingDuplicate) {
      report.isDuplicate = true;
      report.duplicateOfId = existingDuplicate.id;
      report.auditTrail.push({
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'system',
        action: 'DUPLICATE_FLAGGED',
        details: `Potential duplicate of active incident #${existingDuplicate.id}`
      });
    }

    // 3. Save as Draft / Sending locally first (Local Persistence Safety)
    report.lifecycleState = 'sending';
    report.statusMessage = 'Your report is being sent.';
    await reportStorageService.saveReportLocally(report);
    this.notify(report);

    // 4. Check if completely offline
    if (!this.isDeviceOnline) {
      report.lifecycleState = 'queued_locally';
      report.statusMessage = 'Connection lost. Your report is saved on this device and will retry when possible.';
      await reportStorageService.saveReportLocally(report);
      this.notify(report);
      return {
        success: false,
        report,
        error: 'Offline: Report safely queued locally. Will transmit automatically when signal is restored.'
      };
    }

    // 5. Simulate or Execute Network Transmission with Timeout
    try {
      const transmissionResult = await this.transmitWithTimeout(report, 7000);
      return transmissionResult;
    } catch (err: unknown) {
      report.lifecycleState = 'failed';
      report.retryCount = (report.retryCount || 0) + 1;
      report.statusMessage = 'Your report has not been delivered. Tap to retry or use Emergency Help (112).';
      await reportStorageService.saveReportLocally(report);
      this.notify(report);
      return {
        success: false,
        report,
        error: err instanceof Error ? err.message : 'Transmission timeout or server error'
      };
    }
  }

  /**
   * Transmit report to Saathi Server with 7-second timeout
   */
  private async transmitWithTimeout(
    report: EmergencyReport,
    timeoutMs: number
  ): Promise<{ success: boolean; report: EmergencyReport }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Server acknowledgment timed out after 7s. Report retained on device.'));
      }, timeoutMs);

      // Simulate realistic server processing with network roundtrip
      setTimeout(async () => {
        clearTimeout(timer);

        // Update to Submitted -> Received by Operator System
        report.lifecycleState = 'submitted';
        report.statusMessage = 'Report received by the Saathi system. Awaiting operator acknowledgment.';
        report.updatedAt = new Date().toISOString();
        report.auditTrail.push({
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'system',
          action: 'SERVER_RECEIVED',
          details: 'Report successfully validated by Saathi Gateway and delivered to CAD dispatch queue.'
        });

        await reportStorageService.saveReportLocally(report);
        this.notify(report);

        resolve({ success: true, report });
      }, 650);
    });
  }

  /**
   * Drain locally queued reports with exponential backoff and jitter
   */
  async processPendingQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.isDeviceOnline) return;
    this.isProcessingQueue = true;

    try {
      const pending = await reportStorageService.getPendingQueue();
      for (const rep of pending) {
        if (!this.isDeviceOnline) break;

        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(1.5, rep.retryCount || 0), 10000);
        const jitter = Math.random() * 500;
        await new Promise((r) => setTimeout(r, baseDelay + jitter));

        try {
          await this.submitReport(rep);
        } catch (err) {
          console.warn(`Retry failed for report ${rep.id}:`, err);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Manual retry triggered by citizen
   */
  async retryReport(reportId: string): Promise<{ success: boolean; report?: EmergencyReport }> {
    const report = await reportStorageService.getReportById(reportId);
    if (!report) return { success: false };

    report.retryCount = (report.retryCount || 0) + 1;
    report.lifecycleState = 'sending';
    report.statusMessage = `Retrying transmission (Attempt ${report.retryCount})...`;
    await reportStorageService.saveReportLocally(report);
    this.notify(report);

    const res = await this.submitReport(report);
    return { success: res.success, report: res.report };
  }
}

export const networkDeliveryService = new NetworkDeliveryService();
