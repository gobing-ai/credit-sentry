---
doc: 00_ADR
owns: WHY — cross-cutting decisions and their one-line reasons
authority: authoritative
version: 1.2.0
owner: Robin Min
updated_at: 2026-11-05
read_before: structural changes
edit_rules: 99 §6.1
sync: [T1, T2]
---

# 00 — Architecture Decision Record (Monorepo)

> **Status:** Accepted · **Date:** 2026-05-28 · **Scope:** project-wide, binding.
>
> This is the authoritative architecture decision record for the monorepo. `AGENTS.md` points here; changes that contradict a decision below must supersede it with a new dated entry, not diverge silently.

## Context

A Bun + TypeScript + Biome **full-stack monorepo** (Bun workspaces): a server, a web client, and a CLI client sharing typed API contracts. The design optimizes for end-to-end type safety without code generation, clear app/package boundaries, and one coherent build/test graph.

---

## ADR-001 — Turborepo + Bun-workspaces layout (orchestration superseded by ADR-006)

**Original decision.** Apps and packages are separated and orchestrated by Turborepo:

```
apps/
  server/   # Hono on Bun.serve — /health + /rpc
  web/      # Vite + React 19, oRPC client
  cli/      # Bun CLI, oRPC client
packages/
  api/      # oRPC contracts + types (single source of truth)
  config/   # zod-based configuration
  db/       # Bun native SQL data access
  utils/    # shared utilities + zod re-export
tooling/typescript/  # shared tsconfig presets (base/server/react)
```

Workspaces reference each other by scope `@credit-sentry/*` (the root `package.json` name).

**Original rationale.** `apps/*` are deployables, `packages/*` are shared libraries — the split keeps dependencies flowing one direction (apps depend on packages, never the reverse). Turbo originally cached and ordered workspace commands.

**Consequences.** New shared code is a `packages/*` workspace; new deployables are `apps/*`. Cross-cutting tsconfig lives once in `tooling/typescript` and is referenced, not copied.

## ADR-006 — Bun-native workspace orchestration supersedes Turbo

**Decision (2026-07-15).** Preserve the ADR-001 workspace topology, but remove Turbo and orchestrate workspace scripts with Bun's dependency-aware `--filter`. Root `dev` and `build` use `--if-present` because those scripts are intentionally optional across packages.

**Rationale.** The scaffold does not need a second task runner or remote cache. Bun already provides the required workspace selection and dependency ordering, which reduces generated-project dependencies and configuration.

**Consequences.** Generated monorepos contain no active Turbo dependency, configuration, cache cleanup, or operational guidance; this ADR retains the superseded decision as history. The root continues to pin `packageManager: bun@1.3.14`; workspace scripts remain the source of truth for each package's build and test behavior.

---

## ADR-002 — oRPC contracts as the single source of truth for end-to-end type safety

**Decision.** API shapes are defined as **oRPC contracts** in `packages/api/src/contracts/*` (zod schemas + `oc.input/.output`). The server *implements* them via `implement(planetContract)`; web and CLI clients *consume* only the contract **types** through a typed `ContractRouterClient`.

**Rationale.** A shared contract package gives compile-time-verified type safety from server to every client with **no code generation step** — change a schema and every consumer's types update. Clients import contract types only, never server internals, so the server can refactor freely behind the contract.

**Consequences.** The contract package is the API's authority: every endpoint is added there first, then implemented server-side. Clients must never reach into `apps/server`. zod flows through `packages/utils` so contracts and validation share one copy.

---

## ADR-003 — Hono on `Bun.serve` for the server transport

**Decision.** The server (`apps/server`) is **Hono** mounted on `Bun.serve`. `/health` is a vanilla Hono route; all RPC is served under `/rpc/*` by oRPC's `RPCHandler` bridged into Hono middleware.

**Rationale.** A handful of clients and a contract-driven RPC surface need a real router and middleware pipeline (unlike the single-route `app` mode). Hono is `fetch`-native, fast on Bun, and composes cleanly with the oRPC fetch handler. Routing oRPC under a prefix keeps RPC and plain HTTP (health, future webhooks) side by side.

**Consequences.** `ORPCError` (e.g. `NOT_FOUND`) is part of the contract — it maps to status codes clients discriminate on, so handlers throw typed `ORPCError`, never a generic `Error`. The error interceptor logs only unexpected errors, never deliberate `ORPCError`s.

---

## ADR-004 — Per-client env access; `@credit-sentry/*` aliases as the boundary

**Decision.** The web and CLI oRPC clients are deliberate twins (`apps/web/src/orpc.ts`, `apps/cli/src/orpc.ts`) that differ only in env access: web uses Vite's build-time `import.meta.env.VITE_API_URL`; the CLI reads `API_URL` at run time through the ADR-007 env gateway (both default to `http://localhost:3000/rpc`). All cross-package imports use `@credit-sentry/*` aliases.

**Rationale.** Vite and Bun expose configuration through different mechanisms (build-time vs run-time); forcing them into one shared module would leak one runtime's assumptions into the other. Keeping them as parallel files makes the single real difference explicit. Aliases keep package boundaries refactor-safe.

**Consequences.** A change to client-construction logic must be mirrored in both twins. Default dev ports: server `3000`, web `5173`. Config per app lives in its `.env.example`.

---

## ADR-005 — In-memory stores with a test-only reset; Bun-native SQL ready to swap

**Decision.** Demo procedures use an in-memory array (`packages/api` planet store) exposing a test-only `_resetPlanets()`. Real data access is provided as a Bun-native `SQL` pattern in `packages/db` (lazy connection, parameterized queries), ready to back the procedures.

**Rationale.** In-memory keeps the starter runnable with zero infrastructure while demonstrating the full contract→procedure→client flow. The explicit reset lets suites run order-independently (`beforeEach`), never relying on file ordering. `packages/db` shows the sanctioned zero-dependency, injection-safe data pattern for the production swap.

**Consequences.** Swapping the in-memory store for `packages/db` is the expected production step. Any server store must expose a reset and use it in `beforeEach`. No ORM/migration tooling is prescribed; adopting one is a new ADR.

---

## ADR-007 — Process env is read through one gateway in `packages/utils`

**Decision (2026-11-05).** All process-env access goes through `getEnvVar` / `getEnvVars` in `packages/utils/src/env.ts`, re-exported by `@credit-sentry/config` as the app-side funnel. No other file touches `process.env` or `Bun.env`; the local spur rule `.spur/rules/boundary/env-var-hygiene.yaml` enforces it with that one file exempt. Amends ADR-004 (the CLI still reads env at run time, now through the gateway).

**Rationale.** One choke point makes env inputs auditable and test-injectable. It lives in `utils`, the base package, because `config` depends on `utils` — a gateway in `config` would force a cycle for the logger. The global spur rule assumes `@gobing-ai/ts-utils` supplies the gateway, which this repo does not depend on.

**Consequences.** New env reads call the gateway or take an injected `env` record. Vite `import.meta.env` in `apps/web` is a separate build-time plane and unaffected.

---

## Decisions deliberately deferred

- **Auth / sessions** — none; an auth boundary is a future ADR (likely server middleware + a contract convention).
- **Persistence / migrations** — `packages/db` shows the pattern; the actual DB and migration tooling are deferred to the consuming project.
- **Deployment topology** — apps are independently deployable; orchestration is out of scope here.

**Amendment (2026-11-05).** ADR-008–010 below specialize the starter for CreditSentry; historical
demo decisions describe the scaffold, not delivered financial capabilities. ADR-006's Bun pin is
historical: `.prototools` and `package.json` currently pin 1.4.4. Persistence planning is now covered
by ADR-010; hosted auth and deployment remain deferred.

## ADR-008: Local single-user workflow before hosted automation

**Status:** Accepted (design) · **Date:** 2026-11-05

**Decision.** Develop a local, single-user statement-auditing workflow within the existing Bun
workspaces. Keep Workers/D1, SaaS billing, mailbox polling and third-party plugin loading deferred.

**Why.** Import-to-report correctness must be demonstrated before adding unattended or multi-user operation.

**Detail:** `01_PRD` §2; `03_ARCHITECTURE` §2; `02_ROADMAP`.

## ADR-009: AI proposes data; validated records and deterministic rules govern findings

**Status:** Accepted (design) · **Date:** 2026-11-05

**Decision.** Treat extracted/model-generated data as untrusted candidates; validate and review
before ledger admission. Require explicit remote-processing consent and evidence-backed,
deterministic anomaly findings. No autonomous financial actions or zero-knowledge claim.

**Why.** A plausible extraction or explanation is insufficient evidence for a financial finding.

**Detail:** `03_ARCHITECTURE` §3–5; `04_DESIGN` §2.

## ADR-010: Exact money and source provenance in the existing database boundary

**Status:** Accepted (design) · **Date:** 2026-11-05

**Decision.** Extend `packages/db` using its existing Bun SQL/SQLite pattern with versioned
migrations, exact minor-unit amounts, account-scoped identity and source provenance. Keep financial
domain behavior server-owned and API schemas in `packages/api`; do not add parallel core/parser
packages or a new DB abstraction now. Specializes ADR-005; its demo remains until replaced by a
tested vertical slice.

**Why.** Reusing the existing boundaries avoids a second architecture while preserving auditable records.

**Detail:** `03_ARCHITECTURE` §2–4; `04_DESIGN` §2.

## ADR-011: Explicit local capability for financial RPC

**Status:** Accepted (design) · **Date:** 2026-11-05

**Decision.** Bind the local server to loopback by default. Enable financial operations only with
an explicitly configured local token and file-backed database; authorize each financial RPC with
that capability and reject browser-origin requests and non-loopback Host values. Preserve the
existing demo contract. No remote identity or hosted tenant boundary is introduced.

**Why.** A local financial service must reject unauthorized requests before opening sensitive storage.

**Detail:** `03_ARCHITECTURE` §5; `04_DESIGN` §4.
