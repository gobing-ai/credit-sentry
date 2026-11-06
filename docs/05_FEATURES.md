---
doc: 05_FEATURES
owns: STATUS — feature decomposition and delivery state
authority: derived
version: 1.3.0
derived_from: [00_ADR, 01_PRD, 02_ROADMAP]
owner: Robin Min
updated_at: 2026-11-05
read_before: feature planning or status reporting
edit_rules: 99 §6.6
sync: [T4]
---

# Feature status

Legend: ✅ done · 🔶 partial · ⏳ planned · 💤 deferred. Delivery state is distinct from the
Spur lifecycle: all newly created roots are `backlog`; deferred roots are described as such in
their Scope/Notes and cannot imply an implementation commitment.

| Root | Capability | State | Acceptance headline |
|---|---|---|---|
| A | Statement intake | ⏳ | Supported input becomes reviewable candidates with provenance; unsupported/failed extraction cannot silently succeed |
| B | Transaction records | ⏳ | Accepted exact-money records survive restart; replay and overlap do not erase legitimate purchases |
| C | Anomaly detection | ⏳ | Versioned rules produce explainable findings and distinguish insufficient history from no anomaly |
| D | Review and reporting | ⏳ | CLI exposes candidates, corrections, evidence, coverage and persistent finding dispositions |
| E | Automation and notifications | 💤 | A future authorized connector resumes/retries without duplicate records or unchanged alerts |
| F | Privacy and data control | ⏳ | Explicit processing consent, protected local access, safe logs, export/deletion and verified backup/restore |
| G | Hosted service | 💤 | A future hosted release proves tenant isolation, recovery, quotas, deletion and billing reconciliation |
| Z | Project Foundation | 🔶 | Workspace and quality gate exist; remaining shared configuration, reusable E2E infrastructure, packaging and documentation work requires scoped acceptance evidence |

Detailed Goal/Scope/Gherkin acceptance contracts are tool-owned: [feature index](features/INDEX.md).
Roots partition product outcomes and shared foundation work, not packages; create children only when a bounded implementation slice
is ready. A, B, C, D, F and Z each have three child capabilities in the generated tree;
E/G remain deferred roots. Tasks 0001 → 0002 deliver the first local CSV audit slice.
The original A–Z proposal's disposition is retained in the dated review under `plans/`.

The current planet demo and user-table DB pattern are supporting scaffold, verified by their
existing tests. None of the seven financial capabilities is implemented, including privacy controls.
