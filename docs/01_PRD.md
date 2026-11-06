---
doc: 01_PRD
owns: WHAT — product vision, users, and scope
authority: authoritative-on-scope
version: 1.2.0
derived_from: [00_ADR]
owner: Robin Min
updated_at: 2026-11-05
read_before: adding a feature or command
edit_rules: 99 §6.2
sync: [T1, T4, T6]
---

# CreditSentry product requirements

## 1. Product and user

CreditSentry helps an individual review credit-card statements for possible duplicate charges,
subscription price changes and unfamiliar small charges. Every finding must link to the underlying
records and explain its uncertainty. A finding is a review candidate, not proof of fraud or a
promise of recoverable savings.

The initial user is a technically comfortable individual with several cards who can export
statements and inspect a local report. The primary job is: import statements, resolve extraction
issues, inspect evidence, record a disposition, and repeat without duplicating records or alerts.

Bank statements usually expose transaction rows, not purchased-item detail. CreditSentry audits
those rows; receipt-level product analysis is outside this release.

## 2. Scope membership

The local MVP is the planning baseline selected under ADR-008. Product capabilities are A–G;
Z owns shared project foundation work. See `05_FEATURES`; presence in the tree does not commit deferred scope.

| Capability | Membership | Boundary |
|---|---|---|
| A — Statement intake | in (committed) | Manual CSV and text-based PDF import for a declared pilot format set; bounded, consented AI extraction; actionable unsupported-input handling |
| B — Transaction records | in (committed) | Local persistent ledger; accounts, statement provenance, exact USD amounts, review/correction and overlap handling |
| C — Anomaly detection | in (committed) | Possible duplicates, price increases on confirmed recurring charges, advisory unfamiliar small charges; evidence and explicit insufficient-history outcomes |
| D — Review and reporting | in (committed) | CLI workflow, machine-readable/local human-readable reports, finding disposition and suppression of already-reviewed unchanged findings |
| F — Privacy and data control | in (committed) | Local data ownership, remote-processing opt-in, minimal disclosure/logging, source retention choice, export, deletion and backup/restore |
| Existing starter surfaces | supporting | Planet demo, health endpoint, typed RPC, React client, configuration and DB helpers support development; they are not financial functionality |
| Z — Project Foundation | supporting | Workspace/toolchain setup, shared configuration infrastructure, quality gates and reusable E2E infrastructure, packaging/release preparation, and project documentation; feature-specific work stays with A–G |
| E — Automation and notifications | deferred (needs design reconfirmation) | Reopen after the manual workflow is accurate and users request unattended operation; then choose one mailbox source and one notification channel |
| G — Hosted service | deferred (needs design reconfirmation) | Reopen after demand and unit economics are demonstrated; requires identity/tenant boundaries, operational recovery, data handling and billing design |
| Additional bank/file formats, EML/HTML, scans/OCR, encrypted PDFs | deferred (needs design reconfirmation) | Admit per-format fixtures and a selected extraction implementation; no universal-bank claim |
| Multi-currency and FX analysis | deferred (needs design reconfirmation) | Admit an explicit currency/exponent set and original-versus-settlement amount semantics; never silently treat non-USD as USD |
| Read-only natural-language assistant | deferred (needs design reconfirmation) | Reopen after reliable ledger/report queries exist and users need a conversational surface; belongs under D |
| Custom rules, third-party plugins, public asset registry | deferred (needs design reconfirmation) | Reopen only when built-in adapters/rules have demonstrated extension pressure |
| Direct bank APIs / Plaid | deferred (needs design reconfirmation) | Requires explicit demand beyond file/mail ingestion and provider review; belongs under A |
| Hosted pricing / commercial licensing | deferred (needs design reconfirmation) | Owner selects business model and distribution terms; current repository license remains unchanged |
| Budgeting, investments, credit scoring, tax advice | out of scope | Separate product domains |
| Auto-cancel, disputes, payments, transfers or bank credential collection | out of scope | CreditSentry reports evidence; users decide and act with their provider |
| Coding-agent harness, sandbox, task tree, skill/package hub, Git automation | out of scope | Development infrastructure is not the CreditSentry product |

## 3. Required user outcomes

| ID | Requirement |
|---|---|
| P1 | Supported files produce reviewable transaction candidates; unreadable, incomplete or unsupported input cannot silently become a successful empty import. |
| P2 | A user can identify the account, source row/page, amount, currency and dates behind every accepted transaction and finding. |
| P3 | Retrying or importing overlapping statements preserves legitimate repeated purchases while avoiding duplicate ledger records and repeat findings. |
| P4 | Uncertain parsing or merchant matching is visible; user corrections survive reprocessing and invalidate affected stale findings. |
| P5 | Audit results distinguish likely anomaly, informational review and insufficient history; no findings does not imply the account is safe. |
| P6 | Import, review, audit and report work locally; no remote model or notifier receives financial content without the relevant explicit choice. |
| P7 | A user can export, back up, restore and remove application-owned financial data, with clear limits for source files, copies and third parties. |
| P8 | Failure is actionable and leaves recoverable state; an interrupted import cannot leave a partially admitted statement marked complete. |
| P9 | Reports make coverage visible: supported account/date range, missing history, quarantined rows and rule versions. |

## 4. Evidence and product validation

Use a labeled, consented or synthetic fixture corpus to assess extraction completeness, exactness,
false positives and repeat-run behavior. Capture per-format results and failures rather than
advertising an unmeasured global accuracy rate. See the release evidence contract in `04_DESIGN` §3.

Customer interviews must establish current review time, useful findings versus noise, willingness
to upload data or run locally, and willingness to pay. Subscription prices, competitor weaknesses,
worldwide coverage and delivery dates in the original brief are hypotheses, not validated facts.
No delivery-duration commitment is made before a representative statement corpus exists.
