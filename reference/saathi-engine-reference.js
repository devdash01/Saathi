// SAATHI reference engine (JavaScript), extracted from the working prototype.
// Port this to TypeScript in packages/engine EXACTLY. Behaviour must match these functions.
// The second half (STORE, recompute, api) is the prototype's in-browser stand-in for the server:
// it shows the incident lifecycle the real server must implement.
const LX = require('./saathi-lexicon.json');
const LEVELS = ["Low", "Medium", "High", "Critical"];
function makeEngine(LX) {
  const CANON = {};
  for (const [k, vs] of Object.entries(LX.variants)) for (const v of vs) CANON[v] = k;
  const SIG = {};
  for (const [k, s] of Object.entries(LX.signals)) SIG[k] = { ...s, g: new RegExp(s.rx, "g") };
  const CODE = LX.code.map(c => ({ ...c, re: new RegExp(c.rx) }));
  const STRUCT = Object.fromEntries(Object.entries(LX.struct).map(([k, v]) => [k, new RegExp(v)]));
  const DENIAL = new RegExp(LX.denial), NEG_AFTER = new RegExp(LX.negAfter), NEG_BEFORE = new RegExp(LX.negBefore);
  const LOC = LX.loc.map(l => ({ ...l, g: new RegExp(l.rx, "g") }));
  const THREAT_PRIORITY = ["self_harm", "sexual_violence", "trafficking", "physical_violence", "medical", "domestic_abuse", "stalking", "shelter_need", "legal_query", "non_emergency"];

  function normalize(text) {
    let t = text.toLowerCase();
    for (const [k, v] of Object.entries(LX.devanagari)) t = t.split(k).join(` ${v} `);
    t = t.replace(/(.)\1{2,}/gsu, "$1$1").replace(/_/g, " ").replace(/[^\p{L}\p{M}\p{N}_\s\[\]()]/gu, " ");
    return t.split(/\s+/).filter(Boolean).map(w => CANON[w] || w).join(" ");
  }
  const negated = (norm, m) => {
    const after = norm.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const before = norm.slice(Math.max(0, m.index - 14), m.index);
    return NEG_AFTER.test(after) || NEG_BEFORE.test(before);
  };
  const LOC_STOP = new Set(["hai", "hoon", "hu", "mein", "me", "se", "par", "pe", "bhi", "aur", "jaldi", "abhi", "please", "plz", "wahi", "yahi", "same", "ka", "ki", "ke", "wala", "wali", "hum", "main", "mera", "meri", "ghar", "tha", "the"]);
  function cleanLoc(p) {
    let t = p.split(/\s+/).filter(Boolean);
    while (t.length && LOC_STOP.has(t[0])) t.shift();
    for (let i = t.length - 1; i >= 0; i--) if (["hai", "hoon", "hu", "tha"].includes(t[i])) { t = t.slice(i + 1); break; }
    while (t.length && LOC_STOP.has(t[t.length - 1]) && !["paas", "samne"].includes(t[t.length - 1])) t.pop();
    return t.join(" ");
  }
  function extractLocation(norm) {
    let best = { phrase: null, kind: null, confidence: 0 };
    for (const l of LOC) {
      l.g.lastIndex = 0;
      for (const m of norm.matchAll(l.g)) {
        const first = (m[1].split(/\s+/)[0]) || "";
        if (l.kind === "stated" && LOC_STOP.has(first)) continue;
        const phrase = cleanLoc(m[1].trim());
        if (phrase.length >= 4 && phrase.split(/\s+/).length >= (l.kind !== "landmark" ? 1 : 2) && l.conf > best.confidence) best = { phrase, kind: l.kind, confidence: l.conf };
      }
    }
    return best;
  }
  function perpetrator(raw) {
    let m = raw.match(/\b(pati|husband|devar|jeth|sasur|padosi|landlord|malik|boss|uncle|chacha|mama|dost|ex|boyfriend|manager|driver|teacher)\s+([A-Z][a-z]+)/);
    if (m) return { name: m[2], relation: normalize(m[1]) };
    m = raw.match(/\b([A-Z][a-z]{2,})\s+(?:naam|name)\b|\bnaam\s+([A-Z][a-z]{2,})/);
    if (m) return { name: m[1] || m[2], relation: null };
    const rel = raw.toLowerCase().match(/\b(mere pati|pati|husband|padosi|landlord|boss|ex|boyfriend|devar|jeth|sasur)\b/);
    return { name: null, relation: rel ? normalize(rel[1]) : null };
  }
  function modelProposal(hits, struct) {
    let score = 0;
    for (const [sid, hs] of Object.entries(hits)) {
      const s = SIG[sid];
      const w = { hard: 1.0, soft: 0.5, context: 0.0, benign: -0.4 }[s.kind];
      score += w * (s.kind === "hard" ? Math.min(hs.length, 2) : 1);
      if (s.kind === "soft" && s.floor === 0) score -= w;
    }
    if (hits.immediacy && score > 0.4) score += 0.8;
    if (hits.child_danger && score > 0.4) score += 0.7;
    if (hits.fear && hits.immediacy) score += 0.5;
    if (struct.whisper || struct.background_threat) score += 0.9;
    return score >= 2.5 ? 3 : score >= 1.5 ? 2 : score >= 0.5 ? 1 : 0;
  }
  const ev = (signal, text, why, effect) => ({ signal, text, why, effect });
  const has = (hits, ...ks) => ks.some(k => hits[k]);

  function assess(raw, answers = {}, constraints = {}, llmProposal = null) {
    const norm = normalize(raw), a = { evidence: [], unresolved: [], suppressed: [], needs_operator_review: false, review_reason: "" };
    const low = raw.toLowerCase();
    const struct = Object.fromEntries(Object.entries(STRUCT).map(([k, r]) => [k, r.test(low)]));
    const hits = {};
    for (const [sid, s] of Object.entries(SIG)) {
      s.g.lastIndex = 0;
      for (const m of norm.matchAll(s.g)) {
        if (negated(norm, m) && (s.kind === "hard" || s.kind === "soft")) { a.suppressed.push(ev(sid, m[0], s.why + " (negated)", "suppressed")); continue; }
        (hits[sid] = hits[sid] || []).push(m[0]);
      }
    }
    let floor = 0; const threats = new Set(), routes = new Set();
    for (const [sid, hs] of Object.entries(hits)) {
      const s = SIG[sid];
      if ((s.kind === "hard" || s.kind === "soft") && s.floor > 0) {
        if (s.kind === "hard") floor = Math.max(floor, s.floor);
        a.evidence.push(ev(sid, hs[0], s.why, `${s.kind === "hard" ? "floor" : "soft"}:${LEVELS[s.floor]}`));
      } else a.evidence.push(ev(sid, hs[0], s.why, s.kind !== "benign" ? "context" : "benign"));
      if (s.threat) threats.add(s.threat);
      s.route.forEach(r => routes.add(r));
    }
    if (hits.weapon && has(hits, "life_threat", "active_violence", "immediacy")) floor = Math.max(floor, 3);
    if (hits.child_danger && has(hits, "weapon", "life_threat", "active_violence", "sexual", "domestic", "forced_entry")) {
      floor = Math.max(floor, has(hits, "active_violence", "life_threat", "weapon") ? 3 : 2);
      a.evidence.push(ev("child_danger", hits.child_danger[0], "child at risk with violence cue", "floor:High+"));
    }
    if (hits.domestic && hits.immediacy && has(hits, "fear", "stalking")) floor = Math.max(floor, 2);
    if (hits.trafficking && hits.immediacy) floor = Math.max(floor, 3);
    if (hits.stalking && has(hits, "weapon", "forced_entry")) floor = Math.max(floor, 3);

    const reasons = [];
    for (const c of CODE) { const m = norm.match(c.re); if (m) { reasons.push({ id: c.id, text: m[0], why: c.why }); a.evidence.push(ev(c.id, m[0], c.why, "indirect:High")); } }
    if (struct.whisper) reasons.push({ id: "whisper", text: "[whisper]", why: "annotated as whispered" });
    if (struct.background_threat) reasons.push({ id: "background", text: "[background]", why: "threatening voice in background" });
    const dm = norm.match(DENIAL);
    if (dm && (struct.whisper || struct.background_threat || reasons.length || hits.fear))
      reasons.push({ id: "denial_with_distress", text: dm[0], why: "says everything is fine while distress cues are present; denial is not read as safety" });
    a.indirect = { flag: reasons.length > 0, reasons };
    if (reasons.length) { floor = Math.max(floor, 2); routes.add("police"); if (!threats.size) threats.add("coercion_indirect"); }

    const facts = {};
    for (const [q, ans] of Object.entries(answers)) facts[q] = ans === "yes" ? true : ans === "no" ? false : null;
    const bump = (cond, lvl, text, why, eff, route) => { if (cond) { floor = Math.max(floor, lvl); if (route) routes.add(route); a.evidence.push(ev(...[eff.q, text, why, eff.e])); } };
    bump(facts.q_danger_now === true, 3, "haan", "caller confirmed danger now", { q: "q_danger_now", e: "floor:Critical" }, "police");
    bump(facts.q_weapon === true, 3, "haan", "caller confirmed weapon", { q: "q_weapon", e: "floor:Critical" }, "police");
    bump(facts.q_child_with === true && floor >= 2, 3, "haan", "child with caller during danger", { q: "q_child_with", e: "floor:Critical" });
    if (facts.q_injured === true) { floor = Math.max(floor, 2); routes.add("medical"); threats.add("medical"); a.evidence.push(ev("q_injured", "haan", "caller confirmed injury", "floor:High")); }
    if (facts.q_need_police === true) routes.add("police");
    if (constraints.comm_mode === "cannot_speak_safely") { floor = Math.max(floor, 2); a.evidence.push(ev("caller_constraint", "cannot_speak_safely", "caller declared she cannot speak safely", "floor:High")); }
    const asked = constraints.assistance_requested || [];
    if (asked.includes("medical")) routes.add("medical");
    if (asked.includes("police")) routes.add("police");

    const proposal = llmProposal == null ? modelProposal(hits, struct) : llmProposal;
    let fin = Math.max(floor, proposal);
    const hk = Object.keys(hits);
    if (hk.every(k => ["info_query", "immediacy", "child_danger"].includes(k)) && hits.info_query && floor === 0) fin = Math.min(fin, 0);
    a.floor = LEVELS[floor]; a.model_proposal = LEVELS[proposal];
    a.threat_type = THREAT_PRIORITY.find(t => threats.has(t)) || (threats.has("coercion_indirect") ? "coercion_indirect" : fin >= 1 ? "unclear" : "non_emergency");
    if (a.threat_type === "domestic_abuse" && threats.has("physical_violence")) a.threat_type = "physical_violence";
    if (fin >= 2 && !routes.size) routes.add("police");
    if (fin >= 3) routes.add("police");
    if (a.threat_type === "domestic_abuse" && fin >= 2) { routes.add("police"); routes.add("shelter"); }
    a.routes = [...routes].sort();
    a.location = extractLocation(norm); a.perpetrator = perpetrator(raw);
    a.facts = { ...facts, weapon_mentioned: !!hits.weapon, child_present: !!hits.child_danger, immediacy_cue: !!hits.immediacy };
    if (!a.location.phrase) a.unresolved.push("location"); else if (a.location.confidence < 0.6) a.unresolved.push("location_unconfirmed");
    if (fin >= 2 && !("q_danger_now" in answers) && !hits.immediacy) a.unresolved.push("is_danger_happening_now");
    if (!hits.weapon && fin >= 2 && !("q_weapon" in answers)) a.unresolved.push("weapon_unknown");
    if (fin >= 2 && !a.facts.child_present && !("q_child_with" in answers)) a.unresolved.push("children_present_unknown");
    const nwords = norm.split(/\s+/).filter(Boolean).length;
    if (!hk.length && !reasons.length) {
      a.needs_operator_review = true; a.review_reason = nwords < 6 ? "very short or empty input: treat as unknown, not safe." : "no recognised signal: unclear, not safe. Operator should listen directly.";
      if (nwords < 6) fin = Math.max(fin, 1);
      a.threat_type = "unclear";
    } else if (fin <= 1 && struct.interrupted) {
      a.needs_operator_review = true; a.review_reason = "call interrupted/cut: safety unconfirmed."; fin = Math.max(fin, 1);
    } else if (proposal !== floor && Math.abs(proposal - floor) >= 2) { a.needs_operator_review = true; a.review_reason = "rules and model disagree strongly"; }
    a.urgency_idx = fin; a.urgency = LEVELS[fin];
    return a;
  }

  // ---- SafeSignal ----
  const SX = Object.fromEntries(Object.entries(LX.sx).map(([k, v]) => [k, new RegExp(v)]));
  const n = normalize;
  const RULEFN = [
    (q, c) => SX.yesno.test(n(q)), (q, c) => q.split(/\s+/).length <= 14, (q, c) => !SX.threat.test(n(q)),
    (q, c) => !SX.action.test(n(q)), (q, c) => !(SX.callback.test(n(q)) && (c.callback_safe === "no" || c.text_safe === "no")),
    (q, c) => (q.match(/\?/g) || []).length <= 1, (q, c) => !SX.id.test(n(q)), (q, c) => !SX.promise.test(n(q)),
    (q, c) => !["yes_no_only", "cannot_speak_safely"].includes(c.comm_mode) || SX.yesno.test(n(q)),
    (q, c) => !/\b(emergency|assault|domestic|incident|victim|perpetrator)\b/.test(n(q)),
  ];
  function check(q, c = {}) {
    const rules = LX.rules.map((r, i) => ({ id: r[0], desc: r[1], ok: !!RULEFN[i](q, c) }));
    return { passed: rules.every(r => r.ok), rules };
  }
  function nextQuestion(a, answers, c = {}) {
    const un = new Set(a.unresolved), order = [];
    if (un.has("is_danger_happening_now") || a.urgency_idx >= 1) order.push("q_danger_now");
    if (un.has("location") || un.has("location_unconfirmed")) order.push("q_location_home");
    if (un.has("weapon_unknown")) order.push("q_weapon");
    if (a.urgency_idx >= 2) order.push("q_injured");
    if (un.has("children_present_unknown")) order.push("q_child_with");
    order.push("q_need_police");
    for (const id of order) {
      if (id in answers) continue;
      const q = LX.questions[id], chk = check(q.text, c);
      if (chk.passed) return { id, text: q.text, missing_fact: q.fact, effects: q.effects, checks: chk };
    }
    return null;
  }

  // ---- linking ----
  function translitKey(name) {
    let s = name.toLowerCase().trim().replace(/[^a-z ]/g, "");
    for (const [a, b] of [["ph", "f"], ["w", "v"], ["z", "j"], ["x", "ks"], ["q", "k"], ["c", "k"], ["sh", "s"], ["ch", "c"], ["kh", "k"], ["gh", "g"], ["bh", "b"], ["dh", "d"], ["th", "t"], ["jh", "j"], ["ck", "k"], ["ee", "i"], ["oo", "u"], ["aa", "a"], ["ey", "e"], ["ai", "e"], ["au", "o"], ["y", "i"]]) s = s.split(a).join(b);
    return s.replace(/(.)\1+/g, "$1").replace(/ /g, "");
  }
  function jw(a, b) {
    if (a === b) return 1; if (!a || !b) return 0;
    const md = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0), am = Array(a.length).fill(false), bm = Array(b.length).fill(false); let m = 0;
    for (let i = 0; i < a.length; i++) for (let j = Math.max(0, i - md); j < Math.min(b.length, i + md + 1); j++) if (!bm[j] && b[j] === a[i]) { am[i] = bm[j] = true; m++; break; }
    if (!m) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
    t = Math.floor(t / 2);
    const j = (m / a.length + m / b.length + (m - t) / m) / 3; let p = 0;
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) { if (a[i] !== b[i]) break; p++; }
    return j + p * 0.1 * (1 - j);
  }
  const skel = k => k[0] + k.slice(1).replace(/[aeiou]/g, "");
  const nameSim = (a, b) => { if (!a || !b) return 0; const ka = translitKey(a), kb = translitKey(b); return Math.max(jw(ka, kb), 0.95 * jw(skel(ka), skel(kb))); };
  function phoneSim(a, b) {
    const da = (a || "").replace(/\D/g, "").slice(-10), db = (b || "").replace(/\D/g, "").slice(-10);
    if (da.length < 10 || db.length < 10) return 0; if (da === db) return 1;
    let d = 0; for (let i = 0; i < 10; i++) d += da[i] !== db[i]; return d === 1 ? 0.6 : 0;
  }
  const NOISE = new Set(["ke", "paas", "wali", "wala", "gali", "mein", "me", "ka", "ki", "road", "rd", "nagar", "colony", "ghar", "number", "no"]);
  function locSim(a, b) {
    if (!a || !b) return 0;
    const ta = normalize(a).split(" ").filter(w => w && !NOISE.has(w)).map(translitKey), tb = normalize(b).split(" ").filter(w => w && !NOISE.has(w)).map(translitKey);
    if (!ta.length || !tb.length) return 0;
    const best = (x, ys) => Math.max(...ys.map(y => jw(x, y)));
    const s = (ta.reduce((u, x) => u + best(x, tb), 0) / ta.length + tb.reduce((u, y) => u + best(y, ta), 0) / tb.length) / 2;
    return s > 0.8 ? s : s * 0.5;
  }
  const TH = 0.70;
  function matchScore(a, b) {
    const parts = { name: nameSim(a.name, b.name), phone: phoneSim(a.phone, b.phone), location: locSim(a.location, b.location) };
    let score = 0.45 * parts.name + 0.35 * parts.phone + 0.2 * parts.location;
    if (!(parts.name >= 0.9 || parts.phone >= 0.9)) score = Math.min(score, 0.55);
    return { score, parts };
  }
  return { normalize, assess, check, nextQuestion, matchScore, nameSim, LEVELS, TH };
}

// In-browser stand-in for server.py: same endpoints, same incident logic (see saathi/incident.py).
const E = makeEngine(LX);
const STORE = {};
const DEF_C = () => ({ comm_mode: "unknown", callback_safe: "unknown", text_safe: "unknown", location_correction: null, assistance_requested: [], source: "caller_declared" });
const HANDOFF = ["not_prepared", "awaiting_operator_review", "approved_simulated", "response_status_unknown"];
let seq = 0x4a1c;
function diffOf(o, n) {
  if (!o) return [];
  const d = [];
  for (const k of ["urgency", "floor", "threat_type", "routes"]) if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) d.push({ field: k, before: o[k], after: n[k] });
  if (o.location.phrase !== n.location.phrase) d.push({ field: "location", before: o.location.phrase, after: n.location.phrase });
  if (o.indirect.flag !== n.indirect.flag) d.push({ field: "indirect", before: o.indirect.flag, after: n.indirect.flag });
  const seen = new Set(o.evidence.map(e => e.signal));
  for (const e of n.evidence) if (!seen.has(e.signal)) d.push({ field: "new_evidence", before: null, after: `${e.signal}: "${e.text}" (${e.effect})` });
  return d;
}
function newInc() { return { id: "INC-" + (seq++).toString(16).toUpperCase(), lines: [], answers: {}, constraints: DEF_C(), notes: [], events: [{ t: Date.now() / 1000, kind: "call_started", provenance: "real", text: "Call opened (simulated session)" }], assessment: null, history: [], handoff_state: "not_prepared", status: "open", safety: "unconfirmed", call_ended: null, closed: null }; }
const callerText = i => i.lines.filter(l => l.speaker === "caller").map(l => l.text).join(" . ");
function recompute(i, reason) {
  if (!i.lines.length) return [];
  const old = i.assessment, a = E.assess(callerText(i), i.answers, i.constraints);
  if (i.constraints.location_correction) { a.location = { phrase: i.constraints.location_correction, kind: "caller_declared", confidence: 0.9 }; a.unresolved = a.unresolved.filter(u => !u.startsWith("location")); }
  i.assessment = a; const d = diffOf(old, a);
  i.history.push({ reason, diff: d, urgency: a.urgency });
  if (i.handoff_state !== "not_prepared") i.handoff_state = "awaiting_operator_review";
  return d;
}
function brief(i) {
  const a = i.assessment; if (!a) return null;
  return { urgency: a.urgency, routes: a.routes, location: a.location, unresolved: a.unresolved, notice: "SIMULATED handoff. No real authority has been contacted.",
    facts: a.evidence.filter(e => e.effect !== "benign").map(e => ({ fact: e.why, evidence: e.text })) };
}
function timeline(i) {
  return i.events.flatMap(e => e.kind === "handoff_prepared" || e.kind === "handoff_approved" ? [{ text: "Operator has prepared a note about your call", label: "SIMULATED" }]
    : e.provenance === "real" || e.provenance === "caller_declared" ? [{ text: e.text, label: null }] : []);
}
function links(i) {
  const me = { name: i.assessment.perpetrator.name, phone: null, location: i.assessment.location.phrase };
  return Object.values(STORE).filter(o => o.id !== i.id && o.assessment).map(o => {
    const r = E.matchScore(me, { name: o.assessment.perpetrator.name, phone: null, location: o.assessment.location.phrase });
    return { id: o.id, score: +r.score.toFixed(3), parts: Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, +v.toFixed(2)])), summary: callerText(o).slice(0, 80) };
  }).filter(x => x.score >= E.TH).sort((a, b) => b.score - a.score);
}
function pub(i) {
  const c = i.constraints;
  return { ...i, events: i.events.slice(-30), history: i.history.slice(-15), handoff_states: HANDOFF, needs_real_integration: ["sent", "acknowledged", "response_in_progress"],
    actions: { callback: c.callback_safe !== "no", text_update: c.text_safe !== "no", callback_blocked_reason: c.callback_safe === "no" ? "caller declared callback unsafe" : null, text_blocked_reason: c.text_safe === "no" ? "caller declared text unsafe" : null },
    next_question: i.assessment ? E.nextQuestion(i.assessment, i.answers, i.constraints) : null, brief: i.handoff_state !== "not_prepared" ? brief(i) : null, verified_timeline: timeline(i) };
}
async function api(path, body) {
  const get = id => STORE[id];
  if (path === "scenarios") return LX.scenarios;
  if (path === "eval") return LX.eval;
  if (path === "config") return { stt: false, llm: null };
  if (path === "new") { const i = newInc(); STORE[i.id] = i; return pub(i); }
  const i = body && body.id ? get(body.id) : null;
  if (path === "line") { i.lines.push({ speaker: "caller", text: body.text, t: Date.now() / 1000 }); recompute(i, "caller: " + body.text.slice(0, 40)); const o = pub(i); o.links = links(i); return o; }
  if (path === "answer") { i.answers[body.qid] = body.answer; i.events.push({ t: Date.now() / 1000, kind: "answer", provenance: body.answer === "silence" ? "system" : "caller_declared", text: `${body.qid} = ${body.answer}` + (body.answer === "silence" ? " (no response is NOT treated as 'no')" : "") }); recompute(i, `answer ${body.qid}=${body.answer}`); return pub(i); }
  if (path === "constraint") { Object.assign(i.constraints, body.set); i.events.push({ t: Date.now() / 1000, kind: "constraint", provenance: "caller_declared", text: Object.entries(body.set).map(([k, v]) => `${k}=${v}`).join(", ") }); recompute(i, "constraint " + Object.keys(body.set).join(",")); return pub(i); }
  if (path === "handoff/prepare") { i.handoff_state = "awaiting_operator_review"; i.events.push({ t: Date.now() / 1000, kind: "handoff_prepared", provenance: "simulated", text: "Handoff brief prepared (SIMULATED)" }); return pub(i); }
  if (path === "handoff/approve") { if (i.handoff_state !== "awaiting_operator_review") return { error: "handoff must be prepared and reviewed first" }; i.events.push({ t: Date.now() / 1000, kind: "handoff_approved", provenance: "simulated", text: "Operator approved handoff (SIMULATED, nothing was sent)" }); i.handoff_state = "response_status_unknown"; return pub(i); }
  if (path === "end") { i.call_ended = { reason: body.reason, final_urgency: i.assessment ? i.assessment.urgency : null, unresolved: i.assessment ? i.assessment.unresolved : [] }; i.safety = "unconfirmed"; i.events.push({ t: Date.now() / 1000, kind: "call_ended", provenance: "real", text: `Call ended: ${body.reason}. Safety remains UNCONFIRMED.` }); return pub(i); }
  if (path === "close") { if (!(body.operator && body.reason && body.note)) return { error: "closing needs an operator, a reason and a note" }; i.closed = body; i.status = "closed"; i.events.push({ t: Date.now() / 1000, kind: "closed", provenance: "real", text: `Closed by ${body.operator}: ${body.reason}` }); return pub(i); }
  if (path === "check_question") return E.check(body.text, i ? i.constraints : {});
  if (path === "note") { if (!(body.text || "").trim()) return { error: "empty note" }; i.notes.push({ t: Date.now() / 1000, text: body.text.trim() }); i.events.push({ t: Date.now() / 1000, kind: "operator_note", provenance: "real", text: "Operator note: " + body.text.trim().slice(0, 80) }); return pub(i); }
  if (path === "whatif") { const c = structuredClone(i); const before = c.assessment; const d = (c.lines.push({ speaker: "caller", text: body.text }), recompute(c, "whatif")); return { diff: d, urgency_before: before ? before.urgency : "-", urgency_after: c.assessment.urgency }; }
  return { error: "unknown " + path };
}

module.exports = { makeEngine, LX, api, STORE };
