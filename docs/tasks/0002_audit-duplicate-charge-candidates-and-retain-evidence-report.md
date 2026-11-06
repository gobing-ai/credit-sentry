---
schema_version: 1
name: Audit duplicate-charge candidates and retain evidence reports
status: todo
template: feature-impl
created_at: 2026-11-06T05:57:10.020Z
updated_at: "2026-11-06T05:57:14.966Z"
feature_id: C1
priority: P1
estimate_hours: 5

dependencies: ["0001"]
---

## 0002. Audit duplicate-charge candidates and retain evidence reports

### Background

Implements C1's two duplicate detection/control scenarios using accepted history from the first task. Supporting D2 evidence reports and D3 dispositions. No other anomaly rule, model or remote notifier. See docs/design/first-csv-audit.md.

### Requirements

- [ ] R1. Evaluate distinct eligible same-account posted purchases with exact equal amounts and conservative merchant matching within three calendar days.
- [ ] R2. Exclude pending and non-purchase records, out-of-window and cross-account records; label matches as review candidates.
- [ ] R3. Persist rule version, source/transaction evidence, stable finding identity and dispositions across repeated audits and restart.
- [ ] R4. Expose audit/report/finding commands and JSON/text outputs with exact decimal display and coverage/incomplete-history limitations.
- [ ] R5. Reject invalid arguments, dispositions and missing records with typed failures; never leak credentials.
- [ ] R6. Write E2E checks before implementation and retain JSON/text artifacts for positives, controls, reruns and restart.

### Acceptance Criteria

- [ ] AC1 — Possible Duplicate Charges produces its documented outcome
- [ ] AC2 — Possible Duplicate Charges handles invalid or incomplete input

### Q&A

<!-- CLOSED decisions from refinement: what was chosen and why, what was deferred and on what
     condition. Not a parking lot for open questions — an unanswered question here means the task
     is not ready to hand off. Keep empty if none. -->

### Design

Extend existing financial contract/store. Deterministic duplicate rule with sorted evidence IDs and versioned stable key. Persist findings/dispositions and audit coverage; JSON/text share report data. Advanced admitted-record corrections and other rules remain planned.

### Plan

1. Write failing E2E tests for duplicate positives, exclusions, boundaries and repeated audit/dispositions.
2. Implement typed audit/report/disposition contracts and persisted findings.
3. Add CLI renderings and exact-money display.
4. Verify restart, missing history and invalid input.
5. Update docs/status and record evidence.

### Solution

<!-- Filled during implementation: file:line change map and concise rationale. -->

### Testing

<!-- Filled during verification: commands run, outcomes, coverage claim or N/A. -->

### Review

<!-- Filled during review: P1-P4 findings, residual risk, and final disposition. -->

### References

<!-- Links to the parent feature, design docs, related tasks, or external references. -->

### History
