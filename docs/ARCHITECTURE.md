# SAATHI — System Architecture (docs/ARCHITECTURE.md)

Team: Apex Squad  
Domain: Social Impact, Women's Safety & Emergency Decision Support  

```
+-----------------------------------------------------------------------------------+
|                              CITIZEN SMARTPHONE APP                               |
|              5 Screens: Home · Live Call · Silent Chat · Review · Case            |
+-----------------------------------------------------------------------------------+
             |                                              |
      (Audio / Mic Stream)                       (Encrypted JSON / WS)
             v                                              v
+-----------------------------+               +-----------------------------+
|    ASR STREAMING ADAPTER    |               |     REALTIME CAD GATEWAY    |
|   Browser WebSpeech / Sarvam|               |   Fastify / WebSocket Event |
+-----------------------------+               +-----------------------------+
             |                                              |
             +----------------------+-----------------------+
                                    |
                                    v
                     +-----------------------------+
                     |    SAATHI TRIAGE ENGINE     |
                     |  Hinglish Lexicon & Normalizer|
                     |  1. Coded-Call Pattern Match|
                     |  2. Invariant Urgency Floors|
                     |  3. SafeSignal Rule Filter  |
                     |  4. Tactical Map & Location |
                     +-----------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------------+
|                        OPERATOR CAD DECISION-SUPPORT CONSOLE                      |
|        Console (3-Col) · Incident Docket · Stress Lab · Wallboard Shifts          |
|        Tactical Map · Evidence Provenance · Safe Handoff Brief (112, 108, 181)    |
+-----------------------------------------------------------------------------------+
```

### The Three Core Innovations
1. **Coded-Call Detection:** Identifies food delivery orders, wrong-number calls, relative requests, and whispering cues. Flags the call at minimum High priority with tactical guidance: *"She may not be able to speak freely. Use yes/no questions only."*
2. **Urgency Floors (Safety Invariants):** Hard signals (weapon, violence now, forced entry, life threat) enforce an irreversible priority floor. Denial ("sab theek hai") or silence can never lower the floor.
3. **SafeSignal (10 Question Safety Rules):** Strict filtering (R1–R10) prevents questions that put callers in danger (no abuser names, no movement commands, no promises, yes/no only).
