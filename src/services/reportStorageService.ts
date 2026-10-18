/**
 * Robust Local Persistence & Recovery Service for SAATHI Emergency Reports
 * Uses IndexedDB with localStorage fallback to ensure emergency reports are NEVER lost,
 * even during complete network disconnections or browser crashes.
 */

import type { EmergencyReport, ReportLifecycleState } from '../types/report';

const DB_NAME = 'saathi_emergency_db';
const DB_VERSION = 1;
const STORE_REPORTS = 'emergency_reports';
const STORE_AUDIO = 'emergency_audio';
const LOCAL_STORAGE_KEY = 'saathi_cached_reports_v1';

class ReportStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported in current environment'));
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_REPORTS)) {
          db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO, { keyPath: 'reportId' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('IndexedDB open error, falling back to localStorage:', req.error);
        reject(req.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save or update an emergency report locally
   */
  async saveReportLocally(report: EmergencyReport): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_REPORTS, 'readwrite');
        const store = tx.objectStore(STORE_REPORTS);
        const req = store.put(report);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Graceful fallback to localStorage
      try {
        const existing = this.getFromLocalStorage();
        const idx = existing.findIndex((r) => r.id === report.id);
        if (idx >= 0) {
          existing[idx] = report;
        } else {
          existing.push(report);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
      } catch (err) {
        console.error('Failed to save report to localStorage fallback:', err);
      }
    }
  }

  /**
   * Store audio Blob for a report
   */
  async storeAudioBlob(reportId: string, audioBlob: Blob): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        const req = store.put({ reportId, audioBlob, createdAt: new Date().toISOString() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not store audio Blob in IndexedDB:', err);
    }
  }

  /**
   * Retrieve stored audio Blob
   */
  async getAudioBlob(reportId: string): Promise<Blob | null> {
    try {
      const db = await this.initDB();
      return await new Promise<Blob | null>((resolve) => {
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        const req = store.get(reportId);
        req.onsuccess = () => {
          if (req.result && req.result.audioBlob) {
            resolve(req.result.audioBlob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Get all reports from local database
   */
  async getAllReports(): Promise<EmergencyReport[]> {
    try {
      const db = await this.initDB();
      return await new Promise<EmergencyReport[]>((resolve, reject) => {
        const tx = db.transaction(STORE_REPORTS, 'readonly');
        const store = tx.objectStore(STORE_REPORTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFromLocalStorage();
    }
  }

  /**
   * Get a report by its unique ID
   */
  async getReportById(id: string): Promise<EmergencyReport | null> {
    try {
      const db = await this.initDB();
      return await new Promise<EmergencyReport | null>((resolve) => {
        const tx = db.transaction(STORE_REPORTS, 'readonly');
        const store = tx.objectStore(STORE_REPORTS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      const all = this.getFromLocalStorage();
      return all.find((r) => r.id === id) || null;
    }
  }

  /**
   * Retrieve all reports currently queued or pending delivery
   */
  async getPendingQueue(): Promise<EmergencyReport[]> {
    const all = await this.getAllReports();
    return all.filter((r) => r.lifecycleState === 'queued_locally' || r.lifecycleState === 'failed');
  }

  /**
   * Update report status directly
   */
  async updateReportStatus(
    reportId: string,
    state: ReportLifecycleState,
    statusMessage: string,
    partialUpdates?: Partial<EmergencyReport>
  ): Promise<EmergencyReport | null> {
    const report = await this.getReportById(reportId);
    if (!report) return null;

    const updated: EmergencyReport = {
      ...report,
      ...partialUpdates,
      lifecycleState: state,
      statusMessage,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...report.auditTrail,
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'system',
          action: `LIFECYCLE_${state.toUpperCase()}`,
          details: statusMessage
        }
      ]
    };

    await this.saveReportLocally(updated);
    return updated;
  }

  /**
   * Clean up old resolved reports to preserve device storage (retention policy)
   */
  async clearResolvedReports(maxAgeHours: number = 24): Promise<void> {
    const all = await this.getAllReports();
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    for (const rep of all) {
      if (rep.lifecycleState === 'resolved') {
        const repTime = new Date(rep.updatedAt).getTime();
        if (repTime < cutoff) {
          await this.deleteReport(rep.id);
        }
      }
    }
  }

  private async deleteReport(id: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction([STORE_REPORTS, STORE_AUDIO], 'readwrite');
      tx.objectStore(STORE_REPORTS).delete(id);
      tx.objectStore(STORE_AUDIO).delete(id);
    } catch {
      const existing = this.getFromLocalStorage().filter((r) => r.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    }
  }

  private getFromLocalStorage(): EmergencyReport[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export const reportStorageService = new ReportStorageService();
