# SAATHI — Architectural Decisions Record (DECISIONS.md)

This document records the architectural and engineering decisions made during the implementation of the SAATHI 181 Women Helpline Triage Assist platform, according to the build brief.

---

### 1. Package Manager and Runtime Environment
- **Decision:** Use Node 20+ with `npm` (v11.6.2) natively across Windows and POSIX systems.
- **Rationale:** `pnpm` is not installed by default on Windows workstations and enabling it via corepack requires system-level administrator write permissions to `C:\Program Files\nodejs`. Using standard npm scripts ensures single-command startup (`npm run dev`, `npm test`, `npm run seed`) with zero configuration barriers at hackathons.

### 2. Location Extraction Pre-Token Trimming (Intentional Difference from Reference Engine)
- **Decision:** In `extractLocation`, clean leading non-locational verbs and filler words (e.g. `"dalega shiv colony gali 4"` -> `"Shiv Colony Gali 4"`).
- **Rationale:** The reference prototype had a known bug where preceding verbs from the threat leaked into the location phrase. We trim leading tokens that are verbs or filler words not part of the place name and title-case the result for clean display and geocoding.

### 3. Case Module & Invariant Guardrails (Around the Engine)
- **Decision:** Implement `packages/engine/src/case.ts` (and its unified TypeScript module in `src/services/triageEngine.ts`) wrapping `assess()`.
- **Key Invariants:**
  1. **Urgency Floors:** Hard danger signals (weapon, threat to life, violence now, forced entry, sexual violence, confinement, unconscious, self-harm) enforce an absolute floor. Later denial ("sab theek hai"), caller silence, or interrupted calls can never lower the floor.
  2. **Contradiction Register:** Conflicting information (e.g. threat followed by denial, conflicting addresses) does not silently overwrite state; it opens a flagged contradiction card under "Still unknown".
  3. **Location History:** Superseded locations are kept with timestamp and provenance, never deleted.
  4. **SafeSignal (10 Rules):** Operator-facing and automated questions are strictly filtered against rules R1–R10 (yes/no only, ≤14 words, no abuser/weapon names, no movement/louder commands, no unsafe callback/SMS, exactly 1 question, no PII, no promises, plain Hinglish).

### 4. Interactive Tactical Map Integration
- **Decision:** Embed real-time OpenStreetMap / Leaflet tactical maps with live GPS pins and nearby helplines (112, 108, 181, DLSA) directly within the Operator CAD Workstation (under `CALLER LOCATION`) and within the Citizen Helpline application.
- **Rationale:** Location in distress calls is often fragmented ("mandir ke paas, gali 4"). Combining automated landmark extraction with interactive map telemetry gives the operator immediate geographic context and verified dispatch routing.

### 5. UI Design Language
- **Decision:** Maintain zero decorative fluff—no neon glows, no glassmorphism, no artificial 3D cards. Strictly adhere to real government dispatch workstation standards (IBM Plex Sans / IBM Plex Mono, 3px corner radii, high-contrast crisp cards, semantic priority colors P1/P2/P3/P4).
