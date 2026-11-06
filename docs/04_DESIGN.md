---
doc: 04_DESIGN
owns: SURFACE — commands, configuration, schemas, and DTO shapes
authority: derived
version: 1.1.0
derived_from: [00_ADR, 01_PRD, 03_ARCHITECTURE]
owner: Robin Min
updated_at: 2026-11-05
read_before: command, configuration, or schema changes
edit_rules: 99 §6.5
sync: [T3]
---

# Surface inventory and financial design

## 1. Implemented starter surface

Source registrations: `apps/cli/src/cli.ts`, `packages/api/src/contracts/planet.ts`,
`apps/server/src/app.ts`, `packages/config/src/index.ts`, `packages/db/src/connection.ts`.

| Surface | Current shape |
|---|---|
| CLI entry | `bun run apps/cli/src/index.ts [list\|create] [name]`; no args runs `list`; missing create name becomes `Unknown`; additional args are not validated |
| CLI exit | Success `0`; invalid command `2`; wrapped API failure `3`; other entry failure `1` |
| Health | `GET /health` → `{ status: 'ok' }`; does not check DB readiness |
| Planet list RPC | `list({ limit?: integer 1..100, cursor?: integer >= 0 })`; cursor defaults `0`; returns `Planet[]` |
| Planet find RPC | `find({ id: positive integer })` → `Planet` or typed `NOT_FOUND` |
| Planet create RPC | `create({ name: string, description?: string })` → `Planet` |
| Planet | `{ id: positive integer, name: string, description?: string }` |
| Server config | `PORT` → integer `1..65535`, default `3000`; `DATABASE_URL` → string, default `sqlite::memory:` |
| Server bootstrap | `startServer({ port?, hostname? })`; hostname is passed through as optional, no explicit loopback default |
| CLI API URL | `API_URL`; fallback `http://localhost:3000/rpc` |
| Web API URL | `VITE_API_URL`; otherwise browser origin + `/rpc`, otherwise local fallback |
| Client timeout | Default `10_000` ms; injected client `timeout` must be finite and positive |
| Demo DB | `users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE)`; no financial tables |
| DB helpers | `createDatabase`, `createMigratedDatabase`, `db`, `migrateDatabase`, `healthCheck`, `resetDb`, `closeDb`; `findUserByEmail`, `createUser` |

The executable bin is currently named `cli`, not `credit-sentry`. There are no financial commands,
provider credentials, privacy controls, notifications or billing endpoints yet. Root development
and gate commands are defined in `package.json` and summarized in `AGENTS.md`.

## 2. Financial shapes (accepted design — ADR-009/010; not yet built)

These are implementation constraints, not exported interfaces or available API signatures. Define
the actual Zod/oRPC contract before implementation and synchronize this section in that change.

### 2.1 Values and identity

| Value | Planned representation / validation |
|---|---|
| IDs | Opaque strings; application-generated; never derive account identity from card last-four alone |
| `accountId` | Explicit local account selected/confirmed by user; distinct cards must remain distinct |
| `amountMinor` | Canonical signed base-10 integer string over API/export; SQLite `INTEGER`; exact parse from decimal text; positive = debit, negative = credit; enforce signed 64-bit DB range and avoid lossy JS-number conversion |
| `currency` | Explicit uppercase code from supported set; pilot `USD` only, exponent `2`; missing/unsupported currency requires resolution, no USD default |
| Dates | Valid `YYYY-MM-DD` calendar dates; separate transaction and posted date; `occurredAt` optional RFC 3339 with offset when source supplies it; never invent timestamps from date-only rows |
| `kind` | `purchase \| refund \| payment \| fee \| interest`; sign must agree with kind; zero/unknown amounts or kinds require review |
| `postingStatus` | `posted \| pending`; pending records cannot participate in initial charge rules |
| Merchant | Preserve `merchantRaw`; `merchantKey` is a versioned conservative match or user-confirmed alias, not an LLM authority |
| Source reference | Source ID, page or row locator, original amount/date/merchant text; extraction/parser version and candidate revision |
| Import identity | Unique `(accountId, contentHash)` for identical file bytes; an identical replay returns the existing import; reprocessing creates a new attempt/revision, not new admitted records |
| Transaction identity | Provider ID scoped to account when supplied; otherwise persistent generated ID plus source observations; no uniqueness on `(merchant, date, amount)` |

### 2.2 Planned record groups

| Record | Required fields / constraints |
|---|---|
| Account | ID, user label, issuer label, supported settlement currency; no full card number or bank credentials |
| Source/import | ID, account, source type, content hash, statement period, safe display name, retention choice, state, active revision; raw content private and optional |
| Import attempt | ID, source, parser/provider/model/prompt versions where applicable, stage, safe error code, counts, start/end time; bounded retry history |
| Candidate row | ID, source locator, raw fields, proposed normalized fields, validation issues, review state and revision |
| Ledger transaction | ID, account, exact money, dates, merchant, kind, posting status, accepted revision; admitted only after review |
| Source observation | Source + locator + candidate revision → ledger transaction; preserve multiple observations for overlapping statements |
| Audit run | ID, covered accounts/date ranges, ledger revision, rule-set version, start/end/status, incompleteness warnings |
| Finding | ID/stable key, audit/run links, rule/version/parameters, evidence transaction revisions, comparison values, severity, reason code, disposition |
| Finding disposition | `open \| dismissed \| acknowledged \| resolved \| superseded`, change time and optional user note; resolving does not assert a bank refund |

Versioned migrations must record applied versions; enable/verify FK enforcement, account-consistent
relationships and unique source/finding keys. Admission commits ledger rows, observations and import
completion together. Import/attempt state is `received → extracting → needs_review → admitted`, with
`failed` from pre-admission stages and a retry as a new attempt. A source may be `needs_review` with
no issues so that the user can confirm it; admission never bypasses review in the MVP.

### 2.3 Initial rule parameters

| Rule ID | Parameter contract |
|---|---|
| `possible_duplicate` | Same account/currency/merchant key/exact positive purchase amount; distinct ledger IDs; transaction dates differ by at most 3 calendar days. If only date precision exists, never describe this as an exact 72-hour test. |
| `recurring_price_increase` | User-confirmed monthly series; at least 3 prior comparable posted purchases in separate cycles, successive gaps 25–35 calendar days including the new charge; current amount greater than median of previous 3; any positive delta is a review candidate. Otherwise `insufficient_history`/`not_comparable`. |
| `unfamiliar_small_charge` | Posted purchase with `0 < amountMinor <= 200` in USD; no earlier accepted transaction with that merchant key in that account's imported history; informational only. Report history start. |

Rule parameters and algorithm version are recorded with each finding. No cross-currency comparison,
automatic merchant merging, JSON-rule editing or financial action in this contract.

## 3. Planned release evidence contract

Before building the first financial slice, author end-to-end scenarios and labeled fixtures. Each
scenario leaves a deterministic JSON result and human-readable report in an ignored local artifact
directory selected by the runner; assert contents, not just file existence. Stub remote extraction
for reproducibility; run any consented live provider evaluation separately with costs and versions.

| Scenario | Observable acceptance |
|---|---|
| Supported import | Expected row count, exact amounts/signs/dates, account and source locators agree with labeled fixtures; available transaction subtotals reconcile under documented statement semantics |
| Bad/ambiguous input | Corrupt/oversized/encrypted/scanned, invalid dates/currency, missing rows, inconsistent totals and invalid model outputs yield actionable failure/review, no admitted ledger writes |
| Replay / overlap | Identical source retry is a no-op; overlapping files share observations; two real same-day same-amount purchases remain two transactions |
| Crash / restart | Interrupt before and during admission; reopen DB; no partial admitted statement, replay resumes safely and committed data persists |
| Corrections | Correct an amount or merchant; correction survives reprocessing, affected findings supersede, unaffected dispositions persist |
| Rule positives and controls | Duplicate pair, confirmed price increase and unfamiliar small charge are explained; refund, payment, pending authorization, known merchant, missing history and cross-account/currency controls are excluded or labeled appropriately |
| Privacy | Denied egress makes zero provider calls; logs/artifacts contain no test-secret canaries; unauthorized local web requests fail; export/deletion/restore behavior matches selected retention |
| Report rerun | Stable evidence IDs, exact decimal display, rule version and coverage warnings; unchanged findings retain disposition |

The pilot corpus must cover at least two declared export layouts, overlapping periods, recurring
history and the negative controls above before Phase 1.5 exits. Unsupported layouts remain listed
as unsupported. Generalization to untested banks is not an acceptance claim. Existing code gate
thresholds remain owned by `bunfig.toml` and the Spur rules, not by this planning document.
