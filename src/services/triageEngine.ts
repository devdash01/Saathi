import type {
  StructuredTriage,
  SafetyFloor,
  UrgencyLevel,
  SafeSignalQuestion,
  AgencyDispatchState,
  EvidenceItem,
  WarningSignCategory
} from '../types';
import { LX } from '../data/lexiconData';
import { extractLocationFromSpeech } from './locationService';

export interface TriageRule {
  id: string;
  name: string;
  condition: (triage: StructuredTriage, rawTranscript: string) => boolean;
  enforceMinimumLevel: UrgencyLevel;
  rationale: string;
}

export const SAFETY_FLOOR_RULES: TriageRule[] = [
  {
    id: 'RULE-SF-01',
    name: 'Severe Hemorrhage / Active Trauma Guardrail',
    condition: (_triage, text) => {
      const lower = text.toLowerCase();
      return (
        lower.includes('khoon') ||
        lower.includes('bleeding') ||
        lower.includes('sir pe mara') ||
        lower.includes('chaku') ||
        lower.includes('fracture')
      );
    },
    enforceMinimumLevel: 'CRITICAL',
    rationale:
      'Active bleeding or penetrating trauma detected. Immediate medical intervention protocol required. Downward downgrade strictly prevented.'
  },
  {
    id: 'RULE-SF-02',
    name: 'Minor Child at Risk + Perimeter Breach Guardrail',
    condition: (triage, text) => {
      const lower = text.toLowerCase();
      const hasChild =
        triage.childrenAtRisk.detected ||
        lower.includes('bachcha') ||
        lower.includes('bacche') ||
        lower.includes('beti') ||
        lower.includes('beta') ||
        lower.includes('child');
      const hasPerimeterThreat =
        lower.includes('ghar ke bahar') ||
        lower.includes('darwaza') ||
        lower.includes('gate') ||
        lower.includes('bahar khada') ||
        lower.includes('chhat pe') ||
        lower.includes('stalker');
      return hasChild && hasPerimeterThreat;
    },
    enforceMinimumLevel: 'CRITICAL',
    rationale:
      'Aggressor in immediate residential perimeter with dependent minor present. High risk of hostage/breach escalation. Safety floor locks urgency to CRITICAL.'
  },
  {
    id: 'RULE-SF-03',
    name: 'Transit Diversion + Low Battery Lifeline Guardrail',
    condition: (_triage, text) => {
      const lower = text.toLowerCase();
      const transitDeviation =
        lower.includes('auto') ||
        lower.includes('cab') ||
        lower.includes('galat raste') ||
        lower.includes('sunsaan') ||
        lower.includes('ruk nahi raha');
      const batteryOrDrop =
        lower.includes('battery') ||
        lower.includes('percent') ||
        lower.includes('phone band') ||
        lower.includes('switch off');
      return transitDeviation && batteryOrDrop;
    },
    enforceMinimumLevel: 'CRITICAL',
    rationale:
      'Mobile hostage/transit abduction threat with impending power loss. Lifeline cutoff imminent. Urgent GPS tracking and interceptor alert required.'
  },
  {
    id: 'RULE-SF-04',
    name: 'Covert Distress / Speech Suppression Guardrail',
    condition: (triage, text) => {
      const lower = text.toLowerCase();
      return (
        triage.callerConstraints.whispering ||
        lower.includes('zyada der baat nahi') ||
        lower.includes('chupke') ||
        lower.includes('sun lega') ||
        lower.includes('phone chheen')
      );
    },
    enforceMinimumLevel: 'SEVERE',
    rationale:
      'Caller is unable to speak openly due to proximity of threatening party. AI cannot classify as Low even if caller tone is calm or ambiguous.'
  }
];

export function levelToScore(level: UrgencyLevel): number {
  switch (level) {
    case 'CRITICAL':
      return 4;
    case 'SEVERE':
      return 3;
    case 'MODERATE':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 1;
  }
}

export function scoreToLevel(score: number): UrgencyLevel {
  if (score >= 4) return 'CRITICAL';
  if (score === 3) return 'SEVERE';
  if (score === 2) return 'MODERATE';
  return 'LOW';
}

function mapUrgency(u: string): UrgencyLevel {
  if (u === 'Critical') return 'CRITICAL';
  if (u === 'High') return 'SEVERE';
  if (u === 'Medium') return 'MODERATE';
  return 'LOW';
}

// =========================================================================
// REAL REFERENCE SAATHI ENGINE IMPLEMENTATION (PORTED & COMPILED DIRECTLY)
// =========================================================================

export const LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export function makeEngine(lexiconData: any) {
  const CANON: Record<string, string> = {};
  for (const [k, vs] of Object.entries(lexiconData.variants as Record<string, string[]>)) {
    for (const v of vs) CANON[v] = k;
  }

  const SIG: Record<string, any> = {};
  for (const [k, s] of Object.entries(lexiconData.signals as Record<string, any>)) {
    SIG[k] = { ...s, g: new RegExp(s.rx, "g") };
  }

  const CODE = (lexiconData.code as any[]).map((c) => ({ ...c, re: new RegExp(c.rx) }));
  const STRUCT = Object.fromEntries(
    Object.entries(lexiconData.struct as Record<string, string>).map(([k, v]) => [k, new RegExp(v)])
  );
  const DENIAL = new RegExp(lexiconData.denial);
  const NEG_AFTER = new RegExp(lexiconData.negAfter);
  const NEG_BEFORE = new RegExp(lexiconData.negBefore);
  const LOC = (lexiconData.loc as any[]).map((l) => ({ ...l, g: new RegExp(l.rx, "g") }));
  const THREAT_PRIORITY = [
    "self_harm",
    "sexual_violence",
    "trafficking",
    "physical_violence",
    "medical",
    "domestic_abuse",
    "stalking",
    "shelter_need",
    "legal_query",
    "non_emergency"
  ];

  function normalize(text: string): string {
    let t = (text || '').toLowerCase();
    for (const [k, v] of Object.entries(lexiconData.devanagari as Record<string, string>)) {
      t = t.split(k).join(` ${v} `);
    }
    t = t
      .replace(/(.)\1{2,}/gsu, "$1$1")
      .replace(/_/g, " ")
      .replace(/[^\p{L}\p{M}\p{N}_\s\[\]()]/gu, " ");
    return t
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => CANON[w] || w)
      .join(" ");
  }

  const negated = (norm: string, m: RegExpMatchArray) => {
    const idx = m.index || 0;
    const after = norm.slice(idx + m[0].length, idx + m[0].length + 24);
    const before = norm.slice(Math.max(0, idx - 14), idx);
    return NEG_AFTER.test(after) || NEG_BEFORE.test(before);
  };

  const LOC_STOP = new Set([
    "hai", "hoon", "hu", "mein", "me", "se", "par", "pe", "bhi", "aur", "jaldi", "abhi",
    "please", "plz", "wahi", "yahi", "same", "ka", "ki", "ke", "wala", "wali", "hum", "main", "mera", "meri", "ghar", "tha", "the"
  ]);

  function cleanLoc(p: string): string {
    let t = p.split(/\s+/).filter(Boolean);
    while (t.length && LOC_STOP.has(t[0])) t.shift();
    for (let i = t.length - 1; i >= 0; i--) {
      if (["hai", "hoon", "hu", "tha"].includes(t[i])) {
        t = t.slice(i + 1);
        break;
      }
    }
    while (t.length && LOC_STOP.has(t[t.length - 1]) && !["paas", "samne"].includes(t[t.length - 1])) {
      t.pop();
    }
    return t.join(" ");
  }

  function extractLocation(norm: string) {
    let best = { phrase: null as string | null, kind: null as string | null, confidence: 0 };
    for (const l of LOC) {
      l.g.lastIndex = 0;
      for (const m of norm.matchAll(l.g)) {
        const first = (m[1].split(/\s+/)[0]) || "";
        if (l.kind === "stated" && LOC_STOP.has(first)) continue;
        const phrase = cleanLoc(m[1].trim());
        if (phrase.length >= 4 && phrase.split(/\s+/).length >= (l.kind !== "landmark" ? 1 : 2) && l.conf > best.confidence) {
          best = { phrase, kind: l.kind, confidence: l.conf };
        }
      }
    }
    return best;
  }

  function modelProposal(hits: Record<string, string[]>, struct: Record<string, boolean>) {
    let score = 0;
    for (const [sid, hs] of Object.entries(hits)) {
      const s = SIG[sid];
      if (!s) continue;
      const w = { hard: 1.0, soft: 0.5, context: 0.0, benign: -0.4 }[s.kind as string] || 0;
      score += w * (s.kind === "hard" ? Math.min(hs.length, 2) : 1);
      if (s.kind === "soft" && s.floor === 0) score -= w;
    }
    if (hits.immediacy && score > 0.4) score += 0.8;
    if (hits.child_danger && score > 0.4) score += 0.7;
    if (hits.fear && hits.immediacy) score += 0.5;
    if (struct.whisper || struct.background_threat) score += 0.9;
    return score >= 2.5 ? 3 : score >= 1.5 ? 2 : score >= 0.5 ? 1 : 0;
  }

  const ev = (signal: string, text: string, why: string, effect: string) => ({ signal, text, why, effect });
  const has = (hits: Record<string, string[]>, ...ks: string[]) => ks.some((k) => hits[k]);

  function assess(
    raw: string,
    answers: Record<string, string> = {},
    constraints: Record<string, any> = {},
    llmProposal: number | null = null
  ) {
    const norm = normalize(raw);
    const a: any = {
      evidence: [] as any[],
      unresolved: [] as string[],
      suppressed: [] as any[],
      needs_operator_review: false,
      review_reason: ""
    };
    const low = raw.toLowerCase();
    const struct = Object.fromEntries(Object.entries(STRUCT).map(([k, r]) => [k, r.test(low)]));
    const hits: Record<string, string[]> = {};

    for (const [sid, s] of Object.entries(SIG)) {
      s.g.lastIndex = 0;
      for (const m of norm.matchAll(s.g)) {
        if (negated(norm, m) && (s.kind === "hard" || s.kind === "soft")) {
          a.suppressed.push(ev(sid, m[0], s.why + " (negated)", "suppressed"));
          continue;
        }
        (hits[sid] = hits[sid] || []).push(m[0]);
      }
    }

    let floor = 0;
    const threats = new Set<string>();
    const routes = new Set<string>();

    for (const [sid, hs] of Object.entries(hits)) {
      const s = SIG[sid];
      if ((s.kind === "hard" || s.kind === "soft") && s.floor > 0) {
        if (s.kind === "hard") floor = Math.max(floor, s.floor);
        a.evidence.push(ev(sid, hs[0], s.why, `${s.kind === "hard" ? "floor" : "soft"}:${LEVELS[s.floor]}`));
      } else {
        a.evidence.push(ev(sid, hs[0], s.why, s.kind !== "benign" ? "context" : "benign"));
      }
      if (s.threat) threats.add(s.threat);
      s.route.forEach((r: string) => routes.add(r));
    }

    if (hits.weapon && has(hits, "life_threat", "active_violence", "immediacy")) floor = Math.max(floor, 3);
    if (hits.child_danger && has(hits, "weapon", "life_threat", "active_violence", "sexual", "domestic", "forced_entry")) {
      floor = Math.max(floor, has(hits, "active_violence", "life_threat", "weapon") ? 3 : 2);
      a.evidence.push(ev("child_danger", hits.child_danger[0], "child at risk with violence cue", "floor:High+"));
    }
    if (hits.domestic && hits.immediacy && has(hits, "fear", "stalking")) floor = Math.max(floor, 2);
    if (hits.trafficking && hits.immediacy) floor = Math.max(floor, 3);
    if (hits.stalking && has(hits, "weapon", "forced_entry")) floor = Math.max(floor, 3);

    const reasons: any[] = [];
    for (const c of CODE) {
      const m = norm.match(c.re);
      if (m) {
        reasons.push({ id: c.id, text: m[0], why: c.why });
        a.evidence.push(ev(c.id, m[0], c.why, "indirect:High"));
      }
    }
    if (struct.whisper) reasons.push({ id: "whisper", text: "[whisper]", why: "annotated as whispered" });
    if (struct.background_threat) reasons.push({ id: "background", text: "[background]", why: "threatening voice in background" });

    const dm = norm.match(DENIAL);
    if (dm && (struct.whisper || struct.background_threat || reasons.length || hits.fear)) {
      reasons.push({
        id: "denial_with_distress",
        text: dm[0],
        why: "says everything is fine while distress cues are present; denial is not read as safety"
      });
    }

    a.indirect = { flag: reasons.length > 0, reasons };
    if (reasons.length) {
      floor = Math.max(floor, 2);
      routes.add("police");
      if (!threats.size) threats.add("coercion_indirect");
    }

    const facts: Record<string, boolean | null> = {};
    for (const [q, ans] of Object.entries(answers)) {
      facts[q] = ans === "yes" || ans === "YES" ? true : ans === "no" || ans === "NO" ? false : null;
    }

    const bump = (cond: boolean, lvl: number, textVal: string, whyVal: string, eff: any, route?: string) => {
      if (cond) {
        floor = Math.max(floor, lvl);
        if (route) routes.add(route);
        a.evidence.push(ev(eff.q, textVal, whyVal, eff.e));
      }
    };

    bump(facts.q_danger_now === true, 3, "haan", "caller confirmed danger now", { q: "q_danger_now", e: "floor:Critical" }, "police");
    bump(facts.q_weapon === true, 3, "haan", "caller confirmed weapon", { q: "q_weapon", e: "floor:Critical" }, "police");
    bump(facts.q_child_with === true && floor >= 2, 3, "haan", "child with caller during danger", { q: "q_child_with", e: "floor:Critical" });
    if (facts.q_injured === true) {
      floor = Math.max(floor, 2);
      routes.add("medical");
      threats.add("medical");
      a.evidence.push(ev("q_injured", "haan", "caller confirmed injury", "floor:High"));
    }
    if (facts.q_need_police === true) routes.add("police");
    if (constraints.comm_mode === "cannot_speak_safely") {
      floor = Math.max(floor, 2);
      a.evidence.push(ev("caller_constraint", "cannot_speak_safely", "caller declared she cannot speak safely", "floor:High"));
    }

    const proposal = llmProposal == null ? modelProposal(hits, struct) : llmProposal;
    let fin = Math.max(floor, proposal);
    const hk = Object.keys(hits);
    if (hk.every((k) => ["info_query", "immediacy", "child_danger"].includes(k)) && hits.info_query && floor === 0) {
      fin = Math.min(fin, 0);
    }

    a.floor = LEVELS[floor];
    a.model_proposal = LEVELS[proposal];
    a.threat_type =
      THREAT_PRIORITY.find((t) => threats.has(t)) ||
      (threats.has("coercion_indirect") ? "coercion_indirect" : fin >= 1 ? "unclear" : "non_emergency");
    if (a.threat_type === "domestic_abuse" && threats.has("physical_violence")) {
      a.threat_type = "physical_violence";
    }

    if (fin >= 2 && !routes.size) routes.add("police");
    if (fin >= 3) routes.add("police");
    if (a.threat_type === "domestic_abuse" && fin >= 2) {
      routes.add("police");
      routes.add("shelter");
    }

    a.routes = [...routes].sort();
    a.location = extractLocation(norm);
    a.facts = {
      ...facts,
      weapon_mentioned: !!hits.weapon,
      child_present: !!hits.child_danger,
      immediacy_cue: !!hits.immediacy
    };

    if (!a.location.phrase) a.unresolved.push("location");
    else if (a.location.confidence < 0.6) a.unresolved.push("location_unconfirmed");
    if (fin >= 2 && !("q_danger_now" in answers) && !hits.immediacy) a.unresolved.push("is_danger_happening_now");
    if (!hits.weapon && fin >= 2 && !("q_weapon" in answers)) a.unresolved.push("weapon_unknown");
    if (fin >= 2 && !a.facts.child_present && !("q_child_with" in answers)) a.unresolved.push("children_present_unknown");

    const nwords = norm.split(/\s+/).filter(Boolean).length;
    if (!hk.length && !reasons.length) {
      a.needs_operator_review = true;
      a.review_reason = nwords < 6 ? "very short or empty input: treat as unknown, not safe." : "no recognised signal: unclear, not safe. Operator should listen directly.";
      if (nwords < 6) fin = Math.max(fin, 1);
      a.threat_type = "unclear";
    } else if (fin <= 1 && struct.interrupted) {
      a.needs_operator_review = true;
      a.review_reason = "call interrupted/cut: safety unconfirmed.";
      fin = Math.max(fin, 1);
    } else if (proposal !== floor && Math.abs(proposal - floor) >= 2) {
      a.needs_operator_review = true;
      a.review_reason = "rules and model disagree strongly";
    }

    a.urgency_idx = fin;
    a.urgency = LEVELS[fin];
    return a;
  }

  // SafeSignal 10 Rules Checker
  const SX = Object.fromEntries(
    Object.entries(lexiconData.sx as Record<string, string>).map(([k, v]) => [k, new RegExp(v)])
  );
  const n = normalize;
  const RULEFN = [
    (q: string) => SX.yesno.test(n(q)),
    (q: string) => q.split(/\s+/).length <= 14,
    (q: string) => !SX.threat.test(n(q)),
    (q: string) => !SX.action.test(n(q)),
    (q: string, c: any) => !(SX.callback.test(n(q)) && (c.callback_safe === "no" || c.text_safe === "no")),
    (q: string) => (q.match(/\?/g) || []).length <= 1,
    (q: string) => !SX.id.test(n(q)),
    (q: string) => !SX.promise.test(n(q)),
    (q: string, c: any) => !["yes_no_only", "cannot_speak_safely"].includes(c.comm_mode) || SX.yesno.test(n(q)),
    (q: string) => !/\b(emergency|assault|domestic|incident|victim|perpetrator)\b/.test(n(q))
  ];

  function check(q: string, c: any = {}) {
    const rules = (lexiconData.rules as Array<[string, string]>).map((r, i) => ({
      id: r[0],
      desc: r[1],
      ok: Boolean(RULEFN[i](q, c))
    }));
    return { passed: rules.every((r) => r.ok), rules };
  }

  function nextQuestion(a: any, answers: Record<string, string>, c: any = {}) {
    const un = new Set(a.unresolved || []);
    const order: string[] = [];

    if (un.has("is_danger_happening_now") || a.urgency_idx >= 1) order.push("q_danger_now");
    if (un.has("location") || un.has("location_unconfirmed")) order.push("q_location_home");
    if (un.has("weapon_unknown")) order.push("q_weapon");
    if (a.urgency_idx >= 2) order.push("q_injured");
    if (un.has("children_present_unknown")) order.push("q_child_with");
    order.push("q_need_police");

    for (const id of order) {
      if (id in answers) continue;
      const q = (lexiconData.questions as Record<string, any>)[id];
      if (!q) continue;
      const chk = check(q.text, c);
      if (chk.passed) {
        return { id, text: q.text, missing_fact: q.fact, effects: q.effects, checks: chk };
      }
    }
    return null;
  }

  return { normalize, assess, check, nextQuestion, LEVELS };
}

export const saathiEngine = makeEngine(LX);

/**
 * Dynamically triage any raw Hinglish transcript returned live
 */
export function analyzeIncomingTranscript(
  text: string,
  baseLocation?: string,
  answers: Record<string, string> = {},
  constraints: Record<string, any> = {}
): {
  triage: StructuredTriage;
  safetyFloor: SafetyFloor;
  detectedFlags: string[];
  aiConfidence: { score: number; isUncertain: boolean; rationale: string };
  rawAiLevel: UrgencyLevel;
} {
  const trimmed = (text || '').trim();

  // If no speech yet, return standby state
  if (!trimmed) {
    const standbyTriage: StructuredTriage = {
      urgencyLevel: 'LOW',
      threats: [],
      injuries: [],
      location: {
        raw: baseLocation || 'Paschim Vihar, Delhi',
        detectedAddress: baseLocation || 'Paschim Vihar, New Delhi',
        confidence: 0.9,
        ambiguityScore: 10,
        landmarks: []
      },
      childrenAtRisk: {
        detected: false,
        details: 'No minor dependent reported'
      },
      callerConstraints: {
        canSpeakFreely: true,
        whispering: false,
        silenceLikely: false,
        backgroundThreatPresent: false
      },
      missingDetails: [],
      evidenceLinks: []
    };

    const emptyFloor: SafetyFloor = {
      active: false,
      ruleId: 'STANDBY',
      ruleName: 'Awaiting Caller Input',
      enforcedLevel: 'LOW',
      originalAILevel: 'LOW',
      rationale: 'Helpline receiver ready in standby mode.',
      cannotOverrideDownward: false
    };

    return {
      triage: standbyTriage,
      safetyFloor: emptyFloor,
      detectedFlags: [],
      aiConfidence: { score: 0.95, isUncertain: false, rationale: 'Listening for incoming citizen transmission' },
      rawAiLevel: 'LOW'
    };
  }

  // Run full reference engine assessment
  const assessment = saathiEngine.assess(trimmed, answers, constraints);
  const finalLevel = mapUrgency(assessment.urgency);
  const floorLevel = mapUrgency(assessment.floor);

  // Map evidence items to EvidenceItem[]
  const evidenceLinks: EvidenceItem[] = (assessment.evidence || []).map((evItem: any, idx: number) => {
    let cat: WarningSignCategory = 'caller_safety';
    if (['weapon', 'life_threat', 'active_violence', 'forced_entry', 'stalking'].includes(evItem.signal)) {
      cat = 'threat';
    } else if (['medical', 'life_medical'].includes(evItem.signal)) {
      cat = 'injury';
    } else if (evItem.signal === 'child_danger') {
      cat = 'child_at_risk';
    } else if (evItem.signal?.startsWith('loc') || evItem.signal === 'q_location_home') {
      cat = 'location';
    }

    let displayLabel = evItem.why;
    if (evItem.signal === 'life_threat') {
      displayLabel = `Danger: Threat to life (${evItem.text})`;
    } else if (evItem.signal === 'fear') {
      displayLabel = `Madad Needed: Plea for urgent help (${evItem.text})`;
    } else if (evItem.signal === 'active_violence') {
      displayLabel = `Active Physical Violence (${evItem.text})`;
    } else if (evItem.signal === 'weapon') {
      displayLabel = `Weapon / Hazard Cue (${evItem.text})`;
    }

    return {
      id: `ev-${idx}-${Date.now()}`,
      category: cat,
      label: displayLabel,
      quoteHinglish: evItem.text,
      englishTranslation: displayLabel,
      timestamp: 'Live',
      confidence: 0.94,
      severity: evItem.effect?.includes('Critical')
        ? 'critical'
        : evItem.effect?.includes('High')
        ? 'high'
        : 'medium',
      ruleEnforced: evItem.effect?.includes('floor:')
    };
  });

  const speechLoc = extractLocationFromSpeech(trimmed, baseLocation);
  if (speechLoc.isFound && speechLoc.matchedKeyword) {
    evidenceLinks.push({
      id: `ev-loc-${Date.now()}`,
      category: 'location',
      label: `Location: ${speechLoc.locality}`,
      quoteHinglish: speechLoc.matchedKeyword,
      englishTranslation: `Location: ${speechLoc.locality}`,
      timestamp: 'Live',
      confidence: 0.95,
      severity: 'medium',
      ruleEnforced: false
    });
  } else if (assessment.location?.phrase) {
    evidenceLinks.push({
      id: `ev-loc-${Date.now()}`,
      category: 'location',
      label: `Location: ${assessment.location.phrase}`,
      quoteHinglish: assessment.location.phrase,
      englishTranslation: `Location: ${assessment.location.phrase}`,
      timestamp: 'Live',
      confidence: assessment.location.confidence || 0.8,
      severity: 'medium',
      ruleEnforced: false
    });
  }

  const threatsList: string[] = [];
  (assessment.evidence || []).forEach((e: any) => {
    if (e.signal === 'life_threat') {
      const tag = `Danger: Threat to life (${e.text})`;
      if (!threatsList.includes(tag)) threatsList.push(tag);
    } else if (e.signal === 'fear') {
      const tag = `Madad Needed (${e.text})`;
      if (!threatsList.includes(tag)) threatsList.push(tag);
    } else if (e.signal === 'active_violence') {
      const tag = `Active Violence (${e.text})`;
      if (!threatsList.includes(tag)) threatsList.push(tag);
    } else if (e.effect && e.effect.includes('floor:') && !threatsList.includes(e.why)) {
      threatsList.push(e.why);
    }
  });
  if (assessment.threat_type && assessment.threat_type !== 'non_emergency') {
    const formatted = assessment.threat_type.replace(/_/g, ' ');
    if (!threatsList.some(t => t.toLowerCase().includes(formatted.toLowerCase()))) {
      threatsList.unshift(formatted);
    }
  }

  const injuriesList: string[] = [];
  (assessment.evidence || []).forEach((e: any) => {
    if (['medical', 'life_medical', 'q_injured'].includes(e.signal)) {
      injuriesList.push(e.why);
    }
  });

  const hasChild = Boolean((assessment.evidence || []).find((e: any) => e.signal === 'child_danger'));
  const isCoded = Boolean(assessment.indirect?.flag);
  const isWhispering = Boolean(assessment.indirect?.reasons?.find((r: any) => r.id === 'whisper'));

  const structuredTriage: StructuredTriage = {
    urgencyLevel: finalLevel,
    threats: threatsList.length > 0 ? threatsList : ['General distress situation under operator assist'],
    injuries: injuriesList.length > 0 ? injuriesList : ['No overt physical trauma stated'],
    location: {
      raw: speechLoc.isFound ? speechLoc.locality : (assessment.location?.phrase || baseLocation || 'Vicinity via telemetry'),
      detectedAddress: speechLoc.isFound ? speechLoc.locality : (assessment.location?.phrase || baseLocation || 'Vicinity via telemetry'),
      confidence: speechLoc.isFound ? 0.95 : (assessment.location?.confidence || 0.75),
      ambiguityScore: speechLoc.isFound || assessment.location?.phrase ? 15 : 65,
      landmarks: speechLoc.matchedKeyword ? [speechLoc.matchedKeyword] : []
    },
    childrenAtRisk: {
      detected: hasChild,
      details: hasChild ? 'Dependent minor present with caller' : 'No minor reported'
    },
    callerConstraints: {
      canSpeakFreely: !isCoded,
      whispering: isWhispering,
      silenceLikely: trimmed.includes('[silence]') || trimmed.includes('[call cut]'),
      backgroundThreatPresent: Boolean(assessment.indirect?.reasons?.find((r: any) => r.id === 'background'))
    },
    missingDetails: assessment.unresolved || [],
    evidenceLinks
  };

  const isFloorActive = assessment.floor !== 'Low';
  const safetyFloor: SafetyFloor = {
    active: isFloorActive,
    ruleId: isFloorActive ? 'RULE-FLOOR-INVARIANT' : 'NONE',
    ruleName: isFloorActive ? `Urgency Floor Locked: ${assessment.floor}` : 'Standard AI Classification',
    enforcedLevel: floorLevel,
    originalAILevel: mapUrgency(assessment.model_proposal),
    rationale: isFloorActive
      ? `Safety floor locked to ${assessment.floor} due to critical danger signals. Silence and denial cannot lower it.`
      : 'Within nominal bounds.',
    cannotOverrideDownward: isFloorActive
  };

  const detectedFlags = (assessment.evidence || []).map((e: any) => e.signal);

  return {
    triage: structuredTriage,
    safetyFloor,
    detectedFlags,
    aiConfidence: {
      score: assessment.needs_operator_review ? 0.65 : 0.95,
      isUncertain: assessment.needs_operator_review,
      rationale: assessment.review_reason || 'Verified deterministic signals match helpline safety invariants'
    },
    rawAiLevel: mapUrgency(assessment.model_proposal)
  };
}

/**
 * Generate dynamic SafeSignal questions tailored to what is known & unknown
 */
export function generateSafeSignalQuestions(
  _triage: StructuredTriage,
  rawTranscript?: string,
  answers: Record<string, string> = {},
  constraints: Record<string, any> = {}
): SafeSignalQuestion[] {
  const text = (rawTranscript || '').trim();
  if (!text) return [];

  const assessment = saathiEngine.assess(text, answers, constraints);
  const nextQ = saathiEngine.nextQuestion(assessment, answers, constraints);

  if (!nextQ) return [];

  return [
    {
      id: nextQ.id,
      questionText: nextQ.missing_fact,
      hinglishText: nextQ.text,
      category:
        nextQ.id === 'q_child_with'
          ? 'child_safety'
          : nextQ.id === 'q_weapon'
          ? 'hazard_proximity'
          : nextQ.id === 'q_injured'
          ? 'medical_triage'
          : nextQ.id === 'q_location_home'
          ? 'location_precision'
          : 'discrete_response',
      responseType: 'yes_no_only',
      riskRating: 'LOW_RISK',
      status: 'suggested'
    }
  ];
}

export interface WhatIfModification {
  callerWentSilent?: boolean;
  injuryRevealed?: boolean;
  perpetratorBreached?: boolean;
  locationAmbiguous?: boolean;
  childCryingDetected?: boolean;
}

export interface OverrideResult {
  updatedTriage: StructuredTriage;
  isOverridden: boolean;
  warning?: string;
  auditNote: string;
}

/**
 * Human Operator Priority Override
 */
export function applyHumanUrgencyOverride(
  currentTriage: StructuredTriage,
  currentSafetyFloor: SafetyFloor,
  requestedLevel: UrgencyLevel,
  operatorId: string,
  operatorName: string,
  overrideReason: string
): OverrideResult {
  const requestedScore = levelToScore(requestedLevel);
  const floorScore = levelToScore(currentSafetyFloor.enforcedLevel);

  let warning: string | undefined;
  if (currentSafetyFloor.active && requestedScore < floorScore) {
    warning = `DOWNWARD SAFETY OVERRIDE: Requested ${requestedLevel} is lower than safety floor ${currentSafetyFloor.enforcedLevel} enforced by ${currentSafetyFloor.ruleName}. Operator override accepted under human authority, reason logged for judicial audit: "${overrideReason}".`;
  }

  const updatedTriage: StructuredTriage = {
    ...currentTriage,
    urgencyLevel: requestedLevel
  };

  return {
    updatedTriage,
    isOverridden: true,
    warning,
    auditNote: `Operator ${operatorName} (${operatorId}) set urgency to ${requestedLevel}. Reason: ${overrideReason}`
  };
}

/**
 * What-if Analysis simulator
 */
export function simulateWhatIf(
  baseTriage: StructuredTriage,
  baseAgencies: AgencyDispatchState,
  mods: any
): {
  simulatedTriage: StructuredTriage;
  simulatedSafetyFloor: SafetyFloor;
  simulatedAgencies: AgencyDispatchState;
  explanation: string;
} {
  const newTriage: StructuredTriage = JSON.parse(JSON.stringify(baseTriage));
  const newAgencies: AgencyDispatchState = JSON.parse(JSON.stringify(baseAgencies));
  const explanations: string[] = [];

  let simulatedTranscript = newTriage.evidenceLinks.map((e) => e.quoteHinglish).join(' ');

  if (mods.callerWentSilent) {
    newTriage.callerConstraints.silenceLikely = true;
    newTriage.callerConstraints.canSpeakFreely = false;
    simulatedTranscript += ' [silence]';
    explanations.push('Caller sudden silence detected: System maintains highest locked urgency level.');
  }

  if (mods.injuryRevealed) {
    newTriage.injuries.unshift('Acute physical assault with visible trauma');
    newAgencies.medical.recommended = true;
    newAgencies.medical.priority = 'IMMEDIATE';
    newAgencies.medical.status = 'DISPATCHED';
    simulatedTranscript += ' khoon nikal raha hai chot lag gayi';
    explanations.push('Injury revealed: Medical 108 ambulance automatically escalated.');
  }

  if (mods.perpetratorBreached) {
    newTriage.threats.unshift('Aggressor forcibly breached inner boundary');
    newAgencies.police.priority = 'IMMEDIATE';
    newAgencies.police.status = 'DISPATCHED';
    simulatedTranscript += ' darwaza tod diya andar ghus gaya';
    explanations.push('Premise breach confirmed: Police tactical unit instructed to expedite approach.');
  }

  const analysis = analyzeIncomingTranscript(simulatedTranscript);

  return {
    simulatedTriage: analysis.triage,
    simulatedSafetyFloor: analysis.safetyFloor,
    simulatedAgencies: newAgencies,
    explanation: explanations.length > 0 ? explanations.join(' | ') : 'Baseline scenario conditions unmodified.'
  };
}

export function applySafetyFloor(
  currentTriage: StructuredTriage,
  rawTranscript: string,
  rawAiLevel: UrgencyLevel
): { effectiveLevel: UrgencyLevel; safetyFloor: SafetyFloor } {
  let highestFloorScore = levelToScore(rawAiLevel);
  let triggeredRule: TriageRule | null = null;

  for (const rule of SAFETY_FLOOR_RULES) {
    if (rule.condition(currentTriage, rawTranscript)) {
      const ruleScore = levelToScore(rule.enforceMinimumLevel);
      if (ruleScore > highestFloorScore || !triggeredRule) {
        highestFloorScore = Math.max(highestFloorScore, ruleScore);
        triggeredRule = rule;
      }
    }
  }

  const effectiveLevel = scoreToLevel(highestFloorScore);
  const floorActive = triggeredRule !== null && levelToScore(effectiveLevel) >= levelToScore(rawAiLevel);

  const safetyFloor: SafetyFloor = {
    active: floorActive,
    ruleId: triggeredRule ? triggeredRule.id : 'NONE',
    ruleName: triggeredRule ? triggeredRule.name : 'Standard AI Classification',
    enforcedLevel: effectiveLevel,
    originalAILevel: rawAiLevel,
    rationale: triggeredRule
      ? triggeredRule.rationale
      : 'Standard AI confidence score within nominal operating bounds. No safety floor override required.',
    cannotOverrideDownward: floorActive
  };

  return { effectiveLevel, safetyFloor };
}
