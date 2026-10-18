# SAATHI — 5-Minute Hackathon Demo Script (docs/DEMO_SCRIPT.md)

Team: Apex Squad  
Product: SAATHI — Decision-Support Console for India's 181 Women Helpline  

---

### 0. The 30-Second Opening Hook (The Pitch)
> *“When a woman calls 181, the person she fears may be standing right next to her. She whispers, she speaks in code, she says she's fine. Most emergency systems fail because they only understand what a caller says out loud. SAATHI is built for the caller who cannot say it: it detects coded distress calls, guarantees that silence or denial can never lower the urgency floor, and strictly blocks questions that could put her in danger.”*

---

### Step 1: Coded Call Detection (Pizza Call)
1. In the console, select Scenario 1: `[whisper] bhaiya ek pizza bhej do, address wahi hai, jaldi aana` and click **Receive call**.
2. **Observe live:**
   - The system flags **“Possible coded call”** in red.
   - Priority climbs to **P2 High** automatically.
   - Operator note advises: *“She may not be able to speak freely. Do not repeat her words back or ask her to explain. Use yes/no questions only.”*
   - SafeSignal suggests the exact safe question: *“Kya aap abhi kisi khatre mein hain? Sirf haan ya nahi.”*

---

### Step 2: Urgency Floor Invariant (The Weapon & Denial Test)
1. Load Scenario 0: `Madam mere pati ne chaku nikal liya hai...`.
2. **Observe:** Urgency jumps to **P1 Critical**. Evidence table clearly links the exact quote *“chaku”* to *“weapon mentioned”*.
3. **The Twist:** In Stress Lab, add the twist *“nahi nahi, sab theek hai”* (denial).
4. **Observe the guardrail:**
   - Priority stays **P1 Critical**.
   - Alert: *“Floor held. A later ‘sab theek hai’ does not undo a weapon and a threat said earlier. Safety remains unconfirmed.”*
   - A contradiction is logged in the activity trail.

---

### Step 3: SafeSignal Question Checking (R1–R10 Rules)
1. Open the question checker *“Check my own question before asking it”*.
2. Type an unsafe question: `“Aapke pati ne chaku kahan rakha hai? Zor se bolo.”`
3. Click **Check**:
   - Result: **DO NOT ASK THIS** (Red).
   - Rules failed: **R3** (names abuser/weapon) and **R4** (asks her to speak louder/move).
4. Show that only pre-screened, yes/no Hinglish questions under 14 words are permitted.

---

### Step 4: Live Smartphone Integration & Tactical Map
1. Open `/caller` on a phone or switch to the Citizen Phone pane.
2. Show the 5 citizen screens:
   - **Screen 1 (Home):** Clean landing with *Call 181*, *Chat without speaking*, and *Silent SOS* (3s hold).
   - **Screen 2 (Call):** Live whisper mode toggle and real-time caption.
   - **Screen 3 (Chat):** Big **Haan** and **Nahi** buttons for silent 1-tap interaction. Tap *“Share my area”* to transmit live GPS coordinates.
   - **Screen 4 (Review):** Plain language confirmation with landmark input.
   - **Screen 5 (Case Docket):** Case **INC-4A21**, 4-step progress tracker, and live dispatch route map.
3. Show the Operator Console Column 3: The **Tactical Emergency Map** updates in real time with the caller's SOS pin and nearby units (Police 112, Ambulance 108, One Stop Centre 181, DLSA legal aid).

---

### Step 5: Honest Dispatch Handoff & Incident Closure
1. In the console, check **Police 112 [SUGGESTED]** and **One Stop Centre 181**.
2. Click **Prepare handoff brief** → verify the quote-backed evidence brief.
3. Click **Approve and send** → status updates honestly to *“Approved by OP-07. Response status unknown until police confirms.”* (No fake promises of arrival).
4. End call with reason *“Handed over to service”*.
5. Close incident with outcome *“Service dispatched and confirmed”* and required closing note.
6. Check **Activity Log**: Every single step is cryptographically audited and append-only.

---

### Fallback Plan
If Wi-Fi or microphone is unavailable at the venue, all 9 real scenarios can be triggered deterministically via the **Receive call (replay)** dropdown with simulated word-by-word streaming.
