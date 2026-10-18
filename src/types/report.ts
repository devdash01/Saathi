import type { UrgencyLevel, StructuredTriage, SafetyFloor, SafeSignalQuestion, AgencyDispatchState } from './index';

export type ReportLifecycleState =
  | 'draft'
  | 'queued_locally'
  | 'sending'
  | 'submitted'
  | 'received'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'failed';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: 'citizen' | 'system' | 'operator';
  action: string;
  details: string;
}

export interface OperatorSession {
  id: string;
  name: string;
  badge: string;
  station: string;
  role: 'lead_operator' | 'dispatch_officer' | 'triage_specialist';
  dutyStatus: 'on_duty' | 'in_call' | 'break';
}

export interface LocationReportData {
  address: string;
  coords: [number, number];
  accuracyMeters: number;
  isLiveStreaming: boolean;
  source: 'live_gps' | 'gps_cached' | 'speech_extracted' | 'manual_landmark' | 'unavailable';
  lastUpdated: string;
  isSuspiciousOrStale?: boolean;
}

export interface HumanOverrideRecord {
  originalLevel: UrgencyLevel;
  overriddenLevel: UrgencyLevel;
  operatorId: string;
  operatorName: string;
  overrideReason: string;
  timestamp: string;
}

export interface EmergencyReport {
  id: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  lifecycleState: ReportLifecycleState;
  statusMessage: string;
  callerText: string;
  translatedText?: string;
  audioUrl?: string;
  audioBlobStored?: boolean;
  audioFailedTranscription?: boolean;
  audioDurationSeconds?: number;
  location: LocationReportData;
  triage: StructuredTriage;
  safetyFloor: SafetyFloor;
  aiConfidence: {
    score: number;
    isUncertain: boolean;
    rationale: string;
  };
  urgencyLevel: UrgencyLevel;
  humanOverride?: HumanOverrideRecord;
  operatorAssignment?: {
    operatorId: string;
    operatorName: string;
    badge: string;
    assignedAt: string;
  };
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  agencies: AgencyDispatchState;
  questions: SafeSignalQuestion[];
  auditTrail: AuditEvent[];
  retryCount: number;
  isDuplicate?: boolean;
  duplicateOfId?: string;
}
