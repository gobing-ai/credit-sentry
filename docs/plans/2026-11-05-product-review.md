# CreditSentry requirements and feature-tree review

Date: 2026-11-05 (America/Los_Angeles). Status: completed review and planning baseline;
not a claim that product behavior is implemented or that the owner approved a commercial launch.

## 1. Conclusion and evidence scope

Build a statement-auditing product around the existing Bun/Hono/oRPC scaffold. Validate a local
manual workflow before unattended ingestion or hosting. The supplied A–Z tree describes a coding-agent
platform called Spur; making it CreditSentry's backlog would leave its actual financial workflow
largely unowned. Reuse that platform as development tooling where useful, not as product scope.

Inputs reviewed: original BRD v1.0 §§1–5; original technical specification v1.0 §§1–6; the supplied
A–Z proposal; `AGENTS.md`; numbered docs and constitution; workspace manifests; contracts,
CLI/server/web entry points; DB/config helpers; gate configuration and existing tests.
The five numbered docs `01`–`05` and README were empty. Two incoming drafts were untracked.

No actual bank statement corpus, customer interview, live provider integration or production data
was available. Consequently no extraction quality, commercial demand, model cost, fraud accuracy
or hosted capacity result is established by this review.

## 2. Findings by severity

Severity: critical = invalidates the product's trust/correctness premise; high = blocks a dependable
release; medium = scope/maintenance or unvalidated commercial assertion. References to v1.0 sections
below describe the input drafts before refinement.

| ID | Severity | Input / evidence | Finding and correction | Owning destination |
|---|---|---|---|---|
| R01 | Critical | A–Z proposal, especially B–H/O/Q/U | Wrong product domain. Coding-agent sandbox, skills, task tree and Git orchestration do not implement statement auditing. Replace with capability roots A–G. | `01`, feature corpus |
| R02 | Critical | BRD §§1.2/3.2; Tech §6 TS-012 | Local storage plus remote parsing is not entirely local processing; server-held decryption does not establish zero knowledge. Require consent and accurate trust boundaries; remove the claim. | ADR-009, `03` §5 |
| R03 | Critical | Tech §4.2 `amount REAL`; §3 `number` | Floating-point money and no scale/sign contract undermine comparison and exports. Use exact minor units, explicit currency and sign, exact boundary serialization [S1]. | ADR-010, `04` §2 |
| R04 | Critical | Tech §4.2 | No account/card entity, original/posted distinction or multi-source provenance. `user_id` alone cannot prevent cross-card false matches; global hash index is not unique or scope-aware. Separate account, source, candidate, ledger and observation identity. | `03` §3, `04` §2 |
| R05 | High | Tech §5.1 | Facts include only current amount/merchant/recurrence flag. They cannot prove a historical duplicate or increase. Derive historical facts first; store rule versions and evidence. | `03` §4 |
| R06 | High | BRD §5; Tech diagram | A 72-hour predicate cannot be recovered from date-only statement rows. Initial rule uses an explicitly labeled calendar-date window. Distinct purchases are not ingestion duplicates. | `04` §2.3 |
| R07 | High | BRD §5; Tech alert types | Small first-seen charge does not establish fraud/probing; same merchant/amount does not prove duplicate charging. Use review/informational outcomes, negative controls and coverage warnings. | `01` §3, `03` §4 |
| R08 | High | BRD §§4/5; Tech §3 | No review gate, parser completeness checks, corrections or source locators. Schema-constrained output can still contain mistakes [S2]. Add review, reconciliation, revisions, refusal/truncation/error handling. | `03` §3, `04` §3 |
| R09 | High | BRD §4.1 | Autonomous prompt “self-healing” may change results without evidence. Use versioned extraction and bounded retries; re-evaluate fixtures before promoting parser changes. | ADR-009, `03` §5 |
| R10 | High | Tech §4.2 | Idempotency, overlap reconciliation, retry checkpoints, partial commit and finding lifecycle unspecified. A non-unique hash index is insufficient. Define atomic admission and stable finding keys/dispositions. | `03` §3, `04` §2 |
| R11 | High | Tech §4.1; existing `packages/db` | Proposed internal DB abstraction/`better-sqlite3` is not installed. Existing Bun SQL/SQLite already works [S6]. Keep it; any D1 adapter requires separate parity evidence. | ADR-010 |
| R12 | High | Tech §§1/2/6 vs ADR-001–007 | Proposed `core`, `parsers`, `cloud-worker`, changed scope names and mixed runtime layout diverge from the starter without migration decisions. Keep existing boundaries and record design ADRs first. | ADR-008–010, `03` §2 |
| R13 | High | Tech §3/5 types | `any`-typed DB/env/tool APIs and hypothetical `getRepository` calls conflict with project types and observed DB API. Remove pretend implementation; define actual contracts at delivery. | `04` §2 |
| R14 | High | Tech §5.2; BRD §4.3 | Model-facing query tool has no user/account binding, query bounds or authority limits. Defer assistant; any future tool must be read-only, scoped and bounded, never arbitrary SQL. | `01` §2, D Notes |
| R15 | High | BRD §§4/5 | Email/PDF breadth, global banks, OCR, three rules and Day-1 agents in 1–2 weeks are unsupported scope/time claims. Pilot CSV then text PDF; fixture-based exits, no calendar promise. | `01`, `02` |
| R16 | High | BRD §5 Phase 2 | Gmail read scopes are restricted; verification/security-assessment requirements depend on use and exceptions [S3]. Treat connector launch as its own gate, with token revocation and policy review. | E Scope/AC |
| R17 | High | Tech §§1/4/6 | Workers/D1 do not imply transparent runtime/driver compatibility or adequate PDF/OCR capacity. Workers have CPU/memory limits [S5]; spike actual workloads, migrations and recovery before selecting hosting. | G Notes, `02` Phase 3 |
| R18 | High | Tech §§3/4/6 | Plugin context exposes DB/env broadly; no data retention/deletion, credential custody, safe logging, local access boundary or tenant isolation. Use narrow built-in functions; make privacy an independent deliverable and acceptance axis. | F, `03` §5 |
| R19 | High | BRD §2; Tech §2 | Draft assumes MIT/BSL while root `LICENSE` says Apache-2.0 and names a template copyright holder. Preserve license; owner must verify provenance/rights before distribution. No conclusion about relicensing rights is made. | BRD business decisions |
| R20 | Medium | BRD header | “Approved” is unsupported: user explicitly said it had not been reviewed. Mark reviewed draft/planning baseline. | Revised BRD |
| R21 | Medium | BRD §§2/3 | Dual-entity operation, price range, competitor privacy/accuracy/coverage claims lack evidence. Retain pricing as a hypothesis; replace categorical competitor claims with validation questions. | Revised BRD |
| R22 | Medium | BRD §2 US entity diagram | Stripe Checkout does not itself make Stripe the merchant of record; Stripe documents Managed Payments as a separate MoR offering [S4]. Product choice/eligibility and entity obligations remain unresolved. | Revised BRD |
| R23 | Medium | BRD §3.2 | “Line item” overstates information in card statements. Distinguish transaction rows from receipt purchase items; no tax/FX explanation without supporting evidence. | `01` §1 |
| R24 | Medium | BRD §5; Tech §6 | Subscription tracking is placed in multiple phases; dashboards and core audit history have no stable owner. Assign records to B, detection to C, review surfaces to D and automation to E. | feature boundaries |
| R25 | Medium | Tech §3 plugin-first | Extension registry/hooks and a generic rules platform precede any demonstrated extension need. Built-in adapters and pure deterministic rules suffice initially; do not add dependencies yet. | `01` §2, `03` §2 |
| R26 | High | `packages/config/src/index.ts`; `apps/server/src/index.ts` | Starter default DB is volatile despite a file-backed comment; hostname is optional despite a localhost-default comment. Document reality; durability and access controls must precede financial input. | `03` §1, `04` §1 |
| R27 | High | Empty `01`–`05`; planet demo | Neither a product status baseline nor end-to-end financial acceptance exists. Populate owners, mark every financial capability unbuilt, define artifacts before implementation. | `01`–`05`, `04` §3 |

## 3. First-level feature boundaries

The CLI allocated A–G. Only these roots are created now; the slices below are possible future
children, not reserved IDs, packages or an implementation task batch.

| Root | Owns | Excludes / handoff | Candidate child slices |
|---|---|---|---|
| A — Statement intake | Bytes/source → validated, reviewable candidates | B admits ledger; E schedules/connects; F governs data handling | CSV import; text-PDF extraction; bounded provider extraction; explicit format failures |
| B — Transaction records | Account/source identity, admission, history and revisions | C interprets history; D presents review; F owns lifecycle policy | Account ledger; exact money; source replay/overlap; correction/reprocessing |
| C — Anomaly detection | Historical facts, versioned rules and finding evidence | D owns dispositions; E owns delivery; no autonomous financial action | Possible duplicates; recurring price change; small-charge advisory; coverage/evaluation |
| D — Review and reporting | User review/correction flow, findings/dispositions and reports | B validates/persists changes; C creates findings; future chat uses existing query contracts | CLI review; JSON/text reports; finding lifecycle; later web/read-only assistant |
| E — Automation and notifications | Authorized connectors, scheduled ingestion and delivery | A/B/C remain single-run domain owners; G owns hosted accounts/quotas | One mailbox connector; resumable scheduling; one notifier; delivery recovery |
| F — Privacy and data control | Consent, local access, safe logging, retention/export/delete/backup policy | Every other root enforces F's boundary; G adds tenant/hosting controls | Processing consent; local boundary; safe artifacts/logs; export/deletion/restore |
| G — Hosted service | Hosted identity, tenant isolation, entitlements/billing and operations | No parallel audit engine; no pricing/license commitment | Identity/tenancy; billing reconciliation; quotas/operations; deployment compatibility |

Dependencies: F's baseline and B's value/identity contract precede sensitive intake; A produces
candidates for B; C requires B's accepted history; D spans review/admission/reporting. E depends on
the verified manual workflow. G depends on explicit demand and its own security/operations design.
E/G remain backlog records with deferred scope, not active implementation promises.

## 4. Disposition of every proposed A–Z root

| Supplied root | Disposition for CreditSentry |
|---|---|
| A Architecture/bootstrap | Supporting work under the relevant delivery slice; keep Bun scaffold, measure performance only against a real workload |
| B Agent sandbox/isolation | Out of product scope; safe file parsing still requires limits under A/F |
| C CLI agent harness | Coding-agent adapter/slash-command system out; product CLI belongs to D, config to its owning feature |
| D Context/prompt hydration | Repository-index/AGENTS parsing out; bounded extraction inputs and prompt versions belong to A/F |
| E Skills loader | Out; no runtime skills marketplace |
| F Agent event loop | Out; bounded import processing belongs to A, resumable scheduling to future E |
| G Governance/security | Relevant financial-data controls under F/G; no shell-command guard product |
| H Hierarchical task tree | Spur development tooling only; never the financial product's data model |
| I TUI/I/O | CLI reports/review under D; start with existing terminal output rather than a TUI framework |
| J Job queue/pipeline | Deferred E; durable bounded jobs when automatic ingestion is admitted |
| K Secrets | Minimal credential handling under F/E; no Doppler/Vault/token-exchange platform without need |
| L Logging/telemetry | Safe processing metadata and extraction cost under F/A; hosted operations under G; no collection of model private reasoning |
| M Middleware/plugins | Defer public extension system; narrow built-in adapter functions under A/E |
| N Network/proxy | Provider egress consent under F; tunnels/proxy control are not the product |
| O Multi-agent orchestration | Out; deterministic financial pipeline with bounded optional model extraction |
| P Package/asset hub | Out; installation documentation is supporting delivery work |
| Q AST/code inspection | Out; financial-history queries belong to B/C, not code indexing |
| R Replay/rollback | Import replay and recovery under A/B/F; Git/terminal replay out |
| S Storage/state | B financial persistence; F retention/backup; not a generic KV product |
| T Testing harness | Supporting E2E/evaluation work attached to each root; no coding-agent self-correction engine |
| U Git integration | Development convention/tooling only; not product scope |
| V Static analysis | Existing Biome/typecheck/gate supporting development; not a product feature |
| W Web dashboard | Later D surface, using existing React app; not a sandbox dashboard |
| X API/RPC | Existing oRPC boundary supporting all slices; no parallel REST API without a consumer requirement |
| Y Artifact packaging | D reports and F sensitive export/backup; not generated PRD/release-note tooling |
| Z CI/CD/deployment | Existing development gate; future G operations; no automatic deployments or workflow edits in this review |

## 5. Repository adaptation and next slice

Populate the existing authority documents and refine both incoming briefs to point to them. Keep
the app/package topology, runtime, dependencies, license and public demo APIs. Add a README that
distinguishes scaffold from product. Create/check roots through `spur feature` and regenerate its
index. No new task batch: representative inputs and detailed slice design are still missing.

First implementation slice: one supported CSV import through a loopback-protected local server,
review/admission into a durable ledger, a possible-duplicate finding and a CLI evidence report.
Write failing E2E scenarios before changing domain code. Start by obtaining fixtures and designing
the contract/migration; do not start with model prompts, cloud provisioning or generic plugins.

Owner decisions still needed before dependent implementation:

| Decision | Planning baseline / why it matters |
|---|---|
| Initial formats/banks and shareable samples | CSV then text PDF; select actual layouts and expected outputs, no claimed bank support yet |
| Remote provider, region, consent and spend cap | No egress by default; choose before a real statement is transmitted |
| First-release mode | Local single-user baseline; hosted/mailbox-first priority would change the roadmap and trust boundary |
| Raw-source retention and evidence tradeoff | User choice, with metadata-only implications disclosed; fix defaults during the first slice design |
| Commercial release | Validate price and cost; confirm entity/data-access arrangements, license provenance and intended distribution terms |

These decisions do not block the documentation/tree work. No external service was configured,
no data sent to a model, no package installed, and no production/deployment action was taken.

## 6. Sources and confidence

Sources inspected during this review. High confidence for directly observed repository state and
the limited API/documentation facts below; medium confidence for the recommended sequencing,
which is engineering judgment; customer demand, provider quality and economics remain unverified.

- **S1:** [SQLite floating-point documentation](https://www.sqlite.org/floatingpoint.html): REAL
  values are approximate; exact integer storage is the basis for the proposed money representation.
- **S2:** [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs):
  constrained output can still contain mistakes and refusals. [Data controls](https://developers.openai.com/api/docs/guides/your-data)
  describe provider processing/retention controls; local storage alone says nothing about model egress.
- **S3:** [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) and
  [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification):
  read access is restricted; determine applicable verification/assessment requirements before launch.
- **S4:** [Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments): distinguishes
  its MoR role from other Stripe products; no account eligibility or legal conclusion was established here.
- **S5:** [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): runtime
  resource ceilings exist; compatibility and workload fitness remain to be measured.
- **S6:** [Bun SQL](https://bun.sh/docs/runtime/sql): native SQL includes SQLite. The local DB
  implementation and passing tests independently establish the installed scaffold's use of that API.

No current competitor feature/pricing research was performed: unsupported comparisons were removed,
not replaced with guesses. No legal/tax determination or benchmark was performed.

## 7. Verification record

Baseline before edits: `bun run gate` passed; 72 tests, no failures; functions 100%, lines 98.27%;
27 pre-check and 2 post-check rules passed. These are scaffold checks, not financial E2E evidence.

Final validation:

- `bun run gate`: PASS; format applied no changes; all workspace builds and typechecks passed;
  72 tests passed, 0 failed; functions 100%, lines 98.27%; 27 pre-check and 2 post-check rules passed.
- `spur feature refresh --all --json`: regenerated seven task regions and `docs/features/INDEX.md`.
- `spur feature check --json`: all seven roots have `pass: true`; each carries one
  `L4.orphan-scenarios` warning because this first-layer planning pass deliberately creates no linked
  implementation tasks. Strict feature validation would fail on those warnings; no claim of task
  coverage or implementation verification is made.
- Document assertions: 19 Markdown files inspected, 31 local links resolved, `00`–`05` frontmatter
  contracts checked, seven backlog roots and 28 numbered scenarios counted; zero assertion errors.
  Repeatable local result: `.spur/run/product-review/document-check.json` (ignored scratch evidence).
- `git diff --check`: PASS. Final changes are README, governing docs, the two refined incoming
  drafts, review record and tool-owned feature records/index. Source, dependencies, license,
  environment files, workflows and vendor content remain untouched.

No financial E2E test, live extraction, mailbox delivery, billing or browser product-flow test was
run: those capabilities are not implemented. Fixture acquisition remains the first delivery blocker,
not a blocker to this completed review/tree work.

## 8. Amendment (2026-11-05): Project Foundation

The owner added Z — Project Foundation as a supporting theme for shared engineering work;
the product capability roots A–G retain their boundaries. Z's five acceptance scenarios and
scope are recorded in the feature corpus, with membership, sequencing and status synchronized
in `01`, `02` and `05`.

The owner explicitly approved one direct creation of the Z record because the installed Spur
CLI cannot select a root ID. Subsequent edits and index regeneration use Spur. The tree now has
eight roots and 33 scenarios; all roots pass feature validation with the existing unlinked-task
warnings. The final project gate after adding Z passed all 72 tests, builds, typechecks and rules.
