import { useState, useEffect, useCallback, useTransition } from 'react';
import { UserPhoneView } from './components/UserPhoneView';
import { OperatorCadView } from './components/OperatorCadView';
import type { AgencyDispatchState, UrgencyLevel, SafeSignalQuestion } from './types';
import type { EmergencyReport, OperatorSession } from './types/report';
import {
  analyzeIncomingTranscript,
  generateSafeSignalQuestions,
  applyHumanUrgencyOverride
} from './services/triageEngine';
import { translateTextWithSarvam } from './services/sarvamService';
import {
  extractLocationFromSpeech,
  geocodeAndFetchNearbyServices,
  getInstantNearbyServices,
  getNearbyServicesForCoordinates,
  reverseGeocodeCoords,
  type EmergencyServiceEntity
} from './services/locationService';
import { networkDeliveryService } from './services/networkDeliveryService';
import { reportStorageService } from './services/reportStorageService';
import { deviceLocationService, type DeviceLocationResult } from './services/deviceLocationService';
import { cloudSyncService, type SyncStatus, type CloudSyncEvent } from './services/cloudSyncService';
import { BellRing, WifiOff, Radio } from 'lucide-react';

export function App() {
  const [, startTransition] = useTransition();

  // Network Online State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Authenticated Operator Session (Ananya Sharma)
  const [operatorSession] = useState<OperatorSession>({
    id: 'OP-1187',
    name: 'Ananya Sharma',
    badge: 'DL-CAD-1187',
    station: 'Delhi Central ERSS Command',
    role: 'lead_operator',
    dutyStatus: 'on_duty'
  });

  // Active Report State (Case #SA-2024-1187) - Starts Clean Awaiting Citizen Input
  const [callerAnswers, setCallerAnswers] = useState<Record<string, string>>({});
  const initialBaseTriage = analyzeIncomingTranscript('', 'Paschim Vihar, Delhi');

  const [activeReport, setActiveReport] = useState<EmergencyReport>({
    id: 'SA-2024-1187',
    idempotencyKey: 'idemp-init-1187',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lifecycleState: 'submitted',
    statusMessage: 'Ready for emergency distress transmission. Speak or type in the Citizen Phone to initiate live triage.',
    callerText: '',
    translatedText: '',
    location: {
      address: 'Paschim Vihar, New Delhi',
      coords: [28.6692, 77.1068],
      accuracyMeters: 20,
      isLiveStreaming: true,
      source: 'live_gps',
      lastUpdated: new Date().toISOString()
    },
    triage: initialBaseTriage.triage,
    safetyFloor: initialBaseTriage.safetyFloor,
    aiConfidence: { score: 0.95, isUncertain: false, rationale: 'Live audio/text listener active in standby mode.' },
    urgencyLevel: 'LOW',
    agencies: {
      police: { recommended: true, unitType: 'PCR Van - PV-12', priority: 'ROUTINE', status: 'NOT_REQUESTED', eta: '4m' },
      medical: { recommended: false, priority: 'NONE', status: 'NOT_REQUESTED', eta: '5m' },
      shelter: { recommended: false, shelterName: 'Women Help Desk Safe Shelter', availableBeds: 4, status: 'NOT_REQUESTED' },
      legalAid: { recommended: false, counselorType: 'DLSA Legal Protection Officer', status: 'NOT_REQUESTED' }
    },
    questions: [],
    auditTrail: [
      {
        id: `audit-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        actor: 'system',
        action: 'STANDBY_SESSION_OPENED',
        details: 'SAATHI CAD session opened for Case #SA-2024-1187. Awaiting caller transmission.'
      }
    ],
    retryCount: 0
  });

  const [allReports, setAllReports] = useState<EmergencyReport[]>([activeReport]);
  const [nearbyServices, setNearbyServices] = useState<EmergencyServiceEntity[]>([]);
  const [locationError, setLocationError] = useState<string | undefined>(undefined);

  const [sarvamStatus, setSarvamStatus] = useState<'connected' | 'transcribing' | 'idle' | 'error'>('connected');
  const [sarvamLatency] = useState<number>(280);
  const [dispatchAlertToast, setDispatchAlertToast] = useState<string | null>(null);

  // Cloud Real-Time Sync State (Mobile Data & Global Cross-Device Link)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected');
  const [syncChannel, setSyncChannel] = useState<string>(() => cloudSyncService.getChannelId());
  const [isEditingChannel, setIsEditingChannel] = useState<boolean>(false);

  // View Mode: 'split' (side-by-side) | 'phone' (citizen smartphone only) | 'cad' (operator CAD workstation only)
  const [viewMode, setViewMode] = useState<'split' | 'phone' | 'cad'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v === 'cad' || v === 'phone' || v === 'split') return v;
      // Auto-detect mobile devices or native Capacitor APK environment
      const isMobile =
        window.innerWidth <= 800 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        Boolean((window as any).Capacitor?.isNativePlatform?.());
      if (isMobile) return 'phone';
    }
    return 'split';
  });

  // 1. Subscribe to Network Connectivity Status
  useEffect(() => {
    const unsubNet = networkDeliveryService.subscribeNetwork((online) => {
      setIsOnline(online);
      if (!online) {
        setActiveReport((prev) => ({
          ...prev,
          lifecycleState: prev.lifecycleState === 'submitted' || prev.lifecycleState === 'acknowledged' ? prev.lifecycleState : 'queued_locally',
          statusMessage: 'Connection lost. Your report is saved on this device and will retry when possible.'
        }));
      }
    });

    const unsubRep = networkDeliveryService.subscribe((rep) => {
      startTransition(() => {
        setActiveReport(rep);
        setAllReports((prev) => {
          const idx = prev.findIndex((r) => r.id === rep.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = rep;
            return next;
          }
          return [rep, ...prev];
        });
      });
    });

    return () => {
      unsubNet();
      unsubRep();
    };
  }, []);

  // 2. Initial Location Geocoding & GPS Acquisition
  useEffect(() => {
    // Acquire real GPS if supported
    deviceLocationService.acquireGpsFix().then((loc: DeviceLocationResult) => {
      if (loc.error) {
        setLocationError(loc.error);
      }
      if (loc.source === 'live_gps') {
        setActiveReport((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            coords: loc.coords,
            accuracyMeters: loc.accuracyMeters,
            source: 'live_gps',
            lastUpdated: loc.timestamp
          }
        }));
      }
    });

    // Geocode initial locality
    geocodeAndFetchNearbyServices('Rohini Sector 16, New Delhi').then((geo) => {
      setNearbyServices(geo.nearbyServices);
    });
  }, []);

  // 3. Handle live user phone input (Voice recording, Presets, Direct typing, Audio upload)
  // FULLY REAL-TIME & SYNCHRONOUS: Updates map, questions, and CAD immediately in 0ms!
  const handleUserPhoneInput = useCallback(
    (
      text: string,
      contextHint?: string,
      audioUrl?: string,
      isRemoteSync: boolean = false,
      remoteLocation?: EmergencyReport['location'],
      remoteNearbyServices?: EmergencyServiceEntity[]
    ) => {
      if (!text || text.trim().length === 0) return;

      // A. Instantly extract locality & resolve coordinates + nearby services (0ms synchronous)
      const loc = extractLocationFromSpeech(text, contextHint);
      const instantGeo = getInstantNearbyServices(loc.locality);
      let coords: [number, number];
      let resolvedAddress: string;

      if (remoteLocation && remoteLocation.coords && remoteLocation.coords.length === 2) {
        coords = remoteLocation.coords;
        resolvedAddress = remoteLocation.address || loc.locality;
        if (remoteNearbyServices && remoteNearbyServices.length > 0) {
          setNearbyServices(remoteNearbyServices);
        } else {
          const nearby = getNearbyServicesForCoordinates(coords[0], coords[1], resolvedAddress);
          setNearbyServices(nearby);
        }
      } else if (loc.isFound) {
        coords = [instantGeo.lat, instantGeo.lon];
        resolvedAddress = loc.locality;
        setNearbyServices(instantGeo.nearbyServices);
      } else if (activeReport.location.source === 'live_gps' && activeReport.location.coords) {
        coords = activeReport.location.coords;
        resolvedAddress = activeReport.location.address;
      } else {
        coords = [instantGeo.lat, instantGeo.lon];
        resolvedAddress = loc.locality;
        setNearbyServices(instantGeo.nearbyServices);
      }

      // B. Instantly run AI triage & safety floor enforcement
      const analysis = analyzeIncomingTranscript(text, resolvedAddress, callerAnswers);
      const dynamicQuestions = generateSafeSignalQuestions(analysis.triage, text, callerAnswers);

      // Dynamically adapt fleet dispatch recommendations based on triage analysis
      const updatedAgencies: AgencyDispatchState = {
        ...activeReport.agencies,
        police: {
          ...activeReport.agencies.police,
          recommended: analysis.triage.urgencyLevel === 'CRITICAL' ||
                       analysis.triage.urgencyLevel === 'SEVERE' ||
                       analysis.triage.threats.length > 0,
          priority: analysis.triage.urgencyLevel === 'CRITICAL' ? 'IMMEDIATE' : analysis.triage.urgencyLevel === 'SEVERE' ? 'HIGH' : 'ROUTINE'
        },
        medical: {
          ...activeReport.agencies.medical,
          recommended: (analysis.triage.injuries && analysis.triage.injuries.some((i: string) => !i.toLowerCase().includes('no overt'))) ||
                       analysis.triage.threats.some((t: string) => t.toLowerCase().includes('medical') || t.toLowerCase().includes('khoon') || t.toLowerCase().includes('chot') || t.toLowerCase().includes('behosh')),
          priority: analysis.triage.injuries.some((i: string) => i.toLowerCase().includes('severe') || i.toLowerCase().includes('bleeding')) ? 'IMMEDIATE' : 'STANDBY'
        },
        shelter: {
          ...activeReport.agencies.shelter,
          recommended: !analysis.triage.callerConstraints.canSpeakFreely ||
                       analysis.triage.threats.some((t: string) => t.toLowerCase().includes('violence') || t.toLowerCase().includes('life') || t.toLowerCase().includes('forced'))
        },
        legalAid: {
          ...activeReport.agencies.legalAid,
          recommended: activeReport.agencies.legalAid.recommended ||
                       analysis.triage.threats.some((t: string) => t.toLowerCase().includes('stalking') || t.toLowerCase().includes('legal') || t.toLowerCase().includes('custody'))
        }
      };

      // C. Construct updated report object
      const updatedReport: EmergencyReport = {
        ...activeReport,
        id: activeReport.id || `REP-${Date.now().toString().slice(-6)}`,
        idempotencyKey: `idemp-${Date.now()}`,
        updatedAt: new Date().toISOString(),
        callerText: text,
        translatedText: activeReport.translatedText && activeReport.callerText === text ? activeReport.translatedText : text,
        audioUrl: audioUrl || activeReport.audioUrl,
        location: {
          address: resolvedAddress,
          coords,
          accuracyMeters: loc.isFound ? 20 : activeReport.location.accuracyMeters || 15,
          isLiveStreaming: activeReport.location.isLiveStreaming,
          source: loc.isFound ? 'speech_extracted' : (activeReport.location.source || 'speech_extracted'),
          lastUpdated: new Date().toISOString()
        },
        triage: analysis.triage,
        safetyFloor: analysis.safetyFloor,
        aiConfidence: analysis.aiConfidence,
        urgencyLevel: analysis.triage.urgencyLevel,
        questions: dynamicQuestions,
        agencies: updatedAgencies,
        auditTrail: [
          ...activeReport.auditTrail,
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'citizen',
            action: 'INPUT_APPENDED',
            details: `Caller provided additional report details: "${text.substring(0, 50)}..."`
          }
        ]
      };

      // D. SYNCHRONOUS STATE UPDATE: Triggers immediate re-render of Map, Questions, and Triage
      setActiveReport(updatedReport);
      setNearbyServices(instantGeo.nearbyServices);
      setAllReports((prev) => {
        const idx = prev.findIndex((r) => r.id === updatedReport.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedReport;
          return next;
        }
        return [updatedReport, ...prev];
      });

      // E. Persist report locally in background
      reportStorageService.saveReportLocally(updatedReport).catch(console.warn);

      // F. Submit to network delivery service
      networkDeliveryService.submitReport(updatedReport).catch(console.warn);

      // Cloud real-time sync broadcast to paired CAD / Phone consoles across mobile data
      if (!isRemoteSync) {
        cloudSyncService.broadcast('phone', 'CALLER_INPUT', {
          text,
          contextHint,
          audioUrl,
          callerAnswers,
          location: updatedReport.location,
          nearbyServices: instantGeo.nearbyServices
        });
      }

      // G. Background async refinement: Sarvam translation & Nominatim GIS geocoding (non-blocking)
      translateTextWithSarvam(text)
        .then((transRes) => {
          if (transRes.translated_text && transRes.translated_text !== text) {
            setActiveReport((prev) => {
              if (prev.callerText !== text) return prev;
              const refined = { ...prev, translatedText: transRes.translated_text };
              reportStorageService.saveReportLocally(refined).catch(() => {});
              return refined;
            });
          }
        })
        .catch(() => {});

      geocodeAndFetchNearbyServices(loc.locality)
        .then((geo) => {
          if (geo && (geo.lat !== coords[0] || geo.lon !== coords[1])) {
            setActiveReport((prev) => {
              if (prev.callerText !== text) return prev;
              const refined = {
                ...prev,
                location: {
                  ...prev.location,
                  coords: [geo.lat, geo.lon] as [number, number]
                }
              };
              reportStorageService.saveReportLocally(refined).catch(() => {});
              return refined;
            });
            setNearbyServices(geo.nearbyServices);
          }
        })
        .catch(() => {});
    },
    [activeReport, callerAnswers]
  );

  // 4. Manual Landmark Entered Fallback (When GPS is unavailable)
  const handleManualLandmarkEntered = async (landmark: string) => {
    setLocationError(undefined);
    const locResult = deviceLocationService.setManualLandmark(landmark);
    let nearby = getInstantNearbyServices(landmark).nearbyServices;

    try {
      const geo = await geocodeAndFetchNearbyServices(landmark);
      nearby = geo.nearbyServices;
      setNearbyServices(geo.nearbyServices);
      locResult.coords = [geo.lat, geo.lon];
    } catch (err) {
      console.warn('Geocode manual landmark error:', err);
    }

    const updated: EmergencyReport = {
      ...activeReport,
      location: {
        ...activeReport.location,
        address: landmark,
        coords: locResult.coords,
        accuracyMeters: 40,
        source: 'manual_landmark',
        lastUpdated: new Date().toISOString()
      },
      auditTrail: [
        ...activeReport.auditTrail,
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'citizen',
          action: 'MANUAL_LANDMARK_SET',
          details: `Caller entered manual landmark: "${landmark}"`
        }
      ]
    };

    setActiveReport(updated);
    await reportStorageService.saveReportLocally(updated);
    setDispatchAlertToast(`Landmark updated to: "${landmark}"`);
    setTimeout(() => setDispatchAlertToast(null), 3500);

    // Broadcast location update over cloud sync
    cloudSyncService.broadcast('phone', 'LOCATION_UPDATE', {
      coords: locResult.coords,
      address: landmark,
      accuracy: 40,
      isLiveStreaming: false,
      nearbyServices: nearby
    });
  };

  // 4b. Live GPS Telemetry Fix Acquired
  const handleGpsLocationAcquired = useCallback(
    async (coords: [number, number], accuracy: number, address?: string) => {
      // Guard against identical coordinate re-dispatch to prevent re-render thrashing
      if (
        activeReport.location.source === 'live_gps' &&
        activeReport.location.coords &&
        Math.abs(activeReport.location.coords[0] - coords[0]) < 0.0001 &&
        Math.abs(activeReport.location.coords[1] - coords[1]) < 0.0001
      ) {
        return;
      }

      setLocationError(undefined);
      let resolvedAddress = address || activeReport.location.address;
      if (!address) {
        try {
          resolvedAddress = await reverseGeocodeCoords(coords[0], coords[1]);
        } catch (_e) {
          resolvedAddress = `Live GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`;
        }
      }

      const nearby = getNearbyServicesForCoordinates(coords[0], coords[1], resolvedAddress);
      setNearbyServices(nearby);

      const updated: EmergencyReport = {
        ...activeReport,
        location: {
          ...activeReport.location,
          address: resolvedAddress,
          coords: coords,
          accuracyMeters: accuracy,
          source: 'live_gps',
          isLiveStreaming: true,
          lastUpdated: new Date().toISOString()
        },
        auditTrail: [
          ...activeReport.auditTrail,
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'citizen',
            action: 'GPS_LIVE_TELEMETRY_STREAMING',
            details: `Live browser GPS fix acquired: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)} (±${accuracy}m accuracy). Coordinates synced with CAD map.`
          }
        ]
      };

      setActiveReport(updated);
      await reportStorageService.saveReportLocally(updated);
      setDispatchAlertToast(`Live GPS Acquired: ${resolvedAddress} (±${accuracy}m)`);
      setTimeout(() => setDispatchAlertToast(null), 3500);

      // CRITICAL: Broadcast real-time GPS telemetry to the Operator CAD console!
      cloudSyncService.broadcast('phone', 'LOCATION_UPDATE', {
        isLiveStreaming: true,
        coords: coords,
        address: resolvedAddress,
        accuracy: accuracy,
        nearbyServices: nearby
      });
    },
    [activeReport.location.source, activeReport.location.coords, activeReport.location.address, activeReport.auditTrail]
  );

  // 5. Operator Acknowledges Report
  const handleAcknowledgeReport = async () => {
    const updated: EmergencyReport = {
      ...activeReport,
      lifecycleState: 'acknowledged',
      statusMessage: `Report acknowledged by ${operatorSession.name} (${operatorSession.badge}). Response coordinated.`,
      acknowledgedAt: new Date().toISOString(),
      operatorAssignment: {
        operatorId: operatorSession.id,
        operatorName: operatorSession.name,
        badge: operatorSession.badge,
        assignedAt: new Date().toISOString()
      },
      auditTrail: [
        ...activeReport.auditTrail,
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'operator',
          action: 'REPORT_ACKNOWLEDGED',
          details: `Operator ${operatorSession.name} (${operatorSession.badge}) acknowledged report and took ownership.`
        }
      ]
    };

    setActiveReport(updated);
    await reportStorageService.saveReportLocally(updated);
    setDispatchAlertToast(`Report #${updated.id} acknowledged by ${operatorSession.name}`);
    setTimeout(() => setDispatchAlertToast(null), 4000);

    cloudSyncService.broadcast('cad', 'OPERATOR_ACKNOWLEDGE', {
      operatorName: operatorSession.name,
      reportId: updated.id
    });
  };

  // 6. Operator Human Priority Override
  const handleOverridePriority = async (newLevel: UrgencyLevel, reason: string) => {
    const overrideResult = applyHumanUrgencyOverride(
      activeReport.triage,
      activeReport.safetyFloor,
      newLevel,
      operatorSession.id,
      operatorSession.name,
      reason
    );

    const updated: EmergencyReport = {
      ...activeReport,
      urgencyLevel: newLevel,
      triage: overrideResult.updatedTriage,
      humanOverride: {
        originalLevel: activeReport.triage.urgencyLevel,
        overriddenLevel: newLevel,
        operatorId: operatorSession.id,
        operatorName: operatorSession.name,
        overrideReason: reason,
        timestamp: new Date().toISOString()
      },
      auditTrail: [
        ...activeReport.auditTrail,
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'operator',
          action: 'PRIORITY_OVERRIDE',
          details: `Urgency tier manually overridden from ${activeReport.triage.urgencyLevel} to ${newLevel}. Reason: "${reason}". ${overrideResult.warning || ''}`
        }
      ]
    };

    setActiveReport(updated);
    await reportStorageService.saveReportLocally(updated);
    setDispatchAlertToast(`CAD Priority overridden to: Tier ${newLevel}`);
    setTimeout(() => setDispatchAlertToast(null), 4000);

    cloudSyncService.broadcast('cad', 'URGENCY_OVERRIDE', {
      urgencyLevel: newLevel,
      reason,
      operatorName: operatorSession.name
    });
  };

  // 7. Manual Retry for Failed Reports
  const handleManualRetry = async () => {
    setDispatchAlertToast('Retrying report transmission to SAATHI Gateway...');
    const res = await networkDeliveryService.retryReport(activeReport.id);
    if (res.report) {
      setActiveReport(res.report);
    }
  };

  // 8. Dispatch Agency from CAD
  const handleDispatchAgency = (key: keyof AgencyDispatchState) => {
    setActiveReport((prev) => {
      const copyAgencies = { ...prev.agencies };
      let toastMsg = '';

      if (key === 'police') {
        copyAgencies.police = {
          ...copyAgencies.police,
          status: 'DISPATCHED',
          eta: '3m'
        };
        toastMsg = 'CAD DISPATCH: Police PCR #DL-03-P-112 deployed en route (Silent Approach).';
      } else if (key === 'medical') {
        copyAgencies.medical = {
          ...copyAgencies.medical,
          status: 'DISPATCHED',
          eta: '5m'
        };
        toastMsg = 'CAD DISPATCH: Ambulance 108 ALS deployed.';
      } else if (key === 'shelter') {
        copyAgencies.shelter = {
          ...copyAgencies.shelter,
          status: 'RESERVED'
        };
        toastMsg = 'SHELTER CAD: Bed held at One-Stop Crisis Centre.';
      } else if (key === 'legalAid') {
        copyAgencies.legalAid = {
          ...copyAgencies.legalAid,
          status: 'ASSIGNED'
        };
        toastMsg = 'LEGAL AID: DLSA Protection Officer assigned.';
      }

      const updatedRep: EmergencyReport = {
        ...prev,
        agencies: copyAgencies,
        auditTrail: [
          ...prev.auditTrail,
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'operator',
            action: `AGENCY_DISPATCH_${key.toUpperCase()}`,
            details: toastMsg
          }
        ]
      };

      reportStorageService.saveReportLocally(updatedRep);
      setDispatchAlertToast(toastMsg);
      setTimeout(() => setDispatchAlertToast(null), 4500);

      cloudSyncService.broadcast('cad', 'AGENCY_DISPATCH', {
        agencyKey: key,
        dispatchState: copyAgencies[key],
        toastMsg
      });

      return updatedRep;
    });
  };

  // 9. Questions handling
  const handleApproveQuestion = (id: string) => {
    setActiveReport((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, status: 'approved' } : q))
    }));
  };

  const handleSendToCaller = (id: string) => {
    setActiveReport((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, status: 'sent_to_caller' } : q))
    }));
    setDispatchAlertToast('SafeSignal question transmitted directly to caller smartphone.');
    setTimeout(() => setDispatchAlertToast(null), 3500);

    cloudSyncService.broadcast('cad', 'SEND_QUESTION', {
      questionId: id
    });
  };

  const handleSendCustomQuestion = (questionHinglish: string, questionEnglish?: string) => {
    if (!questionHinglish || !questionHinglish.trim()) return;
    const customQ: SafeSignalQuestion = {
      id: `custom-q-${Date.now()}`,
      category: 'custom_operator_inquiry',
      questionText: questionEnglish || questionHinglish,
      hinglishText: questionHinglish,
      responseType: 'yes_no_only',
      riskRating: 'LOW_RISK',
      status: 'sent_to_caller',
      priority: 1,
      expectedResponseType: 'binary_safety',
      safetyRulesPassed: true,
      timestamp: new Date().toISOString()
    };

    setActiveReport((prev) => ({
      ...prev,
      questions: [customQ, ...prev.questions],
      auditTrail: [
        ...prev.auditTrail,
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'operator',
          action: 'CUSTOM_QUESTION_TRANSMITTED',
          details: `Operator transmitted custom question to caller: "${questionHinglish}"`
        }
      ]
    }));

    setDispatchAlertToast(`Custom question transmitted to caller: "${questionHinglish}"`);
    setTimeout(() => setDispatchAlertToast(null), 3500);

    cloudSyncService.broadcast('cad', 'SEND_QUESTION', {
      customQ
    });
  };

  const handleCallerAnswer = useCallback(
    (questionId: string, answer: string, isRemoteSync: boolean = false) => {
      const normAns =
        answer === 'YES' || answer === 'Haan' || answer === 'yes'
          ? 'yes'
          : answer === 'NO' || answer === 'Nahi' || answer === 'no'
          ? 'no'
          : 'silence';

      const updatedAnswers = { ...callerAnswers, [questionId]: normAns };
      setCallerAnswers(updatedAnswers);

      // Synchronously re-run triage analysis with the new answer!
      const text = activeReport.callerText || '';
      const loc = activeReport.location.address || 'Paschim Vihar, New Delhi';
      const analysis = analyzeIncomingTranscript(text, loc, updatedAnswers);
      const dynamicQuestions = generateSafeSignalQuestions(analysis.triage, text, updatedAnswers);

      const updatedRep: EmergencyReport = {
        ...activeReport,
        triage: analysis.triage,
        safetyFloor: analysis.safetyFloor,
        urgencyLevel: analysis.triage.urgencyLevel,
        questions: dynamicQuestions,
        auditTrail: [
          ...activeReport.auditTrail,
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'citizen',
            action: normAns === 'silence' ? 'QUESTION_SKIPPED' : 'QUESTION_ANSWERED',
            details: `Question ${questionId} answered: "${answer}". Triage urgency evaluated to ${analysis.triage.urgencyLevel}.`
          }
        ]
      };

      setActiveReport(updatedRep);
      setAllReports((prev) => prev.map((r) => (r.id === updatedRep.id ? updatedRep : r)));
      reportStorageService.saveReportLocally(updatedRep).catch(() => {});
      setDispatchAlertToast(`Caller SafeSignal Response: "${answer}" → Urgency: ${analysis.triage.urgencyLevel}`);
      setTimeout(() => setDispatchAlertToast(null), 3500);

      if (!isRemoteSync) {
        cloudSyncService.broadcast('phone', 'CALLER_ANSWER', {
          questionId,
          answer,
          callerAnswers: updatedAnswers
        });
      }
    },
    [activeReport, callerAnswers]
  );

  // 10. Toggle Live Location Sharing
  const handleToggleLiveLocationSharing = useCallback((sharing: boolean) => {
    if (sharing) {
      deviceLocationService.startLiveTracking();
    } else {
      deviceLocationService.stopLiveTracking();
    }

    setActiveReport((prev) => {
      const updated = {
        ...prev,
        location: {
          ...prev.location,
          isLiveStreaming: sharing
        },
        auditTrail: [
          ...prev.auditTrail,
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: 'citizen' as const,
            action: sharing ? 'GPS_SHARING_RESUMED' : 'GPS_SHARING_PAUSED',
            details: sharing
              ? 'Citizen enabled real-time high precision GPS telemetry'
              : 'Citizen paused live GPS telemetry'
          }
        ]
      };

      cloudSyncService.broadcast('phone', 'LOCATION_UPDATE', {
        isLiveStreaming: sharing,
        coords: updated.location.coords,
        address: updated.location.address
      });

      return updated;
    });
  }, []);

  // 11. Start New Emergency Session / Reset Chat
  const handleStartNewSession = useCallback((isRemoteSync: boolean = false) => {
    const newId = `SA-2024-${Date.now().toString().slice(-4)}`;
    const standbyTriage = analyzeIncomingTranscript('', 'Paschim Vihar, Delhi');
    const newReport: EmergencyReport = {
      id: newId,
      idempotencyKey: `idemp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lifecycleState: 'submitted',
      statusMessage: 'Ready for emergency distress transmission. Speak or type in the Citizen Phone to initiate live triage.',
      callerText: '',
      translatedText: '',
      location: {
        address: 'Paschim Vihar, New Delhi',
        coords: [28.6692, 77.1068],
        accuracyMeters: 20,
        isLiveStreaming: true,
        source: 'live_gps',
        lastUpdated: new Date().toISOString()
      },
      triage: standbyTriage.triage,
      safetyFloor: standbyTriage.safetyFloor,
      aiConfidence: { score: 0.95, isUncertain: false, rationale: 'New session opened. Listener active in standby mode.' },
      urgencyLevel: 'LOW',
      agencies: {
        police: { recommended: true, unitType: 'PCR Van - PV-12', priority: 'ROUTINE', status: 'NOT_REQUESTED', eta: '4m' },
        medical: { recommended: false, priority: 'NONE', status: 'NOT_REQUESTED', eta: '5m' },
        shelter: { recommended: false, shelterName: 'Women Help Desk Safe Shelter', availableBeds: 4, status: 'NOT_REQUESTED' },
        legalAid: { recommended: false, counselorType: 'DLSA Legal Protection Officer', status: 'NOT_REQUESTED' }
      },
      questions: [],
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'citizen',
          action: 'NEW_SESSION_INITIALIZED',
          details: `Citizen started new clean session #${newId} from Home Screen.`
        }
      ],
      retryCount: 0
    };

    setCallerAnswers({});
    setActiveReport(newReport);
    setAllReports((prev) => [newReport, ...prev]);
    setDispatchAlertToast(`New Session Started: Case #${newId}`);
    setTimeout(() => setDispatchAlertToast(null), 3500);

    if (!isRemoteSync) {
      cloudSyncService.broadcast('phone', 'NEW_SESSION', { newId });
    }
  }, []);

  // 12. Subscribe to Real-Time Cloud MQTT Sync for Cross-Device & Mobile Data Link
  useEffect(() => {
    cloudSyncService.connect();

    const unsubStatus = cloudSyncService.subscribeStatus((st, ch) => {
      setSyncStatus(st);
      setSyncChannel(ch);
    });

    const unsubEvents = cloudSyncService.subscribeEvents((evt: CloudSyncEvent) => {
      startTransition(() => {
        if (evt.type === 'CALLER_INPUT') {
          const { text, contextHint, audioUrl, location: remoteLoc, nearbyServices: remoteNearby } = evt.payload;
          if (text) {
            handleUserPhoneInput(text, contextHint, audioUrl, true /* isRemoteSync */, remoteLoc, remoteNearby);
            if (remoteLoc && remoteLoc.coords) {
              setActiveReport((prev) => ({
                ...prev,
                location: {
                  ...prev.location,
                  coords: remoteLoc.coords,
                  address: remoteLoc.address || prev.location.address,
                  source: remoteLoc.source || 'live_gps',
                  isLiveStreaming: true
                }
              }));
              if (remoteNearby && remoteNearby.length > 0) {
                setNearbyServices(remoteNearby);
              }
            }
            setDispatchAlertToast(`[Cloud Sync] Incoming distress from mobile device #${evt.channelId}`);
            setTimeout(() => setDispatchAlertToast(null), 4000);
          }
        } else if (evt.type === 'CALLER_ANSWER') {
          const { questionId, answer } = evt.payload;
          if (questionId && answer) {
            handleCallerAnswer(questionId, answer, true /* isRemoteSync */);
          }
        } else if (evt.type === 'LOCATION_UPDATE') {
          const { coords, address, isLiveStreaming, nearbyServices: remoteNearby } = evt.payload;
          if (coords && coords.length === 2) {
            const nearby = (remoteNearby && remoteNearby.length > 0)
              ? remoteNearby
              : getNearbyServicesForCoordinates(coords[0], coords[1], address || '');
            setNearbyServices(nearby);
            setActiveReport((prev) => ({
              ...prev,
              location: {
                ...prev.location,
                coords: coords,
                address: address || prev.location.address,
                isLiveStreaming: isLiveStreaming !== undefined ? isLiveStreaming : true,
                source: 'live_gps',
                lastUpdated: new Date().toISOString()
              }
            }));
            setDispatchAlertToast(`[Live GPS Telemetry] Mobile GPS synced: ${address || `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`}`);
            setTimeout(() => setDispatchAlertToast(null), 4000);
          }
        } else if (evt.type === 'OPERATOR_ACKNOWLEDGE') {
          const { operatorName } = evt.payload;
          setActiveReport((prev) => ({
            ...prev,
            lifecycleState: 'acknowledged',
            statusMessage: `Report acknowledged by ${operatorName || 'Operator'}. Emergency responders dispatched.`,
            auditTrail: [
              ...prev.auditTrail,
              {
                id: `audit-${Date.now()}`,
                timestamp: new Date().toISOString(),
                actor: 'operator' as const,
                action: 'REMOTE_OPERATOR_ACKNOWLEDGED',
                details: `Operator ${operatorName} acknowledged distress report over secure cloud sync.`
              }
            ]
          }));
          setDispatchAlertToast(`Operator ${operatorName || 'CAD'} acknowledged this incident.`);
          setTimeout(() => setDispatchAlertToast(null), 4000);
        } else if (evt.type === 'AGENCY_DISPATCH') {
          const { agencyKey, dispatchState, toastMsg } = evt.payload;
          setActiveReport((prev) => {
            const copyAgencies = { ...prev.agencies };
            if (agencyKey && dispatchState) {
              copyAgencies[agencyKey as keyof AgencyDispatchState] = dispatchState;
            }
            return {
              ...prev,
              agencies: copyAgencies,
              auditTrail: [
                ...prev.auditTrail,
                {
                  id: `audit-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  actor: 'operator' as const,
                  action: `REMOTE_DISPATCH_${String(agencyKey).toUpperCase()}`,
                  details: toastMsg || `Emergency responder deployed: ${agencyKey}`
                }
              ]
            };
          });
          setDispatchAlertToast(toastMsg || `Emergency responder dispatched: ${agencyKey}`);
          setTimeout(() => setDispatchAlertToast(null), 4500);
        } else if (evt.type === 'SEND_QUESTION') {
          const { questionId, customQ } = evt.payload;
          if (customQ) {
            setActiveReport((prev) => ({
              ...prev,
              questions: [customQ, ...prev.questions]
            }));
            setDispatchAlertToast(`Operator question received on device.`);
            setTimeout(() => setDispatchAlertToast(null), 4000);
          } else if (questionId) {
            setActiveReport((prev) => ({
              ...prev,
              questions: prev.questions.map((q) => (q.id === questionId ? { ...q, status: 'sent_to_caller' } : q))
            }));
          }
        } else if (evt.type === 'URGENCY_OVERRIDE') {
          const { urgencyLevel, reason, operatorName } = evt.payload;
          setActiveReport((prev) => ({
            ...prev,
            urgencyLevel,
            auditTrail: [
              ...prev.auditTrail,
              {
                id: `audit-${Date.now()}`,
                timestamp: new Date().toISOString(),
                actor: 'operator' as const,
                action: 'REMOTE_PRIORITY_OVERRIDE',
                details: `Urgency level adjusted to ${urgencyLevel} by ${operatorName}: "${reason}"`
              }
            ]
          }));
        } else if (evt.type === 'NEW_SESSION') {
          handleStartNewSession(true /* isRemoteSync */);
        }
      });
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, [handleUserPhoneInput, handleCallerAnswer, handleStartNewSession]);

  return (
    <div className="app-shell">

      {/* Network Offline Alert Banner */}
      {!isOnline && (
        <div
          style={{
            background: '#b45309',
            color: '#fef3c7',
            padding: '6px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            fontWeight: 700,
            zIndex: 70
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WifiOff size={15} />
            <span>OFFLINE MODE: No internet connection detected. Reports are saved locally on your device and will sync automatically when connectivity returns. Use 112 Help for immediate phone dialing.</span>
          </div>
        </div>
      )}

      {/* CAD Dispatch Notification Toast */}
      {dispatchAlertToast && (
        <div
          style={{
            background: 'var(--accent-red)',
            color: 'white',
            padding: '6px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            fontWeight: 600,
            zIndex: 60
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellRing size={14} />
            <span>{dispatchAlertToast}</span>
          </div>
          <button
            onClick={() => setDispatchAlertToast(null)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* GLOBAL VIEW MODE SWITCHER BAR - Hidden in pure phone view for native mobile experience */}
      {viewMode !== 'phone' && (
        <header className="global-app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Saathi" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
            <span className="brand-logo-badge">SAATHI 112</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
              Emergency Response & CAD Platform
            </span>
          </div>

          {/* Real-Time Cloud Link Indicator (Mobile Data & Wi-Fi Sync) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem'
            }}
            title="Live Cloud Sync: Connects mobile app on 4G/5G mobile data with operator workstation"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor:
                    syncStatus === 'connected'
                      ? '#10b981'
                      : syncStatus === 'connecting'
                      ? '#f59e0b'
                      : '#ef4444',
                  boxShadow: syncStatus === 'connected' ? '0 0 8px #10b981' : 'none'
                }}
              />
              <Radio size={13} style={{ color: syncStatus === 'connected' ? '#10b981' : '#94a3b8' }} />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                {syncStatus === 'connected'
                  ? 'Cloud Sync: Active'
                  : syncStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline Sync'}
              </span>
            </div>

            <span style={{ color: '#475569' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Room:</span>
              {isEditingChannel ? (
                <input
                  type="text"
                  value={syncChannel}
                  onChange={(e) => setSyncChannel(e.target.value)}
                  onBlur={() => {
                    setIsEditingChannel(false);
                    cloudSyncService.setChannelId(syncChannel);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingChannel(false);
                      cloudSyncService.setChannelId(syncChannel);
                    }
                  }}
                  style={{
                    background: '#090d16',
                    border: '1px solid #3b82f6',
                    color: '#fff',
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    width: '100px'
                  }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingChannel(true)}
                  title="Click to edit pairing room code for your mobile device"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  #{syncChannel}
                </button>
              )}
            </div>
          </div>

          <div className="view-mode-switcher-bar">
            <button
              type="button"
              className={`view-mode-pill ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('split');
                if (typeof window !== 'undefined') {
                  const u = new URL(window.location.href);
                  u.searchParams.set('view', 'split');
                  window.history.replaceState({}, '', u.toString());
                }
              }}
              id="btn-view-split"
            >
              ⚡ Split View
            </button>
            <button
              type="button"
              className="view-mode-pill"
              onClick={() => {
                setViewMode('phone');
                if (typeof window !== 'undefined') {
                  const u = new URL(window.location.href);
                  u.searchParams.set('view', 'phone');
                  window.history.replaceState({}, '', u.toString());
                }
              }}
              id="btn-view-phone"
            >
              📱 Citizen Phone Only
            </button>
            <button
              type="button"
              className={`view-mode-pill ${viewMode === 'cad' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('cad');
                if (typeof window !== 'undefined') {
                  const u = new URL(window.location.href);
                  u.searchParams.set('view', 'cad');
                  window.history.replaceState({}, '', u.toString());
                }
              }}
              id="btn-view-cad"
            >
              🖥️ Operator CAD Only
            </button>
          </div>
        </header>
      )}

      {/* Discreet floating switch for desktop browser users viewing phone mode */}
      {viewMode === 'phone' && (
        <button
          type="button"
          onClick={() => {
            setViewMode('split');
            if (typeof window !== 'undefined') {
              const u = new URL(window.location.href);
              u.searchParams.set('view', 'split');
              window.history.replaceState({}, '', u.toString());
            }
          }}
          className="desktop-floating-switch-btn"
          title="Switch to Operator Split View"
        >
          🖥️ Split Console
        </button>
      )}

      {/* DUAL-PANE SPLIT SCREEN ARCHITECTURE */}
      <div className={`split-screen-layout ${viewMode === 'cad' ? 'view-cad-only' : viewMode === 'phone' ? 'view-phone-only' : ''}`}>
        {/* LEFT PANE: CITIZEN SMARTPHONE APP (USER DEVICE) */}
        {viewMode !== 'cad' && (
          <div className="user-phone-pane">
            <UserPhoneView
              currentInputText={activeReport.callerText}
              onUserInputChange={handleUserPhoneInput}
              onStartNewSession={handleStartNewSession}
              extractedLocation={activeReport.location.address}
              callerCoords={activeReport.location.coords}
              questions={activeReport.questions}
              onCallerAnswer={handleCallerAnswer}
              agencies={activeReport.agencies}
              sarvamStatus={sarvamStatus}
              setSarvamStatus={setSarvamStatus}
              isLiveLocationSharing={activeReport.location.isLiveStreaming}
              onToggleLiveLocationSharing={handleToggleLiveLocationSharing}
              activeReport={activeReport}
              onRetryReport={handleManualRetry}
              onManualLandmarkEntered={handleManualLandmarkEntered}
              onGpsLocationAcquired={handleGpsLocationAcquired}
              operatorName={operatorSession.name}
              locationError={locationError}
              nearbyServices={nearbyServices}
            />
          </div>
        )}

        {/* RIGHT PANE: EMERGENCY OPERATOR CAD TERMINAL (DESKTOP WORKSTATION) */}
        {viewMode !== 'phone' && (
          <div className="operator-cad-pane">
            <OperatorCadView
              inputText={activeReport.callerText}
              translatedText={activeReport.translatedText || activeReport.callerText}
              extractedLocation={activeReport.location.address}
              isExtractedFromSpeech={activeReport.location.source === 'speech_extracted'}
              callerCoords={activeReport.location.coords}
              nearbyServices={nearbyServices}
              audioUrl={activeReport.audioUrl}
              triage={activeReport.triage}
              safetyFloor={activeReport.safetyFloor}
              agencies={activeReport.agencies}
              questions={activeReport.questions}
              onDispatchAgency={handleDispatchAgency}
              onApproveQuestion={handleApproveQuestion}
              onSendToCaller={handleSendToCaller}
              onSendCustomQuestion={handleSendCustomQuestion}
              onUpdateLocation={handleManualLandmarkEntered}
              onApplySimulation={(newTriage, newAgencies) => {
                setActiveReport((prev) => ({
                  ...prev,
                  triage: newTriage,
                  agencies: newAgencies,
                  urgencyLevel: newTriage.urgencyLevel
                }));
                setDispatchAlertToast('Simulation applied to Live CAD Dispatch Workflow.');
                setTimeout(() => setDispatchAlertToast(null), 3500);
              }}
              sarvamStatus={sarvamStatus}
              sarvamLatency={sarvamLatency}
              isLiveLocationSharing={activeReport.location.isLiveStreaming}
              activeReport={activeReport}
              allReports={allReports}
              onSelectReport={(repId) => {
                const found = allReports.find((r) => r.id === repId);
                if (found) setActiveReport(found);
              }}
              onAcknowledgeReport={handleAcknowledgeReport}
              onOverridePriority={handleOverridePriority}
              onCallerAnswer={handleCallerAnswer}
              onAppendInput={(newAddition) => {
                const combined = activeReport.callerText ? `${activeReport.callerText}. ${newAddition}` : newAddition;
                handleUserPhoneInput(combined);
              }}
              operatorSession={operatorSession}
              aiConfidence={activeReport.aiConfidence}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
