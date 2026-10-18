import type { CallScenario, StressLabScenario, IncidentRecord } from '../types';

export const MOCK_SCENARIOS: CallScenario[] = [
  {
    id: 'call-rohini-01',
    title: 'Perimeter Threat & Minor Child at Risk',
    subtitle: 'From Proposal: "Didi, woh ghar ke bahar aa gaya hai..."',
    callerNameMasked: 'P****a S****a',
    callerPhoneMasked: '+91 98*** **412',
    cityArea: 'Rohini Sector 16, New Delhi',
    initialTranscript:
      'Didi, woh ghar ke bahar aa gaya hai… mera bachcha bhi mere saath hai. Main zyada der baat nahi kar sakti.',
    words: [
      { id: 'w1', word: 'Didi,', startTime: 0.2, endTime: 0.6 },
      { id: 'w2', word: 'woh', startTime: 0.7, endTime: 1.0 },
      { id: 'w3', word: 'ghar', startTime: 1.1, endTime: 1.4, isRedFlag: true, flagCategory: 'location' },
      { id: 'w4', word: 'ke', startTime: 1.5, endTime: 1.7 },
      { id: 'w5', word: 'bahar', startTime: 1.8, endTime: 2.2, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w6', word: 'aa', startTime: 2.3, endTime: 2.6, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w7', word: 'gaya', startTime: 2.7, endTime: 3.0 },
      { id: 'w8', word: 'hai…', startTime: 3.1, endTime: 3.5 },
      { id: 'w9', word: 'mera', startTime: 4.2, endTime: 4.6 },
      { id: 'w10', word: 'bachcha', startTime: 4.7, endTime: 5.2, isRedFlag: true, flagCategory: 'child_at_risk' },
      { id: 'w11', word: 'bhi', startTime: 5.3, endTime: 5.6 },
      { id: 'w12', word: 'mere', startTime: 5.7, endTime: 6.0 },
      { id: 'w13', word: 'saath', startTime: 6.1, endTime: 6.4, isRedFlag: true, flagCategory: 'child_at_risk' },
      { id: 'w14', word: 'hai.', startTime: 6.5, endTime: 6.8 },
      { id: 'w15', word: 'Main', startTime: 7.2, endTime: 7.5 },
      { id: 'w16', word: 'zyada', startTime: 7.6, endTime: 8.0, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w17', word: 'der', startTime: 8.1, endTime: 8.4 },
      { id: 'w18', word: 'baat', startTime: 8.5, endTime: 8.8 },
      { id: 'w19', word: 'nahi', startTime: 8.9, endTime: 9.2, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w20', word: 'kar', startTime: 9.3, endTime: 9.5 },
      { id: 'w21', word: 'sakti.', startTime: 9.6, endTime: 10.0, isRedFlag: true, flagCategory: 'caller_safety' }
    ],
    triage: {
      urgencyLevel: 'CRITICAL',
      threats: [
        'Known aggressor breached residential perimeter ("ghar ke bahar aa gaya hai")',
        'High proximity stalker / domestic perpetrator lurking directly outside door',
        'Caller under immediate surveillance risk'
      ],
      injuries: ['No overt physical trauma reported yet; high probability of violent breach'],
      location: {
        raw: 'Rohini Sector 16, Pocket 3 (Cell tower approx 45m radius)',
        detectedAddress: 'Flat 402, Block C, Rohini Sector 16, New Delhi',
        confidence: 0.88,
        ambiguityScore: 24, // low ambiguity
        landmarks: ['Near Mother Dairy Booth #12', 'Adjacent to District Park gate'],
        safeAccessPoint: 'Rear staircase entrance'
      },
      childrenAtRisk: {
        detected: true,
        details: 'Minor child present inside residence with mother ("mera bachcha bhi mere saath hai")',
        countApprox: '1 child (~4-6 yrs based on background sound analysis)'
      },
      callerConstraints: {
        canSpeakFreely: false,
        whispering: true,
        silenceLikely: true,
        backgroundThreatPresent: true
      },
      missingDetails: [
        'Exact floor & flat number confirmation',
        'Has perpetrator attempted to break door latch?',
        'Does aggressor possess a weapon?'
      ],
      evidenceLinks: [
        {
          id: 'ev-1',
          category: 'threat',
          label: 'Perimeter Breach',
          quoteHinglish: 'woh ghar ke bahar aa gaya hai',
          englishTranslation: 'He has arrived right outside my house',
          timestamp: '00:03',
          confidence: 0.96,
          severity: 'critical',
          ruleEnforced: true
        },
        {
          id: 'ev-2',
          category: 'child_at_risk',
          label: 'Child in Direct Danger',
          quoteHinglish: 'mera bachcha bhi mere saath hai',
          englishTranslation: 'My child is also here with me',
          timestamp: '00:06',
          confidence: 0.98,
          severity: 'critical',
          ruleEnforced: true
        },
        {
          id: 'ev-3',
          category: 'caller_safety',
          label: 'Communication Suppression',
          quoteHinglish: 'Main zyada der baat nahi kar sakti',
          englishTranslation: 'I cannot talk for much longer',
          timestamp: '00:09',
          confidence: 0.94,
          severity: 'high'
        }
      ]
    },
    safetyFloor: {
      active: true,
      ruleId: 'RULE-SF-04',
      ruleName: 'Perimeter Threat + Dependent Child Safeguard',
      enforcedLevel: 'CRITICAL',
      originalAILevel: 'SEVERE',
      rationale:
        'SAFETY FLOOR ENFORCED: AI Model scored speech as SEVERE due to calm/whispered vocal tone, but Rule-Based Safety Layer triggered non-downgrade floor because child is at risk with perpetrator outside door. Urgency locked to CRITICAL.',
      cannotOverrideDownward: true
    },
    safeSignalQuestions: [
      {
        id: 'q1',
        questionText: 'Is the front door bolted from inside? Press 1 for Yes, 2 for No.',
        hinglishText: 'Kya andar se door locked hai? Ek dabayein Haan ke liye, Do dabayein Nahi ke liye.',
        category: 'discrete_response',
        responseType: 'covert_tap',
        riskRating: 'LOW_RISK',
        status: 'suggested'
      },
      {
        id: 'q2',
        questionText: 'Can you hear him trying the door handle?',
        hinglishText: 'Kya woh darwaza todne ki koshish kar raha hai?',
        category: 'perpetrator_distance',
        responseType: 'yes_no_only',
        riskRating: 'LOW_RISK',
        status: 'approved'
      },
      {
        id: 'q3',
        questionText: 'Are you safe to receive an encrypted SMS link to track police dispatch?',
        hinglishText: 'Kya hum SafePath link SMS pe bhej sakte hain?',
        category: 'discrete_response',
        responseType: 'yes_no_only',
        riskRating: 'LOW_RISK',
        status: 'suggested'
      }
    ],
    initialAgencies: {
      police: {
        recommended: true,
        unitType: 'PCR Van #DL-03-P-112 (Sector 16 Patrol)',
        priority: 'IMMEDIATE',
        status: 'REQUESTED',
        eta: '4-6 mins',
        cadNumber: 'CAD-DEL-2026-90412'
      },
      medical: {
        recommended: false,
        priority: 'STANDBY',
        status: 'NOT_REQUESTED',
        eta: 'Standby 108 ambulance'
      },
      shelter: {
        recommended: true,
        shelterName: 'One-Stop Centre (OSC) Rohini North',
        availableBeds: 4,
        status: 'STANDBY'
      },
      legalAid: {
        recommended: true,
        counselorType: 'Duty Protection Officer / DLSA advocate',
        status: 'NOT_REQUESTED'
      }
    },
    repeatIncidentSummary: {
      matchCount: 2,
      lastCallDate: '8 days ago (10 Oct 2026)',
      warningPattern: 'Prior domestic disturbance complaint against same ex-spouse. Cross-referenced via hashed caller identity.'
    }
  },
  {
    id: 'call-lucknow-02',
    title: 'Severe Assault with Active Bleeding',
    subtitle: '"Bhaiya bachao, sir se khoon nikal raha hai, gate band hai..."',
    callerNameMasked: 'A****a K****r',
    callerPhoneMasked: '+91 94*** **820',
    cityArea: 'Alambagh, Lucknow, UP',
    initialTranscript:
      'Bhaiya bachao, sir se khoon nikal raha hai, usne room bahar se band kar diya hai... phone chheen lega mera.',
    words: [
      { id: 'w1', word: 'Bhaiya', startTime: 0.2, endTime: 0.5 },
      { id: 'w2', word: 'bachao,', startTime: 0.6, endTime: 1.0, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w3', word: 'sir', startTime: 1.2, endTime: 1.5, isRedFlag: true, flagCategory: 'injury' },
      { id: 'w4', word: 'se', startTime: 1.6, endTime: 1.8 },
      { id: 'w5', word: 'khoon', startTime: 1.9, endTime: 2.3, isRedFlag: true, flagCategory: 'injury' },
      { id: 'w6', word: 'nikal', startTime: 2.4, endTime: 2.7, isRedFlag: true, flagCategory: 'injury' },
      { id: 'w7', word: 'raha', startTime: 2.8, endTime: 3.0 },
      { id: 'w8', word: 'hai,', startTime: 3.1, endTime: 3.3 },
      { id: 'w9', word: 'usne', startTime: 4.0, endTime: 4.3 },
      { id: 'w10', word: 'room', startTime: 4.4, endTime: 4.7, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w11', word: 'bahar', startTime: 4.8, endTime: 5.1 },
      { id: 'w12', word: 'se', startTime: 5.2, endTime: 5.4 },
      { id: 'w13', word: 'band', startTime: 5.5, endTime: 5.9, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w14', word: 'kar', startTime: 6.0, endTime: 6.2 },
      { id: 'w15', word: 'diya', startTime: 6.3, endTime: 6.5 },
      { id: 'w16', word: 'hai...', startTime: 6.6, endTime: 7.0 },
      { id: 'w17', word: 'phone', startTime: 7.5, endTime: 7.9 },
      { id: 'w18', word: 'chheen', startTime: 8.0, endTime: 8.5, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w19', word: 'lega', startTime: 8.6, endTime: 8.9 },
      { id: 'w20', word: 'mera.', startTime: 9.0, endTime: 9.5 }
    ],
    triage: {
      urgencyLevel: 'CRITICAL',
      threats: [
        'Physical confinement inside locked room ("room bahar se band kar diya")',
        'Aggressor actively attempting phone confiscation to sever lifeline'
      ],
      injuries: [
        'Head trauma with active hemorrhage ("sir se khoon nikal raha hai")',
        'Concussion and acute blood loss risk'
      ],
      location: {
        raw: 'House near Chander Nagar Gurudwara, Alambagh, Lucknow',
        detectedAddress: 'Gali 4, Near Gurudwara, Alambagh, Lucknow 226005',
        confidence: 0.81,
        ambiguityScore: 35,
        landmarks: ['Chander Nagar Gurudwara', 'Old Metro Pillar 114']
      },
      childrenAtRisk: {
        detected: false,
        details: 'No dependents mentioned in initial audio stream'
      },
      callerConstraints: {
        canSpeakFreely: false,
        whispering: false,
        silenceLikely: true,
        backgroundThreatPresent: true
      },
      missingDetails: ['Is caller feeling dizzy or faint?', 'Is aggressor still outside the bedroom door?'],
      evidenceLinks: [
        {
          id: 'ev-l1',
          category: 'injury',
          label: 'Active Head Trauma',
          quoteHinglish: 'sir se khoon nikal raha hai',
          englishTranslation: 'Blood is bleeding from my head',
          timestamp: '00:02',
          confidence: 0.99,
          severity: 'critical',
          ruleEnforced: true
        },
        {
          id: 'ev-l2',
          category: 'threat',
          label: 'Forced Confinement',
          quoteHinglish: 'room bahar se band kar diya hai',
          englishTranslation: 'He locked the room from outside',
          timestamp: '00:06',
          confidence: 0.95,
          severity: 'critical'
        }
      ]
    },
    safetyFloor: {
      active: true,
      ruleId: 'RULE-SF-01',
      ruleName: 'Severe Bodily Injury & Confinement Rule',
      enforcedLevel: 'CRITICAL',
      originalAILevel: 'CRITICAL',
      rationale:
        'Active hemorrhage + involuntary physical confinement triggers Tier-1 Emergency Protocol. Simultaneous Police 112 and Emergency Medical 108 dispatch mandated.',
      cannotOverrideDownward: true
    },
    safeSignalQuestions: [
      {
        id: 'ql1',
        questionText: 'Can you apply pressure to your head with clean cloth?',
        hinglishText: 'Kya aap kisi saaf kapde se sir par dabaav bana sakti hain?',
        category: 'discrete_response',
        responseType: 'yes_no_only',
        riskRating: 'LOW_RISK',
        status: 'approved'
      }
    ],
    initialAgencies: {
      police: {
        recommended: true,
        unitType: 'PRV 112 Alambagh Quick Response',
        priority: 'IMMEDIATE',
        status: 'DISPATCHED',
        eta: '3 mins'
      },
      medical: {
        recommended: true,
        priority: 'IMMEDIATE',
        status: 'DISPATCHED',
        eta: '5 mins'
      },
      shelter: {
        recommended: false,
        shelterName: 'Mahila Kalyan Kendra',
        availableBeds: 2,
        status: 'STANDBY'
      },
      legalAid: {
        recommended: true,
        counselorType: 'Hospital Medico-Legal Liaison',
        status: 'ASSIGNED'
      }
    }
  },
  {
    id: 'call-koramangala-03',
    title: 'Transit Abduction Risk / Route Deviation',
    subtitle: '"Auto wala galat sunsaan raste le ja raha hai, battery 4%..."',
    callerNameMasked: 'S****i R****o',
    callerPhoneMasked: '+91 97*** **304',
    cityArea: 'Koramangala Ring Road, Bengaluru',
    initialTranscript:
      'Auto wala galat sunsaan raste pe le ja raha hai, ruka nahi raha... phone ki battery sirf 4 percent bachi hai.',
    words: [
      { id: 'w1', word: 'Auto', startTime: 0.2, endTime: 0.5 },
      { id: 'w2', word: 'wala', startTime: 0.6, endTime: 0.8 },
      { id: 'w3', word: 'galat', startTime: 0.9, endTime: 1.2, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w4', word: 'sunsaan', startTime: 1.3, endTime: 1.7, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w5', word: 'raste', startTime: 1.8, endTime: 2.1 },
      { id: 'w6', word: 'pe', startTime: 2.2, endTime: 2.3 },
      { id: 'w7', word: 'le', startTime: 2.4, endTime: 2.6 },
      { id: 'w8', word: 'ja', startTime: 2.7, endTime: 2.9 },
      { id: 'w9', word: 'raha', startTime: 3.0, endTime: 3.2 },
      { id: 'w10', word: 'hai,', startTime: 3.3, endTime: 3.6 },
      { id: 'w11', word: 'ruka', startTime: 4.1, endTime: 4.4, isRedFlag: true, flagCategory: 'threat' },
      { id: 'w12', word: 'nahi', startTime: 4.5, endTime: 4.7 },
      { id: 'w13', word: 'raha...', startTime: 4.8, endTime: 5.3 },
      { id: 'w14', word: 'phone', startTime: 6.0, endTime: 6.4 },
      { id: 'w15', word: 'ki', startTime: 6.5, endTime: 6.7 },
      { id: 'w16', word: 'battery', startTime: 6.8, endTime: 7.2 },
      { id: 'w17', word: 'sirf', startTime: 7.3, endTime: 7.6 },
      { id: 'w18', word: '4', startTime: 7.7, endTime: 8.0, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w19', word: 'percent', startTime: 8.1, endTime: 8.6, isRedFlag: true, flagCategory: 'caller_safety' },
      { id: 'w20', word: 'bachi', startTime: 8.7, endTime: 9.1 },
      { id: 'w21', word: 'hai.', startTime: 9.2, endTime: 9.6 }
    ],
    triage: {
      urgencyLevel: 'CRITICAL',
      threats: [
        'Transit kidnapping / route diversion ("galat sunsaan raste")',
        'Driver refusing to stop vehicle upon passenger demand',
        'Imminent total communication cutoff due to depleted 4% battery'
      ],
      injuries: ['No current injuries; high imminent danger of assault'],
      location: {
        raw: 'Outer Ring Road flyover heading toward Bellandur service lane',
        detectedAddress: 'Near EcoSpace / Bellandur unlit bypass road, Bengaluru',
        confidence: 0.74,
        ambiguityScore: 58,
        landmarks: ['Service road underpass', 'Dark stretch behind tech park']
      },
      childrenAtRisk: {
        detected: false,
        details: 'Solo female commuter'
      },
      callerConstraints: {
        canSpeakFreely: false,
        whispering: true,
        silenceLikely: true,
        backgroundThreatPresent: true
      },
      missingDetails: ['Vehicle registration plate digits', 'Color of auto / roof hood'],
      evidenceLinks: [
        {
          id: 'ev-k1',
          category: 'threat',
          label: 'Hostile Route Deviation',
          quoteHinglish: 'galat sunsaan raste pe le ja raha hai',
          englishTranslation: 'Taking me on wrong deserted route',
          timestamp: '00:02',
          confidence: 0.94,
          severity: 'critical',
          ruleEnforced: true
        },
        {
          id: 'ev-k2',
          category: 'caller_safety',
          label: 'Fading Lifeline (<5% Battery)',
          quoteHinglish: 'phone ki battery sirf 4 percent bachi hai',
          englishTranslation: 'Phone battery only has 4 percent left',
          timestamp: '00:08',
          confidence: 0.97,
          severity: 'critical',
          ruleEnforced: true
        }
      ]
    },
    safetyFloor: {
      active: true,
      ruleId: 'RULE-SF-03',
      ruleName: 'In-Transit Threat + Imminent Device Power Loss',
      enforcedLevel: 'CRITICAL',
      originalAILevel: 'CRITICAL',
      rationale:
        'Transit route hijacking coupled with critically depleted phone battery (<5%) leaves zero buffer for delayed escalation. Immediate GPS beacon locking and Highway Interceptor alert triggered.',
      cannotOverrideDownward: true
    },
    safeSignalQuestions: [
      {
        id: 'qk1',
        questionText: 'Can you see the last 4 digits of the auto plate on the meter?',
        hinglishText: 'Kya meter par auto ka number dikh raha hai?',
        category: 'location_precision',
        responseType: 'short_phrase',
        riskRating: 'LOW_RISK',
        status: 'approved'
      }
    ],
    initialAgencies: {
      police: {
        recommended: true,
        unitType: 'Bengaluru City Police Interceptor 112',
        priority: 'IMMEDIATE',
        status: 'REQUESTED',
        eta: '4 mins'
      },
      medical: {
        recommended: false,
        priority: 'STANDBY',
        status: 'NOT_REQUESTED'
      },
      shelter: {
        recommended: false,
        shelterName: 'N/A',
        availableBeds: 0,
        status: 'NOT_REQUESTED'
      },
      legalAid: {
        recommended: false,
        counselorType: 'N/A',
        status: 'NOT_REQUESTED'
      }
    }
  }
];

export const STRESS_LAB_BENCHMARKS: StressLabScenario[] = [
  {
    id: 'bench-01',
    title: 'Proposal Anchor: Whispered Stalker + Child Present',
    category: 'Perimeter Threat & Vulnerable Dependent',
    hinglishSample: 'Didi, woh ghar ke bahar aa gaya hai… mera bachcha bhi mere saath hai. Main zyada der baat nahi kar sakti.',
    description: 'Verifies safety floor cannot be overridden downward even if caller speaks softly or disconnects within 10 seconds.',
    expectedUrgency: 'CRITICAL',
    safetyFloorExpected: true,
    expectedRedFlags: ['ghar ke bahar', 'bachcha', 'saath hai', 'zyada der baat nahi']
  },
  {
    id: 'bench-02',
    title: 'Silent Tap / Indirect Code Language',
    category: 'Covert Communication & Hostile Presence',
    hinglishSample: 'Haan didi... dawai lene aayi thi market... nahi kuch nahi chahiye... (2 fast taps on phone mic)',
    description: 'Tests detection of indirect distress, forced normal tone, and mic tap signals.',
    expectedUrgency: 'SEVERE',
    safetyFloorExpected: true,
    expectedRedFlags: ['dawai lene', 'mic tap signal', 'forced normal tone']
  },
  {
    id: 'bench-03',
    title: 'Sudden Disconnection / Silent Line',
    category: 'Call Continuity & Abrupt Drop',
    hinglishSample: 'Darwaza tod raha hai... (Loud bang sound, sudden silence, call drops at 00:07)',
    description: 'Tests whether SAATHI maintains emergency state after drop rather than closing ticket.',
    expectedUrgency: 'CRITICAL',
    safetyFloorExpected: true,
    expectedRedFlags: ['darwaza tod raha', 'audio dropout', 'premise breach']
  },
  {
    id: 'bench-04',
    title: 'Ambiguous Colloquial Hinglish Slang',
    category: 'Linguistic Nuance & Slang Parsing',
    hinglishSample: 'Woh banda phatta maar raha hai mohalle me, chhuri leke ghoom raha hai mere pichhe.',
    description: 'Tests extraction of regional north-Indian slang ("phatta", "chhuri") into formal threat tags.',
    expectedUrgency: 'CRITICAL',
    safetyFloorExpected: true,
    expectedRedFlags: ['chhuri (knife)', 'phatta maar raha', 'pichhe (stalking)']
  },
  {
    id: 'bench-05',
    title: 'Low Urgency Inquiry with Non-threatening Hinglish',
    category: 'False Positive Prevention',
    hinglishSample: 'Namaste didi, mujhe kal ke legal camp ke timing pata karne the, court me date hai agle hafte.',
    description: 'Ensures non-emergency calls are properly triaged as LOW without false safety floor triggers.',
    expectedUrgency: 'LOW',
    safetyFloorExpected: false,
    expectedRedFlags: []
  }
];

export const MOCK_INCIDENT_HISTORY: IncidentRecord[] = [
  {
    id: 'inc-90412',
    caseId: 'DEL-2026-90412',
    timestamp: 'Today, 00:19:42',
    callerPhoneMasked: '+91 98*** **412',
    locationArea: 'Rohini Sector 16, New Delhi',
    urgency: 'CRITICAL',
    keyPhrases: ['ghar ke bahar', 'bachcha saath hai', 'zyada der baat nahi'],
    status: 'Active',
    officerAssigned: 'Inspector R. Sharma (PCR-112)',
    safetyFloorTriggered: true,
    continuityNotes: 'Current active distress call. High proximity threat. Units alerted.'
  },
  {
    id: 'inc-89104',
    caseId: 'DEL-2026-89104',
    timestamp: '10 Oct 2026, 21:14',
    callerPhoneMasked: '+91 98*** **412',
    locationArea: 'Rohini Sector 16, New Delhi',
    urgency: 'SEVERE',
    keyPhrases: ['gali galoch', 'chilla raha hai bahar', 'darwaza peet raha'],
    status: 'Resolved',
    officerAssigned: 'Sub-Inspector Neha V.',
    safetyFloorTriggered: true,
    continuityNotes: 'Ex-partner warned by local beat patrol. Caller declined FIR at that time. Flagged for priority response on recur.'
  },
  {
    id: 'inc-88421',
    caseId: 'LKO-2026-88421',
    timestamp: '17 Oct 2026, 18:32',
    callerPhoneMasked: '+91 94*** **820',
    locationArea: 'Alambagh, Lucknow',
    urgency: 'CRITICAL',
    keyPhrases: ['khoon nikal raha', 'gate band hai'],
    status: 'Dispatched',
    officerAssigned: 'PRV 112 Unit 8',
    safetyFloorTriggered: true,
    continuityNotes: 'Ambulance 108 and PRV dispatched. Caller secured in locked room.'
  },
  {
    id: 'inc-87211',
    caseId: 'BLR-2026-87211',
    timestamp: '16 Oct 2026, 23:05',
    callerPhoneMasked: '+91 97*** **304',
    locationArea: 'Bellandur Ring Road, Bengaluru',
    urgency: 'CRITICAL',
    keyPhrases: ['galat rasta', 'auto wala nahi ruk raha', 'battery low'],
    status: 'Resolved',
    officerAssigned: 'Whitefield Patrol Squad',
    safetyFloorTriggered: true,
    continuityNotes: 'Auto intercepted near EcoSpace flyover. Passenger safely escorted.'
  }
];
