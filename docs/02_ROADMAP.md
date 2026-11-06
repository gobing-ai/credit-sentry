---
doc: 02_ROADMAP
owns: WHEN — phases, sequencing, and current versus deferred work
authority: derived
version: 1.3.0
derived_from: [00_ADR, 01_PRD, 05_FEATURES]
owner: Robin Min
updated_at: 2026-11-05
read_before: sequencing delivery
edit_rules: 99 §6.3
sync: [T5, T6]
---

# Delivery roadmap

## Phase 0 — Define the product and evidence baseline

Goal: align requirements, boundaries and a testable first slice.

- [x] Bun monorepo scaffold — apps and packages exist; financial behavior does not.
- [ ] Z: maintain shared configuration, verification infrastructure, packaging instructions and documentation as their delivery slices require.
- [x] Review drafts and establish first-level feature tree — see `05_FEATURES` and the dated review in `plans/`.
- [x] Decompose the local MVP one level — A/B/C/D/F/Z each have three children; tasks 0001 → 0002 define the CSV slice.
- [ ] Select pilot bank/export formats and obtain a labeled, shareable fixture corpus.
- [ ] Confirm remote extraction provider, data handling and a cost cap, or keep extraction offline.

**Exit:** representative fixtures and their expected outputs are available; supported formats and
remote-processing choices are explicit. Documentation completion alone does not meet this exit.

## Phase 1 — One complete local statement audit

Goal: prove import → review → persistence → finding → report on one supported CSV format.

- [ ] F + B: durable local data path, migration/recovery, exact money and source/account identity.
- [ ] A: deterministic CSV intake and candidate validation; no model required for this first slice.
- [ ] B + D: review/correction and atomic ledger admission.
- [ ] C + D: possible duplicate detection and evidence-bearing report/disposition.
- [ ] F: export, backup/restore, deletion, redaction and remote processing disabled by default.
- [ ] Record repeatable end-to-end artifacts and synchronize docs with shipped surfaces.

**Exit:** the release scenarios in `04_DESIGN` §3 pass across process restart; re-import and crash
recovery do not duplicate or silently lose accepted data. The existing scaffold gate also passes.

## Phase 1.5 — Complete the local MVP scope

Goal: validate extraction and longitudinal checks before unattended operation.

- [ ] A: text-based PDF pilot adapter and consented, bounded structured extraction.
- [ ] B: overlapping-statement reconciliation and review-preserving reprocessing.
- [ ] C: confirmed recurring price-change and unfamiliar-small-charge checks with negative controls.
- [ ] D: coverage, uncertainty and insufficient-history reporting across the pilot corpus.
- [ ] Record extraction and anomaly evaluation artifacts; update support matrix and docs.

**Exit:** committed local scope in `01_PRD` has feature acceptance evidence on the pilot corpus;
ambiguous extraction stays visible rather than being silently accepted.

## Phase 2 — Automation pilot (deferred; reconfirm E)

Goal: reduce manual effort without hiding failures or increasing alert noise.

- [ ] Confirm demand and data permissions for one ingestion connector and one notifier.
- [ ] Implement bounded scheduling, checkpointing, delivery retries and revocation.
- [ ] Prove replay, reconnect, missed-cycle and notification-redaction behavior.

**Exit:** a consented pilot can detect missed ingestion, revoke access and recover without duplicate
records or repeated unchanged notifications. Starts only after Phase 1.5 and scope reconfirmation.

## Phase 3 — Hosted product (deferred; reconfirm G)

Goal: establish a supportable paid service only after local product validation.

- [ ] Validate pricing, cost per active account and support/verification costs.
- [ ] Decide hosting, licensing, identity, tenant isolation, key custody and data-region design.
- [ ] Implement and verify tenant isolation, deletion, recovery, quotas and billing reconciliation.
- [ ] Evaluate further formats, conversational queries, FX or bank connectors individually.

**Exit:** the selected hosted scope has security, recovery, economic and operational evidence, plus
explicit release/deployment authorization. No fixed calendar estimate or mandatory Workers move.
