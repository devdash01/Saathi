export type UrgencyLevel = 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'LOW';

export type WarningSignCategory = 'threat' | 'injury' | 'location' | 'child_at_risk' | 'caller_safety';

export interface EvidenceItem {
  id: string;
  category: WarningSignCategory;
  label: string;
  quoteHinglish: string;
  englishTranslation: string;
  timestamp: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium';
  ruleEnforced?: boolean;
}

export interface StructuredLocation {
  raw: string;
  detectedAddress: string;
  confidence: number;
  ambiguityScore: number; // 0 = crystal clear, 100 = very ambiguous
  landmarks: string[];
  safeAccessPoint?: string;
}

export interface StructuredTriage {
  urgencyLevel: UrgencyLevel;
  threats: string[];
  injuries: string[];
  location: StructuredLocation;
  childrenAtRisk: {
    detected: boolean;
    details: string;
    countApprox?: string;
  };
  callerConstraints: {
    canSpeakFreely: boolean;
    whispering: boolean;
    silenceLikely: boolean;
    backgroundThreatPresent: boolean;
  };
  missingDetails: string[];
  evidenceLinks: EvidenceItem[];
}

export interface SafetyFloor {
  active: boolean;
  ruleId: string;
  ruleName: string;
  enforcedLevel: UrgencyLevel;
  originalAILevel: UrgencyLevel;
  rationale: string;
  cannotOverrideDownward: boolean;
}

export interface SafeSignalQuestion {
  id: string;
  questionText: string;
  hinglishText: string;
  category: 'location_precision' | 'perpetrator_distance' | 'child_safety' | 'discrete_response' | 'medical_triage' | 'hazard_proximity' | 'custom_operator_inquiry' | 'weapon_visibility';
  responseType: 'yes_no_only' | 'covert_tap' | 'short_phrase' | 'discrete_response';
  riskRating: 'LOW_RISK' | 'CAUTION' | 'LOW';
  status: 'suggested' | 'approved' | 'sent_to_caller' | 'answered';
  callerAnswer?: string;
  answer?: string;
  priority?: number;
  expectedResponseType?: string;
  safetyRulesPassed?: boolean;
  timestamp?: string;
  operatorNotes?: string;
}

export interface AgencyDispatchState {
  police: {
    recommended: boolean;
    unitType: string;
    priority: 'IMMEDIATE' | 'HIGH' | 'ROUTINE';
    status: 'NOT_REQUESTED' | 'REQUESTED' | 'ACKNOWLEDGED' | 'DISPATCHED';
    eta?: string;
    cadNumber?: string;
  };
  medical: {
    recommended: boolean;
    priority: 'IMMEDIATE' | 'STANDBY' | 'NONE';
    status: 'NOT_REQUESTED' | 'REQUESTED' | 'DISPATCHED';
    eta?: string;
  };
  shelter: {
    recommended: boolean;
    shelterName: string;
    availableBeds: number;
    status: 'STANDBY' | 'RESERVED' | 'NOT_REQUESTED';
  };
  legalAid: {
    recommended: boolean;
    counselorType: string;
    status: 'NOT_REQUESTED' | 'ASSIGNED';
  };
}

export interface SafePathMilestone {
  stage: string;
  status: 'completed' | 'in_progress' | 'waiting';
  time: string;
  details: string;
}

export interface SafePathState {
  callerToken: string;
  safeToSpeak: boolean;
  communicationMode: 'whisper' | 'silent_text' | 'normal' | 'emergency_cutoff';
  milestones: SafePathMilestone[];
  camouflageActive: boolean;
  camouflageApp: 'weather' | 'recipe' | 'calculator';
  lastPingTime: string;
  callerNote?: string;
}

export interface TranscriptWord {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  isRedFlag?: boolean;
  flagCategory?: WarningSignCategory;
}

export interface CallScenario {
  id: string;
  title: string;
  subtitle: string;
  callerNameMasked: string;
  callerPhoneMasked: string;
  cityArea: string;
  initialTranscript: string;
  words: TranscriptWord[];
  triage: StructuredTriage;
  safetyFloor: SafetyFloor;
  safeSignalQuestions: SafeSignalQuestion[];
  initialAgencies: AgencyDispatchState;
  repeatIncidentSummary?: {
    matchCount: number;
    lastCallDate: string;
    warningPattern: string;
  };
}

export interface StressLabScenario {
  id: string;
  title: string;
  category: string;
  hinglishSample: string;
  description: string;
  expectedUrgency: UrgencyLevel;
  safetyFloorExpected: boolean;
  expectedRedFlags: string[];
  status?: 'idle' | 'running' | 'passed' | 'warning';
  metrics?: {
    latencyMs: number;
    detectedKeywords: string[];
    safetyFloorPassed: boolean;
    underTriagePrevented: boolean;
  };
}

export interface IncidentRecord {
  id: string;
  caseId: string;
  timestamp: string;
  callerPhoneMasked: string;
  locationArea: string;
  urgency: UrgencyLevel;
  keyPhrases: string[];
  status: 'Active' | 'Dispatched' | 'Resolved' | 'FollowUpNeeded';
  officerAssigned: string;
  safetyFloorTriggered: boolean;
  continuityNotes: string;
}

export type ContactRelationship =
  | 'Parent'
  | 'Spouse'
  | 'Sibling'
  | 'Child'
  | 'Friend'
  | 'Relative'
  | 'Guardian'
  | 'Colleague'
  | 'Other';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: ContactRelationship;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  isPrimary?: boolean;
  createdAt: string;
}

export interface ContactNotificationLog {
  id: string;
  contactId: string;
  contactName: string;
  phone: string;
  channel: 'sms' | 'whatsapp';
  sentAt: string;
  status: 'prepared' | 'opened' | 'dispatched';
  messageSnippet: string;
}

