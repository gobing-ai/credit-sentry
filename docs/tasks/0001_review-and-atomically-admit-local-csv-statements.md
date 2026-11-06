---
schema_version: 1
name: Review and atomically admit local CSV statements
status: todo
template: feature-impl
created_at: 2026-11-06T05:57:10.017Z
updated_at: "2026-11-06T05:57:10.031Z"
feature_id: A1
priority: P1
estimate_hours: 8

---

## 0001. Review and atomically admit local CSV statements

### Background

Implements A1's two CSV intake scenarios through the CLI, typed RPC and persistent SQLite. Supporting boundaries: F1 access, B1 exact ledger, B2 provenance, B3 replay, D1 review and Z2 E2E infrastructure. See docs/design/first-csv-audit.md; synthetic interchange layout is not bank support.

### Requirements

- [ ] R1. Expose additive account create/list and import/review/correct/admit/ledger CLI commands via shared financial oRPC contracts.
- [ ] R2. Require a configured local capability and file-backed DB; reject remote URL/redirect, invalid Host/Origin and unauthorized operations before data access.
- [ ] R3. Parse bounded CreditSentry CSV v1 with quoting/BOM/CRLF and explicit malformed/unsupported input errors.
- [ ] R4. Validate exact signed USD minor units including values above JS safe integers, real dates, kind/status and required fields without admitting invalid candidates.
- [ ] R5. Persist original evidence and user corrections; admit only after explicit confirmation and successful validation.
- [ ] R6. Commit admission, source observations and completion atomically with versioned migration and owner-private storage.
- [ ] R7. Make source replay idempotent, preserve legitimate repeated purchases, and surface conflicting/ambiguous overlap rather than silently merging.
- [ ] R8. Write E2E checks before production code and prove CLI behavior, restart persistence, atomic rollback, security and secret-safe artifacts.

### Acceptance Criteria

- [ ] AC1 — CSV Statement Intake produces its documented outcome
- [ ] AC2 — CSV Statement Intake handles invalid or incomplete input

### Q&A

<!-- CLOSED decisions from refinement: what was chosen and why, what was deferred and on what
     condition. Not a parking lot for open questions — an unanswered question here means the task
     is not ready to hand off. Keep empty if none. -->

### Design

Preserve existing boundaries/demo. Financial schemas in packages/api; storage in packages/db via Bun SQL; services/procedures in server; CLI contract-only client. Exact money strings and account/source identity. Local capability is ADR-011. See docs/design/first-csv-audit.md and docs/04_DESIGN.md; no PDF/model/hosted work.

### Plan

1. Enumerate failures and write failing real CLI/server E2E checks plus synthetic fixtures.
2. Define additive contracts and local access policy.
3. Implement private versioned ledger storage and atomic admission.
4. Add bounded CSV intake and explicit review/correction/admission.
5. Verify replay, overlap, rollback, restart and access failures.
6. Update docs and record E2E artifacts.

### Solution

<!-- Filled during implementation: file:line change map and concise rationale. -->

### Testing

<!-- Filled during verification: commands run, outcomes, coverage claim or N/A. -->

### Review

<!-- Filled during review: P1-P4 findings, residual risk, and final disposition. -->

### References

<!-- Links to the parent feature, design docs, related tasks, or external references. -->

### History
