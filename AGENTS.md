# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` and `GEMINI.md` symlink here.

## Project

Bun + TypeScript + Biome monorepo (Bun workspaces). Layout:

```
apps/
  server/       # Hono on Bun.serve, exposes /health + /rpc (oRPC over Hono)
  web/          # Vite + React 19, oRPC client
  cli/          # Bun CLI, oRPC client
packages/
  api/          # shared oRPC contracts + types (planet schema)
  config/       # zod-based configuration
  db/           # Bun native SQL data access
  utils/        # shared utilities + zod re-export
tooling/
  typescript/   # shared tsconfig presets (base/server/react)
```

Workspaces reference each other by the project scope `@credit-sentry/*` (the root `package.json` name).

- **Runtime / package manager / test runner:** Bun `1.3.14`. Prefer `bun:*` APIs over `node:*` unless Bun lacks the API.
- **Lint + format:** Biome `2.4.16`. No ESLint, no Prettier.
- **Build orchestration:** dependency-aware Bun `--filter` workspace commands.
- **Tool versions:** pinned in `.prototools` via [proto](https://moonrepo.dev/proto). Run `proto use` to install.
- **Git hooks:** Lefthook. **Conventional commits:** cocogitto (`cog`).

Never introduce a new runtime, package manager, linter, or formatter.

## Documentation map

Each doc owns exactly **one question** about the system and is the single source of truth for it.
A fact lives in **one** doc; other docs link to it, never restate it. Read the doc that governs
your change before editing code; edit the **authoritative** doc for the topic, never patch a
symptom in a derived one.

**Conflict rule:** lower number wins. `00_ADR` is binding and overrides all others on *decisions*;
`01_PRD` is authoritative on *scope*. On conflict, fix the authoritative doc and flag the drift.
`docs/99_PROJECT_CONSTITUTION.md` is authoritative on *process* — how these files are
maintained (edit rules, sync triggers, drift audits, writing rules). It holds no project content,
so the two axes never collide. Read it before editing any doc below. Each numbered doc carries
its contract as YAML frontmatter (constitution §4.3).

| Doc | Owns the question | Authority | Read / edit when |
|-----|-------------------|-----------|------------------|
| `docs/00_ADR.md` | **WHY** — which cross-cutting decision was made, and the one-line reason | **Authoritative** (wins all) | Read before any structural change; add a dated entry before diverging from a decision |
| `docs/01_PRD.md` | **WHAT** — product vision, users, scope (in / out / deferred) | **Authoritative on scope** | Read before adding a command/feature; edit when scope changes |
| `docs/02_ROADMAP.md` | **WHEN** — phases, current vs deferred, sequencing | Derived | Read to place work in a phase; edit when phase status changes |
| `docs/03_ARCHITECTURE.md` | **HOW** — module boundaries, data flow, runtime model, invariants, the *rationale* behind a decision | Derived (ADR wins) | Read before cross-module/seam/schema work; edit when boundaries or mechanisms change |
| `docs/04_DESIGN.md` | **SURFACE** — concrete shapes: every CLI command, flag, config key, env var, table, DTO | Derived | Read/edit when changing a command, flag, env var, or schema |
| `docs/05_FEATURES.md` | **STATUS** — feature decomposition + state (✅ done / 🔶 partial / ⏳ planned / 💤 deferred) | Derived | Read to find a feature's state; edit when a feature's status changes |
| `docs/99_PROJECT_CONSTITUTION.md` | **PROCESS** — how the files above are maintained: edit rules, same-commit sync triggers, drift audits, lessons | **Authoritative on process** | Read before editing any doc above; lessons machine-appendable per its §8 |
| `AGENTS.md` (this file) | **ENTRY** — stack, commands, gates, conventions + this doc map | Derived (from 99 + 00/01/04) | Read first every session; factual blocks regenerated from code, never from memory |

**Routing — put each fact in its owning doc, link from the rest:**

- Decision + one-line reason → `00`. Rationale/consequences in depth → `03`.
- Scope (in/out/deferred) → `01`. Mechanism / data flow / invariants → `03`.
- Command/flag/config/schema/DTO shapes → `04`. Phase timing → `02`. Feature status → `05`.
- If you're writing *how it's built* or *why* inside `00`/`01`/`02`, it belongs in `03`/`04`.

A code change that contradicts `00_ADR.md` requires adding a new dated ADR entry that supersedes the
old one **first** — never silently diverge. Any new cross-cutting choice (new app/package, transport
swap, auth boundary, DB swap) gets a new ADR entry pointing to its `03`/`04` detail. A change that
touches a command/config/schema keeps `04_DESIGN.md` in sync in the **same commit**.

## Code style (enforced by `biome.json`)

- 4-space indent, `lineWidth` 120.
- **Single quotes**, semicolons always, trailing commas everywhere.
- `interface` for object shapes, `type` for unions/intersections.
- Imports/exports are auto-sorted by Biome — don't hand-order them.
- `any` is an **error** (`noExplicitAny`). Narrow the type; if unavoidable, justify with `// biome-ignore`.
- TS source imports use extensionless relative specifiers. Library builds patch emitted `dist/*.js` after `tsc`.
- Workspace imports: always use the `@credit-sentry/*` alias, never deep relative paths into a sibling package.

## Commands

```bash
bun run lint       # biome check + Bun workspace typecheck  (the gate)
bun run format     # biome check --write                (autofix)
bun run autofix    # format then workspace typecheck
bun run test       # one bun test run over apps + packages (writes .coverage/lcov.info)
bun run spur-check # lint + spur pre-check rules + test + coverage/TSDoc post-check
bun run gate       # final gate: format, build, then spur-check
bun run build      # build server, web, and cli workspaces
bun run dev        # run available app dev scripts
```

Default dev ports: server `3000`, web `5173`. The web client reads `VITE_API_URL` (falls back to `http://localhost:3000/rpc`); the CLI reads `API_URL`. See each app's `.env.example`.

CLI binary: `apps/cli` exposes `bin: { cli: "./src/index.ts" }` — the `.ts` entry runs only under Bun. To ship for Node consumers, repoint `bin` to `./dist/index.js` and run `bun run build` before publishing.

## Verification gate (all must pass before "done")

`bun run gate` runs the whole gate in one command (format → build → spur-check). It covers steps 1–3 below plus the spur pre/post-check rules.

1. `bun run lint` clean — Biome and Bun workspace typecheck.
2. `bun run test` passes; no test skipped, `.skip`'d, or commented out to go green.
3. `bun run build` succeeds across all workspaces with a `build` script.
4. `git status` shows only intentional changes.

If a check fails, fix the root cause. **Never** bypass with `--no-verify`, `--force`, or new `biome-ignore` suppressions added solely to silence the gate.

## Testing

- Tests live in `tests/` next to the code (`<workspace>/tests/*.test.ts`), using `bun:test`.
- Coverage target is **line >= 90% and function >= 90% in aggregate** (`coverageThreshold` in `bunfig.toml`).
- Names describe behavior under a condition; assertions tie to the requirement, not the implementation.
- Server in-memory stores must expose a test-only reset (e.g. `_resetPlanets()`) and reset in `beforeEach` — never rely on test-file ordering.

## oRPC conventions

- Contracts live in `packages/api/src/contracts/*` and are the single source of truth.
- Server procedures (`apps/server/src/procedures/*`) implement contracts via `implement(planetContract)`.
- Throw `ORPCError('NOT_FOUND', { message })` etc. for typed errors — never generic `Error` (status codes and client discrimination rely on it).
- Clients (`apps/web`, `apps/cli`) consume only the contract types; never reach into server internals.

## Architecture decision record (binding)

`docs/00_ADR.md` is the **authoritative architecture decision record** for this project. It captures the decisions that define the monorepo's shape — the Bun-workspaces layout, the `apps/{server,web,cli}` ⁄ `packages/{api,config,db,utils}` split, oRPC contracts in `packages/api` as the single source of truth for end-to-end type safety, Hono on `Bun.serve` for the server, and the `@credit-sentry/*` workspace-alias boundary. Treat it as a constraint, not a suggestion:

- Read it before any non-trivial change to the workspace graph, the oRPC contract layer, the server transport, or cross-package boundaries.
- Changes that contradict a recorded decision require updating the ADR first (add a new dated entry that supersedes the old one) — never silently diverge.
- New cross-cutting architectural choices (a new app or package, a different RPC/transport layer, a real DB swap, an auth boundary) get a new ADR entry in the same file.

## Conventions & boundaries

- Conventional Commits required (`feat:`, `fix:`, `docs:`, `chore:`, ...). Breaking changes go in a `BREAKING CHANGE:` footer.
- Cross-workspace imports use `@credit-sentry/<pkg>` (workspace aliases), never `../../../packages/...`.
- Read process env only via `getEnvVar` / `getEnvVars` (`@credit-sentry/utils` or `@credit-sentry/config`); never `process.env` directly (ADR-007).
- `vendors/` is reference-only — **never modify** files there.
- Never commit secrets, `.env*`, or credentials. Never edit `.github/workflows/` without approval.
- Surgical changes only: touch what the task needs; no drive-by refactors, no speculative abstractions, no comments that restate what the code already says.
