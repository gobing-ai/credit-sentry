# First local CSV audit slice

Accepted design under ADR-008–011; implementation status is owned by 05_FEATURES.

## Scope

Two cohesive deliveries: review and atomically admit a local CSV statement, then audit accepted
records for possible duplicates and retain evidence reports/dispositions. Use synthetic fixtures
for the explicitly named CreditSentry CSV v1 interchange format. No bank-specific compatibility
claim, PDF/model processing, unattended ingestion or hosted operation.

## Additive surface

Financial contracts live under the existing oRPC router's finance namespace. Planned CLI:

```text
account create <label>
account list
import <account-id> <file>
review <import-id>
correct <import-id> <row> <field> <value>
admit <import-id>
ledger <account-id>
audit <account-id>
report <account-id> [--text]
finding <finding-id> <open|dismissed|acknowledged|resolved>
```

Financial commands return JSON unless text output is requested. Invalid argument shapes exit 2;
API failures exit 3. Preserve the planet commands. No raw CSV or credentials in logs.

`CREDIT_SENTRY_TOKEN` is an explicit local capability of 32–256 characters; no default. Financial
operations also require an explicitly configured file-backed DATABASE_URL. Default hostname is
127.0.0.1. Every financial procedure authorizes the token, loopback Host and absent browser Origin
before storage access. The client validates loopback HTTP API_URL and refuses credential redirects.

## CSV v1

```csv
transaction_date,posted_date,merchant,amount,currency,kind,status,transaction_id
2026-10-01,2026-10-02,Example Merchant,12.34,USD,purchase,posted,example-1
```

UTF-8 with optional BOM; LF/CRLF; quoted fields, escaped quotes and embedded newlines. Exactly
the declared header set and column count. Maximum 1 MiB, 1000 records, plus a bounded RPC envelope.
Malformed CSV/encoding fails; semantic row issues remain visible for correction. Source evidence
retains logical record index and raw fields separately from corrected normalized candidates.

Money/date rules are owned by 04_DESIGN §2. Every row requires an explicit supported currency,
kind and posting status; transaction_id can be empty. No rounding or lossy JSON-number conversion.

## Persistence and identity

Use packages/db with versioned migrations, account-consistent relationships and owner-private
files/directories. Source identity is account plus exact byte hash; replay returns the existing
state without clearing corrections. Admission and completion commit atomically. Provider IDs may
link matching overlapping observations within one account; conflicting values or ambiguous overlaps
require review rather than destructive merging. Equal same-file purchases are separate records.
Candidate correction is included; admitted-record correction is a later B3 slice.

## Audit and report

Implement only possible_duplicate v1 using 04_DESIGN §2.3. Stable evidence keys preserve dispositions
across audits and restarts. Report exact amounts, source locators, rule/version/parameters,
account/date coverage, pending imports and limitations. A finding is not proof of bank error; no
findings is not proof of safety. JSON and text share the same data.

## Failure-first E2E evidence

Before production code: assert real CLI/server round trips, invalid credentials/Host/Origin/URL,
disabled or volatile storage, body/file/record limits, malformed/quoted CSV, invalid money/date/
kind/status/currency, exact values above 2^53, correction preserving raw evidence, explicit admission,
identical replay, conflicting overlap, legitimate repeats, transactional rollback and restart.
Before audit code: add positives, excluded kinds/status/accounts, calendar boundary, stable rerun,
persisted dispositions, missing records and incomplete-history coverage. Retain synthetic JSON/text
artifacts under .spur/run/first-csv/artifacts/. No live provider or real financial data.
