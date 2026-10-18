# SAATHI — Privacy, Security & Data Protection Policy (docs/PRIVACY.md)

### Compliance with India's Digital Personal Data Protection (DPDP) Act 2023

SAATHI is designed from the ground up for high-risk emergency helpline operations (181 Women Helpline and ERSS 112), adhering strictly to purpose limitation, data minimisation, and storage limitations.

---

### 1. Zero Plaintext Phone Number Storage
- **Policy:** Raw phone numbers are never persisted in the database.
- **Implementation:** Caller phone numbers are salted and hashed using SHA-256 before storage (`callerHash`). Only a masked string (e.g. `98XXX-X2666`) is shown to the operator.
- **Repeat Linkage:** Fuzzy and repeat case identification relies on salted cryptographic comparison without exposing caller PII.

### 2. Audio Minimisation
- **Policy:** Raw voice recordings are processed in memory for speech-to-text transcription and immediately discarded.
- **Configuration:** Raw audio is never saved to disk unless `STORE_AUDIO=true` is explicitly enabled for audited forensic quality assurance. Default is `false`.

### 3. Append-Only Event Audit Logs
- **Policy:** Tampering with distress call history or priority ratings is prevented by architectural design.
- **Implementation:** Every operator action, priority transition, question response, and handoff brief is recorded as an immutable append-only event with timestamp, actor role, and provenance (`caller_declared`, `operator`, `saathi`, `system`, `simulated`). Updates or deletions of past event entries are strictly rejected.

### 4. Safe-Contact Enforcement
- **Policy:** Never endanger the caller through unverified callbacks or SMS notifications.
- **Implementation:** If the caller or operator declares `callback_safe = no` or `text_safe = no`, all outgoing automated communication channels are blocked in code. SafeSignal actively rejects any questions proposing a callback.

### 5. Automated Data Retention & Redaction
- **Policy:** Closed incidents older than `RETENTION_DAYS` (default 30 days) have transcript segments, notes, and exact addresses purged, retaining only anonymised aggregate statistics for state-level emergency resource planning.
